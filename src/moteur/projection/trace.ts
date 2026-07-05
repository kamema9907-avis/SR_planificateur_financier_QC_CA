/**
 * Traçabilité (« drill-down ») d'une année de projection.
 *
 * Décompose les agrégats opaques — revenu disponible, impôt, valeur nette — en postes nommés, pour
 * l'affichage détaillé au clic dans l'interface. Principe : les postes d'une décomposition somment
 * EXACTEMENT au total affiché (le moteur est l'unique source, aucune reconstitution approximative).
 *
 * Tous les montants sont NOMINAUX ; l'interface applique le déflateur pour l'affichage en dollars
 * d'aujourd'hui.
 */
import { calculerImpot, construireBase } from '../moteurFiscal';
import type { EntreeFiscale } from '../types';

/** Agrégat lui-même re-décomposable (drill-down récursif). */
export type LienDetail = 'impot';

/** Un poste d'une décomposition (un signe négatif = sortie / crédit / déduction). */
export interface Poste {
  readonly libelle: string;
  readonly montant: number;
  /** Si défini, ce poste ouvre lui-même une décomposition (récursif). */
  readonly lien?: LienDetail;
}

/** Décomposition du revenu disponible d'une année. */
export interface DetailDisponible {
  /** Entrées de liquidités (revenus, retraits, loyers, ventes). */
  readonly entrees: readonly Poste[];
  /** Sorties (impôt — cliquable —, retenues, cotisations, hypothèque). */
  readonly sorties: readonly Poste[];
  /** Revenus nets = Σ entrées − Σ sorties. */
  readonly revenusNets: number;
  /** Cible de dépenses de l'année (0 en accumulation). */
  readonly depenses: number;
  /** Surplus = revenus nets − dépenses (≥ 0 ; 0 s'il n'y a pas de surplus). */
  readonly surplus: number;
  /** Destination du surplus réinvesti (CELI / REER / non-enregistré). */
  readonly destinationSurplus: readonly Poste[];
}

/** Décomposition de l'impôt d'une année. */
export interface DetailImpotAnnee {
  /** Revenu imposable par source (déductions en négatif). */
  readonly revenuImposable: readonly Poste[];
  /** Impôt fédéral : tranches, crédits, abattement, récup. SV (somme = impôt fédéral net). */
  readonly federal: readonly Poste[];
  /** Impôt du Québec : tranches, crédits (somme = impôt QC net). */
  readonly quebec: readonly Poste[];
  /** Impôt de l'année courante (fédéral + Québec). */
  readonly impotCourant: number;
  /** Impôt au décès (dispositions présumées) ; 0 hors de l'année du décès. */
  readonly impotDeces: number;
  /** Détail de l'impôt au décès (REER liquidé, gains latents) ; vide hors année du décès. */
  readonly detailDeces: readonly Poste[];
  readonly tauxMoyen: number;
  readonly tauxMarginal: number;
}

/** Décomposition de la valeur nette d'une année. */
export interface DetailValeurNette {
  /** Solde de chaque compte. */
  readonly comptes: readonly Poste[];
  /** Équité de chaque bien immobilier (valeur − hypothèque). */
  readonly immobilier: readonly Poste[];
}

/** Traçabilité complète d'une année (solo). */
export interface DetailAnnee {
  readonly disponible: DetailDisponible;
  readonly impot: DetailImpotAnnee;
  readonly valeurNette: DetailValeurNette;
}

/** Décomposition du fractionnement du revenu de pension (couple). */
export interface DetailFractionnement {
  readonly nom1: string;
  readonly nom2: string;
  /** Montant de revenu de pension transféré (> 0 : conjoint 1 → conjoint 2 ; < 0 : l'inverse). */
  readonly transfert: number;
  /** Impôt du ménage SANS fractionnement. */
  readonly impotSans: number;
  /** Impôt du ménage AVEC le fractionnement optimal. */
  readonly impotAvec: number;
  /** Économie d'impôt réalisée = impôt sans − impôt avec (≥ 0). */
  readonly economie: number;
}

