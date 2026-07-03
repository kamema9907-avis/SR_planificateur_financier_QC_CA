import { describe, it, expect } from 'vitest';
import { calculerImpot, entreeVide } from './index';
import type { EntreeFiscale } from './types';

/**
 * Validation croisée du moteur fiscal contre des points de référence PUBLIÉS
 * (taux marginaux combinés fédéral + Québec 2026).
 *
 * Ces taux sont des repères externes indépendants du code : ils valident que l'assemblage
 * fédéral + abattement + Québec reproduit la réalité fiscale, au-delà de la cohérence interne.
 *
 * Rappel — cross-validation « vivante » à faire manuellement : comparer une année de retraite
 * (RRQ + SV + FERR) contre SimulR et CompuPension de Retraite Québec.
 */
function entree(partiel: Partial<EntreeFiscale>): EntreeFiscale {
  return { ...entreeVide(), ...partiel };
}

describe('validation croisée — taux marginaux combinés Québec 2026', () => {
  it('taux marginal maximal ≈ 53,31 % (33 % × 0,835 + 25,75 %)', () => {
    // Palier supérieur fédéral (33 %) après abattement du Québec (16,5 %) + palier supérieur QC (25,75 %).
    const r = calculerImpot(entree({ age: 45, revenuEmploi: 400_000 }));
    expect(r.tauxMarginal).toBeCloseTo(0.53305, 4);
  });

  it('taux marginal ~36,12 % dans la 2e tranche (20,5 % × 0,835 + 19 %)', () => {
    const r = calculerImpot(entree({ age: 45, revenuEmploi: 60_000 }));
    expect(r.tauxMarginal).toBeCloseTo(0.361175, 5);
  });

  it('taux marginal ≈ 47,46 % à 140 000 $ (26 % × 0,835 + 25,75 %)', () => {
    // Tranches « propres » : fédéral 26 % (117 045–181 440, sans réduction du MPB) et QC 25,75 %.
    const r = calculerImpot(entree({ age: 45, revenuEmploi: 140_000 }));
    expect(r.tauxMarginal).toBeCloseTo(0.26 * (1 - 0.165) + 0.2575, 4);
  });
});
