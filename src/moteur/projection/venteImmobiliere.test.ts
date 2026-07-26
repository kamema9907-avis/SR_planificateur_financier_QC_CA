/**
 * Produit d'une vente immobilière : ce qu'on en fait, et surtout ce qui doit rester vrai.
 *
 * Le défaut corrigé ici : le produit était placé BRUT au non-enregistré alors que l'impôt sur le
 * gain était prélevé sur le revenu de l'année — le même argent comptait deux fois, et le revenu
 * disponible pouvait devenir négatif.
 */
import { describe, expect, it } from 'vitest';
import { projeter } from './projection';
import { projeterCouple } from './couple';
import type { Immeuble } from './immobilier';
import type { HypothesesProjection, TypeCompte } from './types';
import type { PersonneProjection } from './typesCouple';

const ORDRE: TypeCompte[] = ['NON_ENREGISTRE', 'CRI', 'FRV', 'REER', 'FERR', 'CELIAPP', 'CELI'];

function immeuble(p: Partial<Immeuble> = {}): Immeuble {
  return {
    nom: 'Immeuble', type: 'revenu', valeur: 400_000, coutBase: 100_000, anneesDetenues: 20,
    appreciation: 0, hypotheque: 0, tauxHypotheque: 0.05, paiementAnnuel: 0,
    revenuNetExploitation: 0, ageVente: 55, fractionLiberee: 1, proprietaire: 1, ...p,
  };
}

function hypotheses(partiel: Partial<HypothesesProjection>): HypothesesProjection {
  return {
    ageActuel: 50, ageRetraite: 65, ageDeces: 60, vitSeul: false,
    revenuEmploi: 80_000, croissanceSalaireReelle: 0, epargneAnnuelle: {},
    comptes: [], immeubles: [], rrqA65: 0, svA65: 0, ageDebutRRQ: 65, ageDebutSV: 65,
    rentesEmployeur: [], depensesRetraite: 0, ordreDecaissement: ORDRE,
    inflation: 0, fraisGestion: 0, ...partiel,
  };
}

const a = (r: ReturnType<typeof projeter>, age: number) => r.annees.find((x) => x.age === age)!;

describe('vente immobilière en accumulation — justesse', () => {
  it('ne rend jamais le revenu disponible négatif', () => {
    // Cas historique : gain de 300 000 $ sur un salaire de 80 000 $. L'ancien code plaçait
    // 400 000 $ ET prélevait 81 575 $ d'impôt, d'où un disponible de −7 778 $.
    const r = projeter(hypotheses({ immeubles: [immeuble()], droitsCeliDisponibles: 100_000 }));
    expect(a(r, 55).revenuDisponible).toBeGreaterThan(0);
  });

  it('ne perturbe pas le train de vie de l’année de vente', () => {
    const r = projeter(hypotheses({ immeubles: [immeuble()], droitsCeliDisponibles: 100_000 }));
    // Le disponible de l'année de vente reste comparable aux années voisines : l'impôt du gain est
    // financé par le produit, pas par le salaire.
    const avant = a(r, 54).revenuDisponible;
    expect(a(r, 55).revenuDisponible).toBeGreaterThan(avant * 0.9);
    expect(a(r, 55).revenuDisponible).toBeLessThan(avant * 1.5);
  });

  it('conserve les flux : ce qui entre se retrouve placé ou disponible', () => {
    const r = projeter(hypotheses({ immeubles: [immeuble()], droitsCeliDisponibles: 100_000 }), { trace: true });
    const av = a(r, 54);
    const ve = a(r, 55);

    const placeEnPlus =
      ve.soldes.CELI + ve.soldes.REER + ve.soldes.NON_ENREGISTRE -
      (av.soldes.CELI + av.soldes.REER + av.soldes.NON_ENREGISTRE);
    const impotEnPlus = ve.impotTotal - av.impotTotal;
    const disponibleEnPlus = ve.revenuDisponible - av.revenuDisponible;

    // Les 400 000 $ encaissés se répartissent entre placement, impôt supplémentaire et disponible.
    expect(placeEnPlus + impotEnPlus + disponibleEnPlus).toBeCloseTo(400_000, -3);
  });
});

