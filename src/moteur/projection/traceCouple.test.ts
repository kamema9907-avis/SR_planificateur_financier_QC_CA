import { describe, it, expect } from 'vitest';
import { projeterCouple } from './couple';
import { sommePostes } from './trace';
import type { HypothesesCouple, PersonneProjection } from './typesCouple';
import type { TypeCompte } from './types';
import type { Immeuble } from './immobilier';

const ORDRE: TypeCompte[] = ['NON_ENREGISTRE', 'REER', 'FERR', 'CRI', 'FRV', 'CELI', 'CELIAPP'];
const proche = (a: number, b: number, tol = 1.5) => expect(Math.abs(a - b)).toBeLessThanOrEqual(tol);

function personne(partiel: Partial<PersonneProjection>): PersonneProjection {
  return {
    nom: 'Alex', sexe: 'H', ageActuel: 60, ageRetraite: 63, ageDeces: 88,
    revenuEmploi: 0, croissanceSalaireReelle: 0, epargneAnnuelle: {}, epargneReerConjoint: 0,
    comptes: [], rrqA65: 0, svA65: 0, ageDebutRRQ: 65, ageDebutSV: 65, rentesEmployeur: [], ...partiel,
  };
}

const maison: Immeuble = {
  nom: 'Maison', type: 'residence', valeur: 500_000, coutBase: 300_000, anneesDetenues: 15,
  appreciation: 0.02, hypotheque: 80_000, tauxHypotheque: 0.05, paiementAnnuel: 10_000,
  revenuNetExploitation: 0, ageVente: null, fractionLiberee: 1, proprietaire: 'commun',
};

/** Scénario couvrant accumulation, décaissement (avec fractionnement), survie et immobilier. */
const scenario = (): HypothesesCouple => ({
  personne1: personne({
    nom: 'Alex', ageActuel: 60, ageRetraite: 63, ageDeces: 85, revenuEmploi: 70_000,
    epargneAnnuelle: { REER: 8_000 }, droitsReerDisponibles: 60_000, rrqA65: 14_000, svA65: 8_500,
    comptes: [{ type: 'REER', solde: 500_000, profil: 'equilibre' }, { type: 'CELI', solde: 60_000, profil: 'equilibre' }],
  }),
  personne2: personne({
    nom: 'Sam', sexe: 'F', ageActuel: 58, ageRetraite: 63, ageDeces: 92, rrqA65: 9_000, svA65: 8_500,
    comptes: [{ type: 'CELI', solde: 40_000, profil: 'equilibre' }, { type: 'NON_ENREGISTRE', solde: 30_000, profil: 'equilibre', coutBase: 20_000 }],
  }),
  depensesRetraite: 55_000,
  fractionSurvivant: 0.67,
  immeubles: [maison],
  ordreDecaissement: ORDRE,
  inflation: 0.021,
  fraisGestion: 0.01,
});

describe('traçabilité couple (trace)', () => {
  it('est absente par défaut, présente avec { trace: true }', () => {
    expect(projeterCouple(scenario()).annees[0].detail).toBeUndefined();
    expect(projeterCouple(scenario(), { trace: true }).annees[0].detail).toBeDefined();
  });

  it('n’altère pas les résultats de la projection', () => {
    const sans = projeterCouple(scenario());
    const avec = projeterCouple(scenario(), { trace: true });
    expect(avec.valeurNetteAuDernierDecesReelle).toBeCloseTo(sans.valeurNetteAuDernierDecesReelle, 2);
    expect(avec.impotTotalVieReel).toBeCloseTo(sans.impotTotalVieReel, 2);
  });

  it('les postes somment aux totaux, chaque année', () => {
    const r = projeterCouple(scenario(), { trace: true });
    for (const a of r.annees) {
      const d = a.detail!;
      // Impôt : conjoint 1 + conjoint 2 (post-fractionnement) = impôt du ménage.
      const i1 = d.impot1 ? d.impot1.impotCourant : 0;
      const i2 = d.impot2 ? d.impot2.impotCourant : 0;
      proche(i1 + i2, d.impotMenage);
      // Fractionnement : impôt « avec » = impôt du ménage ; économie ≥ 0.
      proche(d.fractionnement.impotAvec, d.impotMenage);
      expect(d.fractionnement.economie).toBeGreaterThanOrEqual(-0.01);
      // Disponible : Σ entrées + Σ sorties (négatives) = revenus nets.
      proche(sommePostes(d.disponible.entrees) + sommePostes(d.disponible.sorties), d.disponible.revenusNets);
      // Revenus nets − surplus = revenu disponible affiché.
      proche(d.disponible.revenusNets - d.disponible.surplus, a.revenuDisponible, 2);
      // Valeur nette : comptes des deux + immobilier = valeur nette du ménage.
      proche(sommePostes(d.valeurNette.comptes) + sommePostes(d.valeurNette.immobilier), a.valeurNette, 2);
      // Destination du surplus = surplus.
      proche(sommePostes(d.disponible.destinationSurplus), d.disponible.surplus);
    }
  });

  it('le fractionnement dégage une économie quand les revenus sont concentrés', () => {
    const r = projeterCouple(scenario(), { trace: true });
    const avecFract = r.annees.filter((a) => a.detail!.fractionnement.transfert !== 0 && a.detail!.fractionnement.economie > 1);
    expect(avecFract.length).toBeGreaterThan(0);
  });
});
