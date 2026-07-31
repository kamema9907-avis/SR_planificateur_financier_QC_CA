/**
 * Qui décaisse, et ce que ça lui coûte vraiment.
 *
 * **Question de l'utilisateur** : « pourquoi avec les mêmes placements et le même rendement l'impôt
 * des 2 n'est pas le même, et pourquoi à 36 ans le conjoint 1 ne paie plus d'impôt et le conjoint 2
 * paie 44 500 $ ? » Deux causes, sans rapport l'une avec l'autre.
 *
 * 1. Un **gain en capital fantôme** : `financerCouple` réduisait le coût de base AVANT de calculer le
 *    gain, déclarant `w²B/S²` de trop. Le mode solo faisait déjà l'inverse, correctement.
 * 2. Le retrait **dépassait le point d'égalisation** : toute la dépense de l'année sortait d'un seul
 *    compte, si bien qu'un conjoint se vidait pendant que l'autre composait.
 */
import { describe, expect, it } from 'vitest';
import { projeterCouple } from './couple';
import { projeter } from './projection';
import type { HypothesesCouple, PersonneProjection } from './typesCouple';
import type { Compte, HypothesesProjection, TypeCompte } from './types';

const ORDRE: TypeCompte[] = ['NON_ENREGISTRE', 'CRI', 'FRV', 'REER', 'FERR', 'CELIAPP', 'CELI'];

/** Retraité dès le départ : la branche décaissement s'exécute dès la première année. */
function retraite(nom: string, comptes: Compte[], p: Partial<PersonneProjection> = {}): PersonneProjection {
  return {
    nom, sexe: 'H', ageActuel: 65, ageRetraite: 65, ageDeces: 80,
    revenuEmploi: 0, croissanceSalaireReelle: 0, epargneAnnuelle: {}, epargneReerConjoint: 0,
    comptes, rrqA65: 0, svA65: 0, ageDebutRRQ: 65, ageDebutSV: 65, rentesEmployeur: [],
    droitsCeliDisponibles: 0, droitsReerDisponibles: 0, ...p,
  };
}

const menage = (p1: PersonneProjection, p2: PersonneProjection, depensesRetraite: number): HypothesesCouple => ({
  personne1: p1, personne2: p2, depensesRetraite, fractionSurvivant: 0.67, immeubles: [],
  ordreDecaissement: ORDRE, inflation: 0.021, fraisGestion: 0.01,
});

/** Non-enregistré SANS gain latent : coût de base égal au solde. */
const frais = (solde: number): Compte =>
  ({ type: 'NON_ENREGISTRE', solde, profil: 'equilibre', coutBase: solde });

describe('le gain en capital fantôme', () => {
  it('un retrait sans gain latent ne coûte RIEN, quelle que soit son ampleur', () => {
    // La première année, le coût de base vaut exactement le solde : le retrait est intégralement du
    // capital, donc non imposable. L'impôt ne doit donc PAS dépendre du montant dépensé.
    // Avant correction il en dépendait, en w² : c'est toute l'anomalie.
    const impotAn1 = (depenses: number) =>
      projeterCouple(menage(
        retraite('A', [frais(900_000)]), retraite('B', [frais(900_000)]), depenses,
      )).annees[0].impotTotal;

    expect(impotAn1(80_000)).toBeCloseTo(impotAn1(20_000), 2);
    expect(impotAn1(150_000)).toBeCloseTo(impotAn1(20_000), 2);
  });

  it('le couple et le solo imposent le même retrait de la même façon', () => {
    // Un ménage dont un seul conjoint possède tout, comparé à la même personne en solo : le retrait
    // est le même, l'impôt doit l'être aussi. C'est le test qui aurait attrapé le bogue — les deux
    // moteurs faisaient les trois mêmes opérations dans un ordre différent.
    const comptes = (): Compte[] => [
      { type: 'NON_ENREGISTRE', solde: 600_000, profil: 'equilibre', coutBase: 360_000 },
    ];
    const enCouple = projeterCouple(menage(
      retraite('Vigile', comptes()),
      retraite('Conjointe', [], { sexe: 'F' }),
      55_000,
    ));
    const solo: HypothesesProjection = {
      ageActuel: 65, ageRetraite: 65, ageDeces: 80, vitSeul: false,
      revenuEmploi: 0, croissanceSalaireReelle: 0, epargneAnnuelle: {}, comptes: comptes(),
      immeubles: [], rrqA65: 0, svA65: 0, ageDebutRRQ: 65, ageDebutSV: 65, rentesEmployeur: [],
      depensesRetraite: 55_000, ordreDecaissement: ORDRE, inflation: 0.021, fraisGestion: 0.01,
      droitsCeliDisponibles: 0, droitsReerDisponibles: 0,
    };
    expect(enCouple.annees[0].impotTotal).toBeCloseTo(projeter(solo).annees[0].impotTotal, 2);
  });
});

// --- Le dossier signalé : deux conjoints rigoureusement identiques ---

const comptesUtilisateur = (): Compte[] => [
  { type: 'REER', solde: 0, profil: 'equilibre', rendementPersonnalise: 0.07 },
  { type: 'CELI', solde: 0, profil: 'equilibre', rendementPersonnalise: 0.07 },
  { type: 'NON_ENREGISTRE', solde: 0, profil: 'equilibre', coutBase: 0, rendementPersonnalise: 0.07 },
];

