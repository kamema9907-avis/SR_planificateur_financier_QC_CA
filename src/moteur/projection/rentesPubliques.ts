/**
 * Rentes publiques : Régime de rentes du Québec (RRQ) et Sécurité de la vieillesse (SV).
 *
 * Les montants sont saisis en dollars d'aujourd'hui, estimés à 65 ans (relevé Retraite Québec /
 * SimulR). On applique l'ajustement pour âge de début, puis l'indexation à l'inflation jusqu'à
 * l'année versée (les deux rentes sont indexées au coût de la vie).
 */
import { ANNEE_BASE } from '../constantes/indexation';

/** Rente de retraite maximale du RRQ à 65 ans, 2026 (≈ 1 507,65 $/mois). À valider. */
export const MAX_RRQ_RETRAITE_65 = 18_092;

/**
 * Facteur d'ajustement de la RRQ selon l'âge de début :
 *  - avant 65 ans : −0,6 %/mois (minimum 60 ans) ;
 *  - après 65 ans : +0,7 %/mois (maximum 72 ans).
 */
export function facteurAjustementRRQ(ageDebut: number): number {
  const age = Math.min(72, Math.max(60, ageDebut));
  const mois = (age - 65) * 12;
  return age < 65 ? 1 + 0.006 * mois : 1 + 0.007 * mois; // mois négatif avant 65
}

/**
 * Facteur d'ajustement de la SV selon l'âge de début :
 *  - impossible avant 65 ans ;
 *  - après 65 ans : +0,6 %/mois (maximum 70 ans).
 */
export function facteurAjustementSV(ageDebut: number): number {
  const age = Math.min(70, Math.max(65, ageDebut));
  return 1 + 0.006 * (age - 65) * 12;
}

/** RRQ nominale versée une année donnée (0 avant l'âge de début). */
export function rrqNominale(
  rrqA65: number,
  ageDebutRRQ: number,
  age: number,
  annee: number,
  inflation: number,
): number {
  if (age < ageDebutRRQ) return 0;
  return rrqA65 * facteurAjustementRRQ(ageDebutRRQ) * Math.pow(1 + inflation, annee - ANNEE_BASE);
}

/**
 * Rente de conjoint survivant du RRQ : montant ADDITIONNEL versé au survivant, en plus de sa
 * propre rente.
 *  - Survivant de 65 ans et plus : la rente combinée (sienne + 60 % de celle du défunt) est
 *    plafonnée au maximum de la rente de retraite ; le supplément = combiné − sa propre rente.
 *  - Survivant de moins de 65 ans : approximation (37,5 % de la rente du défunt) — la portion
 *    forfaitaire et les règles temporaires de la réforme 2024 sont simplifiées. À raffiner.
 */
export function renteSurvivantRRQ(rrqDefunt: number, rrqPropre: number, ageSurvivant: number): number {
  if (ageSurvivant >= 65) {
    const combine = Math.min(rrqPropre + 0.6 * rrqDefunt, MAX_RRQ_RETRAITE_65);
    return Math.max(0, combine - rrqPropre);
  }
  return 0.375 * rrqDefunt;
}

/** SV nominale versée une année donnée (0 avant l'âge de début). */
export function svNominale(
  svA65: number,
  ageDebutSV: number,
  age: number,
  annee: number,
  inflation: number,
): number {
  if (age < ageDebutSV) return 0;
  return svA65 * facteurAjustementSV(ageDebutSV) * Math.pow(1 + inflation, annee - ANNEE_BASE);
}
