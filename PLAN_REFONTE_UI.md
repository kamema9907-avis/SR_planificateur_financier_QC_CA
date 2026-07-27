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
| **3 — Résultats** | Verdict en grand, jauge d'autonomie, graphique avec curseur et infobulle riche, « ce qui change » | ✅ **fait** (2026-07-25) |
| **4 — Puissance** | Scénarios A/B/C, export/import JSON, impression PDF, optimiseur en Web Worker, `useDeferredValue` | ✅ **fait** (2026-07-26) |
| **5 — Finitions** | Responsive mobile, accessibilité, routing partageable | ✅ **fait** (2026-07-27) |
| **5b — Mode sombre** | Jetons de couleur sémantiques, puis palette foncée | à faire |

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

---

## Lot 3 — Les résultats racontent une histoire ✅

### Fichiers créés

| Fichier | Rôle |
|---|---|
| `projection/Verdict.tsx` | Verdict en grand + jauge d'autonomie (`fractionFinancee` testée) |
| `projection/Verdict.test.ts` | **5 cas-tests** sur la jauge |
| `projection/ComparaisonOptimisation.tsx` | Trajectoires actuelle et optimisée superposées |

### Une imprécision de vocabulaire corrigée

Le moteur marque une année d'« épuisement » dès que **les retraits ne suffisent plus à financer la
cible de dépenses** ([`projection.ts:449`](src/moteur/projection/projection.ts)) — ce n'est *pas*
« le patrimoine tombe à zéro ». Avec un immeuble non vendu, l'ancienne tuile pouvait donc afficher
« Épuisé à 71 ans » à côté de « Valeur nette au décès : 839 218 $ », deux affirmations vraies mais
contradictoires en apparence.

Passer ce message en gros titre rendait l'ambiguïté intenable. Le verdict parle donc de **dépenses
financées**, et lorsqu'un patrimoine subsiste malgré l'échec, il l'explique : *« il est immobilisé —
un bien non vendu ne paie pas les dépenses courantes »*. L'infobulle du graphique dit désormais
« dépenses non financées » plutôt que « capital épuisé ».

### Le reste

