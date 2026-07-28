/**
 * D'où vient le montant de « Dépenses » — invariants du lot A.
 *
 * Le correctif réorganise la trace sans toucher au calcul : le versement hypothécaire passe des
 * « dépenses » aux « sorties », dans les deux phases. Ces tests figent les deux propriétés qui
 * rendent ce déplacement sûr : la projection ne bouge pas, et l'arithmétique du tiroir se conserve.
 */
import { describe, expect, it } from 'vitest';
import { projeter } from './projection';
import { projeterCouple } from './couple';
import type { HypothesesProjection, TypeCompte } from './types';
import type { HypothesesCouple, PersonneProjection } from './typesCouple';
import type { Immeuble } from './immobilier';

const ORDRE: TypeCompte[] = ['NON_ENREGISTRE', 'CRI', 'FRV', 'REER', 'FERR', 'CELIAPP', 'CELI'];

const MAISON: Immeuble = {
  nom: 'Maison', type: 'residence', valeur: 400_000, coutBase: 250_000, anneesDetenues: 15,
  appreciation: 0.02, hypotheque: 150_000, tauxHypotheque: 0.05, paiementAnnuel: 12_000,
  revenuNetExploitation: 0, ageVente: null, fractionLiberee: 1, proprietaire: 1,
};

const COMPTES = [
  { type: 'REER' as const, solde: 400_000, profil: 'equilibre' as const },
  { type: 'CELI' as const, solde: 120_000, profil: 'equilibre' as const },
];

function solo(p: Partial<HypothesesProjection> = {}): HypothesesProjection {
  return {
    ageActuel: 60, ageRetraite: 65, ageDeces: 88, vitSeul: false, revenuEmploi: 80_000,
    croissanceSalaireReelle: 0, epargneAnnuelle: { REER: 8_000 }, comptes: COMPTES,
    immeubles: [MAISON], rrqA65: 15_000, svA65: 8_500, ageDebutRRQ: 65, ageDebutSV: 65,
    rentesEmployeur: [], depensesRetraite: 45_000, ordreDecaissement: ORDRE,
    inflation: 0.021, fraisGestion: 0.01, ...p,
  };
}

function conjoint(nom: string, sexe: 'H' | 'F', ageDeces: number): PersonneProjection {
  return {
    nom, sexe, ageActuel: 60, ageRetraite: 65, ageDeces, revenuEmploi: 70_000,
    croissanceSalaireReelle: 0, epargneAnnuelle: {}, epargneReerConjoint: 0, comptes: COMPTES,
    rrqA65: 14_000, svA65: 8_500, ageDebutRRQ: 65, ageDebutSV: 65, rentesEmployeur: [],
    droitsCeliDisponibles: 40_000, droitsReerDisponibles: 20_000,
  };
}

/** Décès du conjoint 1 à 80 ans : la projection traverse la phase de survie. */
const couple = (): HypothesesCouple => ({
  personne1: conjoint('A', 'H', 80),
  personne2: conjoint('B', 'F', 92),
  depensesRetraite: 70_000, fractionSurvivant: 0.67, immeubles: [MAISON],
  ordreDecaissement: ORDRE, inflation: 0.021, fraisGestion: 0.01,
});

const somme = (postes: readonly { montant: number }[]) => postes.reduce((s, p) => s + p.montant, 0);

describe('le déplacement de l’hypothèque ne change pas la projection', () => {
  it('solo : mêmes totaux avec et sans trace', () => {
    const sans = projeter(solo());
    const avec = projeter(solo(), { trace: true });
    expect(avec.valeurNetteAuDecesReelle).toBeCloseTo(sans.valeurNetteAuDecesReelle, 2);
    expect(avec.impotTotalVieReel).toBeCloseTo(sans.impotTotalVieReel, 2);
    expect(avec.ageEpuisement).toBe(sans.ageEpuisement);
  });

  it('couple : mêmes totaux avec et sans trace', () => {
    const sans = projeterCouple(couple());
    const avec = projeterCouple(couple(), { trace: true });
    expect(avec.valeurNetteAuDernierDecesReelle).toBeCloseTo(sans.valeurNetteAuDernierDecesReelle, 2);
    expect(avec.impotTotalVieReel).toBeCloseTo(sans.impotTotalVieReel, 2);
  });
});

