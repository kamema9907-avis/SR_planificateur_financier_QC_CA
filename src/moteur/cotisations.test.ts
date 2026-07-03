import { describe, it, expect } from 'vitest';
import { calculerCotisations, parametresCotisations } from './cotisations';

describe('cotisations sociales du salarié (2026)', () => {
  it('salaire élevé (≥ MSGA) : atteint les maximums, avec le bon partage base / bonifié', () => {
    // Salaire 110 000 $ ≥ MSGA (85 000) et ≥ max assurable AE/RQAP.
    const c = calculerCotisations(110_000);
    // RRQ base = 5,30 % × (74 600 − 3 500) = 5,30 % × 71 100
    expect(c.rrqBase).toBeCloseTo(3_768.3, 2);
    // RRQ bonifié = 1,00 % × 71 100 + 4,00 % × (85 000 − 74 600)
    expect(c.rrqBonifie).toBeCloseTo(1_127, 2);
    // AE = 1,30 % × 68 900 ; RQAP = 0,430 % × 103 000
    expect(c.ae).toBeCloseTo(895.7, 2);
    expect(c.rqap).toBeCloseTo(442.9, 2);
    expect(c.total).toBeCloseTo(6_233.9, 2);
    // Cohérence : base + 1re additionnelle = 4 479,30 $ (cotisation RRQ « classique » maximale)
    expect(c.rrqBase + 0.01 * 71_100).toBeCloseTo(4_479.3, 2);
  });

  it('salaire moyen (< MGA) : aucune 2e cotisation additionnelle', () => {
    const c = calculerCotisations(50_000);
    expect(c.rrqBase).toBeCloseTo(2_464.5, 2); // 5,30 % × (50 000 − 3 500)
    expect(c.rrqBonifie).toBeCloseTo(465, 2); //   1,00 % × 46 500, RRQ2 = 0
    expect(c.ae).toBeCloseTo(650, 2); //           1,30 % × 50 000
    expect(c.rqap).toBeCloseTo(215, 2); //         0,430 % × 50 000
  });

  it('salaire sous l’exemption RRQ (3 500 $) : aucune cotisation RRQ, mais AE et RQAP dès le 1er dollar', () => {
    const c = calculerCotisations(3_000);
    expect(c.rrqBase).toBe(0);
    expect(c.rrqBonifie).toBe(0);
    expect(c.ae).toBeCloseTo(39, 2); //    1,30 % × 3 000
    expect(c.rqap).toBeCloseTo(12.9, 2); // 0,430 % × 3 000
  });

  it('revenu d’emploi nul ou négatif : aucune cotisation', () => {
    expect(calculerCotisations(0).total).toBe(0);
    expect(calculerCotisations(-10_000).total).toBe(0);
  });

  it('indexe les plafonds au rythme du MGA (3,1 %) mais garde l’exemption gelée', () => {
    const p2027 = parametresCotisations(2027);
    expect(p2027.rrq.mga).toBeCloseTo(74_600 * 1.031, 2); // 76 912,60
    expect(p2027.rrq.msga).toBeCloseTo(85_000 * 1.031, 2);
    expect(p2027.ae.maxAssurable).toBeCloseTo(68_900 * 1.031, 2);
    expect(p2027.rrq.exemption).toBe(3_500); // gelée par la loi
    expect(p2027.rrq.tauxBase).toBe(0.053); // taux inchangé
  });
});