/** Traçabilité complète d'une année de couple. */
export interface DetailCouple {
  /** Revenu disponible du MÉNAGE (entrées et sorties des deux conjoints agrégées). */
  readonly disponible: DetailDisponible;
  readonly nom1: string;
  readonly nom2: string;
  /** Détail fiscal de chaque conjoint (post-fractionnement) ; null si le conjoint est décédé. */
  readonly impot1: DetailImpotAnnee | null;
  readonly impot2: DetailImpotAnnee | null;
  /** Impôt total du ménage. */
  readonly impotMenage: number;
  readonly fractionnement: DetailFractionnement;
  /** Valeur nette du ménage (comptes des deux conjoints + immobilier). */
  readonly valeurNette: DetailValeurNette;
}

/** Ne garde que les postes non négligeables (|montant| > 0,5 $). */
export function postesSignificatifs(postes: readonly Poste[]): Poste[] {
  return postes.filter((p) => Math.abs(p.montant) > 0.5);
}

/**
 * Construit la décomposition fiscale d'une année à partir de l'entrée fiscale FINALE (celle qui
 * a produit l'impôt de l'année, tous ajustements inclus). Les postes fédéraux/québécois somment
 * exactement à l'impôt net de chaque palier (les crédits sont plafonnés à l'impôt par tranches, via
 * `impotParTranches − impotDeBase`, ce qui garantit la somme même si les crédits dépassent l'impôt).
 */
export function construireDetailFiscal(
  entree: EntreeFiscale,
  annee: number,
  impotDeces: number,
  detailDeces: readonly Poste[],
): DetailImpotAnnee {
  const r = calculerImpot(entree, annee);
  const b = construireBase(entree, annee);

  const revenuImposable = postesSignificatifs([
    { libelle: 'Emploi / travail', montant: entree.revenuEmploi },
    { libelle: 'RRQ (dont survivant)', montant: entree.revenuRRQ + entree.renteSurvivantRRQ },
    { libelle: 'Sécurité de la vieillesse', montant: entree.revenuPensionSV },
    { libelle: 'Pension privée (FERR, rentes)', montant: entree.revenuPensionPrivee },
    { libelle: 'Autres (intérêts, loyers nets)', montant: entree.autresRevenus },
    { libelle: 'Dividendes (montant majoré)', montant: b.dividendesMajoresDetermines + b.dividendesMajoresOrdinaires },
    { libelle: 'Gain en capital imposable (50 %)', montant: b.gainsCapitalImposables },
    { libelle: 'Déduction REER', montant: -entree.deductionReer },
    { libelle: 'Autres déductions', montant: -entree.autresDeductions },
  ]);

  const federal = postesSignificatifs([
    { libelle: 'Impôt fédéral (tranches)', montant: r.federal.impotParTranches },
    { libelle: 'Crédits d’impôt (base, cotisations, dividendes…)', montant: -(r.federal.impotParTranches - r.federal.impotDeBase) },
    { libelle: 'Abattement du Québec', montant: -r.federal.abattementQuebec },
    { libelle: 'Récupération de la SV', montant: r.federal.recuperationPSV },
  ]);

  const quebec = postesSignificatifs([
    { libelle: 'Impôt du Québec (tranches)', montant: r.quebec.impotParTranches },
    { libelle: 'Crédits d’impôt (base, cotisations, dividendes…)', montant: -(r.quebec.impotParTranches - r.quebec.impotDeBase) },
  ]);

  return {
    revenuImposable,
    federal,
    quebec,
    impotCourant: r.impotTotal,
    impotDeces,
    detailDeces: postesSignificatifs(detailDeces),
    tauxMoyen: r.tauxMoyen,
    tauxMarginal: r.tauxMarginal,
  };
}

/** Somme des montants d'une liste de postes. */
export function sommePostes(postes: readonly Poste[]): number {
  return postes.reduce((s, p) => s + p.montant, 0);
}
