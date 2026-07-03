/**
 * Paramètres de l'impôt fédéral des particuliers — année d'imposition 2026.
 *
 * Sources :
 *  - ARC / Canada.ca, taux et tranches d'imposition courants 2026.
 *  - TaxTips.ca, Canada 2026 Federal Tax Rates & Brackets.
 *  - Investment Executive, « Essential tax numbers: Updated for 2026 ».
 *
 * Note : le taux de la 1re tranche est passé de 15 % à 14 % (réduction en vigueur
 * depuis le 1er juillet 2025 ; 2026 est la première année pleine à 14 %). Les crédits
 * non remboursables sont donc valorisés à 14 %.
 *
 * Paramètres marqués « À VALIDER » : à confirmer contre un calculateur officiel lors
 * de la validation croisée (décision de conception n°10).
 */
export const FEDERAL_2026 = {
  annee: 2026,

  /** Tranches d'imposition (taux statutaires). */
  paliers: [
    { plafond: 58_523, taux: 0.14 },
    { plafond: 117_045, taux: 0.205 },
    { plafond: 181_440, taux: 0.26 },
    { plafond: 258_482, taux: 0.29 },
    { plafond: Infinity, taux: 0.33 },
  ],

  /** Taux de conversion des crédits d'impôt non remboursables (= taux de la 1re tranche). */
  tauxCredit: 0.14,

  /**
   * Montant personnel de base (MPB) bonifié, réduit progressivement pour les hauts revenus.
   * Réduction linéaire de `max` à `min` entre les deux seuils de revenu net.
   */
  montantPersonnelBase: {
    max: 16_452,
    min: 14_829,
    seuilReductionDebut: 181_440,
    seuilReductionFin: 258_482,
  },

  /**
   * Montant en raison de l'âge (65 ans et plus au 31 décembre).
   * Réduit de `tauxReduction` par dollar de revenu net au-delà du seuil.
   * À VALIDER : seuil exact d'indexation 2026.
   */
  montantAge: {
    montant: 9_208,
    seuilReduction: 45_522,
    tauxReduction: 0.15,
  },

  /** Montant maximal pour revenu de pension (crédit sur pension admissible). */
  montantPensionMax: 2_000,

  /** Majoration et crédit d'impôt pour dividendes (crédit exprimé en % du dividende MAJORÉ). */
  dividendes: {
    determines: { majoration: 0.38, creditSurMajore: 0.150198 },
    ordinaires: { majoration: 0.15, creditSurMajore: 0.090301 },
  },

  /** Taux d'inclusion des gains en capital (la hausse proposée à 66,67 % a été annulée). */
  tauxInclusionGainCapital: 0.5,

  /** Récupération de la Pension de la Sécurité de la vieillesse (impôt de recouvrement). */
  psv: {
    seuilRecuperation: 95_323,
    tauxRecuperation: 0.15,
  },

  /** Abattement du Québec : 16,5 % de l'impôt fédéral de base pour les résidents du Québec. */
  abattementQuebec: 0.165,
} as const;
