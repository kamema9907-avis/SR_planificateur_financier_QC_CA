import { describe, it, expect } from 'vitest';
import { projeter } from './projection';
import { sommePostes } from './trace';
import type { HypothesesProjection, TypeCompte } from './types';
import type { Immeuble } from './immobilier';

const ORDRE: TypeCompte[] = ['NON_ENREGISTRE', 'REER', 'FERR', 'CRI', 'FRV', 'CELI', 'CELIAPP'];

/** Écart absolu toléré (le filtrage des postes négligeables < 0,5 $ peut créer un micro-écart). */
const proche = (a: number, b: number, tol = 1) => expect(Math.abs(a - b)).toBeLessThanOrEqual(tol);

function hypotheses(partiel: Partial<HypothesesProjection>): HypothesesProjection {
  return {
    ageActuel: 60, ageRetraite: 65, ageDeces: 90, vitSeul: false,
    revenuEmploi: 0, croissanceSalaireReelle: 0, epargneAnnuelle: {}, comptes: [], immeubles: [],
    rrqA65: 0, svA65: 0, ageDebutRRQ: 65, ageDebutSV: 65, rentesEmployeur: [],
    depensesRetraite: 0, ordreDecaissement: ORDRE, inflation: 0.021, fraisGestion: 0.01,
    ...partiel,
  };
}

const maison: Immeuble = {
  nom: 'Maison', type: 'residence', valeur: 400_000, coutBase: 250_000, anneesDetenues: 15,
  appreciation: 0.02, hypotheque: 100_000, tauxHypotheque: 0.05, paiementAnnuel: 12_000,
  revenuNetExploitation: 0, ageVente: null, fractionLiberee: 1, proprietaire: 1,
};

/** Scénario couvrant accumulation, décaissement, surplus (retraité-actif), immobilier et décès. */
const scenario = (): HypothesesProjection =>
  hypotheses({
    ageActuel: 60, ageRetraite: 65, ageDeces: 88,
    revenuEmploi: 80_000,
    epargneAnnuelle: { REER: 10_000, CELI: 6_000 },
    droitsReerDisponibles: 100_000,
    rrqA65: 15_000, svA65: 8_500,
    depensesRetraite: 45_000,
    periodesTravail: [{ nom: 'Temps partiel', montant: 30_000, ageDebut: 65, ageFin: 70 }],
    immeubles: [maison],
    comptes: [
      { type: 'REER', solde: 300_000, profil: 'equilibre' },
      { type: 'CELI', solde: 80_000, profil: 'equilibre' },
      { type: 'NON_ENREGISTRE', solde: 60_000, profil: 'equilibre', coutBase: 40_000 },
    ],
  });

describe('traçabilité (trace)', () => {
  it('est absente par défaut, présente avec { trace: true }', () => {
    expect(projeter(scenario()).annees[0].detail).toBeUndefined();
    expect(projeter(scenario(), { trace: true }).annees[0].detail).toBeDefined();
  });

  it('n’altère pas les résultats de la projection', () => {
    const sans = projeter(scenario());
    const avec = projeter(scenario(), { trace: true });
    expect(avec.valeurNetteAuDecesReelle).toBeCloseTo(sans.valeurNetteAuDecesReelle, 2);
    expect(avec.impotTotalVieReel).toBeCloseTo(sans.impotTotalVieReel, 2);
  });

  it('les postes somment exactement aux totaux, chaque année', () => {
    const r = projeter(scenario(), { trace: true });
    for (const a of r.annees) {
      const d = a.detail!;
      // Impôt : fédéral net + Québec net = impôt courant.
      proche(sommePostes(d.impot.federal) + sommePostes(d.impot.quebec), d.impot.impotCourant);
      // Impôt courant + impôt au décès = impôt total de l'année.
      proche(d.impot.impotCourant + d.impot.impotDeces, a.impotTotal);
      // Disponible : Σ entrées + Σ sorties (négatives) = revenus nets.
      proche(sommePostes(d.disponible.entrees) + sommePostes(d.disponible.sorties), d.disponible.revenusNets);
      // Valeur nette : comptes + immobilier = valeur nette.
      proche(sommePostes(d.valeurNette.comptes) + sommePostes(d.valeurNette.immobilier), a.valeurNette, 2);
      // Surplus : la destination réinvestie somme au surplus.
      proche(sommePostes(d.disponible.destinationSurplus), d.disponible.surplus);
      // Revenus nets − surplus = revenu disponible affiché.
      proche(d.disponible.revenusNets - d.disponible.surplus, a.revenuDisponible, 2);
    }
  });

  it('révèle un surplus réinvesti les années de retraité-actif', () => {
    // Revenus forcés (RRQ + SV + travail) largement au-dessus de dépenses basses → surplus.
    const h = hypotheses({
      ageActuel: 65, ageRetraite: 65, ageDeces: 75,
      rrqA65: 15_000, svA65: 8_500,
      depensesRetraite: 25_000,
      droitsCeliDisponibles: 100_000,
      periodesTravail: [{ nom: 'Consultation', montant: 40_000, ageDebut: 65, ageFin: 70 }],
      comptes: [{ type: 'CELI', solde: 100_000, profil: 'equilibre' }],
    });
    const r = projeter(h, { trace: true });
    const surplusAnnees = r.annees.filter((a) => a.age >= 65 && a.age < 70 && a.detail!.disponible.surplus > 1);
    expect(surplusAnnees.length).toBeGreaterThan(0);
    const dest = surplusAnnees[0].detail!.disponible.destinationSurplus;
    expect(sommePostes(dest)).toBeGreaterThan(1); // ventilé quelque part (CELI/REER/non-enr)
  });

  it('sépare impôt courant et impôt au décès l’année du décès', () => {
    const r = projeter(scenario(), { trace: true });
    const deces = r.annees.find((a) => a.age === 88)!;
    expect(deces.detail!.impot.impotDeces).toBeGreaterThan(0);
    expect(deces.detail!.impot.detailDeces.length).toBeGreaterThan(0);
  });
});
