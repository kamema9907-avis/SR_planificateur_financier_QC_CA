/**
 * Le décès en mode couple : qui paie quoi, et qui hérite de quoi.
 *
 * Trois trous couverts ici, tous sur le même moment — celui où de l'argent change de mains et où
 * l'impôt frappe :
 *
 * 1. **Décès simultanés** : `valeurNetteFinaleReelle` était AFFECTÉE, pas cumulée. Les deux conjoints
 *    mourant la même année, la seconde affectation écrasait la première et les comptes du conjoint 1
 *    disparaissaient du patrimoine transmis — alors que son impôt au décès, lui, était bien facturé.
 * 2. **Le tiroir muet** : l'impôt des dispositions présumées était calculé APRÈS la construction de
 *    la trace, qui recevait donc 0. Le chiffre de tête était net sans que rien ne l'explique.
 * 3. **Le roulement invisible** : les comptes du défunt passent au survivant sans impôt, et rien ne
 *    le disait. Dans le tableau, ses soldes disparaissaient d'une ligne à l'autre.
 */
import { describe, expect, it } from 'vitest';
import { projeterCouple } from './couple';
import { sommePostes } from './trace';
import type { HypothesesCouple, PersonneProjection } from './typesCouple';
import type { TypeCompte } from './types';
import type { Immeuble } from './immobilier';

const ORDRE: TypeCompte[] = ['NON_ENREGISTRE', 'CRI', 'FRV', 'REER', 'FERR', 'CELIAPP', 'CELI'];

function conjoint(nom: string, p: Partial<PersonneProjection> = {}): PersonneProjection {
  return {
    nom, sexe: 'H', ageActuel: 70, ageRetraite: 71, ageDeces: 80, revenuEmploi: 0,
    croissanceSalaireReelle: 0, epargneAnnuelle: {}, epargneReerConjoint: 0,
    comptes: [
      { type: 'REER', solde: 400_000, profil: 'equilibre' },
      { type: 'CELI', solde: 120_000, profil: 'dynamique' },
    ],
    rrqA65: 12_000, svA65: 8_500, ageDebutRRQ: 65, ageDebutSV: 65, rentesEmployeur: [],
    droitsCeliDisponibles: 20_000, droitsReerDisponibles: 0, ...p,
  };
}

/** Dépenses faibles : le capital survit, pour que le patrimoine transmis soit substantiel. */
const couple = (p: Partial<HypothesesCouple> = {}): HypothesesCouple => ({
  personne1: conjoint('Alice'), personne2: conjoint('Benoît', { sexe: 'F' }),
  depensesRetraite: 40_000, fractionSurvivant: 0.67, immeubles: [],
  ordreDecaissement: ORDRE, inflation: 0.021, fraisGestion: 0.01, ...p,
});

const derniere = (r: ReturnType<typeof projeterCouple>) => r.annees[r.annees.length - 1];
/** Somme des soldes d'un conjoint pour une année. */
const soldes = (s: Record<TypeCompte, number>) => Object.values(s).reduce((a, b) => a + b, 0);

describe('décès simultanés — les deux successions comptent', () => {
  /** Même âge, même âge de décès : les deux meurent la MÊME année de projection. */
  const simultane = () => couple();

  it('les deux conjoints meurent bien la même année', () => {
    const r = projeterCouple(simultane(), { trace: true });
    const d = derniere(r);
    expect(d.age1).toBe(80);
    expect(d.age2).toBe(80);
    // Aucune phase de survie : personne ne survit à l'autre.
    expect(r.annees.some((a) => a.phase === 'survie')).toBe(false);
  });

  it('le patrimoine transmis compte les comptes des DEUX conjoints', () => {
    // LE test de la dette A. Avant correction, seuls les comptes du conjoint 2 étaient comptés.
    const r = projeterCouple(simultane(), { trace: true });
    const d = derniere(r);
    const impotDeces = d.detail!.valeurNette.impotDeces;

    expect(impotDeces).toBeGreaterThan(50_000); // sinon le dossier ne prouve rien
    expect(r.valeurNetteAuDernierDecesReelle)
      .toBeCloseTo((soldes(d.soldes1) + soldes(d.soldes2) - impotDeces) * d.deflateurReel, 4);
    // Et le conjoint 1 possède réellement quelque chose : le test n'est pas vide de sens.
    expect(soldes(d.soldes1)).toBeGreaterThan(100_000);
  });

  it('l’impôt de l’année cumule les deux dispositions présumées', () => {
    const r = projeterCouple(simultane(), { trace: true });
    const d = derniere(r);
    expect(d.detail!.impot1!.impotDeces).toBeGreaterThan(0);
    expect(d.detail!.impot2!.impotDeces).toBeGreaterThan(0);
    expect(d.detail!.valeurNette.impotDeces)
      .toBeCloseTo(d.detail!.impot1!.impotDeces + d.detail!.impot2!.impotDeces, 4);
  });

  it('un immeuble commun n’est compté qu’une fois dans le patrimoine transmis', () => {
    const bien: Immeuble = {
      nom: 'Chalet', type: 'terrain', valeur: 300_000, coutBase: 100_000, anneesDetenues: 15,
      appreciation: 0.025, hypotheque: 0, tauxHypotheque: 0.05, paiementAnnuel: 0,
      revenuNetExploitation: 0, ageVente: null, fractionLiberee: 1, proprietaire: 'commun',
    };
    const r = projeterCouple(couple({ immeubles: [bien] }), { trace: true });
    const d = derniere(r);
    const attendu = soldes(d.soldes1) + soldes(d.soldes2) + d.equiteImmobiliere
      - d.detail!.valeurNette.impotDeces;
    expect(r.valeurNetteAuDernierDecesReelle).toBeCloseTo(attendu * d.deflateurReel, 4);
    // L'équité est bien celle du bien entier, pas le double.
    expect(d.equiteImmobiliere).toBeGreaterThan(300_000);
    expect(d.equiteImmobiliere).toBeLessThan(700_000);
  });
});

