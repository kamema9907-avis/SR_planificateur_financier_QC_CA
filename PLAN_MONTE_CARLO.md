# Plan — Phase 6 : projection probabiliste (Monte Carlo)

> Conception détaillée, **avant toute ligne de code**. Chaque décision est justifiée ; les points
> qui demandent votre arbitrage sont regroupés à la fin.

---

## Le problème

Le moteur fait croître chaque compte à un taux **fixe** issu des Normes IQPF 2026 : environ 5,1 %
brut pour un profil équilibré, tous les ans, sans exception.

C'est la pratique professionnelle, et c'est défendable. Mais un modèle sans mauvaise année ne peut
pas voir le phénomène qui ruine réellement les plans de retraite : le **risque de séquence**.

Deux retraités, même capital, même rendement **moyen** de 5 % sur 30 ans. Le premier connaît ses
mauvaises années à 85 ans, le second à 63 ans. Le premier finit riche, le second peut être ruiné :
vendre pour vivre pendant une baisse détruit du capital qui ne participera jamais à la reprise.

Le verdict actuel, « vos dépenses sont financées jusqu'à 95 ans », est vrai **dans un seul avenir** :
celui de la moyenne, c'est-à-dire précisément celui qui n'arrivera pas.

---

## Le principe directeur

**Le mode déterministe reste le mode par défaut, et son résultat ne doit pas bouger d'un cent.**

Tout ce qui suit est une couche *ajoutée*. Si aucune trajectoire de rendements n'est fournie, le
moteur se comporte exactement comme aujourd'hui, et les 252 cas-tests existants passent sans être
modifiés. C'est le garde-fou principal de toute la phase.

---

## Décisions de conception

### D1 — Où l'aléa entre dans le moteur

Deux points d'injection, et deux seulement :

| Fichier | Ligne | Appel |
|---|---|---|
| [`projection.ts`](src/moteur/projection/projection.ts) | 226-228 | `croissanceAnnuelle(c.solde, c.profil, frais, …)` |
| [`couple.ts`](src/moteur/projection/couple.ts) | 175 | idem |

On introduit une interface **`Trajectoire`** : pour une année et un profil donnés, elle rend le
rendement brut réalisé, ventilé comme aujourd'hui.

```ts
/** Rendements réalisés d'une simulation. Absente = mode déterministe. */
export interface Trajectoire {
  brut(annee: number, profil: ProfilRendement): ComposantesRendement;
}
```

Elle voyage dans l'objet d'options, à côté de `trace` :

```ts
projeter(h, { trace?: boolean; trajectoire?: Trajectoire })
```

`trajectoire` absente → `composantesRendementBrut(profil)`, le comportement actuel, inchangé.

**Pourquoi une interface et non un générateur aléatoire passé au moteur** : le moteur reste **pur**.
Il ne tire rien, il consomme des rendements qu'on lui donne. C'est ce qui rend les tests possibles :
on peut lui fournir une trajectoire de laboratoire (« −30 % la première année de retraite, puis
+6 % ») sans aucun hasard.

### D2 — Ce qui est aléatoire, et ce qui ne l'est pas

On ne tire pas un « rendement du portefeuille ». On tire un **choc par classe d'actif**, puis on
recompose exactement comme le fait `composantesRendementBrut` :

```
intérêt      = courtTerme × r_ct  +  revenuFixe × r_rf
dividendes   = actions × 2 %          ← rendement en dividendes, gardé stable
gain capital = actions × (r_act − 2 %)
```

**Pourquoi c'est important fiscalement** : une mauvaise année boursière frappe le **gain en capital**,
qui n'est imposé qu'à la réalisation, et non l'intérêt, imposé chaque année. Le revenu imposable
d'une mauvaise année n'est donc pas mécaniquement plus bas. Beaucoup d'outils commerciaux simulent le
portefeuille puis appliquent un taux d'impôt moyen ; ici, l'impôt fédéral et québécois complet est
recalculé chaque année, avec les tranches, la récupération de la PSV et le fractionnement optimal.
**C'est le vrai différenciateur de ce projet**, et il découle de la séparation moteur / interface.

Le rendement en dividendes reste stable (2 % de la portion actions) : le *prix* des actions est
volatil, le *taux de distribution* beaucoup moins.

