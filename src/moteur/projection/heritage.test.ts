import { describe, expect, it } from 'vitest';
import { heritageNominal, totalHeritage } from './heritage';
import type { Heritage } from './types';

const succession = (patch: Partial<Heritage> = {}): Heritage => ({
  nom: 'Succession',
  montant: 200_000,
  age: 58,
  ...patch,
});

describe('héritage — montant nominal', () => {
  it('ne verse rien les années où il ne tombe pas', () => {
    expect(heritageNominal(succession(), 57, 45, 0.021)).toBe(0);
    expect(heritageNominal(succession(), 59, 45, 0.021)).toBe(0);
  });

  it('indexe le montant à l’inflation jusqu’à la réception', () => {
    // 13 ans à 2,1 % : 200 000 × 1,021^13 ≈ 261 793 $
    const recu = heritageNominal(succession(), 58, 45, 0.021);
    expect(recu).toBeCloseTo(200_000 * Math.pow(1.021, 13), 2);
    expect(recu).toBeGreaterThan(200_000);
  });

  it('verse le montant tel quel si l’héritage tombe cette année', () => {
    expect(heritageNominal(succession({ age: 45 }), 45, 45, 0.021)).toBeCloseTo(200_000, 6);
  });

  it('traite un montant négatif comme nul', () => {
    expect(heritageNominal(succession({ montant: -50_000 }), 58, 45, 0.021)).toBe(0);
  });
});

describe('héritage — somme annuelle', () => {
  it('vaut zéro sans héritage', () => {
    expect(totalHeritage(undefined, 58, 45, 0.021)).toBe(0);
    expect(totalHeritage([], 58, 45, 0.021)).toBe(0);
  });

  it('additionne deux successions reçues la même année', () => {
    const deux = [succession({ montant: 100_000 }), succession({ nom: 'Autre', montant: 50_000 })];
    expect(totalHeritage(deux, 58, 45, 0.021)).toBeCloseTo(150_000 * Math.pow(1.021, 13), 2);
  });

  it('ne retient que les héritages de l’année demandée', () => {
    const deux = [succession({ montant: 100_000, age: 58 }), succession({ montant: 300_000, age: 70 })];
    expect(totalHeritage(deux, 58, 45, 0.021)).toBeCloseTo(100_000 * Math.pow(1.021, 13), 2);
    expect(totalHeritage(deux, 70, 45, 0.021)).toBeCloseTo(300_000 * Math.pow(1.021, 25), 2);
    expect(totalHeritage(deux, 65, 45, 0.021)).toBe(0);
  });
});
