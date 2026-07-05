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

describe('droits de cotisation CELI', () => {
  it('plafonne l’épargne CELI aux droits, l’excédent débordant au non-enregistré', () => {
    const r = projeter(
      hypotheses({
        ageActuel: 40, ageRetraite: 100, ageDeces: 41, // 2 années d'accumulation
        epargneAnnuelle: { CELI: 8_000 },
        droitsCeliDisponibles: 5_000,
        comptes: [
          { type: 'CELI', solde: 0, profil: 'equilibre', rendementPersonnalise: 0 },
          { type: 'NON_ENREGISTRE', solde: 0, profil: 'equilibre', coutBase: 0, rendementPersonnalise: 0 },
        ],
      }),
    );
    // Année 1 : droits 5 000 → 5 000 au CELI, 3 000 au non-enregistré.
    expect(r.annees[0].soldes.CELI).toBeCloseTo(5_000, 2);
    expect(r.annees[0].soldes.NON_ENREGISTRE).toBeCloseTo(3_000, 2);
    // Année 2 : +7 000 $ de nouveaux droits → tout le 8 000 ne passe pas (7 000 + 1 000 débordé).
    expect(r.annees[1].soldes.CELI).toBeCloseTo(12_000, 2);
    expect(r.annees[1].soldes.NON_ENREGISTRE).toBeCloseTo(4_000, 2);
  });

  it('chaîne complète : CELIAPP plein → CELI (selon droits) → non-enregistré', () => {
    const r = projeter(
      hypotheses({
        ageActuel: 40, ageRetraite: 100, ageDeces: 40, // 1 année
        epargneAnnuelle: { CELIAPP: 12_000 },
        droitsCeliDisponibles: 1_000,
        comptes: [
          { type: 'CELIAPP', solde: 0, profil: 'equilibre', rendementPersonnalise: 0 },
          { type: 'CELI', solde: 0, profil: 'equilibre', rendementPersonnalise: 0 },
          { type: 'NON_ENREGISTRE', solde: 0, profil: 'equilibre', coutBase: 0, rendementPersonnalise: 0 },
        ],
      }),
    );
    expect(r.annees[0].soldes.CELIAPP).toBeCloseTo(8_000, 2); // plafond annuel CELIAPP
    expect(r.annees[0].soldes.CELI).toBeCloseTo(1_000, 2); // selon les droits CELI
    expect(r.annees[0].soldes.NON_ENREGISTRE).toBeCloseTo(3_000, 2); // le reste
  });

  it('un retrait CELI restaure les droits l’année suivante, et la fonte du REER respecte les droits', () => {
    const r = projeter(
      hypotheses({
        ageActuel: 65, ageRetraite: 65, ageDeces: 67,
        depensesRetraite: 20_000,
        droitsCeliDisponibles: 0,
        cibleFonteReer: 100_000,
        ordreDecaissement: ['CELI', 'CELIAPP', 'NON_ENREGISTRE', 'CRI', 'FRV', 'REER', 'FERR'],
        comptes: [
          { type: 'CELI', solde: 100_000, profil: 'equilibre', rendementPersonnalise: 0 },
          { type: 'REER', solde: 500_000, profil: 'equilibre', rendementPersonnalise: 0 },
          { type: 'NON_ENREGISTRE', solde: 0, profil: 'equilibre', coutBase: 0, rendementPersonnalise: 0 },
        ],
      }),
    );
    // Âge 65 : retrait CELI de 20 000 pour les dépenses ; droits 0 → la fonte réinvestit
    // entièrement au non-enregistré. CELI = 100 000 − 20 000.
    const a65 = r.annees.find((a) => a.age === 65)!;
    expect(a65.soldes.CELI).toBeCloseTo(80_000, 0);
    expect(a65.soldes.NON_ENREGISTRE).toBeGreaterThan(50_000); // l'après-impôt de la fonte y déborde
    // Âge 66 : droits = 7 000 (annuel) + 20 000 (retrait restauré) = 27 000 → la fonte remplit
    // exactement ces droits au CELI. CELI = 80 000 − 20 000 + 27 000.
    const a66 = r.annees.find((a) => a.age === 66)!;
    expect(a66.soldes.CELI).toBeCloseTo(87_000, 0);
  });
});

