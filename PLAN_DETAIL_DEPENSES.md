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
| **A** | Décomposition dans la trace + hypothèque déplacée | tests d'invariance de trace existants, plus un test de somme |
| **B** | Tiroir et colonne cliquable, solo | capture aux deux thèmes, audit de contraste |
| **C** | Idem couple, avec la ligne du survivant | dossier d'essai franchissant le premier décès |

---

## Points tranchés sans vous consulter

- La formulation exacte des libellés du tiroir.
- Une cellule vide (accumulation, où la cible vaut 0) reste **non cliquable**, comme toutes les
  cellules à zéro du tableau.
