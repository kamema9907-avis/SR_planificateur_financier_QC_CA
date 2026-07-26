# Plan de refonte de l'interface — « l'Atelier »

> Document de chantier. Le moteur (`src/moteur`) n'est **pas** touché : les 147 cas-tests restent le
> filet de sécurité à chaque étape. Voir `ETAT_DU_PROJET.md` pour l'état fonctionnel du projet.

## Le problème

| Vue | Sections empilées | Contrôles à l'écran | Hauteur |
|---|---|---|---|
| Impôt | 3 | ~18 | ~1 800 px |
| Projection solo | 8 | ~40 à 58 | ~3 200 px |
| Projection couple | 14 | ~60 à 80 | ~6 000 px |

En mode couple, les résultats se trouvaient sous deux formulaires complets : modifier un champ et
constater son effet demandait de défiler 4 000 px. La boucle de rétroaction, raison d'être d'un
simulateur, était rompue.

## Le principe directeur

> **La saisie occupe une zone bornée ; le résultat ne quitte jamais l'écran.**

```
┌──────────────────────────────────────────────────────────────┐
│  ⬤ Planificateur 2026    [Impôt] [Projection]                │
├──────────────────────────────────────────────────────────────┤
│  Vigile · Conjointe · Ménage        ← qui je modifie          │
│  ┌────────────┐ ┌──────────────────┐ ┌────────────────────┐  │
│  │ ① Horizon ✓│ │                  │ │  Dure jusqu'à 95   │  │
│  │ ② Revenus ✓│ │   UNE étape      │ │  Net  1 240 000 $  │  │
│  │ ③ Comptes ●│ │   à la fois      │ │  Impôt  418 000 $  │  │
│  │ ④ Rentes  ○│ │                  │ │  ┌──────────────┐  │  │
│  │ ⑤ Immo    ○│ │   (~8 champs)    │ │  │   graphique  │  │  │
│  │ ⑥ Sortie  ○│ │                  │ │  └──────────────┘  │  │
│  └────────────┘ └──────────────────┘ └────────────────────┘  │
│      RAIL            ÉTAPE                RÉSULTAT (collant)  │
└──────────────────────────────────────────────────────────────┘
```

Le mode couple utilise **la même coquille** que le solo : un sélecteur de personne remplace les deux
colonnes de formulaires.

## Les lots

| Lot | Contenu | État |
|---|---|---|
| **0 — Fondations** | Tokens de design, composants partagés, hooks d'état, fusion des formulaires jumeaux | ✅ **fait** (2026-07-25) |
| **1 — L'Atelier** | Coquille 3 zones, rail d'étapes avec complétude, panneau résultat collant, sélecteur de personne | ✅ **fait** (2026-07-25) |
| **2 — Densité** | Bascule Essentiel / Avancé, aide en infobulle, validations croisées, rédaction unifiée | ✅ **fait** (2026-07-25) |
| **2.5 — Onglet Impôt** | Mise à niveau de l'onglet resté à l'ancienne mise en page | ✅ **fait** (2026-07-25) |
| **3 — Résultats** | Verdict en grand, jauge d'autonomie, graphique avec curseur et infobulle riche, « ce qui change » | à faire |
| **4 — Puissance** | Scénarios A/B/C, export/import JSON, impression PDF, optimiseur en Web Worker, `useDeferredValue` | à faire |
| **5 — Finitions** | Mode sombre, responsive mobile, accessibilité, routing partageable | à faire |

---

## Lot 0 — Fondations ✅

Aucun changement visuel volontaire : ce lot supprime la duplication qui aurait obligé à faire les
lots suivants deux fois.

### Fichiers créés

| Fichier | Rôle |
|---|---|
| `interface/ui/Tuile.tsx` | Tuile d'indicateur clé, était dupliquée dans `VueProjection` et `VueCouple` |
| `interface/ui/CarteListe.tsx` | Élément de liste éditable (nom + croix), motif répété 3 fois |
| `interface/ui/icones.tsx` | Icônes SVG en trait, était copiées-collées dans 4 fichiers |
| `interface/useDossier.ts` | `useDossier` (persistance locale), `useAffichageReel`, `useOptimiseur` |
| `interface/projection/champsPersonne.ts` | `ChampsPersonne` : intersection de `HypothesesProjection` et `PersonneProjection` |
| `interface/projection/EtapesPersonne.tsx` | **Les 5 sections communes**, servant le solo ET chaque conjoint |
| `interface/projection/BlocsEpargne.tsx` | Encadrés conditionnels : fonds de travailleurs, CELIAPP, droits CELI, droits REER |
| `interface/projection/BarreOptimiseur.tsx` | Barre de lancement de l'optimiseur, commune aux deux modes |

