import { describe, it, expect } from 'vitest';
import { impotTotalPour } from '../moteurFiscal';
import { impotCoupleOptimal } from './fractionnement';
import { renteSurvivantRRQ, MAX_RRQ_RETRAITE_65 } from './rentesPubliques';
import { projeterCouple } from './couple';
import { entreeVide } from '../index';
import type { EntreeFiscale } from '../types';
import type { HypothesesCouple, PersonneProjection } from './typesCouple';
import type { TypeCompte } from './types';
import type { Immeuble } from './immobilier';

function immeuble(p: Partial<Immeuble>): Immeuble {
  return {
    nom: 'Bien', type: 'residence', valeur: 500_000, coutBase: 200_000, anneesDetenues: 15,
    appreciation: 0.031, hypotheque: 0, tauxHypotheque: 0.05, paiementAnnuel: 0,
    revenuNetExploitation: 0, ageVente: null, fractionLiberee: 1, proprietaire: 1, ...p,
  };
}

const ORDRE: TypeCompte[] = ['NON_ENREGISTRE', 'REER', 'FERR', 'CELI'];

function personne(partiel: Partial<PersonneProjection>): PersonneProjection {
  return {
    nom: 'Conjoint', sexe: 'H', ageActuel: 60, ageRetraite: 60, ageDeces: 90,
    revenuEmploi: 0, croissanceSalaireReelle: 0, epargneAnnuelle: {}, epargneReerConjoint: 0,
    comptes: [], rrqA65: 0, svA65: 0, ageDebutRRQ: 65, ageDebutSV: 65, rentesEmployeur: [],
    ...partiel,
  };
}

function couple(p1: Partial<PersonneProjection>, p2: Partial<PersonneProjection>, partiel: Partial<HypothesesCouple> = {}): HypothesesCouple {
  return {
    personne1: personne(p1),
    personne2: personne(p2),
    depensesRetraite: 60_000,
    fractionSurvivant: 0.67,
    immeubles: [],
    ordreDecaissement: ORDRE,
    inflation: 0.021,
    fraisGestion: 0.01,
    ...partiel,
  };
}

// ---------------------------------------------------------------------------
// Fractionnement du revenu de pension
// ---------------------------------------------------------------------------

describe('fractionnement du revenu de pension', () => {
  const e = (revenuPensionPrivee: number): EntreeFiscale => ({ ...entreeVide(), age: 68, revenuPensionPrivee });

  it('ne hausse JAMAIS l’impôt combiné (au pire, aucun transfert)', () => {
    const e1 = e(80_000);
    const e2 = e(0);
    const sans = impotTotalPour(e1, 2026) + impotTotalPour(e2, 2026);
    const avec = impotCoupleOptimal(e1, e2, 2026, 80_000, 0).impot;
    expect(avec).toBeLessThanOrEqual(sans + 1e-6);
  });

  it('réduit l’impôt combiné quand le revenu de pension est concentré sur un conjoint', () => {
    const e1 = e(80_000);
    const e2 = e(0);
    const sans = impotTotalPour(e1, 2026) + impotTotalPour(e2, 2026);
    const avec = impotCoupleOptimal(e1, e2, 2026, 80_000, 0).impot;
    expect(avec).toBeLessThan(sans);
  });

  it('n’apporte rien quand les revenus sont déjà égaux', () => {
    const e1 = e(40_000);
    const e2 = e(40_000);
    const sans = impotTotalPour(e1, 2026) + impotTotalPour(e2, 2026);
    const avec = impotCoupleOptimal(e1, e2, 2026, 40_000, 40_000).impot;
    expect(avec).toBeCloseTo(sans, 0);
  });
});

// ---------------------------------------------------------------------------
// Rente de survivant RRQ
// ---------------------------------------------------------------------------

describe('rente de survivant RRQ', () => {
  it('65+ : 60 % de la rente du défunt, plafonnée', () => {
    // Survivant sans rente propre : reçoit 60 % de 10 000 = 6 000.
    expect(renteSurvivantRRQ(10_000, 0, 68)).toBeCloseTo(6_000, 2);
  });
  it('65+ : plafonné au maximum RRQ combiné', () => {
    const s = renteSurvivantRRQ(MAX_RRQ_RETRAITE_65, MAX_RRQ_RETRAITE_65, 70);
    expect(s).toBeCloseTo(0, 6); // déjà au max, aucun supplément
  });
  it('avant 65 : approximation à 37,5 %', () => {
    expect(renteSurvivantRRQ(10_000, 0, 60)).toBeCloseTo(3_750, 2);
  });
});

