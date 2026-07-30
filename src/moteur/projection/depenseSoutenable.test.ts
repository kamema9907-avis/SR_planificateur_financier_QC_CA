/**
 * Dépense soutenable — les huit propriétés du plan de conception.
 *
 * La première est la plus importante : toute la recherche par dichotomie repose sur la monotonie
 * de la soutenabilité, qui n'a rien d'évident avec un moteur fiscal non linéaire.
 */
import { describe, expect, it } from 'vitest';
import { projeter } from './projection';
import { projeterCouple } from './couple';
import { depenseMaximale, depenseRecommandee, FRACTION_CONSOMMEE_DEFAUT } from './depenseSoutenable';
import type { HypothesesProjection, TypeCompte } from './types';
import type { HypothesesCouple, PersonneProjection } from './typesCouple';
import type { Immeuble } from './immobilier';

const ORDRE: TypeCompte[] = ['NON_ENREGISTRE', 'CRI', 'FRV', 'REER', 'FERR', 'CELIAPP', 'CELI'];

const COMPTES = [
  { type: 'REER' as const, solde: 380_000, profil: 'equilibre' as const },
  { type: 'CELI' as const, solde: 120_000, profil: 'dynamique' as const },
  { type: 'CRI' as const, solde: 60_000, profil: 'equilibre' as const },
  { type: 'NON_ENREGISTRE' as const, solde: 90_000, profil: 'equilibre' as const, coutBase: 60_000 },
];

function maison(p: Partial<Immeuble> = {}): Immeuble {
  return {
    nom: 'Résidence', type: 'residence', valeur: 420_000, coutBase: 200_000, anneesDetenues: 20,
    appreciation: 0.031, hypotheque: 0, tauxHypotheque: 0.05, paiementAnnuel: 0,
    revenuNetExploitation: 0, ageVente: null, fractionLiberee: 1, proprietaire: 1, ...p,
  };
}

function solo(p: Partial<HypothesesProjection> = {}): HypothesesProjection {
  return {
    ageActuel: 58, ageRetraite: 63, ageDeces: 95, vitSeul: false, revenuEmploi: 85_000,
    croissanceSalaireReelle: 0, epargneAnnuelle: { REER: 6_000 }, comptes: COMPTES,
    immeubles: [], rrqA65: 15_000, svA65: 8_800, ageDebutRRQ: 65, ageDebutSV: 65,
    rentesEmployeur: [], depensesRetraite: 0, ordreDecaissement: ORDRE,
    inflation: 0.021, fraisGestion: 0.01, ...p,
  };
}

function conjoint(nom: string, sexe: 'H' | 'F', ageActuel: number, ageDeces: number): PersonneProjection {
  return {
    nom, sexe, ageActuel, ageRetraite: 63, ageDeces, revenuEmploi: 70_000,
    croissanceSalaireReelle: 0, epargneAnnuelle: {}, epargneReerConjoint: 0, comptes: COMPTES,
    rrqA65: 14_000, svA65: 8_800, ageDebutRRQ: 65, ageDebutSV: 65, rentesEmployeur: [],
    droitsCeliDisponibles: 50_000, droitsReerDisponibles: 20_000,
  };
}

function couple(p: Partial<HypothesesCouple> = {}): HypothesesCouple {
  return {
    personne1: conjoint('A', 'H', 58, 94), personne2: conjoint('B', 'F', 56, 96),
    depensesRetraite: 0, fractionSurvivant: 0.67, immeubles: [], ordreDecaissement: ORDRE,
    inflation: 0.021, fraisGestion: 0.01, ...p,
  };
}

// Les deux branchements du calcul générique, réutilisés partout.
const maxSolo = (h: HypothesesProjection) =>
  depenseMaximale(h, (x, d) => ({ ...x, depensesRetraite: d }), projeter);
const maxCouple = (h: HypothesesCouple) =>
  depenseMaximale(h, (x, d) => ({ ...x, depensesRetraite: d }), projeterCouple);