### Points de conception

- **`ChampsPersonne` est une vue d'interface, pas un type du moteur.** Elle exploite la compatibilité
  structurelle : `HypothesesProjection` (champs `readonly`) et `PersonneProjection` (champs
  mutables) lui sont tous deux assignables, les modificateurs `readonly` n'entrant pas dans
  l'assignabilité des objets en TypeScript. Les mises à jour remontent en **patch partiel**, que
  chaque vue applique à son propre type : l'immutabilité côté moteur est préservée.
- **Les classes de composants CSS ne se composent pas.** En Tailwind v4, `@apply` n'accepte que des
  utilitaires, pas une classe définie dans `@layer components`. Chaque variante de bouton est donc
  autonome plutôt que dérivée d'une base `.bouton`.
- **Numérotation des sections corrigée** en mode couple : l'immobilier et le ménage portaient les
  numéros 5 et 6, déjà utilisés par les sections de chaque conjoint. Ils sont désormais 7 et 8.
- **Rédaction unifiée au vouvoiement.** Les deux formulaires jumeaux avaient divergé (« ton dossier »
  d'un côté, « votre dossier » de l'autre) ; la fusion impose une seule version.

### Bilan

- `−547 / +235` lignes dans les fichiers existants, remplacées par ~530 lignes de code **partagé**.
- `FormulaireProjection` : 191 → 84 lignes. `FormulairePersonne` : 170 → 66 lignes.
- Typecheck, build et **147 cas-tests** verts.

---

## Lot 1 — L'Atelier ✅

### Fichiers créés

| Fichier | Rôle |
|---|---|
| `interface/atelier/types.ts` | `Etape`, `Groupe`, calcul de progression |
| `interface/atelier/Atelier.tsx` | Coquille 3 zones + navigation Précédent/Suivant |
| `interface/atelier/RailEtapes.tsx` | Rail (colonne à gauche, bande défilable sur petit écran) + barre de progression |
| `interface/projection/etapes.tsx` | Fabriques d'étapes : `groupeSolo` (8), `groupeConjoint` (6), `groupeMenage` (2) |
| `interface/projection/SectionVieActive.tsx` | Section commune extraite d'`EtapesPersonne` |
| `interface/projection/PanneauSynthese.tsx` | Colonne de droite : optimiseur, tuiles, courbe |
| `interface/projection/GraphiqueCompact.tsx` | Courbe de valeur nette taillée pour 21 rem |

`FormulaireProjection.tsx`, `FormulairePersonne.tsx` et `EtapesPersonne.tsx` sont supprimés : les
étapes remplacent le formulaire monolithique.

### Points de conception

- **Toutes les étapes du groupe actif restent montées**, les inactives masquées par `hidden`. L'état
  interne des sous-composants (le calculateur RREGOP et ses champs service/salaire) survit ainsi à la
  navigation. Tailwind v4 applique `[hidden]{display:none!important}`, ce qui l'emporte sur `.carte`.
- **Les identifiants d'étape sont partagés entre groupes de même nature** (`vie-active`, `comptes`…) :
  passer d'un conjoint à l'autre conserve l'étape courante, ce qui permet de comparer les deux
  personnes sur le même écran de saisie.
- **Le titre, le numéro et l'explication sont portés par l'étape**, plus par la section. Les sections
  listes (immobilier, rentes, travail) ne rendent donc plus que leur contenu.
- **Deux graphiques, deux rôles** : la courbe compacte répond à « est-ce que ça tient ? » sans quitter
  l'écran ; le graphique empilé par catégorie de compte et les tableaux année par année restent en
  pleine largeur sous l'atelier, là où ils ont la place d'être lus.

### Mesures (Chrome headless, fenêtre 1600 × 1150)

| | Avant | Après |
|---|---|---|
| Hauteur de page, couple | ~6 000 px | **3 408 px** |
| Hauteur de page, solo | ~3 200 px | **3 328 px** (dont graphique + tableaux détaillés) |
| Contrôles de saisie à l'écran, couple | 60 à 80 | **5 à 15** selon l'étape |

La hauteur restante est presque entièrement occupée par le graphique détaillé et les tableaux année
par année, désormais **sous** la zone de travail : saisie et résultat tiennent dans le premier écran.

### Conservé intégralement

