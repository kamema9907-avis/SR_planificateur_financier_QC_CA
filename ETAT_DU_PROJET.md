# État du projet — Planificateur Financier 2026

> **Document vivant** : synthèse de tout ce que le projet fait à ce jour. À mettre à jour au fil des
> phases. Voir le [journal des modifications](#-journal-des-modifications) à la fin pour l'historique.
>
> Dernière mise à jour : **2026-07-03** — plafonds CELIAPP (40 000 $ / 8 000 $ par an) et droits de
> cotisation CELI (compteur vivant) vérifiés dans la projection ; cotisations sociales (RRQ/AE/RQAP),
> cotisation syndicale, assurance-salaire et rente de survivant RRQ ajoutées à la Phase 1.

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
- **Hébergeable** comme site statique gratuit, partageable par un simple lien.
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
- **Plafonds vérifiés** : CELIAPP (8 000 $/an, 40 000 $ à vie, champ « déjà cotisé ») et **droits CELI**
  (droits ARC saisis, +7 000 $/an indexé arrondi au 500 $, retraits restaurés l'année suivante ; la
  fonte du REER respecte les droits). Excédent en chaîne : CELIAPP → CELI → non-enregistré.
- **Profils de rendement** (prudent / équilibré / dynamique) calibrés sur les Normes IQPF 2026.
- **Rentes publiques** RRQ et SV (saisie manuelle) avec ajustement report/anticipation et indexation.
- **Rentes d'employeur / RREGOP** : rente de base + ponts, indexation configurable, calculateur RREGOP
  (formule 2 % + coordination à 65 ans). Imposables, admissibles au crédit pour revenu de pension.
- **Minimums de retrait FERR/FRV** forcés dès 72 ans.
- **Immobilier** : résidence, chalet, immeuble à revenu — hypothèque (amortissement), loyers imposables,
  appréciation, vente/downsizing, exemption pour résidence principale (arbitrage automatique). Équité au patrimoine.
- **Phase d'accumulation** (épargne + croissance) puis **décaissement** : un solveur retire dans l'ordre
  choisi pour financer une cible de dépenses **nette d'impôt**.
- **Impôt au décès** (dispositions présumées des comptes enregistrés + gains latents).
- Sorties : **graphique** du patrimoine, **tableau** annuel, indicateurs clés (« le capital dure jusqu'à
  X ans », valeur nette au décès, **impôt total sur la vie**), interrupteur nominal/réel.

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

### Qualité / validation
- **109 cas-tests automatisés** (moteur fiscal, cotisations, plafonds CELIAPP/CELI, indexation, comptes, projection, décaissement, couple, immobilier, optimiseur).
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
│   │   ├── types.ts                # Comptes, hypothèses, résultat de projection
│   │   ├── comptes.ts              # Classification fiscale + croissance des comptes
│   │   ├── rentesPubliques.ts      # RRQ / SV (ajustement + indexation)
│   │   ├── decaissement.ts         # Solveur de retrait (cible nette d'impôt)
│   │   └── projection.ts           # Boucle année par année (cycle de vie)
│   ├── index.ts                    # API publique du moteur
│   └── *.test.ts                   # 109 cas-tests
└── interface/                      # UI React (habillage)
    ├── Champ.tsx                   # Champs de saisie réutilisables
    ├── format.ts                   # Formatage $ / % (fr-CA)
    ├── Resultats.tsx               # Résultats de l'onglet Impôt
    ├── VueImpotAnnuel.tsx          # Onglet « Impôt (1 année) »
    └── projection/                 # Onglet « Projection » (formulaire, graphique, tableau)
```

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
npm test         # les 109 cas-tests
npm run build    # version de production (dossier dist/, à héberger)
npm run preview  # prévisualiser la version de production
```

---

## ⚠️ Limites et simplifications actuelles

À raffiner lors des prochaines phases ou de la validation croisée :
- Traitement **salarié** : le **travailleur autonome** (deux parts du RRQ/RQAP, déduction de la part
  « employeur », AE facultative) n'est pas modélisé. **Montant canadien pour emploi** et crédits mineurs
  (dons, frais médicaux) non inclus.
- Seuil exact d'indexation du montant fédéral en raison de l'âge à confirmer.
- **Maximum de retrait FRV** provincial ; mécaniques fines du **CELIAPP** (achat 1re propriété,
  fermeture à 15 ans / 71 ans, report du droit annuel) et du **REEE** (règles de retrait) simplifiées ;
  plafond de cotisation **REER** non vérifié (les plafonds CELIAPP et les droits CELI le sont).
- Couple : rente de survivant RRQ avant 65 ans **approximée** ; max RRQ (plafond survivant) et règle
  d'attribution du REER de conjoint (3 ans) simplifiés.
- Indexation uniforme à l'inflation IQPF (certains seuils réels s'indexent différemment).
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
4. **Phase 4** — **Optimiseur automatique** : programmation linéaire (`glpk.js` / WebAssembly, in-browser)
   pour trouver la stratégie fiscalement optimale, plutôt que de simuler un scénario donné.
5. **Phase 5** — Finitions UI, export/import chiffré, partage, hébergement.

Idées / à explorer : immobilier détaillé (résidence/chalet/immeuble à revenu, arbitrage d'exemption),
options d'employé, analyse de sensibilité / Monte Carlo, autres provinces.

---

## 📓 Journal des modifications

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

### Comment mettre à jour ce document
À chaque changement notable : (1) ajouter une entrée datée en haut du journal, (2) mettre à jour les
sections concernées (« Ce que l'outil fait », feuille de route, limites), (3) actualiser la date en tête.
