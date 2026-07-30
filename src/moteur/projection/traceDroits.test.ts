/**
 * Droits de cotisation CELI et REER : la chaîne doit SOMMER, et se chaîner d'une année à l'autre.
 *
 * Ces compteurs étaient invisibles : on ne voyait que leur effet (une cotisation redirigée au
 * non-enregistré, un produit de vente entièrement imposé). Ces tests figent les deux invariants qui
 * rendent l'affichage digne de confiance — sans eux, le tiroir serait une jolie fiction.
 */
import { describe, expect, it } from 'vitest';
import { projeter } from './projection';
import { projeterCouple } from './couple';
import { sommePostes, type DetailDroits, type DetailDroitsAnnee } from './trace';
import type { AnneeProjection, HypothesesProjection, TypeCompte } from './types';
import type { AnneeCouple, HypothesesCouple, PersonneProjection } from './typesCouple';
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
    ageActuel: 45, ageRetraite: 62, ageDeces: 92, vitSeul: false, revenuEmploi: 85_000,
    croissanceSalaireReelle: 0, epargneAnnuelle: { REER: 8_000, CELI: 5_000 },
    droitsCeliDisponibles: 40_000, droitsReerDisponibles: 30_000,
    comptes: [
      { type: 'REER', solde: 200_000, profil: 'equilibre' },
      { type: 'CELI', solde: 60_000, profil: 'dynamique' },
      { type: 'NON_ENREGISTRE', solde: 30_000, profil: 'equilibre', coutBase: 30_000 },
    ],
    immeubles: [], rrqA65: 15_000, svA65: 8_800, ageDebutRRQ: 65, ageDebutSV: 65,
    rentesEmployeur: [], depensesRetraite: 55_000, ordreDecaissement: ORDRE,
    inflation: 0.021, fraisGestion: 0.01, ...p,
  };
}

/** `report + Σ ajouts + Σ consommations` — ce que le restant affiché doit valoir. */
const chaine = (d: DetailDroits) => d.report + sommePostes(d.ajouts) + sommePostes(d.consommations);

/**
 * Les deux invariants, sur une suite d'années d'UNE personne : la chaîne somme au restant, et le
 * restant d'une année est le report de la suivante. `null` = personne décédée, la suite s'arrête.
 */
function verifierChaine(suite: readonly { etiquette: string; d: DetailDroitsAnnee | null }[]) {
  let precedent: DetailDroitsAnnee | null = null;
  let anneesVerifiees = 0;
  for (const { etiquette, d } of suite) {
    if (!d) { precedent = null; continue; }
    for (const cle of ['celi', 'reer'] as const) {
      expect(chaine(d[cle]), `${cle} — ${etiquette}`).toBeCloseTo(d[cle].restant, 6);
      expect(d[cle].restant, `${cle} — ${etiquette}`).toBeGreaterThanOrEqual(-1e-9);
      if (precedent) {
        expect(d[cle].report, `${cle} — report ${etiquette}`).toBeCloseTo(precedent[cle].restant, 6);
      }
    }
    precedent = d;
    anneesVerifiees++;
  }
  // Sans cette garde, une projection dont la trace serait absente passerait en silence.
  expect(anneesVerifiees).toBeGreaterThan(5);
}

const suiteSolo = (annees: readonly AnneeProjection[]) =>
  annees.map((a) => ({ etiquette: `${a.age} ans`, d: a.detail!.droits }));

const suiteCouple = (annees: readonly AnneeCouple[], cle: 'droits1' | 'droits2') =>
  annees.map((a) => ({ etiquette: `${cle} en ${a.annee}`, d: a.detail![cle] }));

describe('la chaîne des droits somme, et se chaîne d’une année à l’autre', () => {
  it('cas courant : épargne REER et CELI pendant la vie active', () => {
    verifierChaine(suiteSolo(projeter(solo(), { trace: true }).annees));
  });

  it('avec vente d’immeuble, héritage, travail à la retraite et fonte du REER', () => {
    // Tous les consommateurs de droits réunis dans une seule projection.
    const r = projeter(
      solo({
        immeubles: [bien()],
        heritages: [{ nom: 'Succession', montant: 120_000, age: 58 }],
        periodesTravail: [{ nom: 'Consultation', montant: 30_000, ageDebut: 62, ageFin: 70 }],
        cibleFonteReer: 20_000,
        epargneAnnuelle: { REER: 8_000, CELI: 5_000, CELIAPP: 9_000 },
        droitsCeliDisponibles: 15_000,
      }),
      { trace: true },
    );
    verifierChaine(suiteSolo(r.annees));
  });

  it('droits nuls partout : la chaîne tient quand même', () => {
    verifierChaine(
      suiteSolo(projeter(solo({ droitsCeliDisponibles: 0, droitsReerDisponibles: 0 }), { trace: true }).annees),
    );
  });
});

