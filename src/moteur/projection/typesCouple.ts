/**
 * Types du domaine « couple » (Phase 3).
 */
import type { Compte, RenteEmployeur, TypeCompte } from './types';
import type { Immeuble } from './immobilier';

/** Une personne du couple, entièrement modélisée (comptes, rentes, RRQ/SV propres). */
export interface PersonneProjection {
  nom: string;
  sexe: 'H' | 'F';
  ageActuel: number;
  ageRetraite: number;
  ageDeces: number;
  revenuEmploi: number;
  croissanceSalaireReelle: number;
  epargneAnnuelle: Partial<Record<TypeCompte, number>>;
  /** Cotisation REER de conjoint : déduite par CETTE personne, versée au REER de l'autre. */
  epargneReerConjoint: number;
  comptes: readonly Compte[];
  rrqA65: number;
  svA65: number;
  ageDebutRRQ: number;
  ageDebutSV: number;
  rentesEmployeur: readonly RenteEmployeur[];
}

/** Hypothèses d'une projection de couple. */
export interface HypothesesCouple {
  personne1: PersonneProjection;
  personne2: PersonneProjection;
  /** Dépenses annuelles du ménage, nettes d'impôt, en dollars d'aujourd'hui. */
  depensesRetraite: number;
  /** Dépenses du survivant en fraction des dépenses du couple (ex. 0,67). */
  fractionSurvivant: number;
  /** Immobilier du ménage (chaque bien a un propriétaire : 1, 2 ou commun). */
  immeubles: readonly Immeuble[];
  ordreDecaissement: readonly TypeCompte[];
  inflation: number;
  fraisGestion: number;
}

/** Résultat d'une année de projection du couple (montants NOMINAUX). */
export interface AnneeCouple {
  annee: number;
  /** Âge de chaque conjoint (null si décédé). */
  age1: number | null;
  age2: number | null;
  phase: 'accumulation' | 'decaissement' | 'survie';
  revenuDisponible: number;
  impotTotal: number;
  /** Montant de revenu de pension fractionné cette année (0 si aucun). */
  fractionnement: number;
  equiteImmobiliere: number;
  valeurNette: number;
  soldes1: Record<TypeCompte, number>;
  soldes2: Record<TypeCompte, number>;
  deflateurReel: number;
}

export interface ResultatCouple {
  annees: readonly AnneeCouple[];
  /** Année civile où le capital du ménage s'épuise (null si suffisant). */
  anneeEpuisement: number | null;
  suffisant: boolean;
  valeurNetteAuDernierDecesReelle: number;
  impotTotalVieReel: number;
}
