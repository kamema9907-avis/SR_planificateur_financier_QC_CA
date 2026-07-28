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
import type { VenteRealisee } from './immobilier';

/** Agrégat lui-même re-décomposable (drill-down récursif). */
export type LienDetail = 'impot';

/** Un poste d'une décomposition (un signe négatif = sortie / crédit / déduction). */
export interface Poste {
  readonly libelle: string;
  readonly montant: number;
  /** Si défini, ce poste ouvre lui-même une décomposition (récursif). */
  readonly lien?: LienDetail;
}

/**
 * D'où vient le montant de « Dépenses ».
 *
 * La colonne affichait un produit de facteurs invisibles : le nombre grossissait chaque année
 * (inflation), chutait d'un tiers au premier décès (part du survivant) et dépassait la cible
 * saisie (versement hypothécaire ajouté par-dessus). Ces composantes existent pour que l'interface
 * puisse montrer la chaîne au lieu du seul résultat.
 *
 * Le versement hypothécaire n'y figure pas : il est désormais une **ligne de sortie** dans les deux
 * phases, au lieu d'être fondu ici en décaissement seulement. Voir `PLAN_DETAIL_DEPENSES.md`.
 */
export interface DetailDepenses {
  /** Cible annuelle telle que saisie, en dollars d'aujourd'hui. */
  readonly cibleSaisie: number;
  /** Part conservée par le survivant ; vaut 1 hors phase de survie. */
  readonly fractionSurvivant: number;
  /** Inflation cumulée depuis l'année de départ. */
  readonly facteurInflation: number;
}

/**
 * Anatomie d'une vente immobilière.
 *
 * Le produit d'une vente était un nombre sans origine : le remboursement de l'hypothèque, soustrait
 * à l'intérieur du calcul, n'apparaissait jamais. On ne pouvait que le déduire de la disparition du
 * versement et de la chute de l'équité à zéro.
 *
 * `impotSupporte` est l'impôt **réellement** attribuable au gain : la provision retenue à la vente,
 * MOINS le reliquat restitué lorsqu'une déduction REER l'a absorbée. C'est cette valeur, et non la
 * provision brute, qui fait que `produitBrut − impotSupporte = netPlace`. C'est une **convention
 * d'attribution** (impôt de l'année avec le gain, moins impôt sans lui), pas une ligne de
 * déclaration. Quand plusieurs biens sont vendus la même année, elle se répartit au prorata du gain.
 */
export interface DetailVente {
  readonly nom: string;
  /** Valeur du bien au moment de la vente, après l'amortissement de l'année. */
  readonly valeurVente: number;
  /** Solde hypothécaire épongé par la vente. */
  readonly soldeRembourse: number;
  /** < 1 pour un downsizing partiel. */
  readonly fractionVendue: number;
  /** (valeurVente − soldeRembourse) × fractionVendue. */
  readonly produitBrut: number;
  /** Gain en capital retenu comme imposable (0 si résidence exemptée). */
  readonly gainImposable: number;
  /** Gain avant exemption, pour expliquer un gain imposable nul. */
  readonly gainBrutAvantExemption: number;
  readonly exempte: boolean;
  /** Impôt réellement supporté à cause du gain (provision − reliquat). */
  readonly impotSupporte: number;
  /**
   * Ce qui reste du produit une fois l'impôt du gain supporté : `produitBrut − impotSupporte`.
   * En accumulation, ce montant est intégralement **placé** ; en décaissement il finance d'abord
   * les dépenses, le surplus étant réinvesti. L'interface nomme donc la ligne selon la phase.
   */
  readonly netApresImpot: number;
}

/** Décomposition du revenu disponible d'une année. */
export interface DetailDisponible {
  /** Entrées de liquidités (revenus, retraits, loyers, ventes). */
  readonly entrees: readonly Poste[];
  /** Sorties (impôt — cliquable —, retenues, cotisations, hypothèque). */
  readonly sorties: readonly Poste[];
  /** Revenus nets = Σ entrées − Σ sorties. */
  readonly revenusNets: number;
  /**
   * Train de vie visé de l'année, **hors versement hypothécaire** (0 en accumulation).
   * Vaut exactement `cible − paiementImmo` : c'est la soustraction, et non le produit recalculé
   * des composantes, qui garantit l'invariant de somme au bit près.
   */
  readonly depenses: number;
  /** D'où vient ce montant. */
  readonly detailDepenses: DetailDepenses;
  /** Ventes immobilières de l'année, bien par bien (vide la plupart des années). */
  readonly ventes: readonly DetailVente[];
  /**
   * Le produit des ventes est-il le SEUL capital placé cette année ? Sinon la ventilation
   * CELI/REER/non-enregistré mélange vente et héritage, et ne peut pas être attribuée à la vente.
   */
  readonly ventesSeuleSourceDeCapital: boolean;
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

/**
 * Attribue à chaque vente sa part de l'impôt supporté, **au prorata du gain imposable**.
 *
 * C'est la seule clé défendable : l'impôt est calculé sur le gain TOTAL de l'année, il n'existe pas
 * d'impôt « par bien ». Une vente exemptée (gain nul) ne s'en voit donc attribuer aucun. Quand une
 * seule vente a lieu — le cas courant — la répartition est l'identité.
 */
export function detaillerVentes(
  ventes: readonly VenteRealisee[],
  impotSupporteTotal: number,
): DetailVente[] {
  const gainTotal = ventes.reduce((s, v) => s + v.gainImposable, 0);
  return ventes.map((v) => {
    const part = gainTotal > 0 ? v.gainImposable / gainTotal : 0;
    const impotSupporte = impotSupporteTotal * part;
    return {
      nom: v.nom,
      valeurVente: v.valeurVente,
      soldeRembourse: v.soldeRembourse,
      fractionVendue: v.fractionVendue,
      produitBrut: v.produitBrut,
      gainImposable: v.gainImposable,
      gainBrutAvantExemption: v.gainBrutAvantExemption,
      exempte: v.exempte,
      impotSupporte,
      netApresImpot: v.produitBrut - impotSupporte,
    };
  });
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
