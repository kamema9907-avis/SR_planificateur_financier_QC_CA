/**
 * Héritage dans la boucle de projection : où l'argent aboutit, et ce qu'il ne fait pas.
 * Distinct de `heritage.test.ts`, qui ne teste que l'indexation du montant.
 */
import { describe, expect, it } from 'vitest';
import { projeter } from './projection';
import { projeterCouple } from './couple';
import type { HypothesesProjection, TypeCompte } from './types';

const ORDRE: TypeCompte[] = ['NON_ENREGISTRE', 'REER', 'FERR', 'CRI', 'FRV', 'CELI', 'CELIAPP'];

/** Inflation et frais nuls : les montants restent lisibles à l'unité près. */
function hypotheses(partiel: Partial<HypothesesProjection>): HypothesesProjection {
  return {
    ageActuel: 50, ageRetraite: 65, ageDeces: 90, vitSeul: false,
    revenuEmploi: 0, croissanceSalaireReelle: 0, epargneAnnuelle: {},
    comptes: [], immeubles: [],
    rrqA65: 0, svA65: 0, ageDebutRRQ: 65, ageDebutSV: 65, rentesEmployeur: [],
    depensesRetraite: 0, ordreDecaissement: ORDRE,
    inflation: 0, fraisGestion: 0,
    ...partiel,
  };
}

const anneeDeLAge = (r: ReturnType<typeof projeter>, age: number) => r.annees.find((a) => a.age === age)!;

describe('héritage — placement pendant l’accumulation', () => {
  it('remplit le CELI jusqu’aux droits, puis déborde au non-enregistré', () => {
    const r = projeter(
      hypotheses({
        // Reçu l'année d'entrée : les droits valent exactement ceux saisis.
        heritages: [{ nom: 'Succession', montant: 100_000, age: 50 }],
        droitsCeliDisponibles: 30_000,
        droitsReerDisponibles: 0,
      }),
      { trace: true },
    );

    const a = anneeDeLAge(r, 50);
    expect(a.soldes.CELI).toBeCloseTo(30_000, 0);
    // 100 000 − 30 000 au CELI = 70 000 au non-enregistré (aucun droit REER).
    expect(a.soldes.NON_ENREGISTRE).toBeCloseTo(70_000, 0);
  });

  it('profite des droits CELI accumulés entre-temps', () => {
    // Les droits croissent d'environ 7 000 $/an : un héritage plus tardif s'abrite davantage.
    const abrite = (age: number) => {
      const r = projeter(
        hypotheses({
          heritages: [{ nom: 'S', montant: 100_000, age }],
          droitsCeliDisponibles: 30_000,
          droitsReerDisponibles: 0,
        }),
      );
      return anneeDeLAge(r, age).soldes.CELI;
    };

    expect(abrite(50)).toBeCloseTo(30_000, 0);
    expect(abrite(52)).toBeGreaterThan(abrite(50));
    // Deux années de droits supplémentaires, soit ~14 000 $.
    expect(abrite(52) - abrite(50)).toBeCloseTo(14_000, 0);
  });

  it('place la totalité de l’héritage, quelle que soit la répartition', () => {
    const r = projeter(
      hypotheses({
        heritages: [{ nom: 'S', montant: 100_000, age: 50 }],
        droitsCeliDisponibles: 12_345,
        droitsReerDisponibles: 0,
      }),
    );
    const a = anneeDeLAge(r, 50);
    expect(a.soldes.CELI + a.soldes.NON_ENREGISTRE).toBeCloseTo(100_000, 0);
  });

  it('verse au REER quand des droits restent, et la déduction réduit l’impôt', () => {
    const commun = {
      revenuEmploi: 90_000,
      droitsCeliDisponibles: 0,
      droitsReerDisponibles: 40_000,
      ageDeces: 55,
    };
    const avec = projeter(hypotheses({ ...commun, heritages: [{ nom: 'S', montant: 40_000, age: 52 }] }), { trace: true });
    const sans = projeter(hypotheses(commun), { trace: true });

    const a = anneeDeLAge(avec, 52);
    expect(a.soldes.REER).toBeGreaterThan(0);
    // La déduction REER de l'héritage abaisse l'impôt de l'année.
    expect(a.impotTotal).toBeLessThan(anneeDeLAge(sans, 52).impotTotal);
  });

  it('n’est jamais imposé à la réception', () => {
    const commun = { revenuEmploi: 60_000, ageDeces: 55, droitsCeliDisponibles: 500_000 };
    // Droits CELI énormes : tout va au CELI, aucune déduction REER ne vient brouiller la comparaison.
    const avec = projeter(hypotheses({ ...commun, heritages: [{ nom: 'S', montant: 250_000, age: 52 }] }), { trace: true });
    const sans = projeter(hypotheses(commun), { trace: true });

    expect(anneeDeLAge(avec, 52).impotTotal).toBeCloseTo(anneeDeLAge(sans, 52).impotTotal, 2);
  });

  it('apparaît comme poste tracé, sans gonfler le revenu disponible', () => {
    const r = projeter(
      hypotheses({
        revenuEmploi: 50_000,
        heritages: [{ nom: 'Succession', montant: 80_000, age: 52 }],
        droitsCeliDisponibles: 200_000,
        ageDeces: 55,
      }),
      { trace: true },
    );

    const a = anneeDeLAge(r, 52);
    const poste = a.detail!.disponible.entrees.find((p) => p.libelle.startsWith('Héritage'));
    expect(poste?.montant).toBeCloseTo(80_000, 0);
    // Le disponible sert à vivre : l'héritage est placé, pas dépensé.
    expect(a.revenuDisponible).toBeLessThan(50_000);
  });
});

