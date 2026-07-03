import { describe, it, expect } from 'vitest';
import { amortir, determinerBienAbrite, vendre, type EtatImmeuble, type Immeuble } from './immobilier';

function bien(partiel: Partial<Immeuble>): Immeuble {
  return {
    nom: 'Bien', type: 'residence', valeur: 500_000, coutBase: 300_000, anneesDetenues: 10,
    appreciation: 0.031, hypotheque: 0, tauxHypotheque: 0.05, paiementAnnuel: 0,
    revenuNetExploitation: 0, ageVente: null, fractionLiberee: 1, proprietaire: 1,
    ...partiel,
  };
}
function etat(b: Immeuble): EtatImmeuble {
  return { bien: b, valeur: b.valeur, hypotheque: b.hypotheque, coutBase: b.coutBase, vendu: false, proprietaire: b.proprietaire };
}

describe('amortissement de l’hypothèque', () => {
  it('sépare intérêt et capital', () => {
    const a = amortir(200_000, 0.05, 15_000);
    expect(a.interet).toBeCloseTo(10_000, 6);
    expect(a.nouveauSolde).toBeCloseTo(195_000, 6); // capital = 5 000
  });
  it('plafonne le dernier paiement et solde à zéro', () => {
    const a = amortir(3_000, 0.05, 15_000);
    expect(a.paiementReel).toBeCloseTo(3_150, 6);
    expect(a.nouveauSolde).toBe(0);
  });
  it('ne fait rien sur un solde nul', () => {
    expect(amortir(0, 0.05, 15_000)).toEqual({ interet: 0, paiementReel: 0, nouveauSolde: 0 });
  });
});

describe('arbitrage d’exemption (bien abrité)', () => {
  it('abrite le bien au gain par année le plus élevé', () => {
    const residence = bien({ type: 'residence', valeur: 600_000, coutBase: 300_000, anneesDetenues: 20 }); // 15 000/an
    const chalet = bien({ nom: 'Chalet', type: 'chalet', valeur: 300_000, coutBase: 100_000, anneesDetenues: 10 }); // 20 000/an
    expect(determinerBienAbrite([residence, chalet])).toBe(chalet);
  });
  it('ignore les immeubles à revenu', () => {
    const revenu = bien({ type: 'revenu', valeur: 900_000, coutBase: 100_000, anneesDetenues: 5 });
    const residence = bien({ type: 'residence', valeur: 400_000, coutBase: 300_000, anneesDetenues: 20 });
    expect(determinerBienAbrite([revenu, residence])).toBe(residence);
  });
});

describe('vente', () => {
  it('exempte le gain de la résidence abritée', () => {
    const e = etat(bien({ type: 'residence', valeur: 500_000, coutBase: 300_000, hypotheque: 100_000 }));
    const v = vendre(e, true);
    expect(v.gainBrutImposable).toBe(0);
    expect(v.cashLibere).toBeCloseTo(400_000, 6); // équité = 500 000 − 100 000
    expect(e.vendu).toBe(true);
  });
  it('impose le gain d’un chalet non abrité', () => {
    const e = etat(bien({ type: 'chalet', valeur: 400_000, coutBase: 150_000, hypotheque: 0 }));
    const v = vendre(e, false);
    expect(v.gainBrutImposable).toBeCloseTo(250_000, 6); // le moteur appliquera 50 %
  });
  it('impose toujours un immeuble à revenu, même « abrité »', () => {
    const e = etat(bien({ type: 'revenu', valeur: 500_000, coutBase: 200_000 }));
    expect(vendre(e, true).gainBrutImposable).toBeCloseTo(300_000, 6);
  });
  it('downsizing : libère une fraction et conserve le reste', () => {
    const e = etat(bien({ type: 'residence', valeur: 600_000, coutBase: 400_000, hypotheque: 0, fractionLiberee: 0.5 }));
    const v = vendre(e, true);
    expect(v.cashLibere).toBeCloseTo(300_000, 6);
    expect(e.vendu).toBe(false);
    expect(e.valeur).toBeCloseTo(300_000, 6);
  });
});
