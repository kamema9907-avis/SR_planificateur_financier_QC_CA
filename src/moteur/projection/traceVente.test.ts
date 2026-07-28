/**
 * Anatomie d'une vente immobilière — invariants du lot A.
 *
 * Le produit d'une vente était un nombre sans origine : le remboursement de l'hypothèque, soustrait
 * à l'intérieur du calcul, n'apparaissait jamais. Ces tests figent la chaîne désormais exposée, et
 * surtout le fait qu'elle SOMME.
 */
import { describe, expect, it } from 'vitest';
import { projeter } from './projection';
import { projeterCouple } from './couple';
import type { HypothesesProjection, TypeCompte } from './types';
import type { HypothesesCouple, PersonneProjection } from './typesCouple';
import type { Immeuble } from './immobilier';

const ORDRE: TypeCompte[] = ['NON_ENREGISTRE', 'CRI', 'FRV', 'REER', 'FERR', 'CELIAPP', 'CELI'];

function bien(p: Partial<Immeuble> = {}): Immeuble {
  return {
    nom: 'Immeuble à revenu', type: 'revenu', valeur: 350_000, coutBase: 80_000, anneesDetenues: 20,
    appreciation: 0.025, hypotheque: 137_000, tauxHypotheque: 0.05, paiementAnnuel: 14_000,
    revenuNetExploitation: 12_000, ageVente: 60, fractionLiberee: 1, proprietaire: 1, ...p,
  };
}

function solo(p: Partial<HypothesesProjection> = {}): HypothesesProjection {
  return {
    ageActuel: 55, ageRetraite: 62, ageDeces: 95, vitSeul: false, revenuEmploi: 85_000,
    croissanceSalaireReelle: 0, epargneAnnuelle: {}, droitsCeliDisponibles: 20_000,
    comptes: [
      { type: 'REER', solde: 200_000, profil: 'equilibre' },
      { type: 'NON_ENREGISTRE', solde: 20_000, profil: 'equilibre', coutBase: 20_000 },
    ],
    immeubles: [bien()], rrqA65: 15_000, svA65: 8_800, ageDebutRRQ: 65, ageDebutSV: 65,
    rentesEmployeur: [], depensesRetraite: 55_000, ordreDecaissement: ORDRE,
    inflation: 0.021, fraisGestion: 0.01, ...p,
  };
}

/** Les années où une vente a lieu. */
const anneesDeVente = <T extends { detail?: { disponible: { ventes: readonly unknown[] } } }>(annees: readonly T[]) =>
  annees.filter((a) => (a.detail?.disponible.ventes.length ?? 0) > 0);

const capitalPlace = (a: { detail?: { disponible: { sorties: readonly { libelle: string; montant: number }[] } } }) =>
  -(a.detail!.disponible.sorties.find((p) => /Capital placé/.test(p.libelle))?.montant ?? 0);

describe('la chaîne de la vente somme', () => {
  it('valeur − solde remboursé, puis × fraction, donne le produit brut', () => {
    const r = projeter(solo(), { trace: true });
    const annees = anneesDeVente(r.annees);
    expect(annees.length).toBe(1);
    for (const v of annees[0].detail!.disponible.ventes) {
      expect((v.valeurVente - v.soldeRembourse) * v.fractionVendue).toBeCloseTo(v.produitBrut, 6);
      expect(v.produitBrut - v.impotSupporte).toBeCloseTo(v.netApresImpot, 6);
    }
  });

  it('le produit brut des ventes égale le produit encaissé de l’année', () => {
    const r = projeter(solo(), { trace: true });
    for (const a of anneesDeVente(r.annees)) {
      const d = a.detail!.disponible;
      const encaisse = d.entrees.find((p) => p.libelle.startsWith('Produit de vente'))?.montant ?? 0;
      expect(d.ventes.reduce((s, v) => s + v.produitBrut, 0)).toBeCloseTo(encaisse, 2);
    }
  });
});

describe('l’impôt supporté reflète le reliquat', () => {
  it('sans droits REER, une part du produit est retenue pour l’impôt', () => {
    const r = projeter(solo({ droitsReerDisponibles: 0 }), { trace: true });
    const v = anneesDeVente(r.annees)[0].detail!.disponible.ventes[0];
    expect(v.impotSupporte).toBeGreaterThan(1_000);
    expect(v.netApresImpot).toBeLessThan(v.produitBrut);
  });

  it('avec des droits REER, la déduction absorbe l’impôt et le net rejoint le brut', () => {
    // Mesuré avant d'écrire ce lot : la provision est intégralement restituée par le reliquat.
    // Afficher la provision BRUTE aurait donc donné une chaîne visiblement fausse à l'écran.
    const r = projeter(solo({ droitsReerDisponibles: 100_000 }), { trace: true });
    const v = anneesDeVente(r.annees)[0].detail!.disponible.ventes[0];
    expect(v.impotSupporte).toBeLessThan(1);
    expect(v.netApresImpot).toBeCloseTo(v.produitBrut, 2);
  });

  it('le net après impôt égale le capital réellement placé', () => {
    // L'invariant central du lot : la dernière ligne de la chaîne correspond à ce que le moteur a
    // effectivement investi, quel que soit le poids de la déduction REER.
    for (const droits of [0, 40_000, 100_000]) {
      const r = projeter(solo({ droitsReerDisponibles: droits }), { trace: true });
      const a = anneesDeVente(r.annees)[0];
      const net = a.detail!.disponible.ventes.reduce((s, v) => s + v.netApresImpot, 0);
      expect(net).toBeCloseTo(capitalPlace(a), 0);
    }
  });
});