describe('héritage — pendant la retraite', () => {
  it('finance les dépenses de l’année avant d’être placé', () => {
    const commun = {
      ageActuel: 60, ageRetraite: 61, ageDeces: 70,
      depensesRetraite: 40_000,
      comptes: [{ type: 'NON_ENREGISTRE' as TypeCompte, solde: 400_000, profil: 'equilibre' as const, coutBase: 400_000 }],
    };
    const avec = projeter(hypotheses({ ...commun, heritages: [{ nom: 'S', montant: 40_000, age: 63 }] }), { trace: true });
    const sans = projeter(hypotheses(commun), { trace: true });

    // L'année de l'héritage, les retraits chutent : l'encaisse reçue couvre les dépenses.
    const rAvec = anneeDeLAge(avec, 63);
    const rSans = anneeDeLAge(sans, 63);
    expect(rAvec.retraitsNonEnregistres).toBeLessThan(rSans.retraitsNonEnregistres);
  });

  it('laisse plus de patrimoine au décès', () => {
    const commun = {
      ageActuel: 60, ageRetraite: 61, ageDeces: 75,
      depensesRetraite: 30_000,
      comptes: [{ type: 'CELI' as TypeCompte, solde: 300_000, profil: 'equilibre' as const }],
    };
    const avec = projeter(hypotheses({ ...commun, heritages: [{ nom: 'S', montant: 100_000, age: 65 }] }));
    const sans = projeter(hypotheses(commun));

    expect(avec.valeurNetteAuDecesReelle).toBeGreaterThan(sans.valeurNetteAuDecesReelle + 90_000);
  });
});

describe('héritage — cas limites', () => {
  it('est ignoré si l’âge tombe hors de l’horizon', () => {
    const commun = { ageActuel: 50, ageDeces: 60, comptes: [] };
    const avant = projeter(hypotheses({ ...commun, heritages: [{ nom: 'S', montant: 100_000, age: 45 }] }));
    const apres = projeter(hypotheses({ ...commun, heritages: [{ nom: 'S', montant: 100_000, age: 80 }] }));
    const sans = projeter(hypotheses(commun));

    expect(avant.valeurNetteAuDecesReelle).toBeCloseTo(sans.valeurNetteAuDecesReelle, 2);
    expect(apres.valeurNetteAuDecesReelle).toBeCloseTo(sans.valeurNetteAuDecesReelle, 2);
  });

  it('ne verse plus au REER après 71 ans (interdit), mais bien au CELI', () => {
    const r = projeter(
      hypotheses({
        ageActuel: 70, ageRetraite: 71, ageDeces: 80,
        droitsCeliDisponibles: 20_000, droitsReerDisponibles: 100_000,
        depensesRetraite: 0,
        heritages: [{ nom: 'S', montant: 60_000, age: 75 }],
      }),
      { trace: true },
    );

    const a = anneeDeLAge(r, 75);
    expect(a.soldes.CELI).toBeGreaterThan(0);
    expect(a.soldes.REER).toBe(0);
  });

  it('additionne deux successions reçues la même année', () => {
    const r = projeter(
      hypotheses({
        droitsCeliDisponibles: 500_000, ageDeces: 55,
        heritages: [
          { nom: 'Père', montant: 60_000, age: 52 },
          { nom: 'Mère', montant: 40_000, age: 52 },
        ],
      }),
      { trace: true },
    );
    expect(anneeDeLAge(r, 52).soldes.CELI).toBeCloseTo(100_000, 0);
  });
});