// ---------------------------------------------------------------------------
// Projection de couple
// ---------------------------------------------------------------------------

describe('projection de couple', () => {
  it('produit une année par année jusqu’au dernier décès, sans valeur invalide', () => {
    const r = projeterCouple(
      couple(
        { ageActuel: 60, ageDeces: 88, rrqA65: 14_000, svA65: 8_500, comptes: [{ type: 'REER', solde: 400_000, profil: 'equilibre' }] },
        { ageActuel: 58, ageDeces: 92, rrqA65: 9_000, svA65: 8_500, comptes: [{ type: 'CELI', solde: 200_000, profil: 'dynamique' }] },
      ),
    );
    // Dernier décès : personne 2 à 92 ans (départ 58) → 34 ans + 1.
    expect(r.annees.length).toBe(92 - 58 + 1);
    for (const a of r.annees) {
      expect(Number.isFinite(a.valeurNette)).toBe(true);
      expect(a.impotTotal).toBeGreaterThanOrEqual(0);
    }
  });

  it('modélise la phase de survie et le roulement sans impôt au premier décès', () => {
    const r = projeterCouple(
      couple(
        { ageActuel: 70, ageRetraite: 70, ageDeces: 75, comptes: [{ type: 'REER', solde: 300_000, profil: 'prudent' }] },
        { ageActuel: 70, ageRetraite: 70, ageDeces: 90, comptes: [{ type: 'CELI', solde: 100_000, profil: 'prudent' }] },
        { depensesRetraite: 30_000 },
      ),
    );
    // Il existe des années « survie » après le 1er décès (75 ans).
    expect(r.annees.some((a) => a.phase === 'survie')).toBe(true);
    // Au 1er décès, roulement : la valeur nette ne s'effondre pas (pas d'impôt au décès du 1er conjoint).
    const avantDeces = r.annees.find((a) => a.age1 === 75)!;
    const apresDeces = r.annees.find((a) => a.age1 === null && a.age2 === 76)!;
    expect(apresDeces.valeurNette).toBeGreaterThan(avantDeces.valeurNette * 0.9);
  });

  it('un immeuble ajoute de l’équité au patrimoine du ménage', () => {
    const r = projeterCouple(
      couple(
        { ageActuel: 60, ageRetraite: 60, ageDeces: 80 },
        { ageActuel: 60, ageRetraite: 60, ageDeces: 85 },
        { depensesRetraite: 40_000, immeubles: [immeuble({ type: 'residence', valeur: 500_000, coutBase: 300_000, proprietaire: 'commun' })] },
      ),
    );
    expect(r.annees[0].equiteImmobiliere).toBeGreaterThan(490_000);
    expect(r.annees[0].valeurNette).toBeGreaterThan(490_000);
  });

  it('roule les biens au survivant au 1er décès (équité conservée)', () => {
    const r = projeterCouple(
      couple(
        { ageActuel: 70, ageRetraite: 70, ageDeces: 74 },
        { ageActuel: 70, ageRetraite: 70, ageDeces: 88 },
        { depensesRetraite: 25_000, immeubles: [immeuble({ type: 'residence', valeur: 700_000, coutBase: 200_000, proprietaire: 1 })] },
      ),
    );
    const apresDeces = r.annees.find((a) => a.age1 === null);
    expect(apresDeces).toBeDefined();
    expect(apresDeces!.equiteImmobiliere).toBeGreaterThan(0);
  });

  it('le fractionnement réduit l’impôt du couple vs deux calculs séparés (revenus concentrés)', () => {
    // Un conjoint a tout le REER, l'autre rien : le couple doit payer moins qu'en solo grâce au fractionnement.
    const r = projeterCouple(
      couple(
        { ageActuel: 66, ageRetraite: 66, ageDeces: 67, rrqA65: 0, comptes: [{ type: 'REER', solde: 1_000_000, profil: 'equilibre' }] },
        { ageActuel: 66, ageRetraite: 66, ageDeces: 67, rrqA65: 0, comptes: [] },
        { depensesRetraite: 70_000, fraisGestion: 0 },
      ),
    );
    // La 1re année de décaissement doit avoir un fractionnement > 0 (revenu concentré).
    expect(r.annees[0].fractionnement).toBeGreaterThan(0);
  });
});
