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
 * Ventilation des cotisations sociales d'un salarié (RRQ, AE, RQAP) selon leur traitement fiscal.
 * Calculée à partir du revenu d'emploi — voir `cotisations.ts`.
 */
export interface Cotisations {
  /** RRQ — cotisation de base : donne un CRÉDIT non remboursable (féd. + QC). */
  readonly rrqBase: number;
  /** RRQ — cotisation bonifiée (1re + 2e additionnelles) : DÉDUCTIBLE du revenu (féd. + QC). */
  readonly rrqBonifie: number;
  /** Assurance-emploi : CRÉDIT non remboursable. */
  readonly ae: number;
  /** RQAP : CRÉDIT non remboursable. */
  readonly rqap: number;
  /** Total retenu sur la paie (sortie de trésorerie). */
  readonly total: number;
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
  /**
   * Rente de conjoint survivant du RRQ (y compris avant 65 ans) — imposable, traitée comme la RRQ
   * (aucun crédit pour revenu de pension, non admissible au fractionnement).
   */
  readonly renteSurvivantRRQ: number;
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

  /**
   * Cotisation syndicale ou professionnelle versée. Traitement : DÉDUCTION au fédéral,
   * CRÉDIT de 10 % au Québec (ligne 397.1). Les cotisations RRQ/AE/RQAP, elles, sont calculées
   * automatiquement à partir du revenu d'emploi (voir `cotisations.ts`).
   */
  readonly cotisationSyndicale: number;
  /**
   * Prime d'assurance-salaire (assurance invalidité) versée par l'employé. Par défaut NON
   * déductible : réduit le revenu net « en poche », pas l'impôt (en contrepartie, les prestations
   * reçues seront non imposables).
   */
  readonly primeAssuranceSalaire: number;
  /** La prime d'assurance-salaire est-elle déductible du revenu ? (cas particulier ; défaut : false). */
  readonly assuranceSalaireDeductible: boolean;
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
  /** Cotisations sociales du salarié (RRQ base/bonifié, AE, RQAP), ventilées. */
  readonly cotisations: Cotisations;
  /**
   * Déductions du revenu net au FÉDÉRAL : REER + autres + RRQ bonifié + cotisation syndicale
   * (+ prime d'assurance-salaire si déductible).
   */
  readonly deductionsFederal: number;
  /**
   * Déductions du revenu net au QUÉBEC : REER + autres + RRQ bonifié (+ prime si déductible).
   * La cotisation syndicale N'EST PAS déduite au Québec — elle y donne plutôt un crédit de 10 %.
   */
  readonly deductionsQuebec: number;
}

/** Détail du calcul d'impôt pour un palier de gouvernement (fédéral ou Québec). */
export interface DetailImpot {
  readonly palier: 'federal' | 'quebec';
  readonly revenuImposable: number;
  readonly impotParTranches: number;
  /** Valeur en dollars des crédits non remboursables (déjà multipliés par le taux). */
  readonly creditsNonRemboursables: number;
  /**
   * Crédit d'impôt pour cotisations (en dollars) : RRQ base + AE + RQAP au taux du crédit
   * (et, au Québec seulement, cotisation syndicale à 10 %).
   */
  readonly creditCotisations: number;
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
  /** Revenu réellement disponible après impôt (revenu total réel − impôt total). */
  readonly revenuApresImpot: number;
  /** Cotisations sociales du salarié (RRQ base/bonifié, AE, RQAP), ventilées. */
  readonly cotisations: Cotisations;
  /**
   * Retenues sur la paie autres que l'impôt (sortie de trésorerie) : RRQ + AE + RQAP +
   * cotisation syndicale + prime d'assurance-salaire.
   */
  readonly retenuesTotales: number;
  /** Revenu net « en poche » : revenu après impôt − retenues sur la paie. */
  readonly revenuNetEnPoche: number;
  /** Taux moyen d'imposition (impôt total / revenu total réel). */
  readonly tauxMoyen: number;
  /** Taux marginal sur le prochain dollar de revenu ordinaire. */
  readonly tauxMarginal: number;
}