- **Verdict** : bandeau vert ou rouge, nombre d'années à découvert, et jauge montrant la part de la
  retraite financée (27 % dans l'exemple ci-dessus). Il passe **en tête** de la colonne de résultat,
  devant le bouton d'optimisation : la réponse d'abord, l'action ensuite.
- **Graphique enrichi** : curseur d'année suivant la souris, infobulle donnant la ventilation par
  catégorie de compte, point sur la courbe, et **bande grisée** marquant la phase de décaissement.
  L'ancienne infobulle native `<title>` du navigateur est remplacée.
- **Comparaison avant/après** : le panneau d'optimisation superpose la trajectoire actuelle
  (pointillé gris) et l'optimisée (trait vert) — on voit *quand* l'écart se creuse, pas seulement
  son montant final.

---

## Lot 4 — Puissance ✅

### Fichiers créés

| Fichier | Rôle |
|---|---|
| `interface/fichierDossier.ts` + test | Format de sauvegarde signé et versionné (**12 cas-tests**) |
| `interface/ui/BoutonsDossier.tsx` | Boutons « Enregistrer » / « Ouvrir » |
| `interface/scenarios.ts` + test | Scénarios nommés, comparaison, ex æquo (**8 cas-tests**) |
| `interface/projection/PanneauScenarios.tsx` | Tableau comparatif |
| `interface/optimiseur.worker.ts` | Optimiseur sur un fil séparé |
| `interface/ui/Impression.tsx` | Mode impression (déplie tout) + bouton |

### Ce que ça change

- **Verdict neutre** sur dossier vierge : plus de feu vert sur du néant. Repéré en
  inspectant le site déployé, pas en relisant le code.
- **Sauvegarde en fichier** : c'était le seul risque réel de perte de données — tout vivait dans le
  `localStorage`. Le fichier est écrit par le navigateur, rien n'est envoyé : la promesse « 100 %
  local » tient. L'import valide avant d'écrire et demande confirmation.
- **Scénarios comparables** : la fonction la plus attendue d'un planificateur. Sur un cas réel,
  reporter la retraite de 62 à 67 ans et la RRQ à 70 ans vaut **+734 489 $ de patrimoine** contre
  247 558 $ d'impôt supplémentaire — l'arbitrage devient visible au lieu d'être supposé.
- **Optimiseur en Web Worker** : la page ne gèle plus (~320 ms auparavant), et le calcul est
  annulable. Repli synchrone si les workers de module manquent.
- **`useDeferredValue`** : `projeter` simulait 55 années à chaque frappe sans étalement ; la saisie
  passe maintenant devant, le résultat précédent restant affiché en attendant.
- **Impression / PDF** : l'atelier déplie ses huit étapes le temps de l'impression, les colonnes
  repassent à plat, les tableaux s'impriment en entier. Les commandes disparaissent, sauf les boutons
  qui portent des montants (drill-down).

### Deux défauts de ma part, attrapés en vérifiant

1. Les scénarios n'étaient pas inclus dans l'export — tout le travail de comparaison aurait été perdu
   au premier changement d'appareil.
2. `.sansimpression` était définie avec `display: contents`, ce qui cassait la mise en page à l'écran
   des conteneurs marqués. Elle n'existe plus que dans `@media print`.

---

## Lot 5 — Finitions ✅

Trois chantiers indépendants, aucun ne touche le moteur. Le point commun : **chacun a été mesuré**,
avant et après, dans un Chrome piloté. Le responsive ne se juge pas à l'œil, et le contraste encore
moins.

### Mobile : un défaut de trois mots

Les colonnes se réempilaient bien sous `lg:`, mais la page n'avait jamais été ouverte sous 1600 px.

| Vue | 390 px | 768 px | 1600 px |
|---|---|---|---|
| Impôt | 0 | 0 | 0 |
| Projection solo | **+968 px** → 0 | **+598 px** → 0 | 0 |
| Projection couple | **+666 px** → 0 | **+296 px** → 0 | 0 |

Un enfant de grille CSS vaut `min-width: auto` : « au moins la largeur de mon contenu ». Le rail
d'étapes, en `whitespace-nowrap`, imposait donc **1 358 px** à toute la page, et son `overflow-x-auto`
ne pouvait jamais s'activer. `min-w-0` sur les trois colonnes suffit.

J'étais parti sur une fausse piste : les tableaux année par année, que je croyais dépourvus de
défilement horizontal. Ils ont `overflow-auto`, qui couvre les deux axes.

### Adresse partageable

`routage.ts` : `#/impot`, `#/projection/solo/comptes`, `#/projection/couple/menage/depenses`.

Le **dièse** et non un vrai chemin, parce que GitHub Pages sert des fichiers statiques : `/projection/couple`
provoquerait un 404 au rechargement. Le groupe et l'étape quittent le `useState` de l'Atelier pour
l'URL — F5 conserve la position, Retour revient à l'étape précédente.

`lireRoute` ne rejette jamais : un lien abîmé ouvre l'application plutôt qu'une erreur. 10 cas-tests.

### Contraste, clavier, lecteur d'écran

**59 styles de texte** sous la norme WCAG AA au départ, 0 à l'arrivée :

| Famille | Avant | Après |
|---|---|---|
| `text-slate-400` (42 usages) | 2,5:1 | slate-500 → 4,6:1 |
| `text-slate-300` (tirets des tableaux) | 1,5:1 | slate-500 |
| Blanc sur `marque-500` (boutons, pastille) | 2,5:1 | marque-700 → 5,5:1 |
| `text-marque-600` sur blanc | 3,7:1 | marque-700 → 5,5:1 |
| Cartes de verdict en dégradé | 2,5:1 (titre 24 px inclus) | 800→700 → 5,5:1 |

Le rail devient un vrai jeu d'onglets (`tablist`/`tab`/`tabpanel`) : flèches, Début, Fin, et **une
seule** étape dans l'ordre de tabulation — atteindre le formulaire ne demande plus de traverser les
neuf étapes. Le verdict devient une zone `aria-live="polite"`.

### Ce qui reste : le mode sombre

Zéro occurrence de `dark:` aujourd'hui, et les couleurs sont écrites en dur partout. Le faire
proprement veut dire introduire des **jetons sémantiques** (`--couleur-surface`, `--couleur-texte`,
`--couleur-bordure`), remplacer les couleurs littérales, puis redéfinir les jetons dans un bloc
sombre. C'est un refactor de palette, pas une finition — d'où le lot séparé.