describe('décès séquentiels — le roulement au survivant', () => {
  /** Alice meurt à 80, Benoît lui survit jusqu'à 90. */
  const sequentiel = () => couple({
    personne1: conjoint('Alice', { ageDeces: 80 }),
    personne2: conjoint('Benoît', { sexe: 'F', ageDeces: 90 }),
  });

  const anneeDuPremierDeces = (r: ReturnType<typeof projeterCouple>) =>
    r.annees.find((a) => (a.detail?.valeurNette.roulementVers ?? null) !== null)!;

  it('l’année du premier décès liste les comptes transférés, et nomme le bénéficiaire', () => {
    const r = projeterCouple(sequentiel(), { trace: true });
    const a = anneeDuPremierDeces(r);
    expect(a.age1).toBe(80);
    expect(a.detail!.valeurNette.roulementVers).toBe('Benoît');
    const postes = a.detail!.valeurNette.roulement;
    expect(postes.length).toBeGreaterThan(0);
    // Ce qui roule, c'est exactement ce que la défunte possédait.
    expect(sommePostes(postes)).toBeCloseTo(soldes(a.soldes1), 4);
  });

  it('la somme roulée se retrouve chez le survivant l’année suivante', () => {
    const r = projeterCouple(sequentiel(), { trace: true });
    const a = anneeDuPremierDeces(r);
    const suivante = r.annees[r.annees.indexOf(a) + 1];
    // Le survivant reçoit tout, sans impôt : ses soldes bondissent d'au moins le montant roulé,
    // moins ce qu'il décaisse pour vivre cette année-là.
    expect(soldes(suivante.soldes2)).toBeGreaterThan(soldes(a.soldes2) + sommePostes(a.detail!.valeurNette.roulement) * 0.85);
    expect(soldes(suivante.soldes1)).toBeCloseTo(0, 4);
  });

  it('le premier décès ne coûte AUCUN impôt de dispositions présumées', () => {
    // C'est tout le sens du roulement au conjoint : imposition différée, pas exonération.
    const r = projeterCouple(sequentiel(), { trace: true });
    const a = anneeDuPremierDeces(r);
    expect(a.detail!.valeurNette.impotDeces).toBeCloseTo(0, 4);
  });

  it('le second décès, lui, est imposé — et sur le patrimoine réuni', () => {
    const r = projeterCouple(sequentiel(), { trace: true });
    const d = derniere(r);
    expect(d.age1).toBeNull();
    expect(d.detail!.valeurNette.impotDeces).toBeGreaterThan(0);
    expect(d.detail!.impot1).toBeNull();
    expect(d.detail!.impot2!.impotDeces).toBeGreaterThan(0);
  });

  it('aucun roulement les autres années', () => {
    const r = projeterCouple(sequentiel(), { trace: true });
    const avec = r.annees.filter((a) => a.detail!.valeurNette.roulement.length > 0);
    expect(avec.length).toBe(1);
  });
});

describe('invariant transversal du patrimoine transmis', () => {
  const scenarios: [string, HypothesesCouple][] = [
    ['décès simultanés', couple()],
    ['décès séquentiels', couple({ personne2: conjoint('Benoît', { sexe: 'F', ageDeces: 90 }) })],
    ['survie très longue', couple({ personne2: conjoint('Benoît', { sexe: 'F', ageDeces: 98 }) })],
  ];

  it('= (comptes des deux + équité − impôts au décès) × déflateur', () => {
    for (const [nom, h] of scenarios) {
      const r = projeterCouple(h, { trace: true });
      const d = derniere(r);
      const attendu = (soldes(d.soldes1) + soldes(d.soldes2) + d.equiteImmobiliere
        - d.detail!.valeurNette.impotDeces) * d.deflateurReel;
      expect(r.valeurNetteAuDernierDecesReelle, nom).toBeCloseTo(attendu, 4);
      expect(r.valeurNetteAuDernierDecesReelle, nom).toBeGreaterThanOrEqual(0);
    }
  });
});
