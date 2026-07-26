import { describe, expect, it } from 'vitest';
import { fractionFinancee, type DonneesVerdict } from './Verdict';

const base: DonneesVerdict = {
  suffisant: true,
  ageEpuisement: null,
  ageRetraite: 62,
  ageDeces: 95,
  valeurNetteFinale: 1_000_000,
  evaluable: true,
};

describe('jauge d’autonomie', () => {
  it('est pleine quand le capital tient', () => {
    expect(fractionFinancee(base)).toBe(1);
  });

  it('mesure la part de la retraite financée', () => {
    // Retraite de 62 à 95 = 33 ans ; épuisement à 78 = 16 ans couverts.
    const v = { ...base, suffisant: false, ageEpuisement: 78 };
    expect(fractionFinancee(v)).toBeCloseTo(16 / 33, 5);
  });

  it('tombe à zéro si le capital est épuisé avant même la retraite', () => {
    expect(fractionFinancee({ ...base, suffisant: false, ageEpuisement: 55 })).toBe(0);
  });

  it('ne dépasse jamais 1', () => {
    expect(fractionFinancee({ ...base, suffisant: false, ageEpuisement: 99 })).toBe(1);
  });

  it('reste définie si la retraite et le décès coïncident', () => {
    const v = { ...base, suffisant: false, ageEpuisement: 70, ageRetraite: 70, ageDeces: 70 };
    expect(fractionFinancee(v)).toBe(0);
  });
});