### D3 — Un seul marché pour tout le ménage (contrainte critique)

Le tirage se fait **par année et par classe d'actif**, puis se partage entre :

- tous les comptes d'une personne,
- **les deux conjoints**,
- tous les profils (chacun ne fait que pondérer différemment les mêmes chocs).

Tirer indépendamment pour le REER de l'un et le CELI de l'autre créerait une **diversification
fictive** : les mauvaises années se compenseraient entre comptes et le taux de réussite serait
gonflé, peut-être de dix points ou plus. C'est l'erreur la plus facile à commettre et la plus
difficile à voir. Elle sera couverte par un test dédié (voir D9).

### D4 — Loi de tirage

**Log-normale** pour chaque classe d'actif. Les rendements ne peuvent pas descendre sous −100 %, et
une loi normale simple produit des valeurs absurdes en queue.

Un piège subtil mérite d'être écrit noir sur blanc : pour qu'une log-normale ait une **moyenne
arithmétique** égale à la norme IQPF `μ`, il faut tirer le logarithme avec une moyenne de

```
μ_log = ln(1 + μ) − σ² / 2
```

Utiliser `ln(1+μ)` directement abaisserait silencieusement le rendement moyen réalisé sous la norme,
et rendrait l'outil pessimiste sans que personne ne le remarque. Un test vérifiera la convergence
(voir D9).

*Variante envisagée et écartée pour la v1* : le **tirage par blocs dans l'historique réel**
(bootstrap). Il préserve l'enchaînement des mauvaises années et les queues épaisses, donc il capture
mieux le risque de séquence. Mais il exige d'embarquer une série historique et de justifier laquelle.
À garder pour une v2, une fois le reste éprouvé.

### D5 — Volatilités : le point de crédibilité

**Les Normes IQPF ne publient pas d'écarts-types.** Le fichier de constantes du projet contient des
rendements espérés, une inflation, un taux d'emprunt — aucune volatilité. Les choisir, c'est
**sortir des Normes**, sur lesquelles repose toute la crédibilité actuelle de l'outil.

Trois conséquences, non négociables :

1. Les valeurs vivent dans un fichier **séparé** de `iqpf2026.ts`, avec leur source.
2. L'interface **dit** que la partie probabiliste n'est pas normée.
3. Elles sont **réglables** en mode Avancé, pour qui veut tester sa propre hypothèse.

Valeurs proposées (écarts-types annuels, ordres de grandeur historiques long terme) :

| Classe d'actif | σ proposé | Remarque |
|---|---|---|
| Court terme | 1,5 % | quasi certain |
| Revenu fixe | 5,5 % | obligations univers |
| Actions | 16 % | portefeuille mondial diversifié |

Corrélation actions / obligations : **0** en v1. Historiquement proche de zéro sur longue période,
elle a été franchement positive depuis 2022. La modéliser demanderait une décomposition de Cholesky
pour un gain discutable ; à documenter comme simplification.

**Ces trois chiffres demandent votre validation** (voir Questions ouvertes).

### D6 — Reproductibilité

Générateur pseudo-aléatoire déterministe (type *mulberry32*, une vingtaine de lignes, testable), semé
par une **constante fixe**.

- **Pas** de graine tirée de l'horloge : le taux de réussite changerait à chaque calcul.
- **Pas** de graine dérivée du dossier : une modification d'un dollar ferait sauter le résultat de
  façon imprévisible, ce qui est pire que tout pour la confiance.

Graine fixe ⇒ deux stratégies comparées voient **les mêmes tirages**. C'est la technique des
*nombres aléatoires communs*, et elle est indispensable : sans elle, l'écart mesuré entre deux
stratégies serait surtout du bruit. Elle profitera aussi au panneau de scénarios A/B/C existant.

### D7 — Ce qui reste déterministe, et pourquoi

| Élément | Décision v1 | Raison |
|---|---|---|
| **Inflation** | fixe (norme IQPF) | Elle indexe les tranches d'impôt, la RRQ, la SV et les dépenses. La rendre aléatoire ferait tout bouger à la fois et rendrait le résultat illisible. Vraie limite, à documenter. |
| **Immobilier** | fixe (appréciation saisie) | Autre classe d'actif, autre risque, valeur saisie à la main par l'utilisateur. |
| **Longévité** | fixe (âge de décès saisi) | Décision importante : voir ci-dessous. |

