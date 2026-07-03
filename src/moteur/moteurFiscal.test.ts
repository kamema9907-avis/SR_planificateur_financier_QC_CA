import { describe, it, expect } from 'vitest';
import { impotProgressif } from './bareme';
import { construireBase, calculerImpot } from './moteurFiscal';
import { FEDERAL_2026 as F } from './constantes/federal2026';
import { QUEBEC_2026 as Q } from './constantes/quebec2026';
import { entreeVide } from './index';
import type { EntreeFiscale } from './types';

/** Construit une entrée fiscale à partir de valeurs partielles (le reste = 0). */
function entree(partiel: Partial<EntreeFiscale>): EntreeFiscale {
  return { ...entreeVide(), ...partiel };
}

// ---------------------------------------------------------------------------
// 1. Tests unitaires des mécanismes (objectivement corrects)
// ---------------------------------------------------------------------------

describe('barème progressif', () => {
  it('applique correctement les tranches fédérales sur 100 000 $', () => {
    // 58 523 × 14 % + (100 000 − 58 523) × 20,5 %
    expect(impotProgressif(100_000, F.paliers)).toBeCloseTo(16_696.005, 2);
  });

  it('applique le taux de la 1re tranche québécoise sous le premier plafond', () => {
    expect(impotProgressif(50_000, Q.paliers)).toBeCloseTo(7_000, 2);
  });

  it('traite un revenu nul ou négatif comme 0', () => {
    expect(impotProgressif(0, F.paliers)).toBe(0);
    expect(impotProgressif(-5_000, F.paliers)).toBe(0);
  });
});

describe('majoration des dividendes et inclusion des gains', () => {
  it('majore les dividendes déterminés de 38 % et les ordinaires de 15 %', () => {
    const base = construireBase(entree({ dividendesDetermines: 1_000, dividendesOrdinaires: 1_000 }));
    expect(base.dividendesMajoresDetermines).toBeCloseTo(1_380, 6);
    expect(base.dividendesMajoresOrdinaires).toBeCloseTo(1_150, 6);
  });

  it('inclut 50 % des gains en capital', () => {
    const base = construireBase(entree({ gainsCapital: 10_000 }));
    expect(base.gainsCapitalImposables).toBeCloseTo(5_000, 6);
  });
});

// ---------------------------------------------------------------------------
// 2. Cas-tests étalons (valeurs calculées à la main à partir des constantes 2026)
// ---------------------------------------------------------------------------

describe('Scénario A — salarié 60 000 $, 40 ans, Québec', () => {
  const r = calculerImpot(entree({ age: 40, revenuEmploi: 60_000 }));

  it('impôt fédéral net (après abattement du Québec)', () => {
    // Tranches 8 496,005 − crédit MPB 2 303,28 = 6 192,725 ; abattement 16,5 %
    expect(r.federal.impotNet).toBeCloseTo(5_170.9254, 2);
  });

  it('impôt du Québec net (avec déduction pour travailleur de 1 450 $)', () => {
    // Tranches : 54 345 × 14 % + (58 550 − 54 345) × 19 % = 8 407,25 ; crédit de base 2 653,28
    expect(r.quebec.impotNet).toBeCloseTo(5_753.97, 2);
  });

  it('impôt total et revenu après impôt', () => {
    expect(r.impotTotal).toBeCloseTo(10_924.8954, 2);
    expect(r.revenuApresImpot).toBeCloseTo(49_075.1046, 2);
  });

  it('taux moyen et taux marginal', () => {
    expect(r.tauxMoyen).toBeCloseTo(0.18210, 4);
    expect(r.tauxMarginal).toBeCloseTo(0.361175, 5);
  });
});

describe('Scénario B — retraité 68 ans, vivant seul, pension + dividendes déterminés', () => {
  const r = calculerImpot(
    entree({
      age: 68,
      vitSeul: true,
      revenuRRQ: 12_000,
      revenuPensionSV: 8_000,
      revenuPensionPrivee: 20_000, // FERR — imposable ET admissible au crédit de pension
      dividendesDetermines: 5_000,
    }),
  );

  it('impôt fédéral net (montant en raison de l’âge + crédit pension + crédit dividendes)', () => {
    expect(r.federal.impotNet).toBeCloseTo(1_407.9535, 2);
  });

  it('impôt du Québec net (montants sociaux réduits + crédit dividendes)', () => {
    expect(r.quebec.impotNet).toBeCloseTo(1_851.1163, 2);
  });

  it('impôt total et revenu réel après impôt', () => {
    expect(r.impotTotal).toBeCloseTo(3_259.0697, 2);
    expect(r.revenuApresImpot).toBeCloseTo(41_740.9303, 2);
  });
});