describe('les ajouts de l’année', () => {
  it('la première année ne reçoit aucun droit CELI neuf : le report est la saisie', () => {
    const a = projeter(solo(), { trace: true }).annees[0];
    expect(a.detail!.droits.celi.report).toBe(40_000);
    expect(a.detail!.droits.celi.ajouts).toEqual([]);
    expect(a.detail!.droits.reer.report).toBe(30_000);
  });

  it('les années suivantes ajoutent les droits CELI de l’année (multiple de 500 $)', () => {
    const a = projeter(solo(), { trace: true }).annees[1];
    const neufs = a.detail!.droits.celi.ajouts.find((p) => p.libelle === 'Droits CELI de l’année');
    expect(neufs!.montant).toBe(7_000);
    expect(neufs!.montant % 500).toBe(0);
  });

  it('le 18 % du salaire est décomposé, et somme aux droits REER neufs', () => {
    const a = projeter(solo(), { trace: true }).annees[0];
    const d = a.detail!.droits.reer;
    expect(d.salaireRetenu).toBeCloseTo(85_000, 6);
    expect(d.ajouts.find((p) => p.libelle === '18 % du salaire')!.montant).toBeCloseTo(15_300, 6);
    expect(sommePostes(d.ajouts)).toBeCloseTo(15_300, 6); // ni plafond ni FE ne mordent ici
  });

  it('un régime à PD retranche le facteur d’équivalence, et ne laisse presque rien', () => {
    const a = projeter(solo({ regimeRetraitePD: true }), { trace: true }).annees[0];
    const d = a.detail!.droits.reer;
    expect(d.ajouts.find((p) => p.libelle === 'Facteur d’équivalence (régime à PD)')!.montant)
      .toBeCloseTo(-14_700, 6);
    expect(sommePostes(d.ajouts)).toBeCloseTo(600, 6);
  });

  it('un haut salaire fait mordre le plafond en dollars', () => {
    const a = projeter(solo({ revenuEmploi: 260_000 }), { trace: true }).annees[0];
    const d = a.detail!.droits.reer;
    // 18 % de 260 000 $ = 46 800 $, au-delà du plafond 2026 de 33 810 $.
    expect(d.ajouts.find((p) => p.libelle === '18 % du salaire')!.montant).toBeCloseTo(46_800, 6);
    expect(d.ajouts.find((p) => p.libelle === 'Plafond de l’année appliqué')!.montant)
      .toBeCloseTo(-(46_800 - 33_810), 6);
    expect(sommePostes(d.ajouts)).toBeCloseTo(33_810, 6);
  });

  it('sans salaire, aucun droit REER neuf n’apparaît', () => {
    const a = projeter(solo({ ageActuel: 65, ageRetraite: 66, revenuEmploi: 0, epargneAnnuelle: {} }), { trace: true })
      .annees[3];
    expect(a.detail!.droits.reer.ajouts).toEqual([]);
    expect(a.detail!.droits.reer.salaireRetenu).toBe(0);
  });
});

