/**
 * Remplissage annuel du CELI depuis le non-enregistré.
 *
 * **Signalé par l'utilisateur** : « à partir de la 2e année des héritages, les montants CELI
 * disponibles des 2 conjoints augmentent année après année. » Exact : en décaissement le solveur
 * retire pile la dépense visée, il ne reste aucun surplus, et plus rien ne cotise jamais au CELI.
 * Sur son dossier, 1 341 500 $ de droits inutilisés par conjoint à 95 ans, pendant que 4 M$
 * dormaient en non-enregistré.
 *
 * L'arbitrage n'est pas gagné d'avance, et le dernier bloc le montre : voir `REMPLISSAGE_CELI` dans
 * `optimiseur.ts`.
 */
import { describe, expect, it } from 'vitest';
import { remplirCeli } from './remplissageCeli';
import { projeter } from './projection';
import { projeterCouple } from './couple';
import { optimiserProjection } from './optimiseur';
import type { Compte, HypothesesProjection, TypeCompte } from './types';
import type { HypothesesCouple, PersonneProjection } from './typesCouple';

const ORDRE: TypeCompte[] = ['NON_ENREGISTRE', 'REER', 'FERR', 'CRI', 'FRV', 'CELIAPP', 'CELI'];

const nonEnr = (solde: number, coutBase: number): Compte => ({
  type: 'NON_ENREGISTRE', solde, profil: 'equilibre', coutBase,
});

describe('remplirCeli — la mécanique', () => {
  it('déplace le moindre des droits, du plafond et du solde', () => {
    const c: Compte[] = [nonEnr(100_000, 60_000)];
    expect(remplirCeli(c, 'equilibre', 7_000, 1_000_000).montant).toBe(7_000);
    expect(remplirCeli(c, 'equilibre', 500_000, 5_000).montant).toBe(5_000);
    // Solde restant : 100 000 − 7 000 − 5 000.
    expect(remplirCeli(c, 'equilibre', 500_000, 1_000_000).montant).toBeCloseTo(88_000, 6);
  });

  it('réalise le gain latent au prorata, et réduit le coût de base d’autant', () => {
    // 40 % de gain latent (100 000 − 60 000) : un retrait de 10 000 en réalise 4 000.
    const c: Compte[] = [nonEnr(100_000, 60_000)];
    const r = remplirCeli(c, 'equilibre', 10_000, 1_000_000);
    expect(r.gainRealise).toBeCloseTo(4_000, 6);
    expect(c[0].solde).toBeCloseTo(90_000, 6);
    expect(c[0].coutBase).toBeCloseTo(54_000, 6); // 60 000 × 0,9 : la fraction de gain est conservée
    expect(c.find((x) => x.type === 'CELI')!.solde).toBeCloseTo(10_000, 6);
  });

  it('crée le CELI s’il n’existe pas, et alimente celui qui existe', () => {
    const sans: Compte[] = [nonEnr(50_000, 50_000)];
    remplirCeli(sans, 'dynamique', 7_000, 1_000_000);
    expect(sans.find((c) => c.type === 'CELI')).toMatchObject({ solde: 7_000, profil: 'dynamique' });

    const avec: Compte[] = [nonEnr(50_000, 50_000), { type: 'CELI', solde: 20_000, profil: 'prudent' }];
    remplirCeli(avec, 'equilibre', 7_000, 1_000_000);
    expect(avec.filter((c) => c.type === 'CELI')).toHaveLength(1);
    expect(avec.find((c) => c.type === 'CELI')!.solde).toBeCloseTo(27_000, 6);
  });

  it('ne fait rien sans non-enregistré, sans droits, ou sans plafond', () => {
    const rien = { montant: 0, gainRealise: 0 };
    expect(remplirCeli([{ type: 'REER', solde: 500_000, profil: 'equilibre' }], 'equilibre', 7_000, 1e9)).toEqual(rien);
    expect(remplirCeli([nonEnr(100_000, 0)], 'equilibre', 0, 1e9)).toEqual(rien);
    expect(remplirCeli([nonEnr(100_000, 0)], 'equilibre', 7_000, 0)).toEqual(rien);
    expect(remplirCeli([nonEnr(100_000, 0)], 'equilibre', 7_000, -50_000)).toEqual(rien);
  });

  it('puise dans plusieurs comptes non-enregistrés, chacun avec SON gain latent', () => {
    const c: Compte[] = [nonEnr(6_000, 6_000), nonEnr(10_000, 0)];
    const r = remplirCeli(c, 'equilibre', 10_000, 1_000_000);
    expect(r.montant).toBeCloseTo(10_000, 6);
    // Le premier n'a aucun gain (coût = solde), le second est 100 % gain : 0 + 4 000.
    expect(r.gainRealise).toBeCloseTo(4_000, 6);
  });
});