describe('droits de cotisation REER', () => {
  const comptesSansCroissance = [
    { type: 'REER', solde: 0, profil: 'equilibre', rendementPersonnalise: 0 },
    { type: 'CELI', solde: 0, profil: 'equilibre', rendementPersonnalise: 0 },
    { type: 'NON_ENREGISTRE', solde: 0, profil: 'equilibre', coutBase: 0, rendementPersonnalise: 0 },
  ] as const;

  it('sans régime d’employeur : droits = 18 % du salaire ; l’excédent va au CELI', () => {
    const r = projeter(
      hypotheses({
        ageActuel: 40, ageRetraite: 100, ageDeces: 40, // 1 année d'accumulation
        revenuEmploi: 50_000,
        epargneAnnuelle: { REER: 12_000 },
        droitsReerDisponibles: 0,
        comptes: comptesSansCroissance.map((c) => ({ ...c })),
      }),
    );
    // 18 % × 50 000 = 9 000 de droits → 9 000 au REER, 3 000 redirigés au CELI (droits par défaut).
    expect(r.annees[0].soldes.REER).toBeCloseTo(9_000, 0);
    expect(r.annees[0].soldes.CELI).toBeCloseTo(3_000, 0);
  });

  it('membre RREGOP : ~600 $/an de droits seulement, le reste redirigé', () => {
    const r = projeter(
      hypotheses({
        ageActuel: 40, ageRetraite: 100, ageDeces: 40,
        revenuEmploi: 70_000,
        epargneAnnuelle: { REER: 10_000 },
        droitsReerDisponibles: 0,
        regimeRetraitePD: true,
        comptes: comptesSansCroissance.map((c) => ({ ...c })),
      }),
    );
    // FE ≈ 18 %×70 000 − 600 ⇒ ~600 $ de droits REER.
    expect(r.annees[0].soldes.REER).toBeCloseTo(600, 0);
    expect(r.annees[0].soldes.CELI + r.annees[0].soldes.NON_ENREGISTRE).toBeCloseTo(9_400, 0);
  });
});

