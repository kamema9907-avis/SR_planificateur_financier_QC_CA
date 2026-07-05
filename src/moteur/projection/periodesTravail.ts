/**
 * Travail rémunéré poursuivi à la retraite (« retraité-actif »).
 *
 * Chaque période est saisie en dollars d'aujourd'hui (pouvoir d'achat au début de la période). Le
 * montant nominal versé une année donnée est : montant × (inflation depuis aujourd'hui) ×
 * (croissance réelle depuis le début de la période). Une croissance réelle de 0 maintient le
 * pouvoir d'achat ; une valeur négative modélise un temps partiel qui décroît.
 */
import type { PeriodeTravail } from './types';

/** Revenu nominal d'une période de travail pour un âge donné (0 hors de sa plage [ageDebut, ageFin[). */
export function revenuTravailNominal(
  periode: PeriodeTravail,
  age: number,
  ageActuel: number,
  inflation: number,
): number {
  if (age < periode.ageDebut || age >= periode.ageFin) return 0;
  const facteurInflation = Math.pow(1 + inflation, age - ageActuel);
  const facteurReel = Math.pow(1 + (periode.croissanceReelle ?? 0), age - periode.ageDebut);
  return Math.max(0, periode.montant) * facteurInflation * facteurReel;
}

/** Somme nominale de toutes les périodes de travail pour un âge donné. */
export function totalRevenuTravail(
  periodes: readonly PeriodeTravail[] | undefined,
  age: number,
  ageActuel: number,
  inflation: number,
): number {
  if (!periodes || periodes.length === 0) return 0;
  return periodes.reduce((somme, p) => somme + revenuTravailNominal(p, age, ageActuel, inflation), 0);
}
