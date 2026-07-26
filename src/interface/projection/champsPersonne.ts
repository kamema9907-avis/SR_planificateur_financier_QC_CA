/**
 * Vue « personne » commune au solo et au couple.
 *
 * `HypothesesProjection` (une personne seule) et `PersonneProjection` (un conjoint) partagent la
 * quasi-totalité de leurs champs : âges, vie active, épargne, plafonds, comptes, rentes. Ce type
 * décrit cette intersection pour qu'UN SEUL formulaire (`EtapesPersonne`) les serve tous les deux.
 *
 * Les deux types d'origine restent inchangés dans le moteur : c'est une vue de l'interface, obtenue
 * par compatibilité structurelle (les modificateurs `readonly` du solo n'empêchent pas
 * l'assignation). Les mises à jour passent par un patch que le parent applique à SON propre type,
 * ce qui préserve l'immutabilité côté moteur.
 */
import type { Compte, PeriodeTravail, RenteEmployeur, TypeCompte } from '../../moteur';

export interface ChampsPersonne {
  ageActuel: number;
  ageRetraite: number;
  ageDeces: number;

  revenuEmploi: number;
  croissanceSalaireReelle: number;
  periodesTravail?: readonly PeriodeTravail[];

  epargneAnnuelle: Partial<Record<TypeCompte, number>>;
  celiappDejaCotise?: number;
  droitsCeliDisponibles?: number;
  droitsReerDisponibles?: number;
  regimeRetraitePD?: boolean;
  facteurEquivalenceReer?: number;
  fondsTravailleursAnnuel?: number;

  comptes: readonly Compte[];

  rrqA65: number;
  svA65: number;
  ageDebutRRQ: number;
  ageDebutSV: number;
  rentesEmployeur: readonly RenteEmployeur[];
}

/** Modification partielle d'une personne, appliquée par le parent à son propre type. */
export type PatchPersonne = Partial<ChampsPersonne>;
