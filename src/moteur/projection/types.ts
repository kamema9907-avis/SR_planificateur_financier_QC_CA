/**
 * Types du domaine « projection » (Phase 2) — cycle de vie complet.
 */
import type { ProfilRendement } from '../constantes/profilsRendement';
import type { Immeuble } from './immobilier';

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
  /** Épargne annuelle versée pendant l'accumulation, par type de compte (en $ d'aujourd'hui). */
  readonly epargneAnnuelle: Partial<Record<TypeCompte, number>>;
  /**
   * Montant total déjà cotisé au CELIAPP à ce jour (nominal, distinct du solde du compte).
   * Sert à respecter le plafond à vie de 40 000 $. Défaut : 0.
   */
  readonly celiappDejaCotise?: number;

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