describe('l’hypothèque est une sortie dans les DEUX phases', () => {
  it('solo : la ligne existe en accumulation comme en décaissement', () => {
    // C'était le défaut signalé : le même dollar changeait de place selon l'année.
    const r = projeter(solo(), { trace: true });
    const phases = new Set<string>();
    for (const a of r.annees) {
      const ligne = a.detail!.disponible.sorties.find((p) => p.libelle === 'Paiement hypothécaire');
      if (ligne) {
        phases.add(a.phase);
        expect(ligne.montant).toBeLessThan(0);
      }
    }
    expect(phases).toEqual(new Set(['accumulation', 'decaissement']));
  });

  it('couple : idem', () => {
    const r = projeterCouple(couple(), { trace: true });
    const phases = new Set<string>();
    for (const a of r.annees) {
      if (a.detail!.disponible.sorties.some((p) => p.libelle === 'Paiement hypothécaire')) {
        phases.add(a.phase);
      }
    }
    expect(phases.has('accumulation')).toBe(true);
    expect(phases.has('decaissement')).toBe(true);
  });
});

describe('l’arithmétique du tiroir se conserve', () => {
  it('solo : revenus nets − dépenses = surplus, et les postes somment aux totaux', () => {
    const r = projeter(solo(), { trace: true });
    for (const a of r.annees) {
      const d = a.detail!.disponible;
      expect(somme(d.entrees) + somme(d.sorties)).toBeCloseTo(d.revenusNets, 6);
      if (a.phase === 'decaissement' && d.surplus > 0.5) {
        expect(d.revenusNets - d.depenses).toBeCloseTo(d.surplus, 6);
      }
      expect(d.surplus).toBeGreaterThanOrEqual(0);
    }
  });

  it('couple : mêmes identités', () => {
    const r = projeterCouple(couple(), { trace: true });
    for (const a of r.annees) {
      const d = a.detail!.disponible;
      expect(somme(d.entrees) + somme(d.sorties)).toBeCloseTo(d.revenusNets, 6);
      if (d.surplus > 0.5) expect(d.revenusNets - d.depenses).toBeCloseTo(d.surplus, 6);
    }
  });

  it('couple : les dépenses ne tombent pas à zéro pendant la survie', () => {
    // Régression attrapée en écrivant ces tests : le couple a TROIS phases, et se fier à
    // `phase === 'decaissement'` vidait la colonne « Dépenses » sur toute la fin de la projection.
    const r = projeterCouple(couple(), { trace: true });
    const survie = r.annees.filter((a) => a.phase === 'survie');
    expect(survie.length).toBeGreaterThan(0);
    for (const a of survie) expect(a.detail!.disponible.depenses).toBeGreaterThan(0);
  });
});