describe('cas particuliers', () => {
  it('une résidence exemptée porte un gain imposable nul, mais un gain brut visible', () => {
    const r = projeter(solo({ immeubles: [bien({ nom: 'Résidence', type: 'residence' })] }), { trace: true });
    const v = anneesDeVente(r.annees)[0].detail!.disponible.ventes[0];
    expect(v.exempte).toBe(true);
    expect(v.gainImposable).toBe(0);
    expect(v.gainBrutAvantExemption).toBeGreaterThan(0);
    expect(v.impotSupporte).toBe(0);
    expect(v.netApresImpot).toBeCloseTo(v.produitBrut, 6);
  });

  it('un downsizing ne libère que sa fraction, l’hypothèque étant entièrement éteinte', () => {
    const r = projeter(
      solo({ immeubles: [bien({ nom: 'Résidence', type: 'residence', fractionLiberee: 0.6 })] }),
      { trace: true },
    );
    const v = anneesDeVente(r.annees)[0].detail!.disponible.ventes[0];
    expect(v.fractionVendue).toBe(0.6);
    expect(v.produitBrut).toBeCloseTo((v.valeurVente - v.soldeRembourse) * 0.6, 6);
  });

  it('deux ventes la même année se partagent l’impôt au prorata du gain', () => {
    const r = projeter(
      solo({
        immeubles: [
          bien({ nom: 'Immeuble A' }),
          bien({
            nom: 'Immeuble B', valeur: 200_000, coutBase: 150_000, hypotheque: 0,
            paiementAnnuel: 0, revenuNetExploitation: 6_000,
          }),
        ],
        droitsReerDisponibles: 0,
      }),
      { trace: true },
    );
    const ventes = anneesDeVente(r.annees)[0].detail!.disponible.ventes;
    expect(ventes.length).toBe(2);
    const total = ventes.reduce((s, v) => s + v.impotSupporte, 0);
    const gainTotal = ventes.reduce((s, v) => s + v.gainImposable, 0);
    expect(total).toBeGreaterThan(0);
    for (const v of ventes) {
      expect(v.impotSupporte).toBeCloseTo((total * v.gainImposable) / gainTotal, 6);
    }
  });

  it('sans vente, la liste est vide', () => {
    const r = projeter(solo({ immeubles: [] }), { trace: true });
    for (const a of r.annees) expect(a.detail!.disponible.ventes).toEqual([]);
  });
});

describe('la ventilation n’est attribuée à la vente que si elle en est la seule source', () => {
  it('vrai sans héritage, faux l’année d’un héritage', () => {
    const sans = projeter(solo(), { trace: true });
    expect(anneesDeVente(sans.annees)[0].detail!.disponible.ventesSeuleSourceDeCapital).toBe(true);

    const avec = projeter(solo({ heritages: [{ nom: 'Succession', montant: 50_000, age: 60 }] }), { trace: true });
    expect(anneesDeVente(avec.annees)[0].detail!.disponible.ventesSeuleSourceDeCapital).toBe(false);
  });
});

describe('mode couple', () => {
  function conjoint(nom: string, sexe: 'H' | 'F'): PersonneProjection {
    return {
      nom, sexe, ageActuel: 55, ageRetraite: 62, ageDeces: 92, revenuEmploi: 70_000,
      croissanceSalaireReelle: 0, epargneAnnuelle: {}, epargneReerConjoint: 0,
      comptes: [{ type: 'REER', solde: 200_000, profil: 'equilibre' }],
      rrqA65: 14_000, svA65: 8_500, ageDebutRRQ: 65, ageDebutSV: 65, rentesEmployeur: [],
      droitsCeliDisponibles: 30_000, droitsReerDisponibles: 0,
    };
  }
  const couple = (p: Partial<HypothesesCouple> = {}): HypothesesCouple => ({
    personne1: conjoint('A', 'H'), personne2: conjoint('B', 'F'),
    depensesRetraite: 70_000, fractionSurvivant: 0.67, immeubles: [bien()],
    ordreDecaissement: ORDRE, inflation: 0.021, fraisGestion: 0.01, ...p,
  });

  it('la chaîne somme aussi pour le ménage', () => {
    const r = projeterCouple(couple(), { trace: true });
    const annees = anneesDeVente(r.annees);
    expect(annees.length).toBe(1);
    for (const v of annees[0].detail!.disponible.ventes) {
      expect((v.valeurVente - v.soldeRembourse) * v.fractionVendue).toBeCloseTo(v.produitBrut, 6);
      expect(v.produitBrut - v.impotSupporte).toBeCloseTo(v.netApresImpot, 6);
      expect(v.impotSupporte).toBeGreaterThan(0);
    }
  });

  it('le net après impôt égale le capital placé par le ménage', () => {
    const r = projeterCouple(couple(), { trace: true });
    const a = anneesDeVente(r.annees)[0];
    const net = a.detail!.disponible.ventes.reduce((s, v) => s + v.netApresImpot, 0);
    expect(net).toBeCloseTo(capitalPlace(a), 0);
  });
});