Sur la longévité : garder l'âge de décès fixe donne au taux de réussite un sens **clair et
conservateur** — « **si** je vis jusqu'à 95 ans, mon plan tient dans 87 % des scénarios de marché ».
Ajouter une mortalité aléatoire ferait mécaniquement monter le taux (mourir tôt « réussit ») et
mélangerait deux risques de nature différente dans un seul chiffre. L'interface devra énoncer
explicitement ce conditionnement.

### D8 — Nombre de tirages et honnêteté du chiffre

L'erreur type sur un taux de réussite `p` vaut `√(p(1−p)/N)` :

| N | Erreur type à p ≈ 85 % | Coût mesuré (solo) |
|---|---|---|
| 200 | ± 2,5 pts | ~0,19 s |
| **1 000** | **± 1,1 pt** | **~0,94 s** |
| 2 000 | ± 0,8 pt | ~1,9 s |

**1 000 tirages** par défaut. Et puisque la précision est de l'ordre du point, l'affichage sera
**arrondi à 5 %** (« environ 85 % ») plutôt qu'à l'unité. Afficher « 87,3 % » donnerait une
impression de rigueur que le modèle ne mérite pas — d'autant que le chiffre dépend surtout des
volatilités choisies en D5.

### D9 — Comment on teste de l'aléatoire

Six familles de tests, dont la première est la plus importante :

1. **Non-régression** : sans trajectoire, `projeter` rend un résultat **identique** à aujourd'hui.
2. **σ = 0 ⇒ déterministe** : une simulation à volatilité nulle doit égaler le mode déterministe au
   cent près. Test le plus révélateur de toute la phase.
3. **Reproductibilité** : même graine ⇒ résultat identique au bit près.
4. **Convergence de la moyenne** : sur beaucoup de tirages, le rendement réalisé moyen tend vers la
   norme IQPF. C'est ce test qui attrape l'erreur de `μ_log` (D4).
5. **Marché partagé** : dans une même année, deux comptes de même profil, chez les deux conjoints,
   reçoivent le **même** rendement (D3).
6. **Monotonie** : à dépenses plus élevées, taux de réussite plus bas ; à capital plus élevé, taux
   plus haut. Propriétés invariantes, faciles à vérifier, difficiles à casser par accident.

Plus un test de laboratoire sur le risque de séquence : deux trajectoires de **même moyenne**, l'une
avec ses mauvaises années au début de la retraite, l'autre à la fin, doivent donner des résultats
franchement différents. Si ce test passe, le modèle capture bien le phénomène qui justifie toute la
phase.

### D10 — Agrégation et mémoire

On ne conserve pas 1 000 projections complètes. Pour chaque tirage on retient :

- un booléen « dépenses financées jusqu'au décès »,
- l'âge d'épuisement (ou `null`),
- la valeur nette réelle au décès,
- la valeur nette de chaque année, dans un `Float64Array` (1 000 × 55 ≈ 440 Ko, sans problème).

De quoi calculer le taux de réussite, les percentiles p10 / p50 / p90 année par année, et la
distribution des âges d'épuisement. **La trace détaillée reste désactivée** pendant les simulations :
elle coûte 34 % de temps en plus et exploserait la mémoire.

### D11 — Exécution

Le **Web Worker existe déjà** depuis le lot 4, avec annulation et repli synchrone. On étend son
protocole plutôt que d'en créer un second :

```ts
type Demande =
  | { id: number; type: 'optimiser'; mode: 'solo' | 'couple'; hypotheses: unknown }
  | { id: number; type: 'simuler';  mode: 'solo' | 'couple'; hypotheses: unknown; tirages: number };
```

Le worker émettra une **progression** tous les 50 tirages, pour une barre honnête plutôt qu'un
sablier. Comme l'optimiseur, la simulation se lance **sur demande** — jamais à chaque frappe : une
seconde de calcul à chaque touche viderait la batterie d'un téléphone pour rien.

### D12 — L'optimiseur reste déterministe

