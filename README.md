# Planificateur Financier 2026 🍁

Outil web d'optimisation fiscale pour le **Québec/Canada**, conçu pour optimiser l'impôt
sur toute la vie (vie active + retraite), pour une personne seule ou en couple.

> **100 % local** — vos données financières ne quittent jamais votre appareil (aucun serveur,
> stockées dans le navigateur). Hébergeable comme site statique gratuit.

> ⚖️ Outil de **calcul et de simulation** à des fins personnelles. Le titre « planificateur
> financier » est protégé au Québec (IQPF) ; cet outil ne fournit pas d'avis personnalisé à des clients.

## 🌐 Essayer en ligne

En ligne : **https://kamema9907-avis.github.io/SR_planificateur_financier_QC_CA/**.
Rien à installer — tout tourne dans le navigateur, et **tes données restent sur ton appareil**. L'app
s'ouvre vierge ; un bouton **« Réinitialiser »** remet les champs à zéro à tout moment.

> Hypothèses : résident du **Québec**, **salarié**, paramètres fiscaux **2026**. Hors de ce cadre
> (autre province, travailleur autonome), les chiffres sont des estimations moins précises.

---

## 🚀 Démarrer

```bash
npm install       # installer les dépendances
npm run dev       # serveur de développement (http://localhost:5173)
npm test          # lancer les 353 cas-tests
npm run typecheck # vérifier les types (« npx tsc --noEmit » ne vérifie RIEN ici :
                  #   tsconfig.json est un fichier de références, avec "files": [])
npm run build     # bâtir la version de production (dossier dist/)
npm run preview   # prévisualiser la version de production
```

## 🧱 Architecture

Le principe fondateur : **séparer le moteur de calcul de l'interface**.

```
src/
├── moteur/                  # Moteur — TypeScript PUR, testable, sans React
│   ├── constantes/          # Barèmes 2026 (fédéral, Québec), Normes IQPF, indexation,
│   │                        #   profils de rendement, minimums FERR, fonds de travailleurs
│   ├── bareme.ts            # Calcul de l'impôt progressif
│   ├── impotFederal.ts      # Impôt fédéral (+ abattement QC, récupération PSV) — barèmes indexables
│   ├── impotQuebec.ts       # Impôt du Québec — barèmes indexables
│   ├── moteurFiscal.ts      # Orchestrateur : assemble tout, calcule les taux
│   ├── projection/          # Cycle de vie : comptes, rentes, immobilier, héritage, décaissement,
│   │                        #   couple, optimiseur, dépense soutenable, traçabilité
│   ├── index.ts             # API publique du moteur
│   └── *.test.ts            # 275 cas-tests du moteur (dont validation croisée des taux publiés)
└── interface/               # Interface React (habillage) — aucune règle fiscale ici
    ├── atelier/             # Coquille de saisie : rail d'étapes, étape courante, résultat collant
    ├── projection/          # Vues solo et couple, tableaux, graphiques, tiroirs de détail
    ├── ui/                  # Briques partagées : thème, aide, impression, alertes
    ├── routage.ts           # Adresse partageable (#/projection/couple/…)
    └── theme.ts             # Thème Système / Clair / Sombre
```

