import { describe, it, expect } from 'vitest';
import { facteurAjustementRRQ, facteurAjustementSV } from './rentesPubliques';
import { facteurRetraitMinimumFERR } from '../constantes/ferr';
import { rendementNet } from './comptes';
import { projeter } from './projection';
import type { HypothesesProjection, TypeCompte } from './types';
import type { Immeuble } from './immobilier';

function immeuble(p: Partial<Immeuble>): Immeuble {
  return {
    nom: 'Bien', type: 'revenu', valeur: 400_000, coutBase: 200_000, anneesDetenues: 10,
    appreciation: 0.031, hypotheque: 0, tauxHypotheque: 0.05, paiementAnnuel: 0,
    revenuNetExploitation: 0, ageVente: null, fractionLiberee: 1, proprietaire: 1, ...p,
  };
}

const ORDRE: TypeCompte[] = ['NON_ENREGISTRE', 'REER', 'FERR', 'CRI', 'FRV', 'CELI', 'CELIAPP'];

/** Hypothèses de base réutilisables (inflation et frais nuls pour des tests déterministes). */
function hypotheses(partiel: Partial<HypothesesProjection>): HypothesesProjection {
  return {
    ageActuel: 40,
    ageRetraite: 65,
    ageDeces: 90,
    vitSeul: false,
    revenuEmploi: 0,
    croissanceSalaireReelle: 0,
    epargneAnnuelle: {},
    comptes: [],
    immeubles: [],
    rrqA65: 0,
    svA65: 0,
    ageDebutRRQ: 65,
    ageDebutSV: 65,
    rentesEmployeur: [],
    depensesRetraite: 0,
    ordreDecaissement: ORDRE,
    inflation: 0,
    fraisGestion: 0,
    ...partiel,
  };
}

describe('facteurs de rente publique', () => {
  it('RRQ : +0,7 %/mois après 65 ans (70 ans → +42 %)', () => {
    expect(facteurAjustementRRQ(70)).toBeCloseTo(1.42, 10);
  });
  it('RRQ : −0,6 %/mois avant 65 ans (60 ans → −36 %)', () => {
    expect(facteurAjustementRRQ(60)).toBeCloseTo(0.64, 10);
  });
  it('SV : +0,6 %/mois après 65 ans (70 ans → +36 %)', () => {
    expect(facteurAjustementSV(70)).toBeCloseTo(1.36, 10);
  });
});

describe('minimum de retrait FERR', () => {
  it('utilise 1/(90−âge) avant 71 ans', () => {
    expect(facteurRetraitMinimumFERR(65)).toBeCloseTo(1 / 25, 10);
  });
  it('suit la table prescrite de 71 à 94 ans', () => {
    expect(facteurRetraitMinimumFERR(71)).toBe(0.0528);
    expect(facteurRetraitMinimumFERR(72)).toBe(0.054);
  });
  it('plafonne à 20 % dès 95 ans', () => {
    expect(facteurRetraitMinimumFERR(95)).toBe(0.2);
  });
});

describe('phase d’accumulation', () => {
  const r = projeter(
    hypotheses({
      ageRetraite: 100, // toujours en accumulation
      ageDeces: 100,
      revenuEmploi: 50_000,
      fraisGestion: 0.01,
      comptes: [{ type: 'CELI', solde: 100_000, profil: 'equilibre' }],
    }),
  );

  it('fait croître un compte au rendement net (brut − frais)', () => {
    // 1re année : croissance sur 100 000 $ au rendement net équilibré.
    expect(r.annees[0].valeurNette).toBeCloseTo(100_000 * (1 + rendementNet('equilibre', 0.01)), 2);
  });

  it('compose le rendement d’année en année', () => {
    const taux = 1 + rendementNet('equilibre', 0.01);
    expect(r.annees[1].valeurNette).toBeCloseTo(r.annees[0].valeurNette * taux, 2);
  });
});

