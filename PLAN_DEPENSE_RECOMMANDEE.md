# Plan — Dépense de retraite recommandée

> Conception détaillée, **avant toute ligne de code**. Les quatre décisions structurantes ont été
> arbitrées en entretien ; elles sont rappelées ci-dessous avec leur justification.

---

## Le problème

Les étapes « Décaissement » (solo) et « Dépenses du ménage » (couple) demandent un montant annuel
net d'impôt. **L'utilisateur doit le deviner.** C'est pourtant la donnée qui commande tout le
verdict : entrez 45 000 $ et tout va bien, entrez 65 000 $ et le capital s'épuise à 79 ans.

Or l'application connaît déjà le capital, les rentes, l'horizon et la fiscalité. Elle peut calculer
ce montant au lieu de le demander.

---

## Les quatre décisions arbitrées

| # | Question | Décision | Pourquoi |
|---|---|---|---|
| 1 | Les 85-90 % s'appliquent à quoi ? | **Au maximum soutenable** | Exploite les chiffres réels de l'utilisateur, pas une règle de pouce sur le revenu d'avant-retraite |
| 2 | Le coussin protège de quoi ? | **De rien en particulier** : abattement forfaitaire assumé | Honnête. Le vrai traitement du risque de marché est la Phase 6 (Monte Carlo) |
| 3 | Calculé sur quelle stratégie ? | **La stratégie actuelle**, telle que saisie | Le montant doit être cohérent avec le verdict affiché. Recommander un montant issu de la stratégie optimisée ferait virer la carte au rouge dès qu'on le saisit |
| 4 | Le pourcentage | **85 % par défaut, réglable en mode Avancé** | Même traitement que l'inflation et les frais de gestion, déjà préréglés et modifiables |

---

## L'algorithme

### Ce que « soutenable » veut dire

Rien à inventer : le moteur le définit déjà. Une cible est soutenable quand `suffisant === true`,
c'est-à-dire que `ageEpuisement` reste `null` — la cible a été financée **chaque année** jusqu'à
l'âge de décès saisi.

Deux conséquences qu'il faut assumer telles quelles :

- **Un bien immobilier sans âge de vente n'est jamais consommé.** Le maximum est donc borné par les
  comptes liquides, et la maison va à la succession. C'est déjà le comportement du solveur.
- **Le paiement hypothécaire s'ajoute par-dessus la cible** (`cible = depenses × inflation +
  immo.paiement`, [projection.ts:485](src/moteur/projection/projection.ts#L485)). Le montant
  recommandé est donc un budget de vie **hors versements hypothécaires**. L'interface doit le dire.

### Recherche par dichotomie

La soutenabilité est décroissante en fonction des dépenses. **Vérifié empiriquement**, par balayage
fin sur un dossier réaliste (pas de 250 $ en solo, 500 $ en couple, de 0 à 120 000 / 160 000 $) :
aucun cas de re-succès après un premier échec, dans les deux modes. La dichotomie est donc valide.

La vérification n'est pas une preuve — le moteur est fiscalement non linéaire — d'où deux garde-fous :
un **test de monotonie** dans la suite, et une **revérification finale** du montant retourné.

```
1. Amorçage    : borne basse = 0
                 borne haute = 20 000 $, doublée jusqu'à l'échec (plafond de sécurité)
2. Dichotomie  : ~12 itérations jusqu'à une précision de 250 $
3. Arrondi     : vers le BAS, au 100 $ — le montant affiché doit être réellement soutenable
4. Vérification: si le montant retourné échoue, on redescend d'un cran
```

**Coût mesuré sur l'implémentation réelle** (lot A) :

| Mode | Projections | Temps |
|---|---|---|
| Solo | 13 | **11,6 ms** |
| Couple | 15 | **54,9 ms** |

L'estimation initiale (~19 ms solo, ~40 ms couple) était optimiste côté couple : une projection de
couple coûte 3,7 ms, pas 1,9. Reste très en deçà de l'optimiseur (320 ms), donc l'affichage continu
tient — à condition de mémoïser en excluant `depensesRetraite`, sans quoi on paierait 55 ms à chaque
frappe dans le champ pour un résultat identique.

Contrôle croisé : la dichotomie retrouve exactement le maximum obtenu par balayage exhaustif
(49 500 $ en solo).

### Signature proposée

Générique sur solo / couple, comme la fonction `descente` de l'optimiseur :

```ts
/**
 * Plus grande dépense annuelle (en $ d'aujourd'hui) que la stratégie finance jusqu'au décès.
 * Retourne 0 si même une dépense nulle n'est pas finançable (hypothèque impayable).
 */
export function depenseMaximale<H>(
  h: H,
  poserDepense: (h: H, montant: number) => H,
  evaluer: (h: H) => { suffisant: boolean },
  options?: { precision?: number; plafond?: number },
): number;

