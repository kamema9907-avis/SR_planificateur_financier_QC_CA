/**
 * Types du domaine « projection » (Phase 2) — cycle de vie complet.
 */
import type { ProfilRendement } from '../constantes/profilsRendement';
import type { Immeuble } from './immobilier';
import type { DetailAnnee } from './trace';

export type TypeCompte =
  | 'REER'
  | 'FERR'
  | 'CELI'
  | 'CELIAPP'
  | 'CRI'
  | 'FRV'
  | 'NON_ENREGISTRE'
  | 'REEE';

/** Un compte de placement (l'état — solde, coût de base — évolue durant la projection). */
export interface Compte {
  readonly type: TypeCompte;
  solde: number;
  readonly profil: ProfilRendement;
  /** Non-enregistré seulement : coût de base rajusté (pour le gain en capital à la vente). */
  coutBase?: number;
  /**
   * Rendement net annuel personnalisé (fraction, ex. 0,055). S'il est défini, il remplace le
   * profil : le compte croît à ce taux (frais déjà déduits).
   */
  rendementPersonnalise?: number;
}

/** Provenance d'une rente d'employeur (configure les valeurs par défaut). */
export type SourceRente = 'employeur' | 'rregop' | 'autre';

/**
 * Une rente d'employeur ou un pont (prestation temporaire). Modèle « à plat » : la rente de base
 * et chaque pont sont des lignes distinctes. Une rente est imposable (revenu de pension) et
 * admissible au crédit pour revenu de pension.
 */
export interface RenteEmployeur {
  nom: string;
  source: SourceRente;
  /** Montant annuel en dollars d'aujourd'hui (pouvoir d'achat au début de la rente). */
  montant: number;
  ageDebut: number;
  /** Âge auquel la rente cesse (exclu) ; null = viagère. */
  ageFin: number | null;
  /** Indexation en fraction de l'inflation : 0 = non indexée, 0,5 = partielle (RREGOP), 1 = pleine. */
  indexation: number;
}

/**
 * Une période de travail rémunéré poursuivie à la retraite (« retraité-actif ») : emploi à temps
 * partiel, pige, consultation. Modèle « à plat », calqué sur RenteEmployeur : chaque période est
 * une ligne distincte. Le revenu est imposé comme revenu d'emploi, subit les retenues (RRQ/AE/RQAP)
 * et rouvre des droits REER (jusqu'à 71 ans). Il réduit le décaissement des comptes ; tout surplus
 * est réinvesti (CELI → REER → non-enregistré).
 */
export interface PeriodeTravail {
  nom: string;
  /** Revenu d'emploi annuel, en dollars d'aujourd'hui (pouvoir d'achat au début de la période). */
  montant: number;
  ageDebut: number;
  /** Âge auquel le revenu cesse (exclu). */
  ageFin: number;
  /** Croissance RÉELLE annuelle au-delà de l'inflation (souvent 0, ou négative si décroissant). Défaut 0. */
  croissanceReelle?: number;
}

/**
 * Un héritage : somme reçue d'une succession, à un âge donné. Modèle « à plat » comme les rentes —
 * on peut hériter de plusieurs personnes à des âges différents.
 *
 * **Non imposable** pour le bénéficiaire (la succession a déjà réglé l'impôt au décès). Le montant
 * est placé dans les comptes en respectant les droits de cotisation ; seuls ses rendements futurs
 * seront imposés. Voir `heritage.ts`.
 */
export interface Heritage {
  nom: string;
  /** Montant net reçu, en dollars d'aujourd'hui (indexé jusqu'à l'âge de réception). */
  montant: number;
  /** Âge du bénéficiaire à la réception. */
  age: number;
}

/** Hypothèses complètes d'une projection cycle de vie. */
export interface HypothesesProjection {
  // Personne
  readonly ageActuel: number;
  readonly ageRetraite: number;
  readonly ageDeces: number;
  readonly vitSeul: boolean;

  // Vie active
  readonly revenuEmploi: number;
  /** Croissance RÉELLE du salaire (au-delà de l'inflation) ; défaut 0. */
  readonly croissanceSalaireReelle: number;
  /**
   * Travail rémunéré poursuivi À LA RETRAITE (« retraité-actif ») : une ou plusieurs périodes
   * (temps partiel, pige…) actives à partir de l'âge de retraite. Réduit le décaissement. Défaut : [].
   */
  readonly periodesTravail?: readonly PeriodeTravail[];
  /**
   * Héritages reçus (successions). Non imposables ; placés en CELI → REER → non-enregistré selon
   * les droits disponibles. Défaut : [].
   */
  readonly heritages?: readonly Heritage[];
  /** Épargne annuelle versée pendant l'accumulation, par type de compte (en $ d'aujourd'hui). */
  readonly epargneAnnuelle: Partial<Record<TypeCompte, number>>;
  /**
   * Montant total déjà cotisé au CELIAPP à ce jour (nominal, distinct du solde du compte).
   * Sert à respecter le plafond à vie de 40 000 $. Défaut : 0.
   */
  readonly celiappDejaCotise?: number;
  /**
   * Droits de cotisation CELI disponibles aujourd'hui (chiffre de « Mon dossier » ARC).
   * Défaut si absent : 109 000 $ − solde CELI actuel (heuristique). Les droits croissent ensuite
   * chaque année (+7 000 $ indexé/arrondi) et un retrait les restaure l'année suivante.
   */
  readonly droitsCeliDisponibles?: number;
  /** Droits de cotisation REER disponibles aujourd'hui (avis de cotisation ARC). Défaut : 0. */
  readonly droitsReerDisponibles?: number;
  /** Membre d'un régime de retraite d'employeur à PD (RREGOP/RPA) → applique le FE estimé aux droits REER. */
  readonly regimeRetraitePD?: boolean;
  /** Facteur d'équivalence annuel exact (en $ d'aujourd'hui), si connu — remplace l'estimation du régime à PD. */
  readonly facteurEquivalenceReer?: number;
  /**
   * Cotisation annuelle à un fonds de travailleurs (FTQ / Fondaction), en $ d'aujourd'hui. Détenue
   * dans le REER : déductible + consomme les droits REER, ET donne le crédit de 30 % (1er 5 000 $).
   */
  readonly fondsTravailleursAnnuel?: number;