describe('phase de décaissement — solveur de cible nette', () => {
  it('finance exactement la cible depuis un compte libre d’impôt (CELI)', () => {
    const r = projeter(
      hypotheses({
        ageActuel: 65,
        ageRetraite: 65,
        ageDeces: 85,
        depensesRetraite: 50_000,
        comptes: [{ type: 'CELI', solde: 2_000_000, profil: 'equilibre' }],
      }),
    );
    expect(r.annees[0].revenuDisponible).toBeCloseTo(50_000, 0);
    expect(r.annees[0].retraitsLibresImpot).toBeCloseTo(50_000, 0);
    expect(r.suffisant).toBe(true);
  });

  it('retire davantage d’un REER imposable pour NETTER la cible après impôt', () => {
    const r = projeter(
      hypotheses({
        ageActuel: 65,
        ageRetraite: 65,
        ageDeces: 85,
        depensesRetraite: 50_000,
        comptes: [{ type: 'REER', solde: 3_000_000, profil: 'equilibre' }],
      }),
    );
    // Le revenu disponible net doit égaler la cible…
    expect(r.annees[0].revenuDisponible).toBeCloseTo(50_000, 0);
    // …et le retrait brut imposable doit dépasser la cible (pour couvrir l'impôt).
    expect(r.annees[0].retraitsEnregistres).toBeGreaterThan(50_000);
  });

  it('détecte l’épuisement du capital quand les dépenses excèdent l’épargne', () => {
    const r = projeter(
      hypotheses({
        ageActuel: 65,
        ageRetraite: 65,
        ageDeces: 90,
        depensesRetraite: 50_000,
        comptes: [{ type: 'CELI', solde: 100_000, profil: 'prudent' }],
      }),
    );
    expect(r.suffisant).toBe(false);
    expect(r.ageEpuisement).not.toBeNull();
  });
});

describe('immobilier dans la projection', () => {
  it('un immeuble à revenu ajoute de l’équité au patrimoine et du revenu imposable', () => {
    const base = projeter(hypotheses({ ageActuel: 50, ageRetraite: 100, ageDeces: 75, revenuEmploi: 60_000, fraisGestion: 0 }));
    const avec = projeter(
      hypotheses({
        ageActuel: 50, ageRetraite: 100, ageDeces: 75, revenuEmploi: 60_000, fraisGestion: 0,
        immeubles: [immeuble({ type: 'revenu', valeur: 400_000, coutBase: 300_000, revenuNetExploitation: 20_000 })],
      }),
    );
    expect(avec.annees[0].equiteImmobiliere).toBeGreaterThan(390_000);
    expect(avec.annees[0].valeurNette - base.annees[0].valeurNette).toBeGreaterThan(390_000);
    expect(avec.annees[0].impotTotal).toBeGreaterThan(base.annees[0].impotTotal);
  });

  it('la vente d’un immeuble à revenu réalise un gain imposable (pic d’impôt)', () => {
    const r = projeter(
      hypotheses({
        ageActuel: 65, ageRetraite: 65, ageDeces: 85, depensesRetraite: 30_000,
        immeubles: [immeuble({ type: 'revenu', valeur: 500_000, coutBase: 200_000, ageVente: 70 })],
      }),
    );
    const avant = r.annees.find((a) => a.age === 69)!.impotTotal;
    const vente = r.annees.find((a) => a.age === 70)!.impotTotal;
    expect(vente).toBeGreaterThan(avant + 10_000);
  });

  it('la résidence est exemptée au décès, contrairement à un immeuble à revenu', () => {
    const commun = { valeur: 800_000, coutBase: 200_000, ageVente: null } as const;
    const res = projeter(hypotheses({ ageActuel: 70, ageRetraite: 70, ageDeces: 80, depensesRetraite: 30_000, immeubles: [immeuble({ type: 'residence', ...commun })] }));
    const rev = projeter(hypotheses({ ageActuel: 70, ageRetraite: 70, ageDeces: 80, depensesRetraite: 30_000, immeubles: [immeuble({ type: 'revenu', ...commun })] }));
    const impotDecesRes = res.annees.find((a) => a.age === 80)!.impotTotal;
    const impotDecesRev = rev.annees.find((a) => a.age === 80)!.impotTotal;
    expect(impotDecesRev).toBeGreaterThan(impotDecesRes);
  });
});