describe('1 — monotonie de la soutenabilité', () => {
  it('solo : jamais de re-succès après un échec', () => {
    // Le fondement de la dichotomie. Balayage fin plutôt que quelques points : une inversion due
    // à un saut de tranche d'imposition serait étroite et passerait inaperçue autrement.
    const h = solo({ immeubles: [maison({ hypotheque: 40_000, paiementAnnuel: 12_000 })] });
    let dejaEchoue = false;
    for (let d = 0; d <= 120_000; d += 250) {
      const tient = projeter({ ...h, depensesRetraite: d }).suffisant;
      if (tient && dejaEchoue) expect.unreachable(`${d} $ finance à nouveau après un échec`);
      if (!tient) dejaEchoue = true;
    }
    expect(dejaEchoue).toBe(true); // le balayage doit bien franchir le maximum
  });

  it('couple : jamais de re-succès après un échec', () => {
    const h = couple({ immeubles: [maison({ hypotheque: 40_000, paiementAnnuel: 12_000 })] });
    let dejaEchoue = false;
    for (let d = 0; d <= 160_000; d += 500) {
      const tient = projeterCouple({ ...h, depensesRetraite: d }).suffisant;
      if (tient && dejaEchoue) expect.unreachable(`${d} $ finance à nouveau après un échec`);
      if (!tient) dejaEchoue = true;
    }
    expect(dejaEchoue).toBe(true);
  });
});

describe('2 — exactitude : c’est bien le maximum', () => {
  it('solo : le montant tient, un cran au-dessus non', () => {
    const h = solo();
    const max = maxSolo(h);
    expect(max).toBeGreaterThan(0);
    expect(projeter({ ...h, depensesRetraite: max }).suffisant).toBe(true);
    // La dichotomie s'arrête à 250 $ près, puis arrondit à la centaine inférieure : on teste
    // au-delà de cette tolérance cumulée.
    expect(projeter({ ...h, depensesRetraite: max + 500 }).suffisant).toBe(false);
  });

  it('ne retourne jamais un montant non finançable, même avec une précision grossière', () => {
    const h = solo();
    for (const precision of [100, 250, 1_000, 5_000]) {
      const max = depenseMaximale(h, (x, d) => ({ ...x, depensesRetraite: d }), projeter, { precision });
      expect(projeter({ ...h, depensesRetraite: max }).suffisant).toBe(true);
    }
  });
});

describe('2 bis — le moteur avait la réponse, c’est l’affichage qui la cachait', () => {
  /**
   * L'interface refusait d'afficher la recommandation quand la richesse ne venait pas d'un salaire
   * (voir `interface/projection/ressources.ts`). Ces cas prouvent que le solveur, lui, savait
   * répondre : le bogue était bien dans la garde d'affichage, pas dans le calcul.
   */
  const demuni = (p: Partial<HypothesesProjection>) =>
    solo({
      revenuEmploi: 0, epargneAnnuelle: {}, rrqA65: 0, svA65: 0,
      comptes: [{ type: 'REER', solde: 0, profil: 'equilibre' }],
      ...p,
    });

  it('un héritage reçu à la retraite finance une dépense', () => {
    const max = maxSolo(demuni({ heritages: [{ nom: 'Succession', montant: 400_000, age: 63 }] }));
    expect(max).toBeGreaterThan(0);
  });

  it('un revenu de travail à la retraite aussi', () => {
    const max = maxSolo(demuni({
      periodesTravail: [{ nom: 'Consultation', montant: 40_000, ageDebut: 63, ageFin: 75 }],
    }));
    expect(max).toBeGreaterThan(0);
  });

  it('un immeuble vendu dès la retraite aussi', () => {
    const max = maxSolo(demuni({ immeubles: [maison({ hypotheque: 0, paiementAnnuel: 0, ageVente: 63 })] }));
    expect(max).toBeGreaterThan(0);
  });

  it('mais une ressource qui arrive APRÈS la retraite ne soutient rien : 0 est la bonne réponse', () => {
    // « Soutenable » veut dire financé CHAQUE année. Retraite à 63 ans, héritage à 70 : les sept
    // premières années n'ont pas un dollar, donc aucune dépense constante ne tient dès 63 ans.
    // L'interface montrera alors son avertissement, ce qui est le message utile — et non un bogue.
    expect(maxSolo(demuni({ heritages: [{ nom: 'Succession', montant: 400_000, age: 70 }] }))).toBe(0);
    // Repousser la retraite à l'année de l'héritage suffit à débloquer la situation.
    const max = maxSolo(demuni({
      ageRetraite: 70, heritages: [{ nom: 'Succession', montant: 400_000, age: 70 }],
    }));
    expect(max).toBeGreaterThan(0);
  });
});