describe('les dépenses se reconstituent depuis leurs composantes', () => {
  it('solo : cible saisie × inflation, hypothèque exclue', () => {
    const h = solo();
    const r = projeter(h, { trace: true });
    for (const a of r.annees.filter((x) => x.phase === 'decaissement')) {
      const { depenses, detailDepenses: c } = a.detail!.disponible;
      expect(c.cibleSaisie).toBe(h.depensesRetraite);
      expect(c.fractionSurvivant).toBe(1); // pas de phase de survie en solo
      expect(c.cibleSaisie * c.fractionSurvivant * c.facteurInflation).toBeCloseTo(depenses, 2);
    }
  });

  it('solo : les dépenses valent la cible saisie une fois déflatées', () => {
    // Vérifie que ce que l'interface affichera en « $ d'aujourd'hui » est bien le chiffre tapé.
    const h = solo();
    const r = projeter(h, { trace: true });
    for (const a of r.annees.filter((x) => x.phase === 'decaissement')) {
      expect(a.detail!.disponible.depenses * a.deflateurReel).toBeCloseTo(h.depensesRetraite, 2);
    }
  });

  it('couple : la part du survivant s’applique après le premier décès, et pas avant', () => {
    const h = couple();
    const r = projeterCouple(h, { trace: true });
    const fractions = new Map<number, Set<number>>();
    for (const a of r.annees) {
      const c = a.detail!.disponible.detailDepenses;
      expect(c.cibleSaisie).toBe(h.depensesRetraite);
      // Discriminer sur la PHASE : après le décès, `age1` vaut null, et `null <= 80` est vrai
      // en JavaScript — le piège qui a fait passer ce test à côté du défaut la première fois.
      const cle = a.phase === 'survie' ? 1 : 0;
      (fractions.get(cle) ?? fractions.set(cle, new Set()).get(cle)!).add(c.fractionSurvivant);
    }
    expect([...fractions.get(0)!]).toEqual([1]);
    expect([...fractions.get(1)!]).toEqual([h.fractionSurvivant]);
  });

  it('couple : le train de vie chute d’un tiers au premier décès', () => {
    // C'est la deuxième surprise que le tiroir doit expliquer.
    const h = couple();
    const r = projeterCouple(h, { trace: true });
    const avant = r.annees.filter((a) => a.phase === 'decaissement');
    const apres = r.annees.filter((a) => a.phase === 'survie');
    const derniereAvant = avant[avant.length - 1];
    const premiereApres = apres[0];
    expect(derniereAvant).toBeDefined();
    expect(premiereApres).toBeDefined();

    // En dollars d'aujourd'hui, pour neutraliser l'inflation entre les deux années.
    const reelAvant = derniereAvant.detail!.disponible.depenses * derniereAvant.deflateurReel;
    const reelApres = premiereApres.detail!.disponible.depenses * premiereApres.deflateurReel;
    expect(reelAvant).toBeCloseTo(h.depensesRetraite, 2);
    expect(reelApres).toBeCloseTo(h.depensesRetraite * h.fractionSurvivant, 2);
  });
});

describe('le surplus du survivant', () => {
  it('n’est plus muet : la ventilation du réinvestissement somme au surplus affiché', () => {
    // Défaut antérieur au correctif : pendant la phase de survie, le surplus affiché valait 0
    // alors que la destination du réinvestissement, elle, était renseignée. Le tiroir montrait
    // donc « réinvesti dans… » sous un surplus nul.
    const h: HypothesesCouple = {
      ...couple(),
      // Rentes généreuses et train de vie modeste : le survivant dégage un surplus.
      personne1: { ...conjoint('A', 'H', 78), rrqA65: 20_000, svA65: 9_000 },
      personne2: { ...conjoint('B', 'F', 95), rrqA65: 20_000, svA65: 9_000 },
      depensesRetraite: 30_000,
      immeubles: [],
    };
    const r = projeterCouple(h, { trace: true });
    const survie = r.annees.filter((a) => a.phase === 'survie' && a.detail!.disponible.depenses > 0);
    expect(survie.length).toBeGreaterThan(0);

    let avecSurplus = 0;
    for (const a of survie) {
      const d = a.detail!.disponible;
      const ventile = somme(d.destinationSurplus);
      expect(ventile).toBeCloseTo(d.surplus, 0);
      if (d.surplus > 0.5) avecSurplus += 1;
    }
    // Sans cette garde, le test passerait À VIDE si le scénario ne dégageait aucun surplus.
    expect(avecSurplus).toBeGreaterThan(0);
  });
});

describe('accumulation', () => {
  it('les dépenses y sont nulles : la cible ne commence qu’à la retraite', () => {
    const r = projeter(solo(), { trace: true });
    for (const a of r.annees.filter((x) => x.phase === 'accumulation')) {
      expect(a.detail!.disponible.depenses).toBe(0);
      expect(a.detail!.disponible.surplus).toBe(0);
    }
  });
});
