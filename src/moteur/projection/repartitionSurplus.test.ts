/**
 * À qui appartient le surplus du ménage, en décaissement ?
 *
 * **Signalé par l'utilisateur** : deux conjoints de 18 ans, retraite à 19, héritage de 2 M$ chacun à
 * 19 ans, dépenses de 103 500 $. « Il met tout le reste du 4 000 000 $ dans le non-enregistré du
 * conjoint 1, rien dans le conjoint 2 [...] et l'impôt est supporté seulement par le conjoint 1. »
 *
 * La cause : le surplus partait tout entier chez le conjoint le plus imposé, et à égalité le `>=`
 * désignait le conjoint 1. Le choix se verrouillait ensuite (le placement rendait son bénéficiaire
 * définitivement le plus imposé) et faisait changer de propriétaire l'héritage de l'autre.
 */
import { describe, expect, it } from 'vitest';
import { projeterCouple } from './couple';
import type { HypothesesCouple, PersonneProjection } from './typesCouple';
import type { TypeCompte } from './types';

const ORDRE: TypeCompte[] = ['NON_ENREGISTRE', 'CRI', 'FRV', 'REER', 'FERR', 'CELIAPP', 'CELI'];

/** Les trois comptes que l'interface crée quand on personnalise le rendement, tous à 7 %. */
const comptes = () => [
  { type: 'REER' as const, solde: 0, profil: 'equilibre' as const, rendementPersonnalise: 0.07 },
  { type: 'CELI' as const, solde: 0, profil: 'equilibre' as const, rendementPersonnalise: 0.07 },
  { type: 'NON_ENREGISTRE' as const, solde: 0, profil: 'equilibre' as const, coutBase: 0, rendementPersonnalise: 0.07 },
];

function personne(nom: string, p: Partial<PersonneProjection> = {}): PersonneProjection {
  return {
    nom, sexe: 'H', ageActuel: 18, ageRetraite: 19, ageDeces: 95,
    revenuEmploi: 0, croissanceSalaireReelle: 0, epargneAnnuelle: {}, epargneReerConjoint: 0,
    comptes: comptes(), rrqA65: 0, svA65: 0, ageDebutRRQ: 65, ageDebutSV: 65, rentesEmployeur: [],
    droitsCeliDisponibles: 0, droitsReerDisponibles: 0, ...p,
  };
}

const HERITAGE = [{ nom: 'Succession', montant: 2_000_000, age: 19 }];

function menage(p1: Partial<PersonneProjection>, p2: Partial<PersonneProjection>): HypothesesCouple {
  return {
    personne1: personne('Vigile', p1),
    personne2: personne('Conjointe', { sexe: 'F', ...p2 }),
    depensesRetraite: 103_500, fractionSurvivant: 0.67, immeubles: [],
    ordreDecaissement: ORDRE, inflation: 0.021, fraisGestion: 0.01,
  };
}

describe('le cas signalé : deux héritages simultanés en décaissement', () => {
  const r = projeterCouple(menage({ heritages: HERITAGE }, { heritages: HERITAGE }), { trace: true });
  const a19 = r.annees.find((a) => a.age1 === 19)!;

  it('partage le surplus en parts égales quand les deux apportent autant', () => {
    // Avant correction : 3 964 326 $ chez le conjoint 1, ZÉRO chez le 2.
    expect(a19.soldes1.NON_ENREGISTRE).toBeGreaterThan(1_000_000);
    expect(a19.soldes2.NON_ENREGISTRE).toBeCloseTo(a19.soldes1.NON_ENREGISTRE, 2);
  });

  it('sert d’abord les droits CELI des DEUX conjoints', () => {
    expect(a19.soldes1.CELI).toBeCloseTo(7_000, 0);
    expect(a19.soldes2.CELI).toBeCloseTo(7_000, 0);
  });

  it('ne perd pas un dollar : la destination du surplus somme au surplus', () => {
    const d = a19.detail!.disponible;
    const total = d.destinationSurplus.reduce((s, p) => s + p.montant, 0);
    expect(total).toBeCloseTo(d.surplus, 2);
  });

  it('nomme le conjoint qui reçoit, et publie la clé de répartition', () => {
    // Sans le nom, rien ne montrait que tout atterrissait du même côté.
    const libelles = a19.detail!.disponible.destinationSurplus.map((p) => p.libelle);
    expect(libelles).toContain('Non-enregistré — Vigile');
    expect(libelles).toContain('Non-enregistré — Conjointe');
    const apports = a19.detail!.disponible.apportsSurplus!;
    expect(apports.map((p) => p.libelle)).toEqual(['Apport de Vigile', 'Apport de Conjointe']);
    expect(apports[0].montant).toBeCloseTo(apports[1].montant, 2);
  });

  it('l’impôt cesse de peser sur une seule tête', () => {
    const a20 = r.annees.find((a) => a.age1 === 20)!;
    // Concentré chez un seul conjoint, l'impôt de l'an 2 valait 29 197 $ ; partagé, moitié moins.
    expect(a20.impotTotal).toBeLessThan(20_000);
  });
});

describe('la propriété est respectée', () => {
  it('un seul héritier garde tout son héritage', () => {
    const r = projeterCouple(menage({}, { heritages: HERITAGE }), { trace: true });
    const a19 = r.annees.find((a) => a.age1 === 19)!;
    // Rien ne doit traverser vers le conjoint 1 : ce n'est pas son argent.
    expect(a19.soldes2.NON_ENREGISTRE).toBeGreaterThan(1_000_000);
    expect(a19.soldes1.NON_ENREGISTRE).toBeCloseTo(0, 2);
  });

  it('l’accumulation et le décaissement attribuent le capital de la même façon', () => {
    // Le test qui épingle la cause. Même dossier, même héritage à 19 ans : seule la date de la
    // retraite change la branche empruntée. `poserCapital` (accumulation) plaçait déjà l'héritage
    // de chacun dans SES comptes ; le décaissement, lui, le donnait au plus imposé.
    const enAccumulation = projeterCouple(
      menage({ ageRetraite: 20, heritages: HERITAGE }, { ageRetraite: 20, heritages: HERITAGE }),
    );
    const enDecaissement = projeterCouple(menage({ heritages: HERITAGE }, { heritages: HERITAGE }));
    const partage = (a: { soldes1: Record<TypeCompte, number>; soldes2: Record<TypeCompte, number> }) =>
      a.soldes1.NON_ENREGISTRE / (a.soldes1.NON_ENREGISTRE + a.soldes2.NON_ENREGISTRE);

    expect(partage(enAccumulation.annees.find((a) => a.age1 === 19)!)).toBeCloseTo(0.5, 6);
    expect(partage(enDecaissement.annees.find((a) => a.age1 === 19)!)).toBeCloseTo(0.5, 6);
  });
});

describe('le ménage y gagne', () => {
  it('le patrimoine du couple au dernier décès progresse nettement', () => {
    const r = projeterCouple(menage({ heritages: HERITAGE }, { heritages: HERITAGE }));
    // Mesuré avant les deux corrections : 15 010 520 $ réels.
    expect(r.valeurNetteAuDernierDecesReelle).toBeGreaterThan(20_000_000);
  });
});