describe('3 — indépendance de la valeur déjà saisie', () => {
  it('le maximum ne dépend pas de la dépense courante', () => {
    // Propriété qui autorise l'interface à figer la suggestion pendant qu'on tape dans le champ.
    const base = solo();
    const reference = maxSolo(base);
    for (const saisie of [0, 1_000, 40_000, 500_000]) {
      expect(maxSolo({ ...base, depensesRetraite: saisie })).toBe(reference);
    }
  });
});

describe('4 et 5 — cas dégénérés', () => {
  it('sans capital ni rente, le maximum est nul', () => {
    const h = solo({
      comptes: [], epargneAnnuelle: {}, revenuEmploi: 0, rrqA65: 0, svA65: 0,
      ageActuel: 63, ageRetraite: 63,
    });
    expect(maxSolo(h)).toBe(0);
  });

  it('retourne 0 quand même une dépense nulle est infinançable', () => {
    // Hypothèque lourde, aucun capital, aucune rente : le solveur ne peut pas même payer les
    // versements. « 0 $ » est alors la seule réponse honnête — l'interface le dira en toutes lettres.
    const h = solo({
      comptes: [], epargneAnnuelle: {}, revenuEmploi: 0, rrqA65: 0, svA65: 0,
      ageActuel: 63, ageRetraite: 63,
      immeubles: [maison({ hypotheque: 300_000, paiementAnnuel: 30_000 })],
    });
    expect(maxSolo(h)).toBe(0);
  });
});

describe('6 — croissance avec le capital', () => {
  it('plus de capital permet de dépenser davantage', () => {
    const petit = maxSolo(solo({ comptes: [{ type: 'REER', solde: 200_000, profil: 'equilibre' }] }));
    const gros = maxSolo(solo({ comptes: [{ type: 'REER', solde: 900_000, profil: 'equilibre' }] }));
    expect(gros).toBeGreaterThan(petit);
  });

  it('un bien jamais vendu ne finance pas les dépenses', () => {
    // Point contre-intuitif du plan : 420 000 $ de maison n'augmentent PAS le maximum tant
    // qu'aucune vente n'est planifiée. C'est ce qui rend nécessaire la mention « patrimoine
    // immobilisé » dans l'interface.
    const sansBien = maxSolo(solo());
    const avecBien = maxSolo(solo({ immeubles: [maison()] }));
    expect(avecBien).toBe(sansBien);

    const avecVente = maxSolo(solo({ immeubles: [maison({ ageVente: 80 })] }));
    expect(avecVente).toBeGreaterThan(sansBien);
  });
});

describe('7 — fraction consommée', () => {
  it('applique la part demandée, arrondie vers le bas à la centaine', () => {
    expect(depenseRecommandee(68_432)).toBe(58_100); // 85 % = 58 167,2 → 58 100
    expect(depenseRecommandee(68_432, 0.9)).toBe(61_500); // 61 588,8 → 61 500
    expect(depenseRecommandee(68_432, 1)).toBe(68_400);
    expect(depenseRecommandee(0)).toBe(0);
  });

  it('borne une fraction absurde au lieu de rendre un montant absurde', () => {
    expect(depenseRecommandee(50_000, 5)).toBe(50_000);
    expect(depenseRecommandee(50_000, -1)).toBe(0);
  });

  it('la recommandation par défaut reste finançable', () => {
    const h = solo();
    const recommande = depenseRecommandee(maxSolo(h));
    expect(projeter({ ...h, depensesRetraite: recommande }).suffisant).toBe(true);
    expect(FRACTION_CONSOMMEE_DEFAUT).toBe(0.85);
  });
});

describe('8 — mode couple', () => {
  it('trouve un maximum pour le ménage, exact et finançable', () => {
    const h = couple();
    const max = maxCouple(h);
    expect(max).toBeGreaterThan(0);
    expect(projeterCouple({ ...h, depensesRetraite: max }).suffisant).toBe(true);
    expect(projeterCouple({ ...h, depensesRetraite: max + 1_000 }).suffisant).toBe(false);
  });

  it('un survivant plus dépensier abaisse le maximum du ménage', () => {
    // Vérifie que la dichotomie voit bien la phase de survie, et pas seulement les années à deux.
    const econome = maxCouple(couple({ fractionSurvivant: 0.5 }));
    const depensier = maxCouple(couple({ fractionSurvivant: 1 }));
    expect(depensier).toBeLessThan(econome);
  });
});