// --- Intégration ---

const comptesUtilisateur = () => [
  { type: 'REER' as const, solde: 0, profil: 'equilibre' as const, rendementPersonnalise: 0.07 },
  { type: 'CELI' as const, solde: 0, profil: 'equilibre' as const, rendementPersonnalise: 0.07 },
  { type: 'NON_ENREGISTRE' as const, solde: 0, profil: 'equilibre' as const, coutBase: 0, rendementPersonnalise: 0.07 },
];

const conjoint = (nom: string, sexe: 'H' | 'F'): PersonneProjection => ({
  nom, sexe, ageActuel: 18, ageRetraite: 19, ageDeces: 95,
  revenuEmploi: 0, croissanceSalaireReelle: 0, epargneAnnuelle: {}, epargneReerConjoint: 0,
  heritages: [{ nom: 'Succession', montant: 2_000_000, age: 19 }],
  comptes: comptesUtilisateur(), rrqA65: 0, svA65: 0, ageDebutRRQ: 65, ageDebutSV: 65,
  rentesEmployeur: [], droitsCeliDisponibles: 0, droitsReerDisponibles: 0,
});

const dossierSignale = (remplirDroitsCeli?: boolean): HypothesesCouple => ({
  personne1: conjoint('Vigile', 'H'), personne2: conjoint('Conjointe', 'F'),
  depensesRetraite: 103_500, fractionSurvivant: 0.67, immeubles: [],
  ordreDecaissement: ['NON_ENREGISTRE', 'CRI', 'FRV', 'REER', 'FERR', 'CELIAPP', 'CELI'],
  inflation: 0.021, fraisGestion: 0.01, remplirDroitsCeli,
});

describe('le cas signalé : les droits CELI cessent de s’empiler', () => {
  it('éteint, les droits s’accumulent sans fin — allumé, ils sont consommés', () => {
    const restants = (h: HypothesesCouple) =>
      projeterCouple(h, { trace: true })
        .annees.filter((a) => a.age1 != null && a.age1 >= 25 && a.age1 <= 40)
        .map((a) => a.detail!.droits1!.celi.restant);

    // Le comportement historique : le compteur monte, année après année.
    const avant = restants(dossierSignale(false));
    expect(avant[avant.length - 1]).toBeGreaterThan(avant[0]);
    expect(avant[0]).toBeGreaterThan(40_000);

    // Corrigé : chaque dollar de droits est utilisé l'année où il apparaît.
    expect(restants(dossierSignale(true)).every((x) => x < 0.5)).toBe(true);
  });

  it('nomme le transfert dans le tiroir des droits', () => {
    const a = projeterCouple(dossierSignale(true), { trace: true }).annees.find((x) => x.age1 === 25)!;
    const libelles = a.detail!.droits1!.celi.consommations.map((p) => p.libelle);
    expect(libelles).toContain('Transfert annuel du non-enregistré vers le CELI');
  });

  it('le défaut est ACTIVÉ : un dossier qui ne dit rien en profite', () => {
    const sansReglage = projeterCouple(dossierSignale(undefined));
    const allume = projeterCouple(dossierSignale(true));
    expect(sansReglage.valeurNetteAuDernierDecesReelle)
      .toBeCloseTo(allume.valeurNetteAuDernierDecesReelle, 2);
  });

  it('le ménage y gagne massivement quand le non-enregistré est un surplus durable', () => {
    const eteint = projeterCouple(dossierSignale(false)).valeurNetteAuDernierDecesReelle;
    const allume = projeterCouple(dossierSignale(true)).valeurNetteAuDernierDecesReelle;
    expect(allume - eteint).toBeGreaterThan(4_000_000);
  });
});