Le détail complet — décisions verrouillées, limites, journal des modifications — vit dans
[`ETAT_DU_PROJET.md`](ETAT_DU_PROJET.md). Chaque chantier d'ampleur a en outre son plan, écrit
**avant** le code : [refonte de l'interface](PLAN_REFONTE_UI.md),
[dépense recommandée](PLAN_DEPENSE_RECOMMANDEE.md),
[détail des dépenses et des ventes](PLAN_DETAIL_DEPENSES.md),
[projection probabiliste](PLAN_MONTE_CARLO.md) (conception seule).

## ✅ Phase 1 — Moteur fiscal (une personne, une année)

Impôt **fédéral + Québec 2026** (fidélité « planification ») : tranches, montant personnel de base
(avec réduction), montant en raison de l'âge, crédit pour revenu de pension, majoration et crédit
pour dividendes, inclusion des gains en capital (50 %), déduction pour travailleur (QC), abattement
du Québec (16,5 %), récupération de la PSV, crédit fonds de travailleurs FTQ/CSN.

**Cotisations sociales du salarié** (calculées automatiquement à partir du salaire, avec leur vrai
traitement fiscal 2026) : **RRQ scindé** — cotisation de base → *crédit*, portion bonifiée
(1re additionnelle + RRQ2) → *déduction* ; **assurance-emploi** et **RQAP** → *crédits*. **Cotisation
syndicale** (déduction au fédéral + crédit québécois de 10 %), **assurance-salaire** (non déductible
par défaut) et **rente de survivant du RRQ** (imposable comme la RRQ). Affiche les **retenues sur la
paie** et le **revenu net « en poche »**, en plus des taux **moyen** et **marginal**. Onglet « Impôt (1 année) ».

## ✅ Phase 2 — Projection cycle de vie complet

Projection **année par année** de l'âge actuel jusqu'au décès, avec barèmes fiscaux **indexés à
l'inflation** chaque année (calcul nominal, affichage en dollars d'aujourd'hui) :

- **Comptes** : REER→FERR, CELI, CELIAPP, CRI→FRV, non-enregistré, REEE, groupés par traitement fiscal.
- **Plafonds vérifiés** : **CELIAPP** (8 000 $/an, 40 000 $ à vie, champ « déjà cotisé ») ; **droits CELI**
  (compteur vivant : droits ARC saisis, +7 000 $/an indexé/arrondi au 500 $, retraits restaurés l'année
  suivante) ; **droits REER** (droits ARC saisis, +18 % du salaire − **facteur d'équivalence** RREGOP/RPA,
  max 33 810 $, aucune restauration au retrait). L'excédent déborde en chaîne : CELIAPP → CELI → non-enregistré.
  Les deux champs de **droits disponibles** sont **toujours affichés** à l'étape « Vie active » : ils
  décident aussi où atterrit le produit d'une **vente d'immeuble**, un **héritage** ou le surplus d'un
  retraité-actif. Une alerte prévient si un tel apport arrive **sans droits REER** — le gain en capital
  serait alors imposé au maximum, faute de cotisation déductible pour l'absorber.
- **Crédit fonds de travailleurs** (FTQ/Fondaction) appliqué **chaque année active** : cotisation REER
  additionnelle + **crédit de 30 %** sur le 1er 5 000 $ (jusqu'à 1 500 $/an), obtenu même sans droits REER
  (membre RREGOP). Sur 30 ans, des dizaines de milliers de dollars auparavant ignorés par la projection.
- **Profils de rendement** (prudent / équilibré / dynamique) calibrés sur les Normes IQPF 2026.
- **Rentes publiques** RRQ et SV (saisie manuelle) avec ajustement report/anticipation et indexation.
- **Minimums de retrait FERR/FRV** forcés dès 72 ans.
- **Accumulation** (épargne + croissance) puis **décaissement** : un solveur par bissection retire dans
  l'ordre choisi pour financer une cible de dépenses **nette d'impôt**.
- **Travail à la retraite** (« retraité-actif ») : une ou plusieurs périodes de revenu après la
  retraite, qui réduisent le décaissement et rouvrent des droits REER.
- **Héritage** : apport ponctuel non imposable à un âge choisi, placé CELI → REER → non-enregistré
  selon les droits restants.
- **Dépense de retraite recommandée** : plutôt que de vous demander de deviner votre train de vie,
  l'outil cherche par dichotomie le montant maximal que votre capital finance jusqu'au décès et en
  recommande 85 % par prudence. Un bouton le reporte dans le champ.
- **REER ou CELI ?** Un réglage avancé **réinvestit le remboursement d'impôt** de vos cotisations REER
  et CELIAPP au lieu de le laisser grossir votre train de vie. C'est ce qui met les deux comptes à
  **coût égal de votre poche** : sans lui, le CELI gagne par construction, puisque 8 000 $ au REER
  coûtent moins que 8 000 $ au CELI. Le réglage allumé, l'**optimiseur cherche lui-même** le taux
  marginal au-delà duquel il vaut mieux verser au REER d'abord — la réponse dépend du dossier.
- **Impôt au décès** (dispositions présumées des comptes enregistrés + gains latents), **retranché du
  patrimoine transmis** : la « valeur nette au décès » annoncée est nette, et le tiroir de la dernière
  année montre la soustraction. C'est aussi ce chiffre net que l'optimiseur maximise.
- **En couple, le décès se décortique** : l'année du premier décès, le tiroir liste le **roulement au
  conjoint survivant** compte par compte — sans impôt, mais à imposition *différée* — ce qui explique
  pourquoi les soldes du survivant bondissent l'année suivante. Au second décès, ou aux deux s'ils
  tombent la même année, les dispositions présumées de chaque conjoint s'affichent séparément.
- Sorties : graphique du patrimoine, tableau annuel, indicateurs (« le capital dure jusqu'à X ans »,
  valeur nette au décès, **impôt total sur la vie**). Onglet « Projection (cycle de vie) ».
- **Traçabilité au clic** : tout montant souligné ouvre sa décomposition, et chaque décomposition
  somme **exactement** au total affiché. Sont expliqués le revenu disponible, l'impôt, la valeur
  nette, les dépenses (cible saisie × part du survivant × inflation) et les **ventes immobilières**
  — valeur à la vente, solde hypothécaire remboursé, gain, impôt supporté, produit net placé.
- **Suivi des droits de cotisation** : un tableau année par année donne la place CELI et REER
  inutilisée (par conjoint en couple), et le clic en montre la chaîne — report du 1er janvier,
  18 % du salaire moins le facteur d'équivalence, consommation **source par source**, restant au
  31 décembre. Toujours en dollars de l'année, comme un avis de l'ARC.

### Simplifications assumées (à raffiner)

Traitement **salarié** (le travailleur autonome, qui paie les deux parts du RRQ/RQAP et déduit la
part « employeur », n'est pas modélisé) ; montant canadien pour emploi et crédits mineurs ; maximum
de retrait FRV provincial, mécaniques fines du CELIAPP (fermeture à 15 ans / 71 ans, report du droit
annuel) et du REEE. Droits REER : facteur d'équivalence d'un régime à PD **estimé** (18 % × salaire − 600 $)
sauf si le FE exact est saisi ; base 18 % sur le salaire de l'année courante (approx. de l'année précédente) ;
arrêt des cotisations à 71 ans non forcé.
Indexation uniforme à l'inflation IQPF pour l'impôt (les plafonds RRQ/AE/RQAP suivent plutôt la
croissance du MGA, +1 %). Les montants sont donc de bonnes **estimations de planification**, pas une
déclaration au dollar près.

## ✅ Phase 3 — Le couple

Bascule « Couple » dans l'onglet Projection : deux conjoints entièrement modélisés (colonnes côte à
côte), un ménage à optimiser.

- **Fractionnement du revenu de pension** optimisé automatiquement chaque année (transfert minimisant
  l'impôt combiné).
- **Décaissement coordonné** : le conjoint le moins imposé retire en premier pour équilibrer les
  revenus et exploiter deux fois les tranches basses et les crédits.
- **REER de conjoint** (cotisations croisées : un déduit, l'autre possède).
- **Phase de survie** : au premier décès, roulement sans impôt des comptes enregistrés au survivant,
  **rente de conjoint survivant RRQ**, dépenses du survivant ajustables (~67 %), puis impôt au dernier décès.
- Résultats du ménage : autonomie, valeur nette au dernier décès, impôt total sur la vie du couple,
  graphique du patrimoine, tableau année par année (avec le montant fractionné).

Simplifications : rente de survivant RRQ avant 65 ans approximée ; max RRQ (plafond de survivant) et
règle d'attribution du REER de conjoint (3 ans) simplifiés.

## ✅ Phase 3.5 — Immobilier

Section « Immobilier » dans la projection (solo et couple) : résidence principale, chalet, immeuble à revenu, terrain.

- **Hypothèque détaillée** (amortissement : le solde décroît, les paiements s'ajoutent aux dépenses).
- **Appréciation** (norme IQPF 3,1 %) ; l'équité (valeur − hypothèque) entre dans le patrimoine (série au graphique).
- **Immeuble à revenu** : loyers nets − intérêts hypothécaires = revenu imposable.
- **Vente planifiée / downsizing** : à l'âge choisi, gain calculé, hypothèque remboursée, produit net réinvesti.
- **Exemption pour résidence principale** : arbitrage automatique maison-vs-chalet (abrite le plus fort gain/an).
- **Terrain vacant** : capital comme le chalet, mais **jamais** admissible à l'exemption (gain toujours imposable) et
  sans revenu ; frais de possession (taxes, intérêts) non déductibles ni capitalisés (par. 18(2) LIR).
- **Couple** : chaque bien a un propriétaire (1 / 2 / commun) ; roulement au survivant au décès.

Simplifications : DPA/amortissement fiscal et récupération omis ; frais de vente non modélisés ; arbitrage d'exemption
par heuristique ; carrying costs d'un terrain avec revenu (ajout à l'ACB) non modélisés (terrain supposé sans revenu).

## ✅ Phase 4 — Optimiseur automatique

Bouton « Optimiser la stratégie » (solo et couple) : trouve la combinaison qui **maximise le patrimoine
net au décès** (le capital ne doit pas s'épuiser), puis affiche l'amélioration et permet de l'appliquer.

- **Approche par recherche** (pas de programmation linéaire) : on évalue les stratégies candidates avec
  le simulateur exact (`projeter` / `projeterCouple`) et on garde la meilleure — descente de coordonnées.
- **Leviers optimisés** : ordre de décaissement, **fonte anticipée du REER** (remplir les tranches basses
  tôt en retraite, réinvestir au CELI), **âges de début RRQ (60-72) et SV (65-70)**, **moment des ventes
  immobilières**.
- Résultat : gain de patrimoine au décès, réduction de l'impôt sur la vie, et la stratégie recommandée.

*Révision de la décision n°7 : l'approche par recherche remplace `glpk.js`, car l'impôt QC+fédéral est
trop non linéaire pour un LP fiable, et notre moteur est déjà un simulateur exact et rapide.*

## ✅ Phase 5 — L'interface (« l'Atelier »)

La saisie tenait sur une page de 6 000 pixels, les résultats sous les formulaires : modifier un champ
et voir son effet demandait de défiler. Elle est désormais découpée en **étapes courtes**, avec un
rail à gauche, l'étape au centre et le **résultat qui ne quitte jamais l'écran**.

- **Verdict en grand** : « vos dépenses sont financées jusqu'à 95 ans », avec une jauge d'autonomie.
- **Essentiel / Avancé** : les réglages experts (indexation, facteur d'équivalence, appréciation…)
  sont masqués par défaut, jamais perdus.
- **Validations croisées** : les incohérences sont signalées par une pastille dans le rail, avant
  même d'ouvrir l'étape.
- **Scénarios comparables** : enregistrez une simulation sous un nom, modifiez vos hypothèses,
  comparez ligne à ligne.
- **Sauvegarde en fichier** : le dossier s'exporte et se réimporte en JSON — le `localStorage` d'un
  navigateur n'est pas un coffre-fort. **Impression PDF** de la simulation complète.
- **Mode sombre** (Système / Clair / Sombre), **adresse partageable** (`#/projection/couple`, le
  rechargement et le bouton Retour fonctionnent), **utilisable sur téléphone**, et **contraste WCAG AA
  vérifié par mesure** dans les deux thèmes.
- L'optimiseur tourne sur un **fil séparé** (Web Worker) : la page reste vivante, le calcul annulable.

## 🗺️ Feuille de route

1. **✅ Phase 1** — Moteur fiscal (une personne, une année).
2. **✅ Phase 2** — Projection long terme cycle de vie (accumulation + décaissement).
3. **✅ Phase 3** — Le couple : fractionnement optimisé, REER de conjoint, décaissement coordonné, survie.
4. **✅ Phase 3.5** — Immobilier : résidence, chalet, immeuble à revenu (hypothèque, loyers, vente, exemption).
5. **✅ Phase 4** — Optimiseur automatique (recherche sur le moteur) : trouve la meilleure stratégie fiscale.
6. **✅ Phase 5** — L'interface (« l'Atelier »), mode sombre, accessibilité, adresse partageable,
   sauvegarde en fichier, scénarios, impression PDF.
7. **Phase 6 — envisagée** : projection **probabiliste** (Monte Carlo), pour répondre « dans quelle
   proportion des scénarios de marché mon plan tient-il ? » plutôt que par un oui/non. Conception
   détaillée écrite dans [`PLAN_MONTE_CARLO.md`](PLAN_MONTE_CARLO.md), implémentation non commencée.

Idées à explorer : options d'employé, autres provinces, travailleur autonome.

## 📚 Sources des données (2026)

- **Fédéral** : ARC / Canada.ca, TaxTips.ca, Investment Executive (« Essential tax numbers 2026 »).
- **Québec** : Ministère des Finances du Québec, « Paramètres du régime d'imposition des
  particuliers pour l'année d'imposition 2026 » (novembre 2025, indexation 2,05 %).
- **Cotisations sociales (2026)** : Retraite Québec / Revenu Québec (RRQ — MGA 74 600 $, MSGA
  85 000 $, base 5,30 % + bonifié 1,00 % + RRQ2 4,00 %) ; Commission de l'assurance-emploi (AE
  Québec — max 68 900 $, 1,30 %) ; RQAP (max 103 000 $, 0,430 %) ; tableaux consolidés de la CFFP
  (Université de Sherbrooke) et de PBI Actuarial. Crédit syndical QC 10 % (Revenu Québec, ligne 397.1).
- **Hypothèses de projection** : « Normes d'hypothèses de projection 2026 »,
  Institut de planification financière & FP Canada (avril 2026).

Voir [sources_planificateur_financier_QC_CA.md](sources_planificateur_financier_QC_CA.md) pour la
liste complète des références, calculateurs officiels et librairies.

## 🛠️ Stack

TypeScript · React 18 · Vite 6 · Tailwind CSS v4 · Vitest — aucune dépendance serveur.
