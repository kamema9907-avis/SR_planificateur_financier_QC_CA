# Correctif — expliquer la colonne « Dépenses »

> Signalé par l'utilisateur : dans « Détail année par année », « Revenus nets » est cliquable et
> explique ses chiffres, « Dépenses » ne dit rien. On ne comprend pas d'où sort le montant.

---

## Le défaut, précisément

La colonne affiche `cible`, produit de **quatre facteurs dont trois sont invisibles** :

```
cible = depensesRetraite × fractionSurvivant × facteurInflation + paiementImmo
```

Sources : [`projection.ts:485`](src/moteur/projection/projection.ts#L485) (solo),
[`couple.ts:646`](src/moteur/projection/couple.ts#L646) (à deux),
[`couple.ts:849`](src/moteur/projection/couple.ts#L849) (survivant).

Trois surprises que rien n'explique à l'écran :

1. le nombre **grossit chaque année** — c'est l'inflation cumulée ;
2. il **chute d'un tiers** au premier décès — c'est la part du survivant ;
3. il **dépasse la cible saisie** — c'est le versement hypothécaire ajouté par-dessus.

Une incohérence de présentation aggrave le tout : **en accumulation** le versement hypothécaire est
une ligne de sortie distincte ; **en décaissement** il disparaît des sorties et se fond dans
« Dépenses ». Le même dollar change de place selon l'année.

Et depuis la livraison de la dépense recommandée, l'écart saute aux yeux : la suggestion annonce un
montant « hors versements hypothécaires », mais la colonne, elle, les inclut. Qui saisit les
42 000 $ recommandés lira « Dépenses : 52 803 $ » et croira à une erreur.

---

## Les trois décisions

| # | Question | Décision | Pourquoi |
|---|---|---|---|
| 1 | Forme du correctif | **Colonne cliquable, tiroir dédié** | Seule option qui corrige la plainte de départ : deux colonnes voisines dont une seule invite au clic |
| 2 | Place de l'hypothèque | **Sortie des dépenses**, ligne de sortie dans les deux phases | Cohérence entre phases, accord avec le libellé de la suggestion, et une colonne dont le sens se devine sans tiroir |
| 3 | Réel / nominal | **Toujours partir de la saisie**, conversion en dernière ligne | On part du chiffre qu'on reconnaît ; le tiroir garde la même structure dans les deux modes |

---

## Ce que la décision 2 change, et ne change pas

**La phase d'accumulation ne bouge pas d'un pixel** : l'hypothèque y est déjà une ligne de sortie.
Le correctif ne fait qu'aligner le décaissement sur elle.

**Le moteur de calcul ne change pas d'un cent.** Seule la trace, qui ne sert qu'à l'affichage, est
réorganisée. L'arithmétique se conserve exactement :

```
avant : surplus = revenusNets − (train de vie + hypothèque)
après : surplus = (revenusNets − hypothèque) − train de vie
```

L'invariant du moteur — *les postes somment exactement au total affiché* — tient sans retouche.

**Contrepartie assumée** : la colonne « Revenus nets » baisse du montant de l'hypothèque pendant le
décaissement. C'est le prix de la cohérence, et le tiroir l'explique.

**Précision d'implémentation** : `depenses` doit valoir exactement `cible − paiementImmo`, et non le
produit recalculé des composantes. Les deux sont mathématiquement égaux, mais la soustraction
garantit l'invariant au bit près, quelles que soient les erreurs d'arrondi flottant.

---

## Ce qu'il faut écrire

**Moteur** — une décomposition dans `DetailDisponible` :

```ts
export interface DetailDepenses {
  /** Cible annuelle telle que saisie, en dollars d'aujourd'hui. */
  readonly cibleSaisie: number;
  /** Part conservée par le survivant (1 hors phase de survie). */
  readonly fractionSurvivant: number;
  /** Inflation cumulée depuis l'année de départ. */
  readonly facteurInflation: number;
}
```

Et le poste « Paiement hypothécaire » déplacé dans la branche commune aux deux phases, des deux
côtés (`projection.ts` et `couple.ts`).

**Interface** — un agrégat `'depenses'` ajouté à `AgregatDrawer`, une brique d'affichage, et la
colonne rendue cliquable. À faire **deux fois** : `DetailAnnees` / `DrawerDetail` (solo) et
`DetailAnneesCouple` / `DrawerDetailCouple`.

---

## Découpage

| Lot | Contenu | Vérifiable par |
|---|---|---|
| **A** | ✅ Décomposition dans la trace + hypothèque déplacée | 12 nouveaux cas-tests |
| **B** | ✅ Tiroir et colonne cliquable, solo | captures aux deux thèmes, audit de contraste |
| **C** | ✅ Idem couple, ligne du survivant, surplus de survie | dossier franchissant le premier décès |

---

## Ce que le lot A a révélé

**Une régression que j'ai introduite et que les tests ont attrapée.** Le couple a **trois** phases —
`accumulation`, `decaissement` et **`survie`**. Écrire `phase === 'decaissement'` mettait donc les
dépenses à **zéro pendant toute la phase de survie**, vidant la colonne sur la fin de la projection.
Le test porte désormais sur la **cible** et non sur la phase.

**Un piège JavaScript dans mon propre test.** Après le décès, `age1` vaut `null`, et `null <= 80`
est **vrai**. Mon discriminant « les deux vivent » englobait donc les années de survie, ce qui
masquait la régression ci-dessus. Le test discrimine maintenant sur `phase === 'survie'`.

**Une incohérence de phase dans le moteur, laissée en place.** Le champ `revenuDisponible` de
`AnneeProjection` exclut le versement hypothécaire en accumulation mais l'inclut en décaissement —
la même inconsistance que celle corrigée dans la trace. Il n'est utilisé que comme **repli** quand
la trace est absente, et les tableaux tournent toujours avec la trace : le corriger serait un
changement de sortie du moteur, hors du périmètre convenu. Les deux tests d'invariance existants
encodent explicitement l'écart plutôt que de l'ignorer.

**Le surplus muet du survivant, corrigé au lot C.** Pendant la phase de survie, le surplus affiché
valait 0 alors que la ventilation du réinvestissement était renseignée : le tiroir montrait
« réinvesti dans CELI 7 075 $, non-enregistré 34 836 $ » sous un surplus nul. Même cause que la
régression ci-dessus — une condition sur la phase au lieu de la cible. Antérieur à ce correctif, il
a été traité ici sur demande.

## Points tranchés sans vous consulter

- La formulation exacte des libellés du tiroir.
- Une cellule vide (accumulation, où la cible vaut 0) reste **non cliquable**, comme toutes les
  cellules à zéro du tableau.