Drill-down récursif, badges d'événements, modes « Par thème / Tout voir », calculateur RREGOP,
bascule réel/nominal, optimiseur et panneau de stratégie. 147 cas-tests verts, aucune erreur console.

---

## Lot 2 — Densité ✅

### Fichiers créés

| Fichier | Rôle |
|---|---|
| `interface/ui/ModeDetail.tsx` | Contexte Essentiel / Avancé, composant `<Avance>`, bascule, persistance |
| `interface/ui/Aide.tsx` | Bouton « ? » et popover (fermeture au clic extérieur et à Échap) |
| `interface/projection/validation.ts` | Contrôles de cohérence, purs et testables |
| `interface/projection/validation.test.ts` | **14 cas-tests** (161 au total dans le projet) |

### Ce qui devient « avancé »

Seuls les réglages ayant un **défaut sûr** sont masqués — jamais un champ dont l'absence fausserait
la projection. Les droits REER et CELI, par exemple, restent visibles : ils influencent réellement
le résultat.

| Étape | Masqué en mode Essentiel |
|---|---|
| Vie active | Croissance réelle du salaire · facteur d'équivalence exact |
| Comptes | CELIAPP, CRI et REEE tant que leur solde est nul |
| Rentes publiques | Âges de début RRQ et SV (l'optimiseur les propose) |
| Rentes d'employeur | Source · indexation |
| Travail à la retraite | Croissance réelle |
| Immobilier | Années détenues · taux hypothécaire · appréciation · âge min. de vente · fraction libérée |
| Décaissement / Ménage | Inflation · frais de gestion |

**Mesuré** : groupe solo complet, **46 champs en Avancé → 32 en Essentiel** ; étape Immobilier,
**12 → 7**.

### Aide en infobulle

`Etape` gagne un champ `aide` : la description sous le titre tient désormais en **une phrase**, le
détail (règles fiscales, mécaniques de débordement, formule RREGOP) passe derrière le « ? ».
L'étape Immobilier ouvrait sur cinq lignes de texte gris avant le premier champ ; il en reste une.

### Validations croisées

`validation.ts` retourne des `Alerte { etape, message, niveau }`. L'atelier les affiche en tête de
l'étape concernée, et le rail porte un point rouge (erreur) ou ambre (à vérifier) — une incohérence
se repère donc **sans ouvrir l'étape**. Règles couvertes : ordre des âges, rente ou période de
travail qui se termine avant de commencer, cotisation REER dépassant les droits estimés, paiement
hypothécaire ne couvrant pas les intérêts, âge de vente antérieur au minimum autorisé, coût de base
ou hypothèque supérieurs à la valeur, absence de cible de dépenses, inflation ou frais aberrants.

En mode couple, chaque message est préfixé du nom du conjoint et rattaché à son groupe d'étapes ;
en solo, il commence simplement par une majuscule.

---

## Lot 2.5 — L'onglet Impôt rattrape son retard ✅

Les lots 0 à 2 n'avaient refondu que la Projection : l'onglet Impôt gardait ses sections empilées,
sans bascule ni infobulles. Les deux onglets ne se ressemblaient plus — une dette créée par la
refonte elle-même.

**Choix : ne pas lui imposer l'Atelier.** Ce formulaire tient déjà à l'écran (~1 800 px, 18 champs)
et ses résultats sont déjà collants ; le découper en trois étapes forcerait des allers-retours pour
un calculateur qu'on remplit d'un trait. Il adopte en revanche toutes les autres conventions.

- **Bascule Essentiel / Avancé** partagée avec la Projection : **18 → 10 champs**. Passent en avancé
  les dividendes ordinaires (SPCC), la rente de survivant RRQ, la cotisation syndicale et
  l'assurance-salaire.
- **`TitreSection` accepte une `aide`** : chaque section porte son « ? ». Celle des déductions
  explique la différence déduction (~53 %) / crédit (~14-15 %), qui est la clé de lecture de tout
  l'onglet.
- **`validationImpot.ts`** (**10 cas-tests**) : SV avant 65 ans, rente RRQ avant 60 ans, cumul
  survivant + retraite plafonné à 65 ans, retenues de paie sans salaire, déduction REER sans revenu
  gagné.
- `ListeAlertes` est extrait d'`Atelier.tsx` vers `ui/` pour servir les deux onglets.
- Correctif transverse : les classes `.bouton-*` reçoivent `shrink-0 whitespace-nowrap` — dans une
  colonne étroite, « Réinitialiser » se cassait en deux lignes sous son icône.
