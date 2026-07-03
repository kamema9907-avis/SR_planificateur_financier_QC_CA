/**
 * Paramètres de l'impôt du Québec des particuliers — année d'imposition 2026.
 *
 * Source principale (chiffres officiels, au dollar près) :
 *  - Ministère des Finances du Québec, « Paramètres du régime d'imposition des
 *    particuliers pour l'année d'imposition 2026 » (novembre 2025). Indexation : 2,05 %.
 *
 * Les taux de crédit d'impôt pour dividendes ne sont pas indexés ; valeurs courantes
 * (à reconfirmer chaque année).
 */
export const QUEBEC_2026 = {
  annee: 2026,

  /** Tranches d'imposition du Québec. */
  paliers: [
    { plafond: 54_345, taux: 0.14 },
    { plafond: 108_680, taux: 0.19 },
    { plafond: 132_245, taux: 0.24 },
    { plafond: Infinity, taux: 0.2575 },
  ],

  /** Taux de conversion des crédits d'impôt non remboursables. */
  tauxCredit: 0.14,

  /** Montant personnel de base. */
  montantPersonnelBase: 18_952,

  /** Montant en raison de l'âge (65 ans et plus). */
  montantAge: 3_986,

  /** Montant pour revenus de retraite (plafonné au revenu de pension admissible). */
  montantRevenusRetraite: 3_541,

  /** Montant pour personne vivant seule (montant de base). */
  montantPersonneVivantSeule: 2_172,

  /**
   * Les montants « âge + personne vivant seule + revenus de retraite » sont réduits
   * ensemble en fonction du revenu net excédant le seuil.
   */
  seuilReductionMontantsSociaux: 42_955,
  tauxReductionMontantsSociaux: 0.1875,

  /** Déduction pour travailleur : min(6 % du revenu de travail, plafond). */
  deductionTravailleur: { taux: 0.06, plafond: 1_450 },

  /** Majoration et crédit d'impôt pour dividendes (crédit en % du dividende MAJORÉ). */
  dividendes: {
    determines: { majoration: 0.38, creditSurMajore: 0.117 },
    ordinaires: { majoration: 0.15, creditSurMajore: 0.0342 },
  },

  /** Taux d'inclusion des gains en capital (harmonisé au fédéral). */
  tauxInclusionGainCapital: 0.5,
} as const;