describe('les consommations sont nommées source par source', () => {
  const libelles = (a: AnneeProjection, cle: 'celi' | 'reer') =>
    a.detail!.droits[cle].consommations.map((p) => p.libelle);

  it('l’épargne planifiée est nommée des deux côtés', () => {
    const a = projeter(solo(), { trace: true }).annees[0];
    expect(libelles(a, 'reer')).toContain('Épargne REER planifiée');
    expect(libelles(a, 'celi')).toContain('Épargne CELI planifiée');
  });

  it('l’excédent CELIAPP redirigé apparaît à part de l’épargne CELI', () => {
    // 9 000 $ au CELIAPP : 8 000 $ admissibles, 1 000 $ redirigés au CELI.
    const a = projeter(solo({ epargneAnnuelle: { CELIAPP: 9_000, CELI: 5_000 } }), { trace: true }).annees[0];
    const c = a.detail!.droits.celi.consommations;
    expect(c.find((p) => p.libelle === 'Excédent CELIAPP redirigé au CELI')!.montant).toBeCloseTo(-1_000, 6);
    expect(c.find((p) => p.libelle === 'Épargne CELI planifiée')!.montant).toBeCloseTo(-5_000, 6);
  });

  it('l’épargne REER qui dépasse les droits déborde au CELI, et c’est dit', () => {
    // 40 000 $ cotisés pour 15 300 $ de droits neufs et aucun report.
    const a = projeter(
      solo({ droitsReerDisponibles: 0, epargneAnnuelle: { REER: 40_000 }, droitsCeliDisponibles: 100_000 }),
      { trace: true },
    ).annees[0];
    expect(a.detail!.droits.reer.consommations[0].montant).toBeCloseTo(-15_300, 6);
    const deborde = a.detail!.droits.celi.consommations
      .find((p) => p.libelle === 'Débordement de l’épargne REER vers le CELI');
    expect(deborde!.montant).toBeCloseTo(-(40_000 - 15_300), 6);
  });

  it('le placement d’une vente est nommé, et distingué d’un héritage', () => {
    const vente = projeter(solo({ immeubles: [bien()] }), { trace: true }).annees;
    const aVente = vente.find((a) => a.age === 60)!;
    expect(libelles(aVente, 'reer')).toContain('Placement du produit d’une vente');

    const legs = projeter(solo({ heritages: [{ nom: 'Succession', montant: 90_000, age: 55 }] }), { trace: true }).annees;
    const aLegs = legs.find((a) => a.age === 55)!;
    expect(libelles(aLegs, 'celi')).toContain('Placement d’un héritage');

    // Les deux la même année : ils sont placés d'un seul bloc, le libellé le dit.
    const deux = projeter(
      solo({ immeubles: [bien()], heritages: [{ nom: 'Succession', montant: 90_000, age: 60 }] }),
      { trace: true },
    ).annees;
    expect(libelles(deux.find((a) => a.age === 60)!, 'celi')).toContain('Placement d’un héritage et d’une vente');
  });

  it('le surplus d’un retraité-actif est nommé', () => {
    const r = projeter(
      solo({
        periodesTravail: [{ nom: 'Pige', montant: 60_000, ageDebut: 62, ageFin: 70 }],
        depensesRetraite: 35_000,
      }),
      { trace: true },
    );
    const a = r.annees.find((x) => x.age === 64)!;
    expect(libelles(a, 'celi')).toContain('Surplus de retraite réinvesti');
  });

  it('en décaissement, un héritage passe par le surplus — le libellé le dit', () => {
    // Le moteur ne place PAS un héritage d'un bloc après la retraite : il entre dans l'encaisse,
    // finance les dépenses, et seul l'excédent est réinvesti. Sans la parenthèse, 120 000 $
    // apparaissaient sous le seul mot « surplus ».
    const r = projeter(
      solo({ heritages: [{ nom: 'Succession', montant: 120_000, age: 70 }], depensesRetraite: 40_000 }),
      { trace: true },
    );
    const a = r.annees.find((x) => x.age === 70)!;
    expect(libelles(a, 'celi')).toContain('Surplus de retraite réinvesti (héritage reçu cette année)');
  });

  it('la fonte du REER consomme des droits CELI, et c’est dit', () => {
    const r = projeter(solo({ cibleFonteReer: 25_000 }), { trace: true });
    const a = r.annees.find((x) => x.phase === 'decaissement')!;
    expect(libelles(a, 'celi')).toContain('Fonte du REER réinvestie au CELI');
  });
});

