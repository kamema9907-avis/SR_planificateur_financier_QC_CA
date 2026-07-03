import type { Palier } from './types';

/**
 * Calcule l'impôt selon un barème progressif.
 *
 * @param revenuImposable  Revenu imposable (négatif traité comme 0).
 * @param paliers          Paliers ordonnés par plafond croissant (dernier = Infinity).
 * @returns Impôt avant crédits.
 */
export function impotProgressif(revenuImposable: number, paliers: readonly Palier[]): number {
  const revenu = Math.max(0, revenuImposable);
  let impot = 0;
  let borneInferieure = 0;

  for (const palier of paliers) {
    if (revenu <= borneInferieure) break;
    const montantDansTranche = Math.min(revenu, palier.plafond) - borneInferieure;
    impot += montantDansTranche * palier.taux;
    borneInferieure = palier.plafond;
  }

  return impot;
}

/** Arrondit un montant à deux décimales (cents). */
export function arrondirCents(montant: number): number {
  return Math.round(montant * 100) / 100;
}