describe('Scénario C — récupération de la PSV (clawback) pour haut revenu de retraite', () => {
  const r = calculerImpot(
    entree({ age: 70, revenuPensionSV: 9_000, autresRevenus: 100_000 }),
  );

  it('récupère 15 % du revenu net excédant 95 323 $, plafonné au montant de PSV reçu', () => {
    // 0,15 × (109 000 − 95 323) = 2 051,55 (< 9 000 reçu)
    expect(r.federal.recuperationPSV).toBeCloseTo(2_051.55, 2);
  });
});

describe('Scénario D — crédit pour fonds de travailleurs (FTQ / Fondaction CSN)', () => {
  const sans = calculerImpot(entree({ age: 45, revenuEmploi: 80_000, deductionReer: 10_000 }));
  const avec = calculerImpot(
    entree({ age: 45, revenuEmploi: 80_000, deductionReer: 10_000, cotisationFondsTravailleurs: 5_000 }),
  );

  it('accorde 15 % au fédéral et 15 % au Québec sur le montant investi', () => {
    expect(avec.federal.creditFondsTravailleurs).toBeCloseTo(750, 2);
    expect(avec.quebec.creditFondsTravailleurs).toBeCloseTo(750, 2);
  });

  it('réduit l’impôt total de 30 % du montant investi (1 500 $ sur 5 000 $)', () => {
    expect(sans.impotTotal - avec.impotTotal).toBeCloseTo(1_500, 2);
  });

  it('plafonne le crédit au premier 5 000 $ investi', () => {
    const plafonne = calculerImpot(
      entree({ age: 45, revenuEmploi: 80_000, cotisationFondsTravailleurs: 8_000 }),
    );
    expect(plafonne.federal.creditFondsTravailleurs).toBeCloseTo(750, 2);
    expect(plafonne.quebec.creditFondsTravailleurs).toBeCloseTo(750, 2);
  });
});

// ---------------------------------------------------------------------------
// 3. Propriétés de cohérence
// ---------------------------------------------------------------------------

describe('propriétés de cohérence', () => {
  it('aucun impôt lorsque le revenu est sous les montants personnels de base', () => {
    const r = calculerImpot(entree({ age: 30, revenuEmploi: 15_000 }));
    expect(r.federal.impotNet).toBe(0);
    expect(r.quebec.impotNet).toBe(0);
    expect(r.impotTotal).toBe(0);
  });

  it('le taux marginal est supérieur au taux moyen dans un régime progressif', () => {
    const r = calculerImpot(entree({ age: 45, revenuEmploi: 90_000 }));
    expect(r.tauxMarginal).toBeGreaterThan(r.tauxMoyen);
  });

  it('un revenu plus élevé entraîne un impôt total plus élevé (monotonie)', () => {
    const bas = calculerImpot(entree({ revenuEmploi: 50_000 })).impotTotal;
    const haut = calculerImpot(entree({ revenuEmploi: 51_000 })).impotTotal;
    expect(haut).toBeGreaterThan(bas);
  });

  it('le revenu de pension privé (FERR/rente) est bien imposable', () => {
    const sans = calculerImpot(entree({ age: 66, revenuRRQ: 10_000 })).impotTotal;
    const avec = calculerImpot(entree({ age: 66, revenuRRQ: 10_000, revenuPensionPrivee: 40_000 })).impotTotal;
    expect(avec).toBeGreaterThan(sans);
  });

  it('les dividendes déterminés sont moins imposés que le même montant de salaire', () => {
    const salaire = calculerImpot(entree({ age: 50, revenuEmploi: 50_000 })).impotTotal;
    const dividendes = calculerImpot(entree({ age: 50, dividendesDetermines: 50_000 })).impotTotal;
    expect(dividendes).toBeLessThan(salaire);
  });
});