Faire du Monte Carlo **à l'intérieur** de la boucle d'optimisation coûterait plusieurs minutes pour
un gain douteux. L'architecture retenue :

1. l'optimiseur cherche comme aujourd'hui, dans l'avenir moyen ;
2. on **teste** ensuite sa réponse : Monte Carlo sur la stratégie actuelle **et** sur la stratégie
   optimisée, **sur les mêmes tirages**.

Coût : deux fois 0,94 s. On peut alors afficher une phrase qui n'existe nulle part ailleurs :
« cette stratégie rapporte 40 000 $ de plus en moyenne, **et** fait passer le taux de réussite de
81 % à 88 % » — ou, tout aussi utile, révéler qu'elle gagne du patrimoine espéré **en échange** de
robustesse.

### D13 — Dépense soutenable à 90 %

La question la plus utile n'est pas « mes 60 000 $ tiennent-ils ? » mais « **combien puis-je dépenser
pour avoir 90 % de chances de tenir ?** ».

Le taux de réussite est décroissant en fonction des dépenses : une **recherche par dichotomie**
suffit. Pour tenir le temps de calcul :

- 8 itérations à 200 tirages (précision suffisante pour cadrer le montant) : ~1,5 s ;
- une confirmation finale à 1 000 tirages : ~0,9 s.

Soit **environ 2,5 secondes**, dans le worker, avec progression.

---

## Découpage en lots

| Lot | Contenu | Vérifiable par |
|---|---|---|
| **6.0** | `Trajectoire` dans les options de `projeter` / `projeterCouple`, chemin déterministe inchangé | les 252 tests actuels, sans modification |
| **6.1** | Générateur semé, volatilités, tirage log-normal, marché partagé | tests D9 (1 à 5) |
| **6.2** | Agrégation : taux de réussite, percentiles, distribution d'épuisement | test de séquence, monotonie |
| **6.3** | Worker étendu, progression, annulation | mesure du temps réel, interface qui ne gèle pas |
| **6.4** | Verdict probabiliste + éventail p10/p50/p90 sur le graphique existant | captures aux deux thèmes, audit de contraste |
| **6.5** | Dépense soutenable à 90 % + test de robustesse de l'optimiseur | comparaison sur tirages communs |

Les lots 6.0 à 6.2 ne touchent **que** le moteur et sont entièrement testables sans interface.

---

## Ce que ça ne fera pas

À écrire dans la section « Limites » de `ETAT_DU_PROJET.md` le jour où c'est livré :

- **L'inflation reste normée.** Le risque inflationniste, réel pour un retraité, n'est pas modélisé.
- **Les volatilités ne viennent pas des Normes IQPF.** Elles sont un ajout documenté et réglable.
- **Corrélations ignorées** entre classes d'actifs.
- **Loi log-normale**, qui reste plus douce que la réalité en queue de distribution (krachs).
- **Longévité fixe** : le taux de réussite est conditionnel à l'âge de décès saisi.
- **Le taux de réussite n'est pas une probabilité du monde réel**, c'est la fréquence de succès dans
  un modèle. Le dire ainsi dans l'interface.

---

## Questions ouvertes — votre arbitrage

1. **Les trois volatilités (D5)** : 1,5 % / 5,5 % / 16 % vous paraissent-elles défendables, ou
   préférez-vous d'autres valeurs ? C'est le paramètre qui détermine tous les chiffres affichés.
2. **Réglables ou figées ?** Les exposer en mode Avancé rend l'outil honnête, mais invite à
   bricoler jusqu'à obtenir le taux de réussite qui plaît. Mon avis : les exposer, avec un bouton de
   retour aux valeurs par défaut.
3. **Le verdict par défaut** reste-t-il déterministe, la simulation étant lancée par un bouton
   (comme l'optimiseur) ? Mon avis : oui, pour le coût de calcul et parce que le mode déterministe
   reste la référence professionnelle.
4. **La longévité (D7)** : d'accord pour la garder fixe et énoncer le conditionnement ?
5. **Priorité** : préférez-vous la **dépense soutenable à 90 %** (lot 6.5) avant l'éventail de
   trajectoires (lot 6.4) ? C'est la sortie la plus utile en pratique, mais la moins spectaculaire.
