import { describe, it, expect } from 'vitest';
import { facteurIndexation, parametresFederal, parametresQuebec } from './indexation';
import { FEDERAL_2026 } from './federal2026';
import { QUEBEC_2026 } from './quebec2026';
import { IQPF_2026 } from './iqpf2026';
import { calculerImpot } from '../moteurFiscal';
import { entreeVide } from '../index';

describe('facteur d’indexation', () => {
  it('vaut exactement 1 pour l’année de base 2026', () => {
    expect(facteurIndexation(2026)).toBe(1);
  });

  it('vaut (1 + inflation) après un an', () => {
    expect(facteurIndexation(2027)).toBeCloseTo(1 + IQPF_2026.inflation, 10);
  });
});

describe('paramètres indexés', () => {
  it('reproduisent exactement les barèmes 2026 pour l’année de base', () => {
    const f = parametresFederal(2026);
    expect(f.montantPersonnelBase.max).toBe(FEDERAL_2026.montantPersonnelBase.max);
    expect(f.paliers[0].plafond).toBe(FEDERAL_2026.paliers[0].plafond);
    const q = parametresQuebec(2026);
    expect(q.montantPersonnelBase).toBe(QUEBEC_2026.montantPersonnelBase);
  });

  it('indexent les montants en dollars mais pas les taux', () => {
    const f = parametresFederal(2027);
    expect(f.paliers[0].plafond).toBeCloseTo(58_523 * 1.021, 2);
    expect(f.montantPersonnelBase.max).toBeCloseTo(16_452 * 1.021, 2);
    expect(f.tauxCredit).toBe(0.14); // taux inchangé
    expect(f.abattementQuebec).toBe(0.165); // taux inchangé

    const q = parametresQuebec(2027);
    expect(q.montantPersonnelBase).toBeCloseTo(18_952 * 1.021, 2);
    expect(q.paliers[3].taux).toBe(0.2575); // taux inchangé
  });

  it('conserve la dernière tranche à l’infini', () => {
    const f = parametresFederal(2040);
    expect(f.paliers[f.paliers.length - 1].plafond).toBe(Infinity);
  });
});

describe('cohérence de l’indexation (préservation en dollars réels)', () => {
  it('un revenu ordinaire indexé à l’inflation paie le même impôt en dollars réels', () => {
    // On utilise un revenu ordinaire (sans emploi) pour isoler l'indexation de l'IMPÔT : les
    // cotisations RRQ/AE/RQAP, elles, s'indexent au rythme du MGA (3,1 %) et l'exemption RRQ est
    // gelée, ce qui décale légèrement l'impôt réel d'un salarié (comportement voulu, testé ailleurs).
    const f = 1 + IQPF_2026.inflation;
    const impot2026 = calculerImpot(revenuOrdinaire2026(60_000), 2026).impotTotal;
    const impot2027 = calculerImpot(revenuOrdinaire2026(60_000 * f), 2027).impotTotal;
    // L'impôt nominal 2027 doit être exactement l'impôt 2026 × (1 + inflation).
    expect(impot2027).toBeCloseTo(impot2026 * f, 2);
  });
});

/** Revenu ordinaire (intérêts, loyers…) d'un montant donné, sans cotisations sociales. */
function revenuOrdinaire2026(autresRevenus: number) {
  return { ...entreeVide(), age: 40, autresRevenus };
}