const jumeau = (nom: string, sexe: 'H' | 'F'): PersonneProjection => ({
  nom, sexe, ageActuel: 18, ageRetraite: 19, ageDeces: 95,
  revenuEmploi: 0, croissanceSalaireReelle: 0, epargneAnnuelle: {}, epargneReerConjoint: 0,
  heritages: [{ nom: 'Succession', montant: 2_000_000, age: 19 }],
  comptes: comptesUtilisateur(), rrqA65: 0, svA65: 0, ageDebutRRQ: 65, ageDebutSV: 65,
  rentesEmployeur: [], droitsCeliDisponibles: 0, droitsReerDisponibles: 0,
});

const dossierSignale = menage(jumeau('Vigile', 'H'), jumeau('Conjointe', 'F'), 103_500);

describe('deux conjoints identiques restent identiques', () => {
  const r = projeterCouple(dossierSignale, { trace: true });
  const jusqua = (age: number) => r.annees.filter((a) => a.age1 != null && a.age1 >= 20 && a.age1 <= age);

  it('paient le même impôt dès la première année de décaissement', () => {
    // Avant correction : 7 873 $ contre 6 535 $ — l'écart était le gain fantôme, supporté par le
    // seul conjoint qui décaissait.
    const a20 = r.annees.find((a) => a.age1 === 20)!;
    expect(a20.detail!.impot1!.impotCourant).toBeCloseTo(a20.detail!.impot2!.impotCourant, 2);
  });

  it('gardent des impôts à moins de 1 % l’un de l’autre pendant 20 ans', () => {
    // Avant correction, à 40 ans : 10 178 $ contre 61 129 $.
    for (const a of jusqua(40)) {
      const i1 = a.detail!.impot1!.impotCourant;
      const i2 = a.detail!.impot2!.impotCourant;
      expect(Math.abs(i1 - i2)).toBeLessThan(0.01 * Math.max(i1, i2));
    }
  });

  it('gardent des capitaux à moins de 1 % l’un de l’autre', () => {
    // Le cœur du problème : avant correction, 768 000 $ contre 7 818 000 $ à 40 ans. Un conjoint
    // finançait seul le train de vie — et l'impôt engendré par le capital de l'autre.
    for (const a of jusqua(40)) {
      const n1 = a.soldes1.NON_ENREGISTRE;
      const n2 = a.soldes2.NON_ENREGISTRE;
      expect(Math.abs(n1 - n2)).toBeLessThan(0.01 * Math.max(n1, n2));
    }
  });

  it('l’impôt du ménage recule, et le patrimoine progresse', () => {
    // Deux assiettes égales coûtent moins que deux assiettes inégales : la fonction d'impôt est convexe.
    const a36 = r.annees.find((a) => a.age1 === 36)!;
    expect(a36.impotTotal).toBeLessThan(56_116); // mesuré avant correction
    expect(r.valeurNetteAuDernierDecesReelle).toBeGreaterThan(23_009_827); // idem
  });
});

describe('le plafond d’égalisation ne casse rien', () => {
  it('un ménage dont un seul conjoint détient les comptes finance sa cible', () => {
    // Personne avec qui partager : le plafond ne doit pas s'appliquer, sinon la boucle tournerait
    // sans jamais atteindre la cible.
    const r = projeterCouple(menage(
      retraite('Vigile', [{ type: 'NON_ENREGISTRE', solde: 900_000, profil: 'equilibre', coutBase: 500_000 }]),
      retraite('Conjointe', [], { sexe: 'F' }),
      60_000,
    ));
    expect(r.anneeEpuisement).toBeNull();
    expect(r.annees[0].revenuDisponible).toBeCloseTo(60_000, 0);
  });

  it('la cible reste financée quand les deux ont des comptes', () => {
    const r = projeterCouple(dossierSignale);
    expect(r.anneeEpuisement).toBeNull();
    for (const a of r.annees.filter((x) => x.age1 != null && x.age1 >= 20 && x.age1 <= 60)) {
      // Nominal : la cible est indexée. On vérifie qu'elle est atteinte, pas dépassée à l'infini.
      expect(a.revenuDisponible).toBeGreaterThan(103_500);
    }
  });

  it('un compte enregistré s’égalise aussi, pas seulement le non-enregistré', () => {
    // Un retrait REER est imposable au premier dollar : c'est là que l'égalisation compte le plus.
    const r = projeterCouple(menage(
      retraite('Vigile', [{ type: 'REER', solde: 700_000, profil: 'equilibre' }]),
      retraite('Conjointe', [{ type: 'REER', solde: 700_000, profil: 'equilibre' }], { sexe: 'F' }),
      70_000,
    ), { trace: true });
    const a = r.annees[0];
    expect(a.detail!.impot1!.impotCourant).toBeCloseTo(a.detail!.impot2!.impotCourant, 2);
    // Au cent près : la dichotomie du solveur s'arrête à `TOL = 0,01 $`, elle ne peut pas faire mieux.
    expect(Math.abs(a.soldes1.REER - a.soldes2.REER)).toBeLessThanOrEqual(0.01);
  });
});
