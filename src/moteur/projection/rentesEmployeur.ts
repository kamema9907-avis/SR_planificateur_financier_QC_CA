/**
 * Rentes d'employeur et RREGOP.
 *
 * Chaque rente est saisie en dollars d'aujourd'hui (pouvoir d'achat au début de la rente). Le
 * montant nominal versé une année donnée est : montant × (inflation jusqu'au début) × (indexation
 * depuis le début). L'indexation est une fraction de l'inflation (0 = gelée, 0,5 = partielle comme
 * le RREGOP, 1 = pleinement indexée).
 */
import type { RenteEmployeur } from './types';

/** Maximum des gains admissibles (MGA) approximatif 2026 — sert à la coordination RREGOP. À valider. */
export const MGA_2026 = 73_200;

/** Montant nominal d'une rente pour une année donnée (0 hors de sa plage d'âge). */
export function renteEmployeurNominale(
  rente: RenteEmployeur,
  age: number,
  ageActuel: number,
  inflation: number,
): number {
  if (age < rente.ageDebut) return 0;
  if (rente.ageFin != null && age >= rente.ageFin) return 0;
  const facteurJusquDebut = Math.pow(1 + inflation, rente.ageDebut - ageActuel);
  const facteurIndexation = Math.pow(1 + rente.indexation * inflation, age - rente.ageDebut);
  return rente.montant * facteurJusquDebut * facteurIndexation;
}

/** Somme nominale de toutes les rentes d'employeur pour une année. */
export function totalRentesEmployeur(
  rentes: readonly RenteEmployeur[],
  age: number,
  ageActuel: number,
  inflation: number,
): number {
  return rentes.reduce((somme, r) => somme + renteEmployeurNominale(r, age, ageActuel, inflation), 0);
}

/**
 * Calculateur RREGOP.
 *  - Rente de base = 2 % × années de service (max 35) × salaire moyen des 5 meilleures années.
 *  - Réduction de coordination (à 65 ans) = 0,7 % × années de service (max 35) ×
 *    min(salaire moyen, moyenne des MGA).
 *
 * Retourne les deux composantes à représenter : une base viagère (montant réduit versé à vie) et
 * un pont de coordination (le supplément versé jusqu'à 65 ans).
 */
export function calculerRREGOP(
  anneesService: number,
  salaireMoyen: number,
): { baseViagere: number; pontCoordination: number } {
  const service = Math.min(Math.max(0, anneesService), 35);
  const renteComplete = 0.02 * service * salaireMoyen;
  const pontCoordination = 0.007 * service * Math.min(salaireMoyen, MGA_2026);
  return {
    baseViagere: Math.max(0, renteComplete - pontCoordination),
    pontCoordination,
  };
}
