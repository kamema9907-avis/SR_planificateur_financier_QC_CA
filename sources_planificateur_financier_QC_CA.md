# Sources pour créer un planificateur financier Québec/Canada

Note légale : le titre « planificateur financier » est protégé au Québec (encadré par l'IQPF). Rien n'empêche de coder un outil de calcul/simulation, mais si tu veux offrir des recommandations personnalisées à des clients, informe-toi sur l'encadrement professionnel.

## 1. Outils gouvernementaux officiels (référence et validation)

- [SimulR – Retraite Québec](https://simulr.svc.retraitequebec.gouv.qc.ca/) — simulateur simplifié de revenu de retraite (RRQ + SV + épargne).
- [CompuPension – Retraite Québec](https://www.retraitequebec.gouv.qc.ca/en/online-services-tools/compupension-simulating-your-retirement-income) — simulation plus détaillée de la situation financière à la retraite.
- [Outils de planification de la retraite – Retraite Québec](https://www.retraitequebec.gouv.qc.ca/en/online-services-tools/our-financial-planning-retirement-tools)
- [Calcul de la rente RRQ – Retraite Québec](https://www.retraitequebec.gouv.qc.ca/en/citizens/retirement-planning/applying-your-retirement-pension/retirement-pension-quebec-pension-plan/calculation-your-retirement-pension) — formule officielle de calcul de la rente.
- [Taux et tranches d'imposition (ARC)](https://www.canada.ca/en/revenue-agency/services/tax/individuals/tax-rates-brackets/current-year.html) — barèmes fédéraux à jour.
- [Revenu Québec](https://www.revenuquebec.ca/) — barèmes provinciaux, crédits d'impôt.
- [Québec.ca – Planification financière](https://www.quebec.ca/en/finance-income-and-other-taxes/financial-lanning) — portail gouvernemental.

## 2. Normes de référence utilisées par les vrais planificateurs (essentiel)

- [Normes d'hypothèses de projection 2026 – Institut de planification financière (IQPF)](https://institutpf.org/assets/Documents/Normes-projection/InstitutPF-NHP.pdf) — taux d'inflation, rendements, espérance de vie, etc. C'est LA référence que tout planificateur pro utilise pour ses hypothèses de projection long terme. Publié conjointement avec FP Canada.
- [2026 Projection Assumption Guidelines (version anglaise)](https://institutpf.org/assets/Documents/Normes-projection/InstituteFP-PAG.pdf)
- [Article résumé — Finance et Investissement](https://www.finance-investissement.com/zone-experts_/normes-dhypotheses-2026-linstitut-de-planification-financiere-publie-sa-nouvelle-edition/)

Si tu veux que ton outil soit crédible, calibrer tes hypothèses (rendement, inflation, longévité) sur ces normes plutôt que d'inventer des chiffres est probablement le geste le plus important.

## 3. Calculateurs indépendants / communautaires (Québec)

- [CFFP – Chaire en fiscalité et finances publiques (Université de Sherbrooke)](https://cffp.recherche.usherbrooke.ca/outils-ressources/retraite-epargne-requise-et-regimes-publics-de-retraite/) — outils académiques gratuits sur l'épargne requise et les régimes publics.
- [Simulateur RRQ – CFFP](https://cffp.recherche.usherbrooke.ca/simulateur-prestation-rrq/)
- [Retraite101 – Boutique d'outils Excel](https://retraite101.com/boutique/) — feuilles Excel adaptées au Québec (CoastFIRE, simulateur REEE, simulateur de décaissement, report RRQ/SV). Bon exemple de logique de calcul à observer/décortiquer.
- [Retraite101 – Devenez votre propre planificateur financier](https://retraite101.com/devenez-votre-propre-planificateur-financier/)
- [Jeune Retraité – Boîte à outils / comparateurs](https://jeuneretraite.ca/outils-comparateurs-finances/)

## 4. Logiciels professionnels commerciaux (pour comprendre le standard du marché)

Utile pour voir ce que les vrais pros considèrent indispensable (modules, UX, granularité fiscale) :

- [Conquest Planning](https://www.conquestplanning.com/) — recalcul instantané, gestion de sociétés/fiducies, T2 corporatif.
- [Snap Projections](https://snapprojections.com/) — visualisation des taux marginaux/effectifs, ~828$/an standard, 1188$/an avec planification de société privée.
- NaviPlan — ~2500$/licence/an, portail client en option.
- RazorPlan (Razor Logic Systems).

Comparatifs : [Advisor.ca — how advisors pick financial planning software](https://www.advisor.ca/practice/planning-and-advice/how-advisors-pick-financial-planning-software/), [Finance et Investissement](https://www.finance-investissement.com/fi-releve/carriere/choisir-les-bons-logiciels-de-planification-de-mi-carriere/).

## 5. Code / librairies open source (points de départ concrets)

- [kronostechnologies/tax-ca (GitHub)](https://github.com/kronostechnologies/tax-ca) — **le plus pertinent** : données et fonctions de calcul pour impôts canadiens, comptes enregistrés (REER, CELI, FERR, CRI/FRV) et régimes (RPC, RRQ, SV). Base solide pour ne pas recoder les barèmes à la main.
- [mjcrepeau/retirement-planner (GitHub)](https://github.com/mjcrepeau/retirement-planner) — calculateur multi-comptes (REER, CELI, FERR, CRI, CELIAPP/FHSA, non-enregistré), tranches fédérales/provinciales, RPC et SV.
- [thesweetlegend/cdn_tax_calc (GitHub)](https://github.com/thesweetlegend/cdn_tax_calc) — calculateur d'impôt Python, tranches fédérales + Ontario/Québec, RPC/AE, déductions REER.
- [xlai20/Canada-Income-Tax-Calculator (GitHub)](https://github.com/xlai20/Canada-Income-Tax-Calculator)
- [taxcalc (PyPI)](https://pypi.org/project/taxcalc/) — surtout orienté US, mais architecture intéressante pour un moteur de simulation fiscale.

Approches génériques (US, mais logique transposable) :
- [mdlacasse/Owl (GitHub)](https://github.com/mdlacasse/Owl) — planification par programmation linéaire en nombres entiers pour optimiser les retraits/conversions ; approche mathématique plutôt que simulation.
- [willauld/fplan et wscott/fplan (GitHub)](https://github.com/willauld/fplan) — optimisation des retraits via programmation linéaire.
- [cFIREsim (GitHub Pages)](https://alistair-marshall.github.io/cFIREsim-open/) — simulateur FIRE basé sur données historiques boursières (approche Monte Carlo/historique plutôt que projection linéaire).
- Recherche GitHub : [topics/retirement-planning](https://github.com/topics/retirement-planning), [topics/retirement-calculator](https://github.com/topics/retirement-calculator).

## 6. Données ouvertes et APIs (pour alimenter ton outil automatiquement)

- [Statistique Canada – API / Web Data Service](https://www.statcan.gc.ca/en/developers) — accès JSON/SDMX aux séries statistiques (inflation, salaires, démographie).
- [Statistique Canada – Reference Data as a Service (RDaaS)](https://www.statcan.gc.ca/en/developers/rdaas)
- [Banque du Canada – taux d'intérêt (Portail du gouvernement ouvert)](https://open.canada.ca/data/en/dataset/d5ffb2fb-3607-4bda-8f74-2f7b264a9a85) — 39 séries de taux, historique depuis 1991. La Banque du Canada a aussi sa propre Valet API (https://www.bankofcanada.ca/valet/docs) pour taux de change et taux directeurs en temps réel.
- [Portail du gouvernement ouvert – API générale](https://open.canada.ca/en/access-our-application-programming-interface-api)
- [ARC – taux et tranches d'imposition courants](https://www.canada.ca/en/revenue-agency/services/tax/individuals/tax-rates-brackets/current-year.html)

## 7. Agrégation bancaire / open banking (si tu veux connecter des comptes réels)

- [Flinks](https://www.flinks.com/) — le plus fort au Canada, connexions API à la majorité des institutions, partenaire de la Banque Nationale.
- Plaid — présent au Canada, partenaire notamment de RBC (avec Yodlee).
- MX, Yodlee, Finicity, Tink, TrueLayer, Salt Edge — comparatif utile : [openbankingtracker.com](https://www.openbankingtracker.com/banking-data-aggregation).
- [Open banking au Canada — lancement 2026 (Flinks blog)](https://www.flinks.com/blog/open-banking-canada-2026-launch-fintech-institutions) — la Banque du Canada supervise le cadre ; accès en lecture prévu dès 2026, écriture (transferts) prévue 2027. À suivre si tu veux une intégration bancaire native plus tard.

## 8. Apps grand public existantes (inspiration produit/UX)

- Hardbacon — agrégateur de finances personnelles + comparateurs de produits financiers, populaire au Québec.
- [Retraite101](https://retraite101.com/ressources/) et [Jeune Retraité](https://jeuneretraite.ca/) — blogues avec calculateurs et convertisseurs.
- Wealthsimple — pour l'UX de simulation retraite/investissement (pas open source, mais bon banc d'essai UX).

## Les grandes options pour « créer le tien »

En résumé, tu as essentiellement quatre niveaux de complexité possibles :

1. **Feuille de calcul (Excel/Google Sheets)** — le plus rapide à faire, s'inspire des modèles Retraite101/CFFP. Pas de code, mais limité en interactivité.
2. **Outil web léger fait maison** — un calculateur (REER/CELI/RRQ/SV/impôt) codé à partir de zéro ou en s'appuyant sur `tax-ca` ou `retirement-planner` pour les barèmes, avec les hypothèses IQPF en constantes. Bon compromis effort/contrôle.
3. **Application complète avec agrégation bancaire** — ajoute Flinks/Plaid pour importer les comptes réels, plus lourd à construire et à maintenir (conformité, sécurité des données financières).
4. **Moteur d'optimisation** — inspiré d'Owl/fplan, utilise la programmation linéaire pour trouver la stratégie optimale de décaissement/conversion plutôt que juste simuler un scénario. Le plus sophistiqué, utile si l'objectif est de rivaliser avec les outils pro (Conquest, Snap).

Le point commun à tous : calibrer les hypothèses sur les Normes IQPF/FP Canada (section 2) et valider tes résultats contre SimulR/CompuPension (section 1) pour t'assurer que tes calculs de RRQ/SV sont exacts.
