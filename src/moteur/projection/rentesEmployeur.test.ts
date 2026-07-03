import { describe, it, expect } from 'vitest';
import { renteEmployeurNominale, calculerRREGOP } from './rentesEmployeur';
import { projeter } from './projection';
import type { HypothesesProjection, RenteEmployeur, TypeCompte } from './types';

const ORDRE: TypeCompte[] = ['NON_ENREGISTRE', 'REER', 'FERR', 'CELI'];

function rente(partiel: Partial<RenteEmployeur>): RenteEmployeur {
  return { nom: 'Test', source: 'employeur', montant: 30_000, ageDebut: 60, ageFin: null, indexation: 1, ...partiel };
}

describe('rente d’employeur — montant nominal', () => {
  it('est nul avant l’âge de début', () => {
    expect(renteEmployeurNominale(rente({}), 59, 40, 0.021)).toBe(0);
  });

  it('pleinement indexée : croît à l’inflation (constante en dollars réels)', () => {
    const nominal60 = renteEmployeurNominale(rente({ indexation: 1 }), 60, 40, 0.021);
    expect(nominal60).toBeCloseTo(30_000 * Math.pow(1.021, 20), 2);
    // Réel à 61 ans = même pouvoir d'achat qu'à 60.
    const reel61 = renteEmployeurNominale(rente({ indexation: 1 }), 61, 40, 0.021) / Math.pow(1.021, 21);
    expect(reel61).toBeCloseTo(30_000, 6);
  });

  it('non indexée : montant nominal gelé après le début', () => {
    const a60 = renteEmployeurNominale(rente({ indexation: 0 }), 60, 40, 0.021);
    const a61 = renteEmployeurNominale(rente({ indexation: 0 }), 61, 40, 0.021);
    expect(a61).toBeCloseTo(a60, 6);
  });

  it('pont : cesse à l’âge de fin (exclu)', () => {
    const pont = rente({ montant: 12_000, ageDebut: 58, ageFin: 65 });
    expect(renteEmployeurNominale(pont, 64, 58, 0.021)).toBeGreaterThan(0);
    expect(renteEmployeurNominale(pont, 65, 58, 0.021)).toBe(0);
  });
});

describe('calculateur RREGOP', () => {
  it('calcule la base et la coordination selon la formule officielle', () => {
    // 2 % × 30 ans × 60 000 = 36 000 ; coordination 0,7 % × 30 × 60 000 = 12 600.
    const { baseViagere, pontCoordination } = calculerRREGOP(30, 60_000);
    expect(pontCoordination).toBeCloseTo(12_600, 2);
    expect(baseViagere).toBeCloseTo(36_000 - 12_600, 2);
  });

  it('plafonne les années de service à 35', () => {
    const a = calculerRREGOP(40, 60_000);
    const b = calculerRREGOP(35, 60_000);
    expect(a.baseViagere).toBeCloseTo(b.baseViagere, 2);
  });
});

describe('intégration à la projection', () => {
  it('une rente d’employeur finance les dépenses et évite les retraits', () => {
    const h: HypothesesProjection = {
      ageActuel: 65,
      ageRetraite: 65,
      ageDeces: 85,
      vitSeul: false,
      revenuEmploi: 0,
      croissanceSalaireReelle: 0,
      epargneAnnuelle: {},
      comptes: [{ type: 'CELI', solde: 100_000, profil: 'equilibre' }],
      immeubles: [],
      rrqA65: 0,
      svA65: 0,
      ageDebutRRQ: 65,
      ageDebutSV: 65,
      rentesEmployeur: [rente({ nom: 'Rente', montant: 60_000, ageDebut: 65, indexation: 1 })],
      depensesRetraite: 50_000,
      ordreDecaissement: ORDRE,
      inflation: 0.021,
      fraisGestion: 0,
    };
    const r = projeter(h);
    expect(r.annees[0].renteEmployeur).toBeCloseTo(60_000, 0);
    expect(r.annees[0].retraitsEnregistres).toBeCloseTo(0, 6);
    expect(r.annees[0].retraitsLibresImpot).toBeCloseTo(0, 6);
    expect(r.suffisant).toBe(true);
  });
});