describe('l’arbitrage n’est pas gagné d’avance', () => {
  /**
   * Le contre-exemple qui justifie le levier d'optimiseur. Ici le non-enregistré n'est PAS un
   * surplus : c'est la source de retrait la moins chère du ménage. Le transférer au CELI — dernier
   * dans l'ordre de décaissement — force des retraits REER imposables au premier dollar. Mesuré :
   * 52 000 $ déplacés vers le CELI, 78 000 $ de retraits REER de plus, patrimoine en recul.
   *
   * **L'hypothèque est essentielle au contre-exemple** : ses 12 000 $ de versement annuel s'ajoutent
   * à la cible, et c'est cette pression de décaissement supplémentaire qui rend le non-enregistré
   * précieux comme source. Sans elle, le même dossier bascule et le remplissage redevient gagnant
   * (mesuré : +483 $) — ce qui montre à quel point l'arbitrage est serré et mérite d'être cherché.
   */
  const maison = {
    nom: 'Maison', type: 'residence' as const, valeur: 400_000, coutBase: 250_000, anneesDetenues: 15,
    appreciation: 0.02, hypotheque: 100_000, tauxHypotheque: 0.05, paiementAnnuel: 12_000,
    revenuNetExploitation: 0, ageVente: null, fractionLiberee: 1, proprietaire: 1 as const,
  };

  const retraite = (remplirDroitsCeli?: boolean): HypothesesProjection => ({
    ageActuel: 60, ageRetraite: 65, ageDeces: 88, vitSeul: false,
    revenuEmploi: 80_000, croissanceSalaireReelle: 0,
    epargneAnnuelle: { REER: 10_000, CELI: 6_000 }, droitsReerDisponibles: 100_000,
    rrqA65: 15_000, svA65: 8_500, ageDebutRRQ: 65, ageDebutSV: 65, rentesEmployeur: [],
    depensesRetraite: 45_000, ordreDecaissement: ORDRE, inflation: 0.021, fraisGestion: 0.01,
    periodesTravail: [{ nom: 'Temps partiel', montant: 30_000, ageDebut: 65, ageFin: 70 }],
    immeubles: [maison], comptes: [
      { type: 'REER', solde: 300_000, profil: 'equilibre' },
      { type: 'CELI', solde: 80_000, profil: 'equilibre' },
      { type: 'NON_ENREGISTRE', solde: 60_000, profil: 'equilibre', coutBase: 40_000 },
    ],
    remplirDroitsCeli,
  });

  it('remplir le CELI peut COÛTER quand le non-enregistré finance le train de vie', () => {
    expect(projeter(retraite(true)).valeurNetteAuDecesReelle)
      .toBeLessThan(projeter(retraite(false)).valeurNetteAuDecesReelle);
  });

  it('l’optimiseur ne se laisse piéger par aucun des deux réglages figés', () => {
    // La bonne propriété à exiger, et non « il l'éteint » : la descente de coordonnées bouge AUSSI
    // l'ordre de décaissement, et c'est justement lui qui décide si le CELI est un cul-de-sac. Sur
    // ce dossier elle garde le remplissage ALLUMÉ, avec un autre ordre qui le rend payant — ce qui
    // vaut mieux que de l'éteindre. Exiger une valeur précise du levier testerait le chemin ; on
    // teste le résultat.
    const optimise = optimiserProjection(retraite(true)).resultat.valeurNetteAuDecesReelle;
    expect(optimise).toBeGreaterThanOrEqual(projeter(retraite(false)).valeurNetteAuDecesReelle);
    expect(optimise).toBeGreaterThanOrEqual(projeter(retraite(true)).valeurNetteAuDecesReelle);
  });
});