describe('vente immobilière en accumulation — abri fiscal', () => {
  it('utilise les droits CELI au lieu de tout envoyer au non-enregistré', () => {
    const r = projeter(hypotheses({ immeubles: [immeuble()], droitsCeliDisponibles: 100_000 }));
    expect(a(r, 55).soldes.CELI).toBeGreaterThan(100_000);
  });

  it('envoie l’essentiel au non-enregistré quand les abris sont étroits', () => {
    const r = projeter(
      hypotheses({
        immeubles: [immeuble()],
        droitsCeliDisponibles: 0,
        // Salaire nul : aucun droit REER ne s'accumule non plus.
        revenuEmploi: 0,
      }),
    );
    const ve = a(r, 55);
    // Les droits CELI s'accumulent malgré tout (~7 000 $/an, soit 35 000 $ en 5 ans) : c'est le
    // seul abri disponible ici, et le reste doit aboutir au non-enregistré.
    expect(ve.soldes.CELI).toBeCloseTo(35_000, -2);
    expect(ve.soldes.REER).toBe(0);
    expect(ve.soldes.NON_ENREGISTRE).toBeGreaterThan(300_000);
  });

  it('laisse une résidence exemptée placer la totalité de son produit', () => {
    // Un seul bien exemptable : il est abrité, donc aucun gain imposable, donc aucune provision.
    const r = projeter(
      hypotheses({ immeubles: [immeuble({ type: 'residence' })], droitsCeliDisponibles: 500_000 }),
    );
    expect(a(r, 55).soldes.CELI).toBeCloseTo(400_000, -2);
  });
});

describe('vente immobilière — cas limites', () => {
  it('place zéro quand l’impôt du gain dépasse l’équité libérée', () => {
    // Forte hypothèque : équité de 20 000 $ mais gain de 400 000 $.
    const r = projeter(
      hypotheses({
        immeubles: [immeuble({ valeur: 500_000, coutBase: 100_000, hypotheque: 480_000, paiementAnnuel: 30_000 })],
        droitsCeliDisponibles: 100_000,
      }),
    );
    const ve = a(r, 55);
    // Rien ou presque n'est plaçable ; le moteur ne doit pas inventer de capital.
    expect(ve.soldes.CELI).toBeLessThan(25_000);
    expect(ve.soldes.CELI).toBeGreaterThanOrEqual(0);
  });

  it('traite un downsizing partiel comme une vente partielle', () => {
    const complet = projeter(hypotheses({ immeubles: [immeuble({ type: 'residence' })], droitsCeliDisponibles: 500_000 }));
    const moitie = projeter(
      hypotheses({ immeubles: [immeuble({ type: 'residence', fractionLiberee: 0.5 })], droitsCeliDisponibles: 500_000 }),
    );
    expect(a(moitie, 55).soldes.CELI).toBeCloseTo(a(complet, 55).soldes.CELI / 2, -2);
  });
});

describe('vente immobilière — mode couple', () => {
  function conjoint(p: Partial<PersonneProjection> = {}): PersonneProjection {
    return {
      nom: 'X', sexe: 'H', ageActuel: 50, ageRetraite: 65, ageDeces: 60,
      revenuEmploi: 80_000, croissanceSalaireReelle: 0, epargneAnnuelle: {}, epargneReerConjoint: 0,
      comptes: [], rrqA65: 0, svA65: 0, ageDebutRRQ: 65, ageDebutSV: 65, rentesEmployeur: [],
      droitsCeliDisponibles: 100_000, droitsReerDisponibles: 0, ...p,
    };
  }

  it('abrite le produit chez le propriétaire, sans toucher aux droits de l’autre', () => {
    const r = projeterCouple(
      {
        personne1: conjoint({ nom: 'Vigile' }),
        personne2: conjoint({ nom: 'Conjointe', sexe: 'F' }),
        depensesRetraite: 0, fractionSurvivant: 0.67,
        immeubles: [immeuble({ proprietaire: 1 })],
        ordreDecaissement: ORDRE, inflation: 0, fraisGestion: 0,
      },
      { trace: true },
    );
    const ve = r.annees.find((x) => x.age1 === 55)!;
    expect(ve.soldes1.CELI).toBeGreaterThan(100_000);
    expect(ve.soldes2.CELI).toBe(0);
  });

  it('ne rend pas le disponible du ménage négatif', () => {
    const r = projeterCouple(
      {
        personne1: conjoint({ nom: 'Vigile' }),
        personne2: conjoint({ nom: 'Conjointe', sexe: 'F' }),
        depensesRetraite: 0, fractionSurvivant: 0.67,
        immeubles: [immeuble({ proprietaire: 1 })],
        ordreDecaissement: ORDRE, inflation: 0, fraisGestion: 0,
      },
      { trace: true },
    );
    expect(r.annees.find((x) => x.age1 === 55)!.revenuDisponible).toBeGreaterThan(0);
  });
});
