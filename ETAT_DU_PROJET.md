# État du projet — Planificateur Financier 2026

> **Document vivant** : synthèse de tout ce que le projet fait à ce jour. À mettre à jour au fil des
> phases. Voir le [journal des modifications](#-journal-des-modifications) à la fin pour l'historique.
>
> Dernière mise à jour : **2026-07-28** — **deux correctifs de traçabilité**, tous deux nés d'une
> question de l'utilisateur : la colonne « Dépenses » du détail annuel s'explique désormais au clic
> (et le versement hypothécaire en sort, pour redevenir une ligne de sortie dans les deux phases), et
> les **ventes immobilières** exposent enfin leur anatomie — valeur, solde hypothécaire remboursé,
> gain, impôt supporté, produit net placé.
> Auparavant : **dépense de retraite recommandée** — le planificateur
> calcule par dichotomie le montant maximal que le capital finance jusqu'au décès et en recommande
> 85 %, affiché sous le champ de l'étape « Décaissement » avec un bouton pour l'appliquer.
> Plus tôt, le **lot 5 terminé** : **mode sombre** complet (Système /
> Clair / Sombre), bâti sur une couche de **jetons sémantiques** — aucun composant ne nomme plus une
> couleur. Plus tôt le même jour : l'application tient sur
> un téléphone (elle débordait de 968 px), l'adresse est **partageable** (`#/projection/couple/...`,
> rechargement et bouton Retour fonctionnels), et **tout le texte respecte le contraste WCAG AA**,
> avec navigation au clavier dans le rail et annonce vocale du verdict.
> Auparavant : **héritage** (nouvelle source d'apport) et **trois
> correctifs de justesse** trouvés en simulant : produit de vente placé net d'impôt, décaissement dès
> la retraite du premier conjoint, CELI des deux conjoints rempli avant le non-enregistré.
> Plus tôt : **refonte de l'interface, lots 0 à 4** — fondations partagées, coquille « Atelier »
> (rail d'étapes + résultat collant), densité de saisie, validations croisées, mise à niveau de
> l'onglet Impôt, verdict et graphique enrichi, sauvegarde en fichier, scénarios comparables,
> optimiseur sur un fil séparé et impression PDF — voir [`PLAN_REFONTE_UI.md`](PLAN_REFONTE_UI.md).
> Plus tôt : crédit fonds de travailleurs dans la projection, droits REER (avec facteur
> d'équivalence), terrain vacant, plafonds CELIAPP / droits CELI, cotisations sociales, syndicat,
> assurance-salaire, survivant RRQ.

## Table des matières
1. [Vision et objectif](#-vision-et-objectif)
2. [Ce que l'outil fait aujourd'hui](#-ce-que-loutil-fait-aujourdhui)
3. [Décisions de conception verrouillées](#-décisions-de-conception-verrouillées)
4. [Architecture](#-architecture)
5. [Données fiscales 2026 (référence)](#-données-fiscales-2026-référence)
6. [Comment lancer et tester](#-comment-lancer-et-tester)
7. [Limites et simplifications actuelles](#-limites-et-simplifications-actuelles)
8. [Feuille de route](#-feuille-de-route)
9. [Journal des modifications](#-journal-des-modifications)

---

## 🎯 Vision et objectif

Créer **le meilleur planificateur financier** pour le Québec/Canada, utilisable par le propriétaire et
ses amis, afin d'**optimiser l'impôt sur toute la vie** — vie active puis retraite — pour une personne
seule ou en couple. L'outil doit tenir compte de tous les aspects du patrimoine : salaire, rentes
(RRQ, SV), placements (actions, options, crypto, matières premières), immobilier (résidence, chalet,
immeuble à revenu), comptes enregistrés et impôt fédéral + provincial.

**Question centrale** : *« Dans quel ordre, à quel moment et depuis quel compte (le mien ou celui de
mon conjoint) gagner, cotiser, encaisser et décaisser chaque dollar, sur toute la vie, pour payer le
moins d'impôt total possible ? »*

- **100 % local** : les données financières ne quittent jamais le navigateur (aucun serveur).
- **✅ En ligne** : <https://kamema9907-avis.github.io/SR_planificateur_financier_QC_CA/> — site statique
  gratuit (GitHub Pages), redéployé automatiquement à chaque `git push origin main`.
- ⚖️ **Note légale** : outil de **calcul et de simulation**. Le titre « planificateur financier » est
  protégé au Québec (IQPF) ; l'outil ne fournit pas de conseil personnalisé à des clients.

---

## ✅ Ce que l'outil fait aujourd'hui

L'application web comporte **deux onglets**.

### Onglet « Impôt (1 année) » — Phase 1
Calcule l'impôt **fédéral + Québec 2026** pour une personne, une année (fidélité « planification ») :
- Tranches d'imposition et **taux marginal / moyen**.
- Montant personnel de base (avec réduction pour hauts revenus), montant en raison de l'âge, crédit
  pour revenu de pension.
- Dividendes **déterminés** et **ordinaires** (majoration + crédit d'impôt).
- Gains en capital (inclusion 50 %).
- Déduction pour travailleur (Québec), **abattement du Québec** (16,5 %).
- **Récupération de la PSV** (clawback).
- **Crédit pour fonds de travailleurs** FTQ / Fondaction CSN (30 % sur le 1er 5 000 $).
- **Cotisations sociales du salarié** (calculées du salaire, vrai traitement 2026) : **RRQ scindé**
  (base → crédit ; bonifié 1re + RRQ2 → déduction), **AE** et **RQAP** → crédits.
- **Cotisation syndicale** (déduction fédérale + crédit québécois 10 %), **assurance-salaire** (non
  déductible par défaut), **rente de survivant RRQ** (imposable comme la RRQ).
- Affiche les **retenues sur la paie** et le **revenu net « en poche »** (après impôt *et* cotisations).

### Onglet « Projection (cycle de vie) » — Phase 2
Projette le patrimoine et l'impôt **année par année**, de l'âge actuel jusqu'au décès, avec barèmes
**indexés à l'inflation** (calcul nominal, affichage en dollars d'aujourd'hui) :
- **Tous les comptes** : REER→FERR, CELI, CELIAPP, CRI→FRV, non-enregistré, REEE.
- **Plafonds vérifiés** : CELIAPP (8 000 $/an, 40 000 $ à vie) ; **droits CELI** (droits ARC, +7 000 $/an
  indexé arrondi au 500 $, retraits restaurés l'année suivante) ; **droits REER** (droits ARC, +18 % du
  salaire − **facteur d'équivalence** RREGOP/RPA, max 33 810 $, aucune restauration au retrait ; la fonte
  du REER respecte les droits CELI). Excédent en chaîne : CELIAPP → CELI → non-enregistré.
- **Crédit fonds de travailleurs** (FTQ/Fondaction) chaque année active : cotisation REER additionnelle
  (déductible, consomme les droits) + crédit de **30 %** sur le 1er 5 000 $, obtenu même sans droits REER.
- **Profils de rendement** (prudent / équilibré / dynamique) calibrés sur les Normes IQPF 2026.
- **Rentes publiques** RRQ et SV (saisie manuelle) avec ajustement report/anticipation et indexation.
- **Héritage** : apport ponctuel non imposable à un âge choisi, placé CELI → REER → non-enregistré
  selon les droits restants (versement REER borné à la déduction utilisable).
- **Rentes d'employeur / RREGOP** : rente de base + ponts, indexation configurable, calculateur RREGOP
  (formule 2 % + coordination à 65 ans). Imposables, admissibles au crédit pour revenu de pension.
- **Minimums de retrait FERR/FRV** forcés dès 72 ans.
- **Immobilier** : résidence, chalet, immeuble à revenu, **terrain vacant** — hypothèque (amortissement),
  loyers imposables, appréciation, vente/downsizing, exemption pour résidence principale (arbitrage automatique).
  Le produit d'une vente est placé **net de l'impôt sur le gain**, en CELI → REER → non-enregistré.
  Le terrain et l'immeuble à revenu sont **toujours imposables** (jamais abrités). Équité au patrimoine.
- **Phase d'accumulation** (épargne + croissance) puis **décaissement** : un solveur retire dans l'ordre
  choisi pour financer une cible de dépenses **nette d'impôt**.
- **Impôt au décès** (dispositions présumées des comptes enregistrés + gains latents).
- **Dépense de retraite recommandée** (solo **et** ménage) : sous le champ de dépenses, l'outil
  affiche le montant maximal que le capital finance jusqu'au décès et en recommande 85 % par
  prudence. Un bouton le reporte dans le champ ; rien n'est jamais écrit sans un clic. La part
  consommée se règle en mode Avancé.
- Sorties : **graphique** du patrimoine, **tableau** annuel, indicateurs clés (« le capital dure jusqu'à
  X ans », valeur nette au décès, **impôt total sur la vie**), interrupteur nominal/réel.
- **Traçabilité au clic** (« drill-down ») : tout montant souligné du détail année par année ouvre sa
  décomposition, et chaque décomposition somme **exactement** au total affiché. Sont expliqués : le
  revenu disponible (entrées, sorties, surplus réinvesti), l'**impôt** (revenu imposable par source,
  fédéral, Québec, taux), la **valeur nette**, les **dépenses** (cible saisie × part du survivant ×
  inflation) et les **ventes immobilières** (valeur à la vente, solde hypothécaire remboursé, gain,
  impôt supporté, produit net placé et sa destination).

### Optimiseur automatique (bouton dans la Projection) — Phase 4
Le bouton « Optimiser la stratégie » (solo et couple) explore les stratégies avec notre simulateur et
retourne celle qui **maximise le patrimoine net au décès** : ordre de décaissement, **fonte du REER**,
âges de début RRQ/SV, moment des ventes immobilières. Affiche le gain (patrimoine + / impôt −) et
permet d'appliquer la stratégie recommandée.

### Mode « Couple » (bascule dans l'onglet Projection) — Phase 3
Deux conjoints entièrement modélisés (colonnes côte à côte), un ménage à optimiser :
- **Fractionnement du revenu de pension** optimisé automatiquement chaque année.
- **Décaissement coordonné** : le conjoint le moins imposé retire en premier (équilibre les revenus).
- **REER de conjoint** (cotisations croisées).
- **Phase de survie** : roulement sans impôt au premier décès, **rente de survivant RRQ**, dépenses du
  survivant ajustables (~67 %), impôt au dernier décès.
- Résultats du ménage : autonomie, valeur nette au dernier décès, impôt total sur la vie, graphique et
  tableau (avec le montant fractionné).

### Accessibilité et usage
- **Utilisable sur téléphone et tablette** : les trois colonnes de l'Atelier se réempilent, le rail
  d'étapes devient une bande défilable, les tableaux défilent dans leur cadre. Vérifié à 390, 768 et
  1600 px sur les trois vues.
- **Adresse partageable** : `#/impot`, `#/projection/couple/menage/depenses`… Le rechargement garde
  la position, le bouton **Retour** revient à l'étape précédente, et un lien s'envoie tel quel.
- **Mode sombre** : bascule **Système / Clair / Sombre** dans l'en-tête. « Système » suit le réglage
  de l'appareil *en direct*, sans rechargement. Le choix survit au redémarrage et s'applique avant le
  premier rendu (pas d'éclair blanc à l'ouverture).
- **Contraste WCAG AA vérifié par mesure** sur tous les textes des trois vues, **dans les deux
  thèmes**, fonds en dégradé et étiquettes SVG compris (rapport ≥ 4,5:1, ou ≥ 3:1 pour les grands
  titres).
- **Clavier** : le rail d'étapes est un jeu d'onglets (flèches, Début, Fin) ; une seule étape occupe
  l'ordre de tabulation, pour atteindre le formulaire sans traverser les neuf étapes.
- **Lecteur d'écran** : le verdict est une zone `aria-live` — la réponse à « est-ce que ça tient ? »
  est annoncée quand elle change.

### Qualité / validation
- **291 cas-tests automatisés** — 222 moteur (fiscalité, cotisations, plafonds CELIAPP/CELI/REER,
  fonds de travailleurs, indexation, comptes, projection, décaissement, couple, immobilier dont
  terrain, optimiseur, dépense soutenable) + 69 interface (validations, verdict, fichier, scénarios,
  routage, thème).
- Propriété clé du couple : le **fractionnement ne hausse jamais** l'impôt combiné (testé).
- **Validation croisée** contre les taux marginaux combinés **publiés** du Québec 2026 :
  sommet **53,31 %**, 140 000 $ → **47,46 %**, 60 000 $ → **36,12 %**.
- Comparaison contre **SimulR / CompuPension** de Retraite Québec = à faire **manuellement** (repère).

---

## 🔒 Décisions de conception verrouillées

Issues de sessions `/grill-me` et de questions de portée.

| # | Sujet | Choix |
|---|---|---|
| 1 | Fidélité fiscale | Niveau « planification » (pas de déclaration T1/TP-1 complète) |
| 2 | Inflation | Calcul nominal indexé, affichage en dollars d'aujourd'hui |
| 3 | Géographie | Québec + fédéral d'abord, module provincial extensible |
| 4 | Données | 100 % local (navigateur), aucun serveur |
| 5 | Placements | Catégories fiscales agrégées (pas de suivi lot par lot) |
| 6 | Immobilier | 3 types + arbitrage d'exemption résidence/chalet |
| 7 | Intelligence | Comparateur/projection d'abord, optimiseur automatique en Phase 4 |
| 8 | Rendements | Déterministe calibré IQPF (Monte Carlo plus tard) |
| 9 | Horizon | Espérance IQPF (~95 ans) ajustable + impôt au décès |
| 10 | Validation | Cas-tests étalons + taux publiés ; SimulR/CompuPension en manuel |
| — | Portée Phase 2 | Cycle de vie complet (accumulation + décaissement) |
| — | RRQ / SV | Saisie manuelle (relevé Retraite Québec) |
| — | Comptes | Tous les types dès le départ |

**Stack** : TypeScript de bout en bout · React 18 · Vite 6 · Tailwind CSS v4 · Vitest.
**Zéro backend, zéro Python** (l'optimiseur de la Phase 4 tournera en WebAssembly dans le navigateur).

---

## 🏗️ Architecture

Principe fondateur : **moteur de calcul pur séparé de l'interface**.

```
src/
├── moteur/                         # Calcul pur (TypeScript, testable, sans React)
│   ├── constantes/
│   │   ├── federal2026.ts          # Barèmes fédéraux 2026
│   │   ├── quebec2026.ts           # Barèmes Québec 2026
│   │   ├── iqpf2026.ts             # Normes IQPF (rendements, inflation, survie)
│   │   ├── indexation.ts           # Indexation des barèmes pour une année future
│   │   ├── profilsRendement.ts     # Profils prudent/équilibré/dynamique → rendement IQPF
│   │   ├── ferr.ts                 # Minimums de retrait FERR/FRV
│   │   ├── fondsTravailleurs2026.ts# Crédit FTQ/CSN
│   │   └── cotisations2026.ts      # Cotisations RRQ/AE/RQAP 2026 + crédit syndical QC
│   ├── bareme.ts                   # Impôt progressif
│   ├── cotisations.ts              # Cotisations du salarié (RRQ scindé, AE, RQAP) + indexation
│   ├── impotFederal.ts             # Impôt fédéral (+ abattement, PSV) — barèmes indexables
│   ├── impotQuebec.ts              # Impôt du Québec — barèmes indexables
│   ├── moteurFiscal.ts             # Orchestrateur (assemble tout, taux moyen/marginal)
│   ├── projection/
│   │   ├── types.ts                # Comptes, hypothèses, héritage, résultat de projection
│   │   ├── comptes.ts              # Classification fiscale + croissance des comptes
│   │   ├── rentesPubliques.ts      # RRQ / SV (ajustement + indexation)
│   │   ├── decaissement.ts         # Solveur de retrait (cible nette d'impôt)
│   │   ├── typesCouple.ts          # Types du ménage (PersonneProjection, AnneeCouple)
│   │   ├── trace.ts                # Traçabilité « drill-down » : postes et liens
│   │   ├── rentesEmployeur.ts      # Rentes d'employeur + calculateur RREGOP
│   │   ├── periodesTravail.ts      # Travail poursuivi à la retraite
│   │   ├── heritage.ts             # Héritage : indexation du montant reçu
│   │   ├── placementSurplus.ts     # placerCapital / placerSurplusRetraite (CELI → REER → non-enr.)
│   │   ├── depenseSoutenable.ts    # Dépense de retraite maximale et recommandée (dichotomie)
│   │   ├── immobilier.ts           # Biens, hypothèque, vente, exemption résidence
│   │   ├── couple.ts               # Boucle du ménage (fractionnement, survie)
│   │   └── projection.ts           # Boucle année par année (cycle de vie)
│   ├── index.ts                    # API publique du moteur
│   └── *.test.ts                   # 222 cas-tests (moteur)
└── interface/                      # UI React (habillage)
    ├── Champ.tsx                   # Champs de saisie réutilisables
    ├── format.ts                   # Formatage $ / % (fr-CA)
    ├── routage.ts                  # Adresse partageable (#/projection/couple/…), Retour, F5
    ├── theme.ts                    # Thème Système / Clair / Sombre (jetons de `index.css`)
    ├── useDossier.ts               # Persistance locale, affichage réel/nominal, optimiseur
    ├── Resultats.tsx               # Résultats de l'onglet Impôt
    ├── VueImpotAnnuel.tsx          # Onglet « Impôt (1 année) »
    ├── fichierDossier.ts           # Sauvegarde / restauration du dossier (fichier signé)
    ├── scenarios.ts                # Scénarios nommés et comparaison
    ├── optimiseur.worker.ts        # Optimiseur sur un fil séparé (Web Worker)
    ├── ui/                         # Briques partagées (Tuile, CarteListe, Aide, icônes,
    │                               #   ModeDetail, Impression, BoutonsDossier, ListeAlertes)
    ├── atelier/                    # Coquille de saisie : rail d'étapes, étape, résultat collant
    └── projection/                 # Onglet « Projection »
        ├── champsPersonne.ts       # Vue « personne » commune au solo et au couple
        ├── etapes.tsx              # Découpage en étapes : solo (8), conjoint (6), ménage (2)
        ├── SectionVieActive.tsx    # Section commune (solo ET chaque conjoint)
        ├── BlocsEpargne.tsx        # Encadrés de plafonds (CELIAPP, droits CELI/REER, fonds)
        ├── PanneauSynthese.tsx     # Colonne collante : verdict, optimiseur, indicateurs, courbe
        ├── Verdict.tsx             # « Vos dépenses sont financées jusqu'à… » + jauge
        ├── PanneauScenarios.tsx    # Tableau comparatif des scénarios
        ├── SectionHeritage.tsx     # Saisie des héritages attendus
        ├── SuggestionDepense.tsx   # Dépense soutenable suggérée sous le champ de décaissement
        ├── partConsommee.tsx       # Part du maximum consommée (contexte + réglage Avancé)
        └── …                       # Graphiques, tableaux, drill-down, optimiseur
```

### Documents de conception

Chaque chantier d'ampleur a son plan, écrit **avant** le code et conservé avec ses décisions :

| Document | Sujet | État |
|---|---|---|
| [`PLAN_REFONTE_UI.md`](PLAN_REFONTE_UI.md) | L'Atelier : lots 0 à 5b, dont le mode sombre | ✅ livré |
| [`PLAN_DEPENSE_RECOMMANDEE.md`](PLAN_DEPENSE_RECOMMANDEE.md) | Dépense de retraite recommandée | ✅ livré |
| [`PLAN_DETAIL_DEPENSES.md`](PLAN_DETAIL_DEPENSES.md) | Expliquer « Dépenses » et les ventes immobilières | ✅ livré |
| [`PLAN_MONTE_CARLO.md`](PLAN_MONTE_CARLO.md) | Phase 6 : projection probabiliste | conception seule |

---

## 📊 Données fiscales 2026 (référence)

### Fédéral (ARC / TaxTips / Investment Executive)
- Tranches : **14 %** ≤ 58 523 $ · **20,5 %** → 117 045 $ · **26 %** → 181 440 $ · **29 %** → 258 482 $ · **33 %** au-delà.
- Montant personnel de base : 16 452 $ (réduit à 14 829 $ entre 181 440 $ et 258 482 $).
- Montant en raison de l'âge : 9 208 $ (seuil 45 522 $, réduction 15 %). *(seuil à valider)*
- Montant pour revenu de pension : max 2 000 $. Taux des crédits : 14 %.
- Dividendes : déterminés majoration 38 % / crédit 15,0198 % du majoré ; ordinaires 15 % / 9,0301 %.
- Gains en capital : inclusion 50 %. Récupération PSV : seuil 95 323 $, taux 15 %. Abattement QC : 16,5 %.

### Québec (Ministère des Finances, nov. 2025 — indexation 2,05 %)
- Tranches : **14 %** ≤ 54 345 $ · **19 %** → 108 680 $ · **24 %** → 132 245 $ · **25,75 %** au-delà.
- Montant personnel de base : 18 952 $. Taux des crédits : 14 %.
- Montant âge : 3 986 $ · revenus de retraite : 3 541 $ · personne vivant seule : 2 172 $
  (réduction combinée 18,75 % au-delà de 42 955 $).
- Déduction pour travailleur : min(6 %, 1 450 $). Dividendes : déterminés 11,70 % / ordinaires 3,42 % du majoré.

### Normes IQPF 2026 (rendements bruts, avant frais)
- Inflation **2,1 %** · court terme 2,4 % · revenu fixe 3,2 %.
- Actions : canadiennes 6,3 % · américaines 6,4 % · internationales 6,6 % · marchés émergents 7,5 %.
- Immobilier résidentiel 3,1 % · croissance MGA 3,1 % · emprunt 4,4 %.
- Table de survie CPM 2014 (médiane 50 %) intégrée pour l'horizon par défaut.

### Fonds de travailleurs
- Crédit 15 % fédéral + 15 % Québec (= 30 %) sur le 1er 5 000 $ investi (FTQ / Fondaction CSN).

### Cotisations sociales 2026 (salarié — CFFP Sherbrooke, PBI Actuarial, Retraite/Revenu Québec)
- **RRQ** : exemption **3 500 $** (gelée) · MGA **74 600 $** · MSGA **85 000 $** · taux de base
  **5,30 %** (→ crédit) · 1re additionnelle **1,00 %** + 2e additionnelle RRQ2 **4,00 %** (→ déduction).
  Cotisation max (base + 1re) 4 479,30 $.
- **Assurance-emploi (Québec)** : max assurable **68 900 $** · taux **1,30 %** (→ crédit) · max 895,70 $.
- **RQAP** : max assurable **103 000 $** · taux **0,430 %** (→ crédit) · max 442,90 $.
- **Cotisation syndicale/professionnelle** : crédit **10 %** au Québec (ligne 397.1) ; déduction au fédéral.
- Plafonds indexés au rythme du MGA (**+1 %** sur l'inflation) pour les années futures ; exemption gelée.

**Sources détaillées** : voir `sources_planificateur_financier_QC_CA.md`.

---

## 🚀 Comment lancer et tester

```bash
npm install      # installer les dépendances
npm run dev      # développement (http://localhost:5173)
npm test         # les 291 cas-tests
npm run build    # version de production (dossier dist/, à héberger)
npm run preview  # prévisualiser la version de production
```

**Mise en ligne** : `git push origin main` → GitHub Actions lance les tests, bâtit le site et le déploie
sur GitHub Pages (~1-2 min). Si un test échoue, le déploiement est bloqué (garde-fou). Dépôt :
`kamema9907-avis/SR_planificateur_financier_QC_CA` ; branches `version-1/2/3` = jalons figés, `main` = déployée.

---

## ⚠️ Limites et simplifications actuelles

À raffiner lors des prochaines phases ou de la validation croisée :
- Traitement **salarié** : le **travailleur autonome** (deux parts du RRQ/RQAP, déduction de la part
  « employeur », AE facultative) n'est pas modélisé. **Montant canadien pour emploi** et crédits mineurs
  (dons, frais médicaux) non inclus.
- Seuil exact d'indexation du montant fédéral en raison de l'âge à confirmer.
- **Maximum de retrait FRV** provincial ; mécaniques fines du **CELIAPP** (achat 1re propriété,
  fermeture à 15 ans / 71 ans, report du droit annuel) et du **REEE** (règles de retrait) simplifiées.
  Droits **REER** vérifiés, mais : facteur d'équivalence d'un régime à PD **estimé** (18 % × salaire − 600 $)
  sauf si le FE exact est saisi ; base 18 % sur le salaire courant ; arrêt des cotisations à 71 ans non forcé.
- Couple : rente de survivant RRQ avant 65 ans **approximée** ; max RRQ (plafond survivant) et règle
  d'attribution du REER de conjoint (3 ans) simplifiés.
- Indexation uniforme à l'inflation IQPF (certains seuils réels s'indexent différemment).
- **Report de déduction REER non modélisé** : une cotisation qu'on ne peut pas déduire l'année même
  est reportable indéfiniment dans la réalité. Le moteur ne le suit pas, et borne donc les versements
  REER issus d'un héritage ou d'une vente à la déduction utilisable immédiatement — choix
  conservateur, qui ne surestime jamais l'avantage fiscal.
- Rendements **déterministes** (pas encore de Monte Carlo).

Conséquence : les montants sont de bonnes **estimations de planification**, pas une déclaration au dollar près.

---

## 🗺️ Feuille de route

1. **✅ Phase 1** — Moteur fiscal (une personne, une année).
2. **✅ Phase 2** — Projection cycle de vie (accumulation + décaissement).
3. **✅ Phase 3** — **Le couple** : fractionnement optimisé, REER de conjoint, décaissement coordonné,
   phase de survie (roulement + rente de survivant RRQ).
4. **✅ Phase 3.5** — **Immobilier** : résidence, chalet, immeuble à revenu (hypothèque, loyers, vente,
   downsizing, arbitrage d'exemption, roulement au conjoint).
5. **✅ Phase 4** — **Optimiseur automatique** (recherche sur le moteur) : ordre de décaissement, fonte
   du REER, âges RRQ/SV, ventes immobilières. Maximise le patrimoine net au décès.
6. **Phase 5** — **Refonte de l'interface (« l'Atelier »)**, export/import, partage. Plan détaillé en
   lots dans [`PLAN_REFONTE_UI.md`](PLAN_REFONTE_UI.md) :
   - ✅ **lot 0** — fondations partagées
   - ✅ **lot 1** — coquille à 3 zones et rail d'étapes
   - ✅ **lot 2** — densité de saisie (Essentiel / Avancé) et validations
   - ✅ **lot 2.5** — mise à niveau de l'onglet Impôt
   - ✅ **lot 3** — verdict, graphique enrichi, comparaison avant/après
   - ✅ **lot 4** — sauvegarde en fichier, scénarios comparables, Web Worker, impression PDF
   - ✅ **lot 5** — responsive mobile, accessibilité (contraste, clavier, `aria-live`), routing
     partageable, **mode sombre** (jetons sémantiques)

   **La Phase 5 est terminée.**

   (**Hébergement : ✅ fait** — GitHub Pages, déploiement automatique à chaque `git push`.)

Idées / à explorer : immobilier détaillé (résidence/chalet/immeuble à revenu, arbitrage d'exemption),
options d'employé, analyse de sensibilité / Monte Carlo, autres provinces.

---

## 📓 Journal des modifications

### 2026-07-28 — Ventes immobilières : le moteur les rend vérifiables (lot A)
**Signalé par l'utilisateur** : « comment je vérifie les chiffres, et comment je sais que
l'hypothèque a bien été remboursée ? ». Le produit d'une vente était un nombre sans origine. Le
remboursement, soustrait **à l'intérieur** du calcul, n'apparaissait jamais : on ne pouvait que le
déduire de la disparition du versement et de la chute de l'équité à zéro.

La trace expose désormais, **bien par bien** : valeur au moment de la vente, solde remboursé,
fraction vendue, produit brut, gain (imposable et avant exemption), impôt supporté, net après impôt.
`traiterImmeublesAnnee` agrégeait tout par propriétaire et perdait ce détail ; elle retourne
maintenant aussi les ventes réalisées.

**Décision mesurée avant d'être prise.** La ligne d'impôt affiche l'impôt **réellement supporté** —
la provision moins le reliquat — et non la provision brute. Sur un dossier avec 100 000 $ de droits
REER, la déduction absorbe **toute** la provision : 307 627 $ sont placés au lieu de 281 625 $.
Afficher la provision aurait donné une chaîne visiblement fausse. Un test fige les deux cas.

**Conventions assumées** : l'impôt attribué à un gain est une convention (impôt de l'année avec le
gain, moins impôt sans lui), pas une ligne de déclaration ; quand plusieurs biens sont vendus la même
année, elle se répartit **au prorata du gain**, seule clé défendable puisque l'impôt porte sur le
revenu total. Et la ventilation CELI/REER/non-enregistré n'est attribuée à la vente que si celle-ci
est la **seule source de capital placé** de l'année — un héritage reçu en même temps se place dans le
même bloc.

**Deux défauts trouvés en chemin :**
1. **Un commentaire faux dans `couple.ts`** affirmait qu'un reliquat corrigeait la provision. Le
   couple n'en a pas : la provision non consommée reste simplement dans le revenu disponible.
   Commentaire corrigé ; l'asymétrie avec le mode solo demeure, elle est désormais écrite.
2. **`npx tsc --noEmit` ne vérifiait rien.** Le `tsconfig.json` racine est un fichier de références
   avec `"files": []` : la commande réussit toujours, sans compiler une ligne. Les « typecheck OK »
   des journées précédentes étaient donc vides de sens. Rien n'est passé au travers parce que
   `npm run build` exécute `tsc -b`, lancé après chaque changement — mais la bonne commande est
   `npm run typecheck`, qui existait déjà dans `package.json`.

- **291 cas-tests verts** (+12), build OK.

**Lot B — le tiroir de vente, côté solo.** Deux points d'entrée, parce qu'ils répondent à deux
besoins : le **badge 🏠 devient un bouton** (seul repère qui rende une vente trouvable en balayant le
tableau) et la ligne « Produit de vente » du tiroir devient cliquable. Le mécanisme de lien des
postes, jusque-là câblé sur le seul cas « impôt », est devenu générique.

La chaîne se vérifie de bout en bout à l'écran : 356 910 − 79 645 = **277 265 $** de produit, moins
23 435 $ d'impôt supporté = **253 830 $** placés, qui somment exactement à la ventilation
CELI 51 825 + REER 87 207 + non-enregistré 114 798. **Le solde hypothécaire remboursé est enfin une
ligne**, au lieu d'être soustrait en silence.

Le tiroir dit aussi, en toutes lettres, que l'impôt affiché est une attribution du modèle et non une
ligne de déclaration. Cas couverts : résidence exemptée, downsizing partiel, ventes multiples,
héritage la même année.

Contraste WCAG AA tiroir ouvert : 0 échec dans les deux thèmes. Aucun débordement à 390 px.

**Lot C — le couple et les cas particuliers.** Le tableau du ménage n'avait **aucun badge de vente** :
l'événement n'y était pas même signalé. Il est là, cliquable, comme en solo.

Les quatre cas particuliers vérifiés à l'écran, chiffres additionnés à la main :

| Cas | Ce que le tiroir montre |
|---|---|
| Couple | 356 910 − 79 645 = 277 265 ; −64 132 d'impôt = 213 133 placés, ventilation exacte |
| Résidence exemptée | aucune ligne d'impôt, phrase explicite sur le gain non imposable |
| Downsizing 60 % | équité 277 265, puis « vente partielle de 60 % » → produit 166 359 |
| Deux ventes | deux blocs, impôt réparti 32 710 / 7 896 au prorata du gain |
| Vente + héritage | la ventilation cède la place à la phrase d'avertissement |

Détail corrigé en vérifiant : un bien sans hypothèque affichait « Solde hypothécaire remboursé
− 0 $ ». La ligne est désormais omise.

Contraste WCAG AA : 0 échec sur sept vues, dans les deux thèmes. Aucun débordement aux trois
largeurs. **La fonctionnalité est complète** (lots A, B, C).

### 2026-07-28 — Colonne « Dépenses » : le moteur (lot A)
**Signalé par l'utilisateur** : « Revenus nets » est cliquable et explique ses chiffres, « Dépenses »
ne dit rien. En lisant le code, le défaut s'est révélé plus profond qu'un clic manquant — la colonne
affichait un produit de **quatre facteurs dont trois invisibles** : cible saisie × part du survivant
× inflation cumulée + versement hypothécaire.

**Décision (entretien)** : l'hypothèque **sort** des dépenses et redevient une ligne de sortie dans
les deux phases. Elle n'était une sortie qu'en accumulation ; en décaissement elle se fondait dans
« Dépenses », si bien que le même dollar changeait de place selon l'année et que la colonne dépassait
la cible saisie. Cela réconcilie aussi le tableau avec la suggestion de dépense livrée le matin même,
dont le libellé annonce « hors versements hypothécaires ».

**Le calcul ne change pas d'un cent** : seule la trace, qui ne sert qu'à l'affichage, est
réorganisée. `depenses` vaut exactement `cible − paiementImmo` — la soustraction, et non le produit
recalculé des composantes, pour garantir l'invariant de somme au bit près.

**Trois découvertes en cours de route :**
1. **Régression introduite puis attrapée par les tests.** Le couple a **trois** phases, dont
   `survie`. Écrire `phase === 'decaissement'` mettait les dépenses à zéro sur toute la fin de la
   projection. Le test porte désormais sur la cible, pas sur la phase.
2. **Piège JavaScript dans mon propre test** : après le décès `age1` vaut `null`, et `null <= 80`
   est **vrai**. Mon discriminant englobait donc les années de survie et masquait la régression
   ci-dessus. Il discrimine maintenant sur `phase === 'survie'`.
3. **Incohérence laissée en place, documentée** : le champ `revenuDisponible` du moteur porte la
   même inconsistance de phase que la trace avait. Il ne sert que de repli quand la trace est
   absente ; le corriger serait un changement de sortie du moteur, hors périmètre. Les deux tests
   d'invariance existants encodent l'écart explicitement au lieu de l'ignorer.

- **278 cas-tests verts** (+12), typecheck et build OK.

**Lot B — le tiroir, côté solo.** « Dépenses » est désormais cliquable comme sa voisine, et ouvre une
chaîne de construction qui **part toujours de la cible telle qu'elle a été saisie**, en dollars
d'aujourd'hui : on commence par le chiffre qu'on reconnaît, et l'on voit ce que le temps en fait. En
mode nominal une étape applique l'inflation ; en dollars d'aujourd'hui elle n'aurait aucun effet et
n'apparaît pas.

Les étapes somment **exactement** au montant de la cellule cliquée — vérifié à l'écran : 45 000 $ +
35 525 $ d'inflation cumulée (× 1,79) = 80 525 $, identique à la cellule.

Le tiroir signale aussi que le versement hypothécaire n'y est **pas** compris, avec un lien qui
descend vers le revenu disponible où il figure — c'est là que se réglait la confusion de départ.

Détail corrigé en vérifiant : `toFixed` affichait « × 1.79 » avec un point décimal ; en fr-CA c'est
une virgule.

Contraste WCAG AA tiroir ouvert : 0 échec dans les deux thèmes. Aucun débordement à 390 px.

**Lot C — le couple, et un défaut antérieur corrigé au passage.** Le tiroir s'ouvre aussi depuis le
tableau du ménage, avec la ligne qui manquait le plus : « Part conservée par le survivant (67 %),
−19 800 $ ». C'est la chute d'un tiers au premier décès, désormais nommée. Vérifié à l'écran :
60 000 − 19 800 = 40 200 $.

**Le surplus muet du survivant.** Pendant la phase de survie, le surplus affiché valait 0 alors que
la ventilation du réinvestissement était renseignée : le tiroir montrait « réinvesti dans CELI
7 075 $, non-enregistré 34 836 $ » sous un surplus de 0 $. Même cause que la régression du lot A —
une condition portant sur la phase au lieu de la cible. Le surplus affiche maintenant 41 911 $, et
la ventilation y somme exactement. Un test l'empêche de revenir, avec une garde contre le passage
« à vide » si le scénario ne dégageait aucun surplus.

**279 cas-tests verts**, contraste 0 échec dans les deux thèmes (tiroirs ouverts, solo et couple),
aucun débordement aux trois largeurs. La fonctionnalité est complète (lots A, B, C).

### 2026-07-28 — Dépense de retraite recommandée (lot A : le moteur)
L'étape « Décaissement » demandait un montant net d'impôt que **l'utilisateur devait deviner**, alors
que c'est la donnée qui commande tout le verdict. Le moteur sait désormais le calculer.

**`depenseSoutenable.ts`** — deux fonctions pures :
- `depenseMaximale` : la plus grande dépense annuelle que la stratégie finance jusqu'au décès,
  trouvée par dichotomie. Générique sur solo / couple, comme la descente de l'optimiseur.
- `depenseRecommandee` : la fraction du maximum qu'on accepte de consommer (85 % par défaut).

**Ce que « soutenable » veut dire** : rien de neuf, c'est le `suffisant` déjà défini par le moteur.
Deux conséquences héritées et assumées — un bien sans âge de vente n'est jamais consommé, et le
paiement hypothécaire s'ajoute par-dessus la cible (le montant est donc un budget de vie *hors*
versements hypothécaires).

**La monotonie a été vérifiée avant d'être supposée.** Toute la dichotomie repose sur l'idée que la
soutenabilité décroît quand la dépense monte, ce qui n'a rien d'évident avec un moteur fiscal non
linéaire (un saut de tranche pourrait créer une inversion étroite). Balayage fin — pas de 250 $ en
solo, 500 $ en couple — dans les deux modes : aucun re-succès après un échec. Le balayage est resté
dans la suite de tests, et la fonction revérifie malgré tout le montant qu'elle retourne.

**Coût mesuré** : 13 projections et 11,6 ms en solo, 15 projections et 54,9 ms en couple. L'estimation
de la conception (~40 ms en couple) était optimiste : une projection de couple coûte 3,7 ms, pas 1,9.
Reste très en deçà de l'optimiseur (320 ms). Contrôle croisé rassurant : la dichotomie retrouve
exactement le maximum du balayage exhaustif (49 500 $).

**Résultat contre-intuitif à retenir pour l'interface** : sur un dossier de 650 000 $ de comptes
**et** une maison de 420 000 $ jamais vendue, le maximum tombe à 49 500 $ par an. La maison
n'augmente pas le maximum d'un dollar tant qu'aucune vente n'est planifiée. Un test le fige
explicitement ; le lot D devra l'expliquer à l'écran, sans quoi le chiffre paraîtra faux.

**Défaut corrigé dans l'outillage de documentation** : la commande de vérification de l'arborescence
utilisait `git ls-files`, qui ne liste que les fichiers **déjà suivis** — elle ignorait donc les
fichiers neufs, précisément ceux qu'on oublie de documenter. Elle prend maintenant `--others`, et a
immédiatement signalé `depenseSoutenable.ts`.

- **266 cas-tests verts** (+14), typecheck et build OK.

**Lot B — la suggestion à l'écran.** `SuggestionDepense.tsx`, écrit générique dès maintenant pour que
le mode couple (lot C) le réutilise sans le réécrire. Sous le champ : le maximum, le montant
recommandé, un bouton « Utiliser ». Vérifié dans le navigateur — suggestion stable pendant la frappe,
bouton qui remplit le champ **et** fait passer le verdict au vert (la cohérence voulue par la
décision n° 3), aucune suggestion sur dossier vierge, message explicite quand même 0 $ est
infinançable. Contraste WCAG AA : 0 échec dans les deux thèmes. Aucun débordement à 390, 768 et
1600 px.

La mémoïsation exclut volontairement `depensesRetraite` de sa clé : le maximum ne dépend pas de la
valeur saisie, et sans cette précaution chaque frappe relancerait une dichotomie complète (55 ms en
couple) pour un résultat identique.

**Deux artefacts d'outillage rencontrés en vérifiant** (aucun défaut applicatif) : le serveur de
développement servait un CSS antérieur aux jetons sémantiques — `--pf-fond` était vide et `.carte`
retombait sur `bg-white/80` — et le `dist/` datait d'avant le nouveau composant. Le CSS *bâti* était
correct. Leçon : vérifier le thème sur `vite preview` plutôt que sur un serveur de développement
resté ouvert des heures.

**Lot C — le ménage et le réglage.** La suggestion est branchée sur l'étape « Dépenses du ménage »
avec le même composant, écrit générique au lot B : aucune ligne d'affichage n'a été réécrite. Le
maximum du ménage mesuré à l'écran (95 700 $) correspond exactement au test moteur.

La **part consommée** vit dans son propre contexte et sa propre clé de stockage, **hors des
hypothèses** : le moteur ne s'en sert jamais, elle ne change aucun calcul de projection. C'est une
convention d'affichage, au même titre que le thème. Un contexte plutôt qu'un état local parce que le
curseur et la suggestion sont dans deux composants distincts : deux `useState` séparés ne se
verraient pas, et bouger le réglage ne changerait le montant qu'au prochain rechargement.

Vérifié : le réglage à 95 % fait passer la recommandation de 81 300 $ à 90 900 $ **immédiatement**,
et survit au rechargement. Contraste WCAG AA : 0 échec dans les deux thèmes ; aucun débordement à
390, 768 et 1600 px.

*Choix assumé* : la part consommée n'est **pas** incluse dans le fichier d'export. C'est une
préférence d'affichage au défaut sûr (85 %), pas une donnée financière — l'ajouter reste une ligne
si l'usage montre le contraire.

**Lot D — la mention du patrimoine immobilisé.** Une ligne, sous la recommandation : « "Résidence"
n'a pas d'âge de vente : 380 000 $ d'équité ne financeront aucune dépense. Planifier une vente
augmenterait ce montant. » Elle répond au résultat contre-intuitif figé au lot A, et fait écho à
l'explication déjà présente dans le verdict.

**Seuls les biens sans âge de vente sont signalés**, le seul cas sans ambiguïté. Un âge de vente
postérieur au décès n'est **pas** détecté, et ce n'est pas un oubli : `ageVente` se compare à l'âge
du *propriétaire*, or un bien roulé au survivant peut encore être vendu par lui. Comparer à l'âge de
décès du propriétaire initial produirait une mention fausse en mode couple.

Vérifié sur cinq dossiers : aucun bien (rien), un bien (380 000 $), deux biens (560 000 $, accord
grammatical au pluriel), un bien **avec** âge de vente (rien), un bien sans équité réelle (rien,
seuil à 1 000 $). Contraste et responsive : 0 échec.

**La fonctionnalité est complète** (lots A à D).

### 2026-07-27 — Lot 5 (2/2) : mode sombre, par jetons sémantiques
Le chantier n'était pas « ajouter des couleurs foncées » mais **retirer les couleurs des composants**.

**Le problème de départ.** 371 classes de couleur littérales (`text-slate-500`, `bg-white`,
`ring-slate-200`…) réparties dans 31 fichiers. La solution paresseuse — doubler chacune d'une
variante `dark:` — aurait laissé 742 classes à maintenir en double, avec la certitude qu'elles
divergent au premier oubli.

**La solution.** Une couche de **jetons sémantiques** dans [`index.css`](src/index.css) : aucun
composant ne nomme plus une couleur, il nomme un **rôle** — `bg-carte`, `text-doux`, `ring-bordure`,
`bg-marque-plein`. Un seul bloc `:root` / `:root.sombre` donne à chaque rôle sa valeur selon le
thème. Ajouter un troisième thème ne demanderait plus de toucher un seul composant.

Détail technique qui compte : `@theme inline`. Sans `inline`, la valeur serait figée au niveau de
`:root` et le basculement ne descendrait pas dans l'arbre ; avec, les utilitaires référencent
directement `var(--pf-…)`, résolu sur l'élément qui l'utilise.

**Les valeurs sombres ne sont pas l'inverse mécanique des claires.** Trois exemples :
- Le texte secondaire passe d'ardoise **500** à ardoise **400** : conserver le 500 l'aurait laissé à
  3,7:1 sur fond sombre, sous la norme.
- Le bouton de confirmation inverse son fond ET son texte (émeraude 700 + blanc → émeraude 400 +
  ardoise 900) : un bouton doit **ressortir** du fond, pas s'y fondre.
- Le bouton d'action principale, ardoise 900 sur fond clair, deviendrait invisible sur une page
  ardoise 950 : il passe en ardoise clair avec texte sombre.

**Trois défauts trouvés en mesurant, pas à l'œil :**
1. La pastille d'étape active gardait `text-white` sur un fond de marque devenu **clair** en thème
   sombre : 1,9:1. Corrigé par le jeton `text-sur-marque`, qui suit son fond.
2. Les graphiques avaient des couleurs en dur. Le halo blanc autour de l'étiquette « retraite 60 »
   dessinait un pavé lumineux au milieu du graphique sombre ; il prend maintenant la couleur de la
   carte. Idem pour les graduations, le curseur de survol et la bande de décaissement.
3. **Ma sonde de contraste était fausse en thème sombre** : son fond de repli était codé en dur sur
   la couleur claire, ce qui faisait échouer 42 styles parfaitement valides. Elle lit désormais le
   fond réel du document. Elle a aussi été étendue aux textes SVG, peints par `fill` et non par
   `color` — les étiquettes des graphiques échappaient à tous les audits précédents.

**Vérifié** : 0 échec de contraste dans les **deux** thèmes sur les trois vues ; classe appliquée
avant le premier rendu (script en ligne dans `<head>`, avant le bundle) ; suivi du système en direct,
sans rechargement ; aucun débordement à 390 px en sombre.

- **252 cas-tests verts** (+2), build OK.

### 2026-07-27 — Lot 5 (1/2) : mobile, adresse partageable, accessibilité
Trois chantiers indépendants, **aucune ligne du moteur touchée**. Chacun a été mesuré avant et après,
dans un Chrome piloté : le responsive ne se juge pas à l'œil, et le contraste encore moins.

**1. L'application débordait de 968 px sur un téléphone.**
- La coquille de l'Atelier prévoyait bien le repli des trois colonnes sous `lg:`, mais personne ne
  l'avait jamais ouverte sous 1600 px. À 390 px la page faisait **1 358 px de large** : tout était
  coupé à droite, dans les trois vues.
- **Cause** : un enfant de grille CSS vaut `min-width: auto`, soit « au moins la largeur de mon
  contenu ». Le rail d'étapes, dont les titres sont en `whitespace-nowrap`, imposait donc sa largeur
  naturelle à toute la page — et son `overflow-x-auto` ne servait à rien, puisque le conteneur
  n'était jamais trop étroit.
- **Correctif** : `min-w-0` sur les trois colonnes ([`Atelier.tsx`](src/interface/atelier/Atelier.tsx)).
  Trois mots. Le débordement tombe à **0 px** à 390, 768 et 1600 px, sur les trois vues.
- Au passage, une hypothèse de départ s'est révélée fausse : je soupçonnais les tableaux année par
  année, qui n'ont pas de `overflow-x-auto`. Ils ont `overflow-auto`, qui couvre les deux axes — ils
  n'ont jamais été en cause.

**2. L'application n'avait qu'une seule adresse.**
- Recharger ramenait à l'onglet Impôt, le bouton **Retour** quittait l'application, et il était
  impossible d'envoyer un lien vers le mode couple.
- **Nouveau** [`routage.ts`](src/interface/routage.ts) : `#/impot`, `#/projection/solo/comptes`,
  `#/projection/couple/menage/depenses`. Le groupe et l'étape de l'Atelier vivent désormais dans
  l'URL au lieu d'un `useState`, donc F5 conserve la position et Retour revient à l'étape précédente.
- **Le dièse plutôt qu'un vrai chemin** : GitHub Pages sert des fichiers statiques ; `/projection/couple`
  demanderait au serveur un fichier inexistant (404 au rechargement). Ce qui suit le `#` ne lui est
  jamais envoyé.
- `lireRoute` **ne rejette jamais** : un lien tronqué ou mal recopié ouvre l'application sur la valeur
  par défaut. **10 cas-tests**, dont l'aller-retour lecture/écriture.

**3. Le contraste était sous la norme presque partout.**
- Mesure automatisée (luminance relative WCAG, fonds semi-transparents fusionnés, arrêts de dégradé
  résolus) : **59 styles de texte** échouaient sur les trois vues.
- Les familles : `text-slate-400` (2,5:1 pour 42 usages), `text-slate-300` (1,5:1), blanc sur
  `marque-500` (2,5:1 — les boutons de confirmation et la pastille d'étape active), `text-marque-600`
  sur blanc (3,7:1), et les **cartes de verdict en dégradé** dont même le titre en 24 px gras
  n'atteignait pas les 3:1 exigés.
- Correctifs : ardoise 400/300 → **500** (600 sur les fonds `slate-100`), émeraude 500 → **700** dès
  qu'elle porte du texte blanc, dégradés assombris d'un cran. **0 échec** après coup.
- **Clavier** : le rail devient un vrai jeu d'onglets (`tablist`/`tab`/`tabpanel`) — flèches, Début,
  Fin, et une seule étape dans l'ordre de tabulation. Atteindre le formulaire ne demande plus de
  traverser les neuf étapes.
- **Lecteur d'écran** : le verdict est une zone `aria-live="polite"`. Sans elle, la réponse à
  « est-ce que ça tient ? » n'existait qu'à l'écran.

**Correctif de suivi, le même jour.** La vérification du site déployé a montré que la zone `aria-live`
était **absente** — l'attribut ne vivait que sur la carte « évaluable », alors qu'un nouvel
utilisateur voit d'abord la carte « en attente de vos chiffres ». Or une région d'annonce doit exister
**avant** que son contenu change : apparaître en même temps que le texte, et la plupart des lecteurs
d'écran ne disent rien. C'est précisément la transition la plus intéressante — le premier verdict —
qui passait sous silence. La zone enveloppe désormais les deux états.

**Ce que la vérification a aussi révélé, et qui n'est pas corrigé** : `useDossier` fusionne le dossier
sauvegardé avec les valeurs par défaut **sur un seul niveau**. Un dossier partiel dont un objet
imbriqué manque des champs (un `localStorage` corrompu, un fichier d'une version antérieure) produit
des `NaN` silencieux à l'écran plutôt qu'un message. Découvert en me trompant moi-même dans un jeu
d'essai. À traiter le jour où le format de fichier évoluera.

- **250 cas-tests verts** (+10, tous sur le routage), build OK. La documentation portait encore
  « 147 cas-tests (moteur) » alors qu'il y en a 183 : écart rattrapé par la commande de vérification
  de la checklist ci-dessous.

### 2026-07-26 — Couple : les droits CELI du second conjoint dormaient
- **Signalé par l'utilisateur** : « j'avais 109 000 $ de droits CELI par conjoint, mais l'argent est
  allé au non-enregistré ».
- **Cause** : tout le surplus de retraite était placé chez **un seul** conjoint, celui dont le revenu
  imposable est le plus élevé (`niveauImposable(e1) >= niveauImposable(e2)`). Ce choix se justifie
  pour le REER, dont la déduction vaut le taux marginal — mais **pas pour le CELI** : un dollar y
  rapporte autant chez l'un que chez l'autre, et les droits du second partaient à la poubelle.
- **Correction** : le CELI des **deux** conjoints est rempli d'abord ; le reste suit la chaîne chez
  le plus imposé (son CELI étant alors plein, `placerSurplusRetraite` enchaîne sur le REER puis le
  non-enregistré). Sur le cas signalé : **CELI 116 000 → 232 000 $** pour le ménage et
  non-enregistré **164 462 → 48 462 $**. Le rendement de 116 000 $ cesse d'être imposé chaque année.
- **Champ « Droits CELI disponibles » désormais visible** dès qu'un héritage est prévu ou qu'un
  solde CELI existe, et plus seulement en cas d'épargne CELI planifiée. Il s'appliquait déjà en
  silence (défaut 109 000 $ − solde), mais rien ne le montrait ni ne permettait de l'ajuster.
- **240 cas-tests verts** (+2 : les deux CELI servent ; aucun droit n'est inventé).

### 2026-07-26 — Couple : la retraite du premier conjoint était ignorée
- **Signalé par l'utilisateur** sur une simulation réelle : conjoint 1 retraité à 60 ans, conjoint 2
  à 62 ans, et pourtant aucune dépense n'était financée avant 62 ans.
- **Cause** : `if (!ctx1.travaille && !ctx2.travaille)` — le décaissement attendait que **les deux**
  soient retraités. Et `travaille = age < ageRetraite`, indépendamment du salaire : un conjoint sans
  aucun revenu était donc réputé « travailler ». Le ménage vivait plusieurs années sans revenu ET
  sans dépense prélevée, ce qui **surestimait le patrimoine** (~150 000 $ dans le cas signalé, deux
  ans d'autonomie en trop).
- **Correction** : le décaissement commence dès que le **premier** conjoint atteint sa retraite —
  c'est là que le ménage adopte son budget de retraite. Le salaire de celui qui travaille encore
  entre dans l'encaisse : le solveur ne retire que le manque, et **rien du tout** si ce salaire
  couvre la cible (vérifié : capital intact de 60 à 66 ans avec un conjoint à 120 000 $). Le surplus
  est réinvesti par le mécanisme existant, qui remplace alors l'épargne planifiée.
- **Marqueur du graphique corrigé** : il affichait le plus tardif des deux départs, masquant une
  retraite anticipée. Il indique désormais le premier, là où le régime change réellement.
- **Traçabilité du couple complétée** : le tiroir omettait totalement le produit de vente et
  l'héritage, d'où des « revenus nets » négatifs à l'année d'une vente. Les postes « Produit de
  vente / downsizing », « Héritage reçu » et « Capital placé » y figurent maintenant, aux quatre
  états (accumulation, décaissement, survie).
- **238 cas-tests verts** (+3). Un test existant a dû être ajusté : il s'appuyait sans le dire sur
  l'ancienne règle, son second conjoint étant déjà retraité au départ.

### 2026-07-26 — Produit d'une vente immobilière : correction de justesse
- Conception passée au `/grill-me`. La demande portait sur l'abri fiscal ; la vérification a révélé
  un défaut plus grave.
- **Le même argent était compté deux fois.** En accumulation, le produit de vente était placé
  **brut** au non-enregistré pendant que l'impôt sur le gain était prélevé sur le revenu de l'année.
  Sur un immeuble à revenu de 400 000 $ avec 300 000 $ de gain et 80 000 $ de salaire : impôt de
  81 575 $ et **revenu disponible de −7 778 $** — physiquement impossible.
- **Correction** : on place le produit **net de l'impôt attribuable au gain**, mesuré par différence
  (impôt avec gain − impôt sans gain), puis dans la chaîne **CELI → REER → non-enregistré**. Sur le
  même cas : disponible de 58 498 $ l'année de la vente contre 58 274 $ l'année précédente — le train
  de vie n'est plus perturbé, et 135 000 $ sont abrités au CELI au lieu de dormir au non-enregistré.
- **Circularité évitée** : l'impôt du gain est mesuré avant tout versement REER issu de la vente
  (sinon le montant à placer dépendrait de l'impôt, qui dépendrait du montant placé). Le trop-perçu
  de provision est ensuite **replacé** au non-enregistré, comme `placerSurplusRetraite` le fait de
  son remboursement — une itération unique, bornée comme ailleurs dans le moteur.
- Le gain **augmente la déduction REER utilisable**, ce qui rend possible la stratégie classique
  « vendre un immeuble puis cotiser au REER pour absorber le gain ».
- **Couple aligné sur le solo** : le produit rejoint l'encaisse (il ne partait jamais dans le flux
  auparavant, même à la retraite) et le capital est placé chez son propriétaire, consommant SES droits.
- **Traçabilité refaite** : la cascade du tiroir montre désormais « Produit de vente » en entrée et
  « Capital placé (héritage, vente) » en sortie. Chaque dollar encaissé se retrouve quelque part.
- `placerHeritage` devient **`placerCapital`** (héritage et vente partagent la mécanique) et rejoint
  `placementSurplus.ts`.
- **235 cas-tests verts** (+10 : disponible jamais négatif, conservation des flux, abri effectif,
  downsizing partiel, impôt supérieur à l'équité, couple).
- ⚠️ **Les projections comportant une vente changent** : patrimoines plus bas (l'impôt n'est plus
  compté deux fois) et mieux abrités. C'est une correction, pas une régression.

### 2026-07-26 — Nouvelle source d'apport : l'héritage
- Conception passée au `/grill-me` avant toute ligne de code : unité de saisie, ordre de placement,
  véhicules admissibles, mode couple, optimiseur, traçabilité.
- **Non imposable à la réception** : au Canada, la succession du défunt règle l'impôt au décès. Le
  montant est saisi en **dollars d'aujourd'hui** et indexé jusqu'à l'âge de réception.
- **Placement CELI → REER → non-enregistré**, dans la limite des droits **restants** (l'épargne
  planifiée passe d'abord : elle est choisie, l'héritage est un imprévu). La part versée au REER est
  déductible ; le coût de base du non-enregistré est majoré de la part qui y aboutit.
- **Véhicules écartés, et pourquoi** : CRI et FRV sont immobilisés (aucun versement personnel
  possible) ; le CELIAPP demanderait de vérifier l'admissibilité à une première propriété, que le
  moteur ne connaît pas ; le REEE n'a pas ses plafonds modélisés. Aucun versement REER après 71 ans.
- **Piège découvert en vérifiant** : avec de gros droits REER accumulés, un héritage de 200 000 $
  créait une déduction de 166 460 $ sur un revenu de 123 000 $ — revenu imposable **négatif** et
  43 060 $ de déduction **perdus**, alors qu'une cotisation non déduite est reportable dans la
  réalité. Le versement REER est désormais **borné au revenu imposable restant** : conservateur, et
  jamais trompeur sur l'impôt de l'année. Le report de déduction reste non modélisé (limite connue).
- **Retraite** : l'héritage entre dans l'encaisse comme un produit de vente immobilière — il finance
  les dépenses de l'année d'abord, seul le surplus est placé.
- **Couple** : chaque conjoint a SES héritages, dans SES comptes, consommant SES droits. Un héritage
  n'est jamais commun (une succession désigne un héritier ; au Québec il reste un bien propre).
- **Interface** : étape « Héritage » (facultative) entre « Rentes d'employeur » et « Immobilier »,
  badge 🎁 sur l'année, poste « Héritage reçu (non imposable) » au tiroir de détail, et validations
  (âge hors horizon → erreur ; reçu l'année du décès → avertissement).
- **L'optimiseur n'y touche pas** (on ne choisit pas quand on hérite) mais en tient compte, puisqu'il
  évalue chaque stratégie avec `projeter`.
- **225 cas-tests verts** (+25 : indexation, placement, plafonds, non-imposition, borne de déduction,
  cas limites, couple, validations).

### 2026-07-26 — Refonte de l'interface, lot 4 : sauvegarde, scénarios, performance, impression
- **Verdict neutre** sur un dossier vierge : le bandeau annonçait « OBJECTIF FINANCÉ » sur du néant
  (zéro dépense est toujours finançable). Repéré en inspectant le site déployé. Un troisième état
  gris invite désormais à remplir ; critère : `depensesRetraite > 0`.
- **Sauvegarde et restauration en fichier** (`fichierDossier.ts`, 12 cas-tests) : boutons
  « Enregistrer » / « Ouvrir » dans l'en-tête. Tout vivait dans le `localStorage` — un nettoyage de
  cache et le travail disparaissait. Le fichier est signé et versionné, l'import valide avant
  d'écrire et demande confirmation. Rien n'est envoyé en ligne.
- **Scénarios nommés et comparables** (`scenarios.ts`, 8 cas-tests) : tableau des dépenses financées,
  de la valeur nette et de l'impôt, la simulation en cours incluse. Les ex æquo sont TOUS marqués.
  Sur un cas réel, reporter la retraite de 62 à 67 ans et la RRQ à 70 ans vaut **+734 489 $** de
  patrimoine contre 247 558 $ d'impôt de plus. Les scénarios sont inclus dans l'export.
- **Optimiseur en Web Worker** : la page gelait ~320 ms par optimisation. Le calcul part sur un fil
  séparé (chunk de 41 kB), devient **annulable**, et les erreurs remontent. Repli synchrone prévu.
- **`useDeferredValue`** : `projeter` simulait 55 années avec la trace à chaque frappe. La saisie
  passe devant ; le résultat précédent reste affiché, estompé, le temps du calcul.
- **Impression / PDF** : l'atelier déplie ses huit étapes le temps de l'impression, les colonnes
  repassent à plat, les tableaux s'impriment en entier. Vérifié en générant un vrai PDF.
- **198 cas-tests verts** (147 moteur + 51 interface).

### 2026-07-25 — Refonte de l'interface, lot 3 : les résultats racontent une histoire
- **Verdict en grand** en tête de la colonne de résultat (la réponse d'abord, l'action ensuite) :
  bandeau vert ou rouge, années à découvert, et **jauge** montrant la part de la retraite financée.
- **Correction de vocabulaire importante.** Le moteur marque une année d'« épuisement » dès que les
  retraits ne suffisent plus à financer la cible de dépenses (`projection.ts:449`) — ce n'est *pas*
  « le patrimoine tombe à zéro ». Avec un immeuble non vendu, l'ancienne tuile affichait donc
  « Épuisé à 71 ans » à côté de « Valeur nette au décès : 839 218 $ » : deux affirmations vraies,
  contradictoires en apparence. Le verdict parle maintenant de **dépenses financées** et explique le
  patrimoine restant : *« il est immobilisé — un bien non vendu ne paie pas les dépenses courantes »*.
- **Graphique enrichi** : curseur d'année suivant la souris, infobulle avec la ventilation par
  catégorie de compte, et **bande grisée** marquant la phase de décaissement. Remplace l'infobulle
  native `<title>` du navigateur.
- **Comparaison avant/après** dans le panneau d'optimisation : trajectoire actuelle (pointillé gris)
  et optimisée (trait vert) superposées — on voit *quand* l'écart se creuse, pas seulement son
  montant final. `ResultatOptimisation` exposait déjà `base` et `resultat`, rien à changer au moteur.
- **176 cas-tests verts** (147 moteur + 14 projection + 10 impôt + 5 jauge), build OK.

### 2026-07-25 — Onglet Impôt mis à niveau + actions CI à jour
- Les lots 0 à 2 n'avaient refondu que la Projection : l'onglet Impôt gardait ses sections empilées,
  sans bascule ni infobulles — une incohérence créée par la refonte elle-même. Il adopte maintenant
  les mêmes conventions, **sans** l'Atelier : son formulaire tient déjà à l'écran et ses résultats
  sont déjà collants, le découper en étapes forcerait des allers-retours inutiles.
- **Bascule Essentiel / Avancé** partagée : **18 → 10 champs**. Passent en avancé les dividendes
  ordinaires (SPCC), la rente de survivant RRQ, la cotisation syndicale et l'assurance-salaire.
- `TitreSection` accepte une **aide en infobulle**. Celle des déductions explique la différence
  déduction (~53 % au marginal) / crédit (~14-15 %), clé de lecture de tout l'onglet.
- **`validationImpot.ts`** (**10 cas-tests**) : SV avant 65 ans, rente RRQ avant 60 ans, cumul
  survivant + retraite plafonné à 65 ans, retenues de paie sans salaire, déduction REER sans revenu
  gagné. `ListeAlertes` extrait vers `ui/` pour servir les deux onglets.
- Correctif transverse : `.bouton-*` reçoit `shrink-0 whitespace-nowrap` — dans une colonne étroite,
  « Réinitialiser » se cassait en deux lignes sous son icône.
- **CI** : `actions/checkout` et `setup-node` v4 → **v7**, `upload-pages-artifact` v3 → **v5**,
  `deploy-pages` v4 → **v5**, et `node-version` 20 → **24** pour aligner la CI sur le poste de
  développement. Le runner signalait « Node.js 20 is deprecated » et forçait déjà Node 24.
- **171 cas-tests verts** (147 moteur + 14 projection + 10 impôt), build OK.

### 2026-07-25 — Refonte de l'interface, lot 2 : densité de saisie et cohérence
- **Bascule « Essentiel / Avancé »** (persistée) : les réglages ayant un défaut sûr sont masqués par
  défaut — croissance réelle du salaire, facteur d'équivalence, âges de début RRQ/SV, indexation des
  rentes, appréciation immobilière, âge min. de vente, fraction libérée, inflation, frais de gestion,
  et les comptes CELIAPP/CRI/REEE tant qu'ils sont vides. **Mesuré : 46 → 32 champs** pour le groupe
  solo complet, **12 → 7** pour l'étape Immobilier. Les droits REER et CELI restent visibles : leur
  valeur change réellement le résultat.
- **Aide en infobulle** : chaque étape n'affiche plus qu'**une phrase** ; le détail (règles fiscales,
  chaînes de débordement, formule RREGOP) passe derrière un bouton « ? » fermable au clic extérieur
  ou à Échap. L'étape Immobilier ouvrait sur cinq lignes de texte gris avant le premier champ.
- **Validations croisées** (`interface/projection/validation.ts`, code pur, **14 nouveaux cas-tests**) :
  ordre des âges, rente ou période de travail se terminant avant de commencer, cotisation REER
  dépassant les droits estimés (18 % du salaire + report), paiement hypothécaire ne couvrant pas les
  intérêts, âge de vente antérieur au minimum autorisé, équité négative, absence de cible de
  dépenses, inflation ou frais aberrants.
- Les alertes s'affichent en tête de l'étape concernée **et** comme point rouge (erreur) ou ambre
  (à vérifier) dans le rail : une incohérence se repère sans ouvrir l'étape. En couple, chaque
  message porte le nom du conjoint concerné.
- **161 cas-tests verts** (147 moteur + 14 validation), build OK, aucune erreur console.

### 2026-07-25 — Refonte de l'interface, lot 1 : « l'Atelier »
- La saisie passe d'une page qui défile à une **coquille à trois zones** : rail d'étapes à gauche,
  une étape à la fois au centre, **panneau de synthèse collant** à droite (optimiseur, indicateurs,
  courbe de valeur nette). Le principe : la saisie occupe une zone bornée, le résultat ne quitte
  jamais l'écran.
- **Le mode couple utilise la même coquille que le solo** : un sélecteur `Conjoint 1 / Conjoint 2 /
  Ménage` remplace les deux formulaires côte à côte. Les identifiants d'étape étant partagés, passer
  d'un conjoint à l'autre conserve l'étape courante — pratique pour les comparer.
- Découpage : `groupeSolo` (8 étapes), `groupeConjoint` (6), `groupeMenage` (2) dans `etapes.tsx`.
  Chaque étape porte son titre, son explication, son caractère facultatif et son état de complétude
  (pastille ✓ et compteur « n / m essentielles »).
- Nouveau `GraphiqueCompact` : courbe de valeur nette lisible dans une colonne de 21 rem (le
  graphique empilé par catégorie de compte, illisible à cette largeur, reste en pleine largeur sous
  l'atelier avec les tableaux année par année).
- Les étapes du groupe actif restent **montées mais masquées** (`hidden`) : l'état interne des
  sous-composants, dont le calculateur RREGOP, survit à la navigation.
- Suppression de `FormulaireProjection.tsx`, `FormulairePersonne.tsx` et `EtapesPersonne.tsx`.
- **Mesuré en navigateur** (Chrome headless, 1600 × 1150) : page du couple **6 000 → 3 408 px**,
  contrôles de saisie à l'écran **60-80 → 5-15**. Aucune erreur console ; **147 cas-tests verts**.

### 2026-07-25 — Refonte de l'interface, lot 0 : les fondations partagées
- Diagnostic : la page de saisie atteignait **~3 200 px en solo et ~6 000 px en couple** (jusqu'à 80
  contrôles à l'écran), les résultats du couple se trouvant **sous** deux formulaires complets — la
  boucle de rétroaction du simulateur était rompue. Plan complet : [`PLAN_REFONTE_UI.md`](PLAN_REFONTE_UI.md).
- `FormulaireProjection` et `FormulairePersonne` étaient à ~85 % identiques (blocs CELIAPP/CELI/REER/
  fonds de travailleurs copiés mot pour mot) et avaient déjà divergé. Nouveau **`EtapesPersonne`** :
  les cinq sections communes (vie active, travail à la retraite, comptes, rentes publiques, rentes
  d'employeur) servent désormais la personne seule **et** chaque conjoint. 191 → 84 et 170 → 66 lignes.
- Nouveau type d'interface **`ChampsPersonne`** : intersection structurelle de `HypothesesProjection`
  et `PersonneProjection`, mise à jour par patch partiel appliqué par chaque vue à son propre type
  (l'immutabilité du moteur est préservée, aucun type du moteur n'est modifié).
- Nouveaux partagés : `ui/Tuile`, `ui/CarteListe`, `ui/icones`, `projection/BlocsEpargne`,
  `projection/BarreOptimiseur`, et les hooks **`useDossier` / `useAffichageReel` / `useOptimiseur`**
  (le trio `useState` + `localStorage` + `useEffect` était répété dans les trois vues).
- `index.css` : palette de marque complète (50→900) et classes de composants `.bouton-primaire`,
  `.bouton-marque`, `.bouton-secondaire`, `.bouton-fantome`, `.bouton-ajout`, `.bouton-suppr`,
  `.carte-liste`, `.encadre-marque/ciel/ambre` — remplacent des chaînes Tailwind recopiées à la main.
- Corrections au passage : numérotation des sections du couple (immobilier et ménage portaient 5 et 6,
  déjà pris par chaque conjoint → 7 et 8) ; **rédaction unifiée au vouvoiement** ; anneaux de focus
  visibles sur tous les boutons ; libellé de suppression explicite (« Supprimer « Chalet » »).
- Bilan : `−547 / +235` lignes dans les fichiers existants, remplacées par du code partagé.
  **Aucune ligne du moteur touchée — 147 cas-tests verts**, typecheck et build OK.

### 2026-07-04 — Crédit pour fonds de travailleurs dans la projection
- La projection ignorait le crédit FTQ/Fondaction (`cotisationFondsTravailleurs: 0` codé en dur chaque
  année) — un trou pouvant valoir des dizaines de milliers de dollars sur une vie active.
- Nouveau champ `fondsTravailleursAnnuel` (solo + couple). Traité comme une **cotisation REER additionnelle**
  (déductible, consomme les droits REER, excédent en chaîne CELI → non-enregistré) qui donne le **crédit de
  30 %** sur le 1er 5 000 $ — appliqué via `cotisationFondsTravailleurs` dans l'entrée fiscale de l'année.
- Le crédit s'applique **même sans droits REER** (cas RREGOP : ~600 $ de droits mais crédit complet de 1 500 $).
- Refactor : closure `verserAuReer` (solo) réutilisée par l'épargne REER et le fonds. Interface : champ
  « Fonds de travailleurs (FTQ/Fondaction) » (solo + couple). **122 cas-tests verts.**

### 2026-07-04 — Droits de cotisation REER (avec facteur d'équivalence)
- Nouveaux helpers (`comptes.ts`) : `REER_PLAFOND_DOLLAR_2026` (33 810 $), `plafondReerNominal` (indexé
  salaires), `feRegimePD` (FE ≈ 18 %×salaire − 600 pour un RPA à PD), `droitsReerAnnuels`.
- Compteur `droitsReer` par personne (solo + couple) : départ = droits ARC saisis ; +18 % du salaire −
  FE chaque année active ; cotisations REER (**dont le REER de conjoint**) plafonnées, excédent en chaîne
  CELI → non-enregistré ; **aucune restauration au retrait** (≠ CELI). Seule la part versée est déductible.
- Facteur d'équivalence : case **« Régime à PD (RREGOP/RPA) »** (estimation auto ~600 $/an de droits) +
  champ FE exact optionnel (T4 case 52). Champs `droitsReerDisponibles`, `regimeRetraitePD`, `facteurEquivalenceReer`.
- Interface : bloc REER (solo + couple). **119 cas-tests verts.**
- Sources : ARC (plafonds MP/PD/REER ; Guide T4084 du facteur d'équivalence), TD/Globe & Mail (limite 2026).

### 2026-07-04 — Immobilier : type « Terrain vacant »
- Nouveau `TypeImmeuble` **'terrain'** + helper `estExemptable(type)` (résidence/chalet uniquement),
  utilisé par `determinerBienAbrite`, `vendre` et `gainAuDeces` — le terrain (comme l'immeuble à revenu)
  n'est **jamais abrité** par l'exemption pour résidence principale : gain en capital **toujours imposable**.
- Terrain = capital property sans revenu ; frais de possession (taxes, intérêts) non déductibles ni ajoutés
  au coût de base pour un terrain sans revenu (par. 18(2) LIR) — aucun effet fiscal modélisé en détention.
- Interface : bouton « + Terrain », valeurs par défaut, note fiscale (bandeau ambre). **112 cas-tests verts.**
- Sources : ARC (interprétations techniques 9606735, 2008-0280971E5 ; T4037), art. 53(1)h) LIR.

### 2026-07-03 — Plafonds CELIAPP et droits de cotisation CELI
- **CELIAPP** : plafonds 8 000 $/an et 40 000 $ à vie (`repartirCotisationCeliapp`), champ « déjà
  cotisé », excédent redirigé ; seule la part réellement versée est déductible.
- **CELI** : compteur de **droits vivant** — départ = « droits disponibles » (ARC, défaut heuristique
  109 000 $ − solde CELI), **+7 000 $/an indexé arrondi au 500 $** (`droitsCeliAnnuels`), cotisations
  déduites, **retraits restaurés l'année suivante** (mesurés autour du décaissement). La **fonte du
  REER** réinvestit au CELI dans la limite des droits (excédent au non-enregistré, `celiUtilise`).
- Chaîne de débordement : CELIAPP plein → CELI (selon droits) → non-enregistré. Solo **et** couple
  (droits par personne ; roulement au survivant sans consommer ses droits — titulaire remplaçant).
- Interface : blocs « CELIAPP déjà cotisé » et « Droits CELI disponibles » (solo + couple) ; le CELIAPP
  devient aussi une épargne du couple. **109 cas-tests verts.**

### 2026-07-03 — Bouton « Réinitialiser » + ouverture vierge
- Nouveau `BoutonReinitialiser` (avec confirmation) dans les trois vues : Impôt, Projection, Couple.
- L'application ouvre désormais **vide** par défaut (plus de valeurs d'exemple) — première visite propre
  pour les amis. Note « tes données restent sur ton appareil » ajoutée à la vue Impôt.

### 2026-07-03 — Mise en ligne : GitHub Pages
- Dépôt public `kamema9907-avis/SR_planificateur_financier_QC_CA` ; branche `main` créée (déployée),
  `version-1/2/3` conservées comme jalons.
- Workflow GitHub Actions (`.github/workflows/deploy.yml`) : à chaque push sur `main` → `npm ci` →
  **tests** → build → déploiement Pages. Un test rouge bloque le déploiement.
- `.gitignore` : exclusion de `*.tsbuildinfo` et `.claude/settings.local.json` (retirés du suivi).
- Site : <https://kamema9907-avis.github.io/SR_planificateur_financier_QC_CA/> (le `base: './'` de Vite
  permet le sous-chemin). README : section « Essayer en ligne » + hypothèses (QC, salarié, 2026).

### 2026-07-03 — Cotisations sociales, cotisation syndicale, assurance-salaire, rente de survivant
- Nouveaux `constantes/cotisations2026.ts` (RRQ/AE/RQAP + crédit syndical QC, indexables) et
  `cotisations.ts` (`calculerCotisations` : RRQ **scindé** base/bonifié, AE, RQAP ; `parametresCotisations`).
- Moteur : `EntreeFiscale` gagne `renteSurvivantRRQ`, `cotisationSyndicale`, `primeAssuranceSalaire`,
  `assuranceSalaireDeductible`. `construireBase` scinde les déductions **fédéral vs Québec** (le syndicat
  est déductible au fédéral, crédit au Québec) et calcule les cotisations du salaire. Fédéral/Québec :
  nouveau **crédit pour cotisations** (RRQ base + AE + RQAP ; + 10 % du syndicat au Québec) et déduction
  de la portion **bonifiée** du RRQ. `ResultatFiscal` : `cotisations`, `retenuesTotales`, `revenuNetEnPoche`.
- Projection (solo + couple) : l'impôt des années actives inclut désormais ces crédits/déduction ; le
  revenu disponible soustrait les retenues de paie (RRQ/AE/RQAP).
- Interface : champs « rente de survivant », « cotisation syndicale », « assurance-salaire » (+ interrupteur
  déductible) ; carte **« Retenues sur la paie & net en poche »** et lignes de crédit cotisations au détail féd./QC.
- **Traitement correct crédit-vs-déduction** (une déduction ≈ taux marginal ~50 %, un crédit ~14-15 %) ;
  paramètres 2026 sourcés (CFFP Sherbrooke + PBI Actuarial). **96 cas-tests verts**, build OK.

### 2026-07-02 — Phase 4 : l'optimiseur automatique
- Fonte anticipée du REER (`fonteReer.ts`) : nouveau paramètre `cibleFonteReer` + comportement dans la
  projection solo et couple (retirer du REER jusqu'à une cible de revenu imposable, réinvestir au CELI).
- Optimiseur par recherche (`optimiseur.ts`) : descente de coordonnées sur 4 leviers (ordre, fonte,
  âges RRQ/SV, ventes immobilières), évaluée par le simulateur, maximise le patrimoine net au décès.
  Révise la décision n°7 (glpk.js → recherche).
- Interface : bouton « Optimiser la stratégie » (solo + couple) + panneau d'amélioration (gain patrimoine,
  baisse d'impôt, stratégie recommandée) + « Appliquer ». 84 cas-tests verts.

### 2026-07-02 — Phase 3.5 : l'immobilier
- Modèle `Immeuble` (résidence/chalet/immeuble à revenu) : appréciation, hypothèque (amortissement),
  loyers imposables, vente + downsizing, arbitrage d'exemption automatique (`immobilier.ts`).
- Intégré aux projections solo et couple (attribution par propriétaire, roulement au survivant au décès).
- Interface : section « Immobilier » (solo + couple) + série « Immobilier (équité) » au graphique.
- 80 cas-tests verts (dont résidence exemptée, chalet imposé, loyers imposés, roulement au conjoint).

### 2026-07-02 — Phase 3 : le couple
- Modèle deux personnes symétriques + boucle de projection du ménage (réutilise le moteur fiscal).
- Fractionnement du revenu de pension optimisé automatiquement chaque année (`fractionnement.ts`).
- Décaissement coordonné : le conjoint le moins imposé retire en premier (`couple.ts`).
- REER de conjoint (cotisations croisées). Phase de survie : roulement sans impôt + rente de survivant
  RRQ (`renteSurvivantRRQ`) + dépenses du survivant (~67 %) + impôt au dernier décès.
- Interface : bascule « Couple », deux colonnes, section Ménage, indicateurs + graphique + tableau du ménage.
- Refactor : `EditeurComptes` et `SectionRentesEmployeur` rendus réutilisables ; `GraphiqueProjection`
  généralisé (`PointPatrimoine`). 66 cas-tests verts (dont propriété « le fractionnement ne hausse jamais l'impôt »).

### 2026-07-02 — Ajout : rentes d'employeur + RREGOP
- Nouveau modèle de rentes d'employeur (base + ponts) : montant, âge début/fin, indexation (0 / 50 % / 100 %).
- Calculateur RREGOP (2 % × service × salaire ; coordination 0,7 % à 65 ans ; indexation partielle).
- Interface : section « Rentes d'employeur » avec liste flexible, boutons pré-remplis et calculateur RREGOP.
- Ces rentes sont imposables (revenu de pension), réduisent les retraits, et seront fractionnables (Phase 3).

### 2026-07-02 — Ajout : rendement affiché + profil personnalisé
- Le rendement net de frais de chaque profil s'affiche dans la liste déroulante (ex. « Équilibré (4,1 %) »).
- Nouvelle option « Autre (personnalisé) » par compte : champ pour saisir son propre taux net annuel
  (remplace le profil). Moteur : `Compte.rendementPersonnalise` + `croissanceAnnuelle(..., rendementPersonnalise)`.

### 2026-07-02 — Ajout : 2e tableau « soldes des comptes »
- Nouveau tableau année par année montrant le solde de chaque compte, l'épargne versée (+) et les
  retraits (−). Rend visible où circule l'argent et confirme l'indexation des cotisations à l'inflation.

### 2026-07-02 — Phase 2 : projection cycle de vie
- Indexation des barèmes fiscaux par année (fondation) ; moteur rétrocompatible.
- Modèle de tous les comptes + profils de rendement calibrés IQPF.
- Rentes publiques (RRQ/SV) + minimums FERR/FRV.
- Boucle de projection accumulation + décaissement (solveur de cible nette d'impôt) + impôt au décès.
- Interface : onglets, formulaire de projection, graphique SVG, tableau annuel, indicateurs, nominal/réel.
- Validation croisée contre les taux marginaux combinés publiés du Québec. 49 cas-tests verts.

### 2026-07-01 — Phase 1 : moteur fiscal + interface
- Recherche et intégration des barèmes fédéraux/Québec 2026 et des Normes IQPF (extraits des PDF officiels).
- Moteur fiscal fédéral + Québec avec 21 cas-tests étalons.
- Interface web soignée et responsive (100 % locale).
- Ajouts après revue : revenus de pension correctement imposés ; crédit fonds de travailleurs FTQ/CSN.

### Comment mettre à jour la documentation

La documentation du projet, ce n'est pas **ce** document : c'en est **quatre sortes**, et elles ne
dérivent pas au même rythme.

| Document | Rôle | Qui le lit |
|---|---|---|
| `ETAT_DU_PROJET.md` | journal + inventaire complet | celui qui reprend le travail |
| `README.md` | **porte d'entrée** : ce que l'outil fait, comment le lancer | un visiteur, un ami |
| `PLAN_*.md` | conception d'un chantier, écrite **avant** le code | celui qui implémente |
| `sources_*.md` | références fiscales | celui qui vérifie un barème |

**Ce document a lui-même deux moitiés** : un *journal* (ce qui s'est passé) et un *inventaire* (ce
qui existe aujourd'hui). Le journal se remplit naturellement en fin de tâche ; l'inventaire demande
de relire des sections qu'on n'a pas touchées — c'est celui qui décroche.

**Et le README décroche encore plus vite**, parce que rien dans le travail quotidien n'oblige à
l'ouvrir. Constaté le 2026-07-29 : il était resté au 4 juillet, annonçait 122 cas-tests au lieu de
291, listait la Phase 5 comme « à faire » alors qu'elle était livrée, et ne mentionnait aucune des
fonctionnalités des trois semaines précédentes. Pendant ce temps la présente checklist était cochée
consciencieusement — elle ne parlait que d'`ETAT_DU_PROJET.md`.

Passer la liste **entière** :

**`ETAT_DU_PROJET.md`**
- [ ] **Journal** — une entrée datée en haut, expliquant le *pourquoi* et pas seulement le *quoi*
- [ ] **Date et résumé en tête** — doit décrire le **dernier** travail, pas l'avant-dernier
- [ ] **« Ce que l'outil fait aujourd'hui »** — si une capacité s'ajoute ou change
- [ ] **Architecture** — l'arborescence doit lister les fichiers réellement présents
- [ ] **Nombre de cas-tests** (trois endroits : qualité/validation, commande `npm test`, journal)
- [ ] **Limites et simplifications** — toute approximation nouvelle ou levée
- [ ] **Feuille de route** — cocher ce qui est fait

**`README.md`** — à relire dès qu'une fonctionnalité **visible** est livrée
- [ ] La **description** couvre-t-elle ce que l'outil sait faire *aujourd'hui* ?
- [ ] Le **nombre de cas-tests** y figure aussi (deux endroits : `npm test`, arborescence)
- [ ] L'**arborescence** et la **feuille de route** disent-elles la même chose qu'ici ?
- [ ] Une **commande** nouvelle ou piégeuse est-elle documentée ?

**Les plans**
- [ ] Le `PLAN_*.md` du chantier livré est-il **coché**, avec ses écarts assumés ?
- [ ] Est-il **atteignable** ? Un plan que rien ne référence est introuvable (arrivé deux fois).

---

Trois vérifications mécaniques. Le **moteur** est documenté fichier par fichier — c'est là que
la justesse fiscale se joue ; l'**interface**, qui compte plus de trente fichiers, l'est par dossier.

```bash
# 1. Fichiers du moteur absents de ce document (doit ne rien afficher).
# `--others` est indispensable : sans lui, `git ls-files` ne voit que les fichiers DÉJÀ suivis,
# donc la commande ignore les fichiers neufs — précisément ceux qu'on oublie de documenter.
for f in $(git ls-files --cached --others --exclude-standard 'src/moteur/**/*.ts'            | grep -v test | xargs -n1 basename | sort -u); do
  grep -q "$f" ETAT_DU_PROJET.md || echo "absent de la doc : $f"
done

# 2. Le compte de cas-tests annoncé correspond-il au réel ?
# `sed` retire le JOURNAL, qui garde légitimement les comptes des versions passées — sans quoi la
# commande ramène trente valeurs historiques. L'ancre est le TITRE de section : « Journal des
# modifications » apparaît aussi dans le sommaire, et couper là viderait presque tout le fichier.
# Le second `sed` retire les codes de couleur de vitest, qui cassent le motif.
npx vitest run 2>&1 | sed 's/\x1b\[[0-9;]*m//g' | grep -oE 'Tests +[0-9]+ passed' | grep -oE '[0-9]+'
sed '/^## .*Journal des modifications/,$d' ETAT_DU_PROJET.md | grep -oE '[0-9]+ cas-tests'
grep -oE '[0-9]+ cas-tests' README.md
# Attendu : le total réel, puis ce total partout, et le sous-total du moteur là où il est nommé.

# 3. Aucun document orphelin : chaque .md doit être référencé par un autre (doit ne rien afficher).
for f in *.md; do
  [ "$f" = "README.md" ] && continue
  grep -l "$f" *.md 2>/dev/null | grep -qv "^$f$" || echo "orphelin : $f"
done
```