describe('héritage — mode couple', () => {
  it('va dans les comptes du bénéficiaire seulement, et consomme SES droits', () => {
    const commun = {
      nom: 'X' as string, sexe: 'H' as const, ageActuel: 50, ageRetraite: 65, ageDeces: 70,
      revenuEmploi: 0, croissanceSalaireReelle: 0, epargneAnnuelle: {}, epargneReerConjoint: 0,
      comptes: [], rrqA65: 0, svA65: 0, ageDebutRRQ: 65, ageDebutSV: 65, rentesEmployeur: [],
      droitsCeliDisponibles: 25_000, droitsReerDisponibles: 0,
    };
    const r = projeterCouple(
      {
        personne1: { ...commun, nom: 'Vigile', heritages: [{ nom: 'Succession', montant: 80_000, age: 50 }] },
        personne2: { ...commun, nom: 'Conjointe', sexe: 'F' },
        depensesRetraite: 0,
        fractionSurvivant: 0.67,
        immeubles: [],
        ordreDecaissement: ORDRE,
        inflation: 0,
        fraisGestion: 0,
      },
      { trace: true },
    );

    const a = r.annees[0];
    // Personne 1 : 25 000 au CELI (ses droits) + 55 000 au non-enregistré.
    expect(a.soldes1.CELI).toBeCloseTo(25_000, 0);
    expect(a.soldes1.NON_ENREGISTRE).toBeCloseTo(55_000, 0);
    // Personne 2 : rien. Les droits de la conjointe ne sont pas touchés.
    expect(a.soldes2.CELI).toBe(0);
    expect(a.soldes2.NON_ENREGISTRE).toBe(0);
  });

  it('n’est pas imposé et n’est pas consommable l’année de réception', () => {
    const commun = {
      nom: 'X' as string, sexe: 'H' as const, ageActuel: 50, ageRetraite: 65, ageDeces: 70,
      revenuEmploi: 70_000, croissanceSalaireReelle: 0, epargneAnnuelle: {}, epargneReerConjoint: 0,
      comptes: [], rrqA65: 0, svA65: 0, ageDebutRRQ: 65, ageDebutSV: 65, rentesEmployeur: [],
      droitsCeliDisponibles: 500_000, droitsReerDisponibles: 0,
    };
    const menage = (heritages?: { nom: string; montant: number; age: number }[]) => ({
      personne1: { ...commun, nom: 'Vigile', heritages },
      personne2: { ...commun, nom: 'Conjointe', sexe: 'F' as const },
      depensesRetraite: 0, fractionSurvivant: 0.67, immeubles: [],
      ordreDecaissement: ORDRE, inflation: 0, fraisGestion: 0,
    });

    const avec = projeterCouple(menage([{ nom: 'S', montant: 150_000, age: 50 }]), { trace: true });
    const sans = projeterCouple(menage(), { trace: true });

    // Droits CELI énormes : tout va au CELI, donc aucune déduction REER ne brouille l'impôt.
    expect(avec.annees[0].impotTotal).toBeCloseTo(sans.annees[0].impotTotal, 2);
    // Le disponible du ménage est inchangé : l'héritage est placé, pas dépensé.
    expect(avec.annees[0].revenuDisponible).toBeCloseTo(sans.annees[0].revenuDisponible, 2);
    // Mais le patrimoine, lui, a bondi.
    expect(avec.annees[0].valeurNette).toBeCloseTo(sans.annees[0].valeurNette + 150_000, 0);
  });
});