describe('crédit pour fonds de travailleurs (FTQ/Fondaction) en accumulation', () => {
  const comptes = [
    { type: 'REER', solde: 0, profil: 'equilibre', rendementPersonnalise: 0 },
    { type: 'CELI', solde: 0, profil: 'equilibre', rendementPersonnalise: 0 },
    { type: 'NON_ENREGISTRE', solde: 0, profil: 'equilibre', coutBase: 0, rendementPersonnalise: 0 },
  ] as const;

  it('donne 30 % de crédit (1 500 $ sur 5 000 $) par rapport au même montant en REER ordinaire', () => {
    const base = { ageActuel: 40, ageRetraite: 100, ageDeces: 40, revenuEmploi: 80_000, droitsReerDisponibles: 50_000 };
    const sans = projeter(hypotheses({ ...base, epargneAnnuelle: { REER: 5_000 }, comptes: comptes.map((c) => ({ ...c })) }));
    const avec = projeter(hypotheses({ ...base, fondsTravailleursAnnuel: 5_000, comptes: comptes.map((c) => ({ ...c })) }));
    // Même cotisation REER de 5 000 $ (déductible) ; seule différence = le crédit de 30 %.
    expect(sans.annees[0].impotTotal - avec.annees[0].impotTotal).toBeCloseTo(1_500, 0);
  });

  it('un membre RREGOP obtient le crédit même si le fonds dépasse ses droits REER', () => {
    const base = { ageActuel: 40, ageRetraite: 100, ageDeces: 40, revenuEmploi: 70_000, droitsReerDisponibles: 0, regimeRetraitePD: true };
    const sans = projeter(hypotheses({ ...base, epargneAnnuelle: { REER: 5_000 }, comptes: comptes.map((c) => ({ ...c })) }));
    const avec = projeter(hypotheses({ ...base, fondsTravailleursAnnuel: 5_000, comptes: comptes.map((c) => ({ ...c })) }));
    // Les deux versent 5 000 $ au même parcours REER (~600 $ déductible + reste au CELI) ; diff = crédit 1 500 $.
    expect(sans.annees[0].impotTotal - avec.annees[0].impotTotal).toBeCloseTo(1_500, 0);
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

describe('retraité-actif (travail poursuivi à la retraite)', () => {
  const reer = (): HypothesesProjection['comptes'] => [{ type: 'REER', solde: 2_000_000, profil: 'equilibre' }];

  it('réduit le retrait imposable grâce au revenu de travail', () => {
    const commun = { ageActuel: 65, ageRetraite: 65, ageDeces: 85, depensesRetraite: 50_000 } as const;
    const sans = projeter(hypotheses({ ...commun, comptes: reer() }));
    const avec = projeter(
      hypotheses({
        ...commun,
        comptes: reer(),
        periodesTravail: [{ nom: 'Temps partiel', montant: 30_000, ageDebut: 65, ageFin: 70 }],
      }),
    );
    expect(avec.annees[0].revenuDisponible).toBeCloseTo(50_000, 0); // la cible nette est toujours atteinte
    expect(avec.annees[0].revenuEmploi).toBeCloseTo(30_000, 0); // le revenu de travail est enregistré
    // …mais on puise beaucoup moins dans le REER imposable.
    expect(avec.annees[0].retraitsEnregistres).toBeLessThan(sans.annees[0].retraitsEnregistres);
  });

  it('impose le revenu de travail et le fait cesser à l’âge de fin', () => {
    const r = projeter(
      hypotheses({
        ageActuel: 65, ageRetraite: 65, ageDeces: 72, depensesRetraite: 0,
        periodesTravail: [{ nom: 'Pige', montant: 40_000, ageDebut: 65, ageFin: 68 }],
      }),
    );
    expect(r.annees[0].revenuEmploi).toBeCloseTo(40_000, 0);
    expect(r.annees[0].impotTotal).toBeGreaterThan(0); // imposé même sans retrait de compte
    expect(r.annees.find((a) => a.age === 68)!.revenuEmploi).toBe(0); // âge de fin exclu
  });

  it('place le surplus au CELI en priorité (pas au non-enregistré)', () => {
    const r = projeter(
      hypotheses({
        ageActuel: 65, ageRetraite: 65, ageDeces: 70, depensesRetraite: 10_000,
        droitsCeliDisponibles: 100_000,
        periodesTravail: [{ nom: 'Consultation', montant: 50_000, ageDebut: 65, ageFin: 68 }],
      }),
    );
    expect(r.annees[0].soldes.CELI).toBeGreaterThan(0);
    expect(r.annees[0].soldes.NON_ENREGISTRE).toBeCloseTo(0, 0);
  });

  it('n’applique le travail à la retraite qu’à partir de l’âge de retraite', () => {
    const r = projeter(
      hypotheses({
        ageActuel: 60, ageRetraite: 65, ageDeces: 75, depensesRetraite: 20_000,
        periodesTravail: [{ nom: 'X', montant: 30_000, ageDebut: 60, ageFin: 70 }],
        comptes: [{ type: 'CELI', solde: 500_000, profil: 'equilibre' }],
      }),
    );
    expect(r.annees.find((a) => a.age === 60)!.revenuEmploi).toBe(0); // encore en accumulation
    expect(r.annees.find((a) => a.age === 65)!.revenuEmploi).toBeCloseTo(30_000, 0); // décaissement
  });

  it('améliore le patrimoine au décès à dépenses égales', () => {
    const commun = { ageActuel: 65, ageRetraite: 65, ageDeces: 80, depensesRetraite: 40_000 } as const;
    const sans = projeter(hypotheses({ ...commun, comptes: [{ type: 'REER', solde: 800_000, profil: 'equilibre' }] }));
    const avec = projeter(
      hypotheses({
        ...commun,
        comptes: [{ type: 'REER', solde: 800_000, profil: 'equilibre' }],
        periodesTravail: [{ nom: 'Temps partiel', montant: 25_000, ageDebut: 65, ageFin: 72 }],
      }),
    );
    expect(avec.valeurNetteAuDecesReelle).toBeGreaterThan(sans.valeurNetteAuDecesReelle);
  });
});