describe('mode couple : chaque conjoint a ses propres droits', () => {
  function conjoint(nom: string, p: Partial<PersonneProjection> = {}): PersonneProjection {
    return {
      nom, sexe: 'H', ageActuel: 50, ageRetraite: 62, ageDeces: 88,
      revenuEmploi: 80_000, croissanceSalaireReelle: 0,
      epargneAnnuelle: { REER: 7_000, CELI: 4_000 }, epargneReerConjoint: 0,
      comptes: [
        { type: 'REER', solde: 180_000, profil: 'equilibre' },
        { type: 'CELI', solde: 50_000, profil: 'dynamique' },
        { type: 'NON_ENREGISTRE', solde: 25_000, profil: 'equilibre', coutBase: 25_000 },
      ],
      rrqA65: 14_000, svA65: 8_700, ageDebutRRQ: 65, ageDebutSV: 65, rentesEmployeur: [],
      droitsCeliDisponibles: 30_000, droitsReerDisponibles: 25_000, ...p,
    };
  }
  const couple = (p: Partial<HypothesesCouple> = {}): HypothesesCouple => ({
    personne1: conjoint('Vigile'),
    personne2: conjoint('Conjointe', { sexe: 'F', ageActuel: 48, ageDeces: 94 }),
    depensesRetraite: 70_000, fractionSurvivant: 0.67, immeubles: [],
    ordreDecaissement: ORDRE, inflation: 0.021, fraisGestion: 0.01, ...p,
  });

  it('la chaîne somme pour les deux conjoints, sur les trois phases', () => {
    // personne1 meurt à 88 ans alors que personne2 vit jusqu'à 94 : la phase de survie est couverte.
    const r = projeterCouple(
      couple({
        immeubles: [bien({ proprietaire: 'commun' })],
        cibleFonteReer: 15_000,
      }),
      { trace: true },
    );
    expect(r.annees.some((a) => a.phase === 'survie')).toBe(true);
    verifierChaine(suiteCouple(r.annees, 'droits1'));
    verifierChaine(suiteCouple(r.annees, 'droits2'));
  });

  it('les droits du conjoint décédé disparaissent, ceux du survivant continuent', () => {
    const r = projeterCouple(couple(), { trace: true });
    const survie = r.annees.filter((a) => a.phase === 'survie');
    expect(survie.length).toBeGreaterThan(0);
    for (const a of survie) {
      expect(a.detail!.droits1).toBeNull(); // personne1 meurt la première
      expect(a.detail!.droits2).not.toBeNull();
    }
  });

  it('le REER de conjoint consomme les droits du COTISANT, et nomme le destinataire', () => {
    const h = couple();
    h.personne1 = conjoint('Vigile', { epargneReerConjoint: 6_000, epargneAnnuelle: {} });
    const r = projeterCouple(h, { trace: true });
    const a = r.annees[0];

    const c1 = a.detail!.droits1!.reer.consommations;
    expect(c1.find((p) => p.libelle === 'REER de conjoint (versé à Conjointe)')!.montant).toBeCloseTo(-6_000, 6);
    // Le REER de l'autre grossit, mais SES droits à elle ne bougent pas de ce fait.
    const c2 = a.detail!.droits2!.reer.consommations;
    expect(c2.some((p) => /REER de conjoint/.test(p.libelle))).toBe(false);
  });

  it('le surplus du ménage est partagé, et consomme les droits CELI des DEUX', () => {
    // Retraite précoce avec un gros revenu de travail : le surplus dépasse les droits d'un seul.
    const h = couple({
      personne1: conjoint('Vigile', {
        ageRetraite: 55, periodesTravail: [{ nom: 'Pige', montant: 90_000, ageDebut: 55, ageFin: 70 }],
      }),
      personne2: conjoint('Conjointe', { sexe: 'F', ageRetraite: 55 }),
      depensesRetraite: 40_000,
    });
    const r = projeterCouple(h, { trace: true });
    const a = r.annees.find((x) => x.age1 === 60)!;
    for (const cle of ['droits1', 'droits2'] as const) {
      expect(a.detail![cle]!.celi.consommations.some((p) => /Surplus du ménage réinvesti/.test(p.libelle)))
        .toBe(true);
    }
  });

  it('un bien commun vendu alimente le placement des deux conjoints', () => {
    const h = couple({
      personne1: conjoint('Vigile', { ageRetraite: 70 }),
      personne2: conjoint('Conjointe', { sexe: 'F', ageActuel: 48, ageDeces: 94, ageRetraite: 70 }),
      immeubles: [bien({ proprietaire: 'commun', ageVente: 58 })],
    });
    const r = projeterCouple(h, { trace: true });
    const a = r.annees.find((x) => x.age1 === 58)!;
    expect(a.phase).toBe('accumulation');
    for (const cle of ['droits1', 'droits2'] as const) {
      const tous = [...a.detail![cle]!.celi.consommations, ...a.detail![cle]!.reer.consommations];
      expect(tous.some((p) => p.libelle === 'Placement du produit d’une vente')).toBe(true);
    }
  });
});

describe('les retraits CELI reviennent l’année suivante', () => {
  it('ce qui est retiré une année est restauré à la suivante, au dollar près', () => {
    // Décaissement précoce sans épargne : le CELI est puisé, l'ordre le plaçant en dernier.
    const r = projeter(
      solo({ ageActuel: 60, ageRetraite: 61, revenuEmploi: 0, epargneAnnuelle: {}, depensesRetraite: 70_000 }),
      { trace: true },
    );
    const avecRetrait = r.annees.filter((a) => a.detail!.droits.celi.aRestaurerLAnProchain > 0.5);
    expect(avecRetrait.length).toBeGreaterThan(0);

    for (const a of avecRetrait) {
      const suivante = r.annees.find((x) => x.age === a.age + 1);
      if (!suivante) continue;
      const restaure = suivante.detail!.droits.celi.ajouts
        .find((p) => p.libelle === `Retraits CELI de ${a.age} ans, restaurés`);
      expect(restaure!.montant).toBeCloseTo(a.detail!.droits.celi.aRestaurerLAnProchain, 6);
    }
  });

  it('le REER ne restaure jamais rien', () => {
    const r = projeter(solo({ depensesRetraite: 80_000 }), { trace: true });
    for (const a of r.annees) expect(a.detail!.droits.reer.aRestaurerLAnProchain).toBe(0);
  });
});