  // Comptes de départ
  readonly comptes: readonly Compte[];

  // Immobilier (résidence, chalet, immeuble à revenu)
  readonly immeubles: readonly Immeuble[];

  // Rentes publiques (montants estimés à 65 ans, en $ d'aujourd'hui)
  readonly rrqA65: number;
  readonly svA65: number;
  readonly ageDebutRRQ: number;
  readonly ageDebutSV: number;

  // Rentes d'employeur / RREGOP (base + ponts), imposables
  readonly rentesEmployeur: readonly RenteEmployeur[];

  // Décaissement
  /** Dépenses de retraite cibles, annuelles, NET d'impôt, en $ d'aujourd'hui. */
  readonly depensesRetraite: number;
  readonly ordreDecaissement: readonly TypeCompte[];
  /** Fonte anticipée du REER : revenu imposable cible à atteindre chaque année de retraite (0 = aucune). */
  readonly cibleFonteReer?: number;

  // Hypothèses économiques
  readonly inflation: number;
  readonly fraisGestion: number;
  /**
   * Taux marginal minimal pour verser au REER **en priorité**, avant le CELI (0,36 = 36 %).
   *
   * Absent ou ≥ 1 : règle désactivée, le placement suit la chaîne historique CELI → REER →
   * non-enregistré, au dollar près. Voir `seuilReer.ts`.
   */
  readonly seuilMarginalReer?: number;
  /**
   * Réinvestir le remboursement d'impôt produit par les déductions de l'année (REER, CELIAPP), au
   * lieu de le laisser au train de vie.
   *
   * **Pourquoi ce réglage existe.** En accumulation, l'épargne est SAISIE et le train de vie est le
   * résidu : le remboursement tombe donc dans ce résidu — il est consommé. C'est cohérent avec la
   * structure du modèle (en décaissement c'est l'inverse : le train de vie est saisi, donc le
   * remboursement va forcément à l'épargne). Mais cela rend toute comparaison REER/CELI inéquitable,
   * puisque 8 000 $ au REER coûtent moins de sa poche que 8 000 $ au CELI. Activer ce réglage remet
   * les deux comptes à **coût égal**, ce qui est la seule base honnête pour les arbitrer.
   *
   * Absent ou faux : comportement historique, au dollar près.
   */
  readonly reinvestirRemboursementReer?: boolean;
}

/** Résultat d'une année de projection (montants NOMINAUX). */
export interface AnneeProjection {
  readonly annee: number;
  readonly age: number;
  readonly phase: 'accumulation' | 'decaissement';

  readonly revenuEmploi: number;
  readonly rrq: number;
  readonly sv: number;
  readonly renteEmployeur: number;
  readonly retraitsEnregistres: number;
  readonly retraitsNonEnregistres: number;
  readonly retraitsLibresImpot: number;
  readonly revenuPlacementNonEnr: number;

  readonly impotTotal: number;
  readonly revenuDisponible: number;
  readonly cotisations: number;

  readonly soldes: Record<TypeCompte, number>;
  /** Équité immobilière (valeur des biens − hypothèques). */
  readonly equiteImmobiliere: number;
  /** Valeur nette totale (comptes + équité immobilière). */
  readonly valeurNette: number;

  /** Facteur pour convertir un montant nominal de cette année en dollars d'aujourd'hui. */
  readonly deflateurReel: number;

  /**
   * Traçabilité « drill-down » : décomposition des agrégats (disponible, impôt, valeur nette) en
   * postes. Présente uniquement si la projection est lancée avec `{ trace: true }` (l'optimiseur, qui
   * appelle `projeter` des centaines de fois, la laisse absente pour rester rapide).
   */
  readonly detail?: DetailAnnee;
}

/** Résultat global d'une projection. */
export interface ResultatProjection {
  readonly annees: readonly AnneeProjection[];
  /** Âge où la valeur nette tombe à 0 (null si le capital dure jusqu'au décès). */
  readonly ageEpuisement: number | null;
  /** Le capital dure-t-il jusqu'au décès ? */
  readonly suffisant: boolean;
  /** Valeur nette au décès, en dollars d'aujourd'hui. */
  readonly valeurNetteAuDecesReelle: number;
  /** Impôt total payé sur toute la vie, en dollars d'aujourd'hui. */
  readonly impotTotalVieReel: number;
}
