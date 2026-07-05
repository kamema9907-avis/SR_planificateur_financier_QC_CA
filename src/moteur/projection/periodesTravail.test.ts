import { describe, it, expect } from 'vitest';
import { revenuTravailNominal, totalRevenuTravail } from './periodesTravail';
import type { PeriodeTravail } from './types';

const pige: PeriodeTravail = { nom: 'Pige', montant: 20_000, ageDebut: 65, ageFin: 70 };

describe('revenuTravailNominal', () => {
  it('est nul hors de la plage [ageDebut, ageFin[', () => {
    expect(revenuTravailNominal(pige, 64, 60, 0)).toBe(0); // avant le début
    expect(revenuTravailNominal(pige, 70, 60, 0)).toBe(0); // âge de fin exclu
    expect(revenuTravailNominal(pige, 80, 60, 0)).toBe(0);
  });

  it('vaut le montant saisi sur la plage, sans inflation', () => {
    expect(revenuTravailNominal(pige, 65, 60, 0)).toBeCloseTo(20_000, 6);
    expect(revenuTravailNominal(pige, 69, 60, 0)).toBeCloseTo(20_000, 6); // dernière année incluse
  });

  it('indexe le montant à l’inflation depuis aujourd’hui', () => {
    // À 65 ans avec inflation 2 % et âge actuel 60 : 20 000 × 1,02^5.
    expect(revenuTravailNominal(pige, 65, 60, 0.02)).toBeCloseTo(20_000 * Math.pow(1.02, 5), 4);
  });

  it('applique la croissance réelle depuis le début de la période', () => {
    const decroissant: PeriodeTravail = { ...pige, croissanceReelle: -0.1 };
    // À 67 ans (2 ans après le début), sans inflation : 20 000 × 0,9^2.
    expect(revenuTravailNominal(decroissant, 67, 60, 0)).toBeCloseTo(20_000 * Math.pow(0.9, 2), 4);
  });
});

describe('totalRevenuTravail', () => {
  it('retourne 0 pour une liste absente ou vide', () => {
    expect(totalRevenuTravail(undefined, 65, 60, 0)).toBe(0);
    expect(totalRevenuTravail([], 65, 60, 0)).toBe(0);
  });

  it('somme les périodes actives à un âge donné', () => {
    const periodes: PeriodeTravail[] = [
      { nom: 'A', montant: 10_000, ageDebut: 65, ageFin: 68 },
      { nom: 'B', montant: 5_000, ageDebut: 66, ageFin: 70 },
    ];
    expect(totalRevenuTravail(periodes, 65, 60, 0)).toBeCloseTo(10_000, 6); // seule A
    expect(totalRevenuTravail(periodes, 66, 60, 0)).toBeCloseTo(15_000, 6); // A + B
    expect(totalRevenuTravail(periodes, 68, 60, 0)).toBeCloseTo(5_000, 6); // A terminée, seule B
  });
});