describe('fonte anticipée du REER', () => {
  it('retire davantage du REER tôt en retraite et réinvestit au CELI', () => {
    const base = hypotheses({
      ageActuel: 65, ageRetraite: 65, ageDeces: 90, depensesRetraite: 40_000, fraisGestion: 0,
      comptes: [{ type: 'REER', solde: 800_000, profil: 'equilibre' }],
    });
    const sans = projeter(base);
    const avec = projeter({ ...base, cibleFonteReer: 60_000 });
    const anSans = sans.annees.find((a) => a.age === 66)!;
    const anAvec = avec.annees.find((a) => a.age === 66)!;
    expect(anAvec.retraitsEnregistres).toBeGreaterThan(anSans.retraitsEnregistres);
    expect(anAvec.soldes.CELI).toBeGreaterThan(anSans.soldes.CELI + 1);
  });
});

describe('plafond CELIAPP', () => {
  const comptesSansCroissance = [
    { type: 'CELIAPP', solde: 0, profil: 'equilibre', rendementPersonnalise: 0 },
    { type: 'CELI', solde: 0, profil: 'equilibre', rendementPersonnalise: 0 },
  ] as const;

  it('plafonne à 8 000 $/an et 40 000 $ à vie, l’excédent allant au CELI', () => {
    const r = projeter(
      hypotheses({
        ageActuel: 40, ageRetraite: 100, ageDeces: 50, // 11 années d'accumulation
        epargneAnnuelle: { CELIAPP: 12_000 }, // au-delà du plafond annuel de 8 000
        comptes: comptesSansCroissance.map((c) => ({ ...c })),
      }),
    );
    // 1re année : 8 000 au CELIAPP (plafond annuel), 4 000 redirigés au CELI.
    expect(r.annees[0].soldes.CELIAPP).toBeCloseTo(8_000, 2);
    expect(r.annees[0].soldes.CELI).toBeCloseTo(4_000, 2);
    // Le CELIAPP ne dépasse jamais 40 000 $ (plafond à vie).
    const fin = r.annees[r.annees.length - 1];
    expect(fin.soldes.CELIAPP).toBeCloseTo(40_000, 2);
  });

  it('tient compte du montant déjà cotisé', () => {
    const r = projeter(
      hypotheses({
        ageActuel: 40, ageRetraite: 100, ageDeces: 45,
        epargneAnnuelle: { CELIAPP: 8_000 },
        celiappDejaCotise: 36_000, // il ne reste que 4 000 $ de droits
        comptes: comptesSansCroissance.map((c) => ({ ...c })),
      }),
    );
    const fin = r.annees[r.annees.length - 1];
    expect(fin.soldes.CELIAPP).toBeCloseTo(4_000, 2);
  });
});

describe('projection complète (fumée)', () => {
  it('produit une année par âge, sans valeur invalide', () => {
    const r = projeter(
      hypotheses({
        ageActuel: 40,
        ageRetraite: 60,
        ageDeces: 95,
        revenuEmploi: 90_000,
        inflation: 0.021,
        fraisGestion: 0.01,
        epargneAnnuelle: { REER: 12_000, CELI: 7_000 },
        rrqA65: 15_000,
        svA65: 8_500,
        depensesRetraite: 60_000,
        comptes: [
          { type: 'REER', solde: 150_000, profil: 'equilibre' },
          { type: 'CELI', solde: 60_000, profil: 'dynamique' },
          { type: 'NON_ENREGISTRE', solde: 40_000, profil: 'equilibre', coutBase: 30_000 },
        ],
      }),
    );
    expect(r.annees.length).toBe(95 - 40 + 1);
    for (const a of r.annees) {
      expect(Number.isFinite(a.valeurNette)).toBe(true);
      expect(Number.isFinite(a.impotTotal)).toBe(true);
      expect(a.impotTotal).toBeGreaterThanOrEqual(0);
    }
  });
});