/** Montant recommandé : la fraction du maximum qu'on accepte de consommer. */
export function depenseRecommandee(maximum: number, fraction = 0.85): number;
```

**Note de vocabulaire.** Le paramètre est la **fraction consommée** (0,85), pas la marge retenue
(0,15). Une première version de ce document disait « marge de prudence : 85 % », ce qui était
contradictoire — une marge de 85 % voudrait dire qu'on garde 85 % et qu'on en dépense 15. Le champ
d'interface s'appellera donc **« Part du maximum consommée »**.

Fonctions **pures**, dans `src/moteur/projection/`, testables sans interface — comme tout le reste du
moteur.

---

## Cas limites

| Situation | Comportement |
|---|---|
| Dossier vierge (aucun compte, aucune rente) | Aucune suggestion affichée. On reprend le drapeau `evaluable` déjà utilisé par le verdict |
| Maximum = 0 | On affiche une phrase, pas « 0 $ » : « même sans aucune dépense, le capital ne couvre pas les versements hypothécaires » |
| Capital très élevé | L'amorçage par doublement trouve la borne haute en quelques itérations |
| Déjà à la retraite | Aucun cas particulier : la dichotomie porte sur les mêmes années |
| Revenu de travail à la retraite, héritages | Inclus automatiquement, ce sont des entrées du moteur |

---

## Interface

### Emplacement

Sous le champ existant, dans l'étape « Décaissement » (solo) et « Dépenses du ménage » (couple) :

```
Dépenses de retraite (net d'impôt)
┌────────────────────────┐
│               60 000 $ │
└────────────────────────┘
Votre capital soutient jusqu'à 68 400 $ par an.
Recommandé : 58 100 $   [ Utiliser ]
             85 % du maximum, par prudence
```

En mode **Avancé**, un champ « Part du maximum consommée » à côté de l'inflation et des frais de
gestion.

### Trois règles de comportement

1. **Rien n'est jamais écrit sans un clic.** Le bouton « Utiliser » remplit le champ ; la suggestion
   seule ne touche à rien.
2. **La suggestion ne bouge pas quand on tape dans le champ.** Le maximum soutenable ne dépend pas
   de la valeur saisie — on cherche justement sur cette variable. Conséquence d'implémentation : le
   `useMemo` doit exclure `depensesRetraite` de ses dépendances, sinon on recalcule pour rien à
   chaque frappe.
3. **Le patrimoine immobilisé est signalé.** Si un bien n'a pas d'âge de vente, une ligne le dit :
   « un bien de 420 000 $ n'est jamais vendu ; planifier une vente augmenterait ce montant ». C'est
   la même explication que celle déjà présente dans le verdict, et c'est ce qui évite qu'un
   utilisateur trouve la recommandation absurdement basse.

Ce dernier point n'est pas cosmétique. Sur le dossier d'essai — 650 000 $ de comptes **et** une
maison de 420 000 $ jamais vendue — le maximum soutenable tombe à **49 500 $**. Sans explication,
le chiffre paraît faux.

### Couple

Même mécanisme sur le champ du ménage. La fraction du survivant s'applique automatiquement, puisque
la dichotomie porte sur `depensesRetraite` et que le moteur en dérive les dépenses du survivant.
Maximum d'essai mesuré : **95 500 $** pour le ménage.

---

## Tests

| # | Propriété | Pourquoi |
|---|---|---|
| 1 | **Monotonie** : balayage fin, aucun re-succès après un échec | Fondement de la dichotomie |
| 2 | **Exactitude** : à `depenseMaximale`, `suffisant` est vrai ; à +250 $, faux | Le montant est bien le maximum |
| 3 | **Indépendance** : le résultat ne dépend pas de la valeur saisie dans `depensesRetraite` | Garantit la règle d'interface n° 2 |
| 4 | **Zéro** : sans capital ni rente, maximum = 0 | Cas dégénéré |
| 5 | **Hypothèque impayable** : maximum = 0 même avec des comptes | Le cas où « 0 $ » ne suffit pas |
| 6 | **Croissance** : plus de capital ⇒ maximum plus élevé | Invariant simple, difficile à casser par accident |
| 7 | **Fraction** : recommandation = 85 % du maximum, arrondie vers le bas | Pas de recommandation non soutenable |
| 8 | **Couple** : mêmes propriétés | Le mode couple a son propre solveur |

---

## Limites, à inscrire dans `ETAT_DU_PROJET.md`

- **Le maximum est déterministe.** Il suppose le rendement normé chaque année. Une mauvaise décennie
  en début de retraite le rendrait faux. Les 85 % sont une **convention de prudence**, pas une
  mesure de risque — le vrai traitement est le taux de réussite de la Phase 6.
- **Il dépend de l'âge de décès saisi.** Vivre plus vieux que prévu invalide le montant.
- **Il dépend de la stratégie actuelle.** L'optimiseur pourrait soutenir davantage.
- **Il exclut les versements hypothécaires**, ajoutés par-dessus par le moteur.
- **Un bien non vendu n'est jamais consommé** : la recommandation peut sembler basse alors que la
  succession est importante.

---

## Découpage

| Lot | Contenu | Vérifiable par |
|---|---|---|
| **A** | `depenseMaximale` + `depenseRecommandee`, fonctions pures | tests 1 à 7 |
| **B** | Suggestion et bouton « Utiliser » dans l'étape Décaissement (solo) | capture aux deux thèmes, audit de contraste |
| **C** | Même chose pour le ménage, plus le champ « Part consommée » en mode Avancé | test 8 |
| **D** | Mention du patrimoine immobilisé | dossier d'essai avec bien non vendu |

Le lot A ne touche que le moteur et se teste sans interface.
