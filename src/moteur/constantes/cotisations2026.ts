/**
 * Cotisations sociales 2026 (Québec) — RRQ, assurance-emploi (AE), RQAP.
 *
 * Sources (chiffres 2026 confirmés par deux sources indépendantes) :
 *  - CFFP, Université de Sherbrooke — « Cotisations au RRQ, au RQAP et à l'assurance-emploi ».
 *  - PBI Actuarial Consultants — « Régimes publics au Québec : nouveaux paramètres 2026 ».
 *  - Retraite Québec / Revenu Québec (MGA, MSGA, taux RRQ) ; Commission de l'assurance-emploi (AE 2026) ;
 *    Régime québécois d'assurance parentale (RQAP 2026).
 *
 * TRAITEMENT FISCAL 2026 (essentiel — ce ne sont PAS toutes des déductions) :
 *  - RRQ : la cotisation de BASE (5,30 %) donne un CRÉDIT non remboursable (féd. + QC) ; la cotisation
 *    BONIFIÉE — 1re additionnelle (1,00 %) + 2e additionnelle « RRQ2 » (4,00 %) — est une DÉDUCTION.
 *  - AE et RQAP : CRÉDIT non remboursable (jamais une déduction, pour un salarié).
 *
 * Note 2026 : le taux de BASE du RRQ baisse de 5,40 % à 5,30 % ; l'AE et le RQAP baissent aussi
 * (AE 1,31 → 1,30 % ; RQAP 0,494 → 0,430 %). Salarié (le travailleur autonome, qui paie les deux
 * parts, est un cas distinct non modélisé ici).
 */
export interface ParametresCotisations {
  readonly rrq: {
    /** Exemption générale — gelée par la loi à 3 500 $ (non indexée). */
    readonly exemption: number;
    /** Maximum des gains admissibles (1er plafond). */
    readonly mga: number;
    /** Maximum supplémentaire des gains admissibles (2e plafond, pour le RRQ2). */
    readonly msga: number;
    /** Taux de la cotisation de base du salarié → CRÉDIT. */
    readonly tauxBase: number;
    /** Taux de la 1re cotisation additionnelle → DÉDUCTION. */
    readonly tauxSupplementaire: number;
    /** Taux de la 2e cotisation additionnelle (RRQ2), sur les gains entre MGA et MSGA → DÉDUCTION. */
    readonly tauxDeuxieme: number;
  };
  /** Assurance-emploi (taux réduit du Québec) → CRÉDIT. Aucune exemption. */
  readonly ae: { readonly maxAssurable: number; readonly taux: number };
  /** RQAP → CRÉDIT. Aucune exemption. */
  readonly rqap: { readonly maxAssurable: number; readonly taux: number };
}

export const COTISATIONS_2026: ParametresCotisations = {
  rrq: {
    exemption: 3_500,
    mga: 74_600,
    msga: 85_000,
    tauxBase: 0.053,
    tauxSupplementaire: 0.01,
    tauxDeuxieme: 0.04,
  },
  ae: { maxAssurable: 68_900, taux: 0.013 },
  rqap: { maxAssurable: 103_000, taux: 0.0043 },
};

/**
 * Crédit d'impôt du Québec pour cotisations syndicales, professionnelles ou autres (ligne 397.1) :
 * 10 % du montant versé (le taux est passé de 20 % à 10 % à compter de 2015). Au fédéral, ces
 * cotisations sont plutôt une DÉDUCTION du revenu.
 */
export const TAUX_CREDIT_SYNDICAL_QC = 0.1;
