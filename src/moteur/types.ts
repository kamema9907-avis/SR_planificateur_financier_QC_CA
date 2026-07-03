/**
 * Types du domaine fiscal — Planificateur Financier 2026.
 *
 * Phase 1 : moteur fiscal pour UNE personne, UNE année (2026), résidente du Québec.
 * Le moteur est du code pur (aucune dépendance à React) afin d'être testable et
 * réutilisable par les phases ultérieures (projection, couple, optimiseur).
 */

export type Province = 'QC';

/** Un palier d'imposition progressif. */
export interface Palier {
  /** Borne supérieure de la tranche (Infinity pour la dernière). */
  readonly plafond: number;
  /** Taux marginal appliqué à la portion de revenu dans cette tranche (ex. 0.14). */
  readonly taux: number;
}

/**
 * Données saisies pour une personne, une année.
 * Tous les montants sont en dollars réels reçus (avant tout traitement fiscal).
 */
export interface EntreeFiscale {
  readonly annee: 2026;
  readonly province: Province;
  /** Âge au 31 décembre de l'année d'imposition. */
  readonly age: number;
  /** La personne vit-elle seule (crédit québécois « personne vivant seule ») ? */
  readonly vitSeul: boolean;

  // --- Revenus (montants réels encaissés — TOUS pleinement imposables sauf mention) ---
  /** Revenu d'emploi / de travail (salaire). */
  readonly revenuEmploi: number;
  /** Rente du RRQ / RPC — imposable, mais NON admissible au crédit pour revenu de pension. */
  readonly revenuRRQ: number;
  /** Pension de la Sécurité de la vieillesse — imposable, assujettie à la récupération (clawback). */
  readonly revenuPensionSV: number;
  /**
   * Revenu de pension privé (FERR, rente viagère, rente d'un RPA/RREGOP) — imposable ET
   * admissible au crédit fédéral pour revenu de pension (max 2 000 $) et au montant
   * québécois pour revenus de retraite.
   */
  readonly revenuPensionPrivee: number;
  /** Autres revenus pleinement imposables : intérêts, loyers nets, revenu d'entreprise. */
  readonly autresRevenus: number;
  /** Dividendes canadiens déterminés (montant réel reçu). */
  readonly dividendesDetermines: number;
  /** Dividendes canadiens ordinaires / non déterminés (montant réel reçu). */
  readonly dividendesOrdinaires: number;
  /** Gains en capital réalisés (montant brut, avant application du taux d'inclusion). */
  readonly gainsCapital: number;

  // --- Déductions et crédits d'investissement ---
  /** Cotisation REER déduite. */
  readonly deductionReer: number;
  /** Autres déductions (cotisations à un RPA, pension alimentaire, etc.). */
  readonly autresDeductions: number;
  /**
   * Montant investi dans un fonds de travailleurs (FTQ – Fonds de solidarité, ou Fondaction CSN).
   * Donne droit à un crédit d'impôt de 30 % (15 % fédéral + 15 % Québec) sur le 1er 5 000 $.
   * 0 si aucun.
   */
  readonly cotisationFondsTravailleurs: number;
}

/** Base fiscale intermédiaire commune au fédéral et au Québec. */
export interface BaseFiscale {
  readonly entree: EntreeFiscale;
  /** Dividendes déterminés majorés (× 1,38). */
  readonly dividendesMajoresDetermines: number;
  /** Dividendes ordinaires majorés (× 1,15). */
  readonly dividendesMajoresOrdinaires: number;
  /** Portion imposable des gains en capital (× 50 %). */
  readonly gainsCapitalImposables: number;
  /** Revenu total réellement encaissé (sert au calcul du revenu après impôt). */
  readonly revenuTotalReel: number;
  /** Revenu total aux fins de l'impôt (avec majoration des dividendes et inclusion des gains). */
  readonly revenuTotalImpose: number;
  /** Déductions communes au fédéral et au Québec (REER + autres). */
  readonly deductionsCommunes: number;
}

/** Détail du calcul d'impôt pour un palier de gouvernement (fédéral ou Québec). */
export interface DetailImpot {
  readonly palier: 'federal' | 'quebec';
  readonly revenuImposable: number;
  readonly impotParTranches: number;
  /** Valeur en dollars des crédits non remboursables (déjà multipliés par le taux). */
  readonly creditsNonRemboursables: number;
  /** Crédit d'impôt pour dividendes (en dollars). */
  readonly creditDividendes: number;
  /** Crédit d'impôt pour fonds de travailleurs FTQ/CSN (en dollars). */
  readonly creditFondsTravailleurs: number;
  /** Impôt de base après crédits (avant abattement/récupération). */
  readonly impotDeBase: number;
  /** Abattement du Québec (fédéral seulement ; 0 au Québec). */
  readonly abattementQuebec: number;
  /** Récupération de la PSV / clawback (fédéral seulement ; 0 au Québec). */
  readonly recuperationPSV: number;
  /** Impôt net à payer pour ce palier de gouvernement. */
  readonly impotNet: number;
}

/** Résultat complet du calcul fiscal pour une personne, une année. */
export interface ResultatFiscal {
  readonly entree: EntreeFiscale;
  readonly revenuTotalReel: number;
  readonly revenuTotalImpose: number;
  readonly federal: DetailImpot;
  readonly quebec: DetailImpot;
  /** Impôt total (fédéral net + Québec net). */
  readonly impotTotal: number;
  /** Revenu réellement disponible après impôt. */
  readonly revenuApresImpot: number;
  /** Taux moyen d'imposition (impôt total / revenu total réel). */
  readonly tauxMoyen: number;
  /** Taux marginal sur le prochain dollar de revenu ordinaire. */
  readonly tauxMarginal: number;
}
