/**
 * Réinvestir le remboursement d'impôt des déductions de l'année.
 *
 * **Pourquoi ce réglage existe.** En accumulation, l'épargne est SAISIE et le train de vie est le
 * résidu : le remboursement tombe donc dans ce résidu — il est consommé. En décaissement c'est
 * l'inverse (le train de vie est saisi), donc le remboursement va forcément à l'épargne. Ce n'est pas
 * une incohérence, c'est la conséquence de la variable d'entrée de chaque phase.
 *
 * Mais tant que le remboursement est consommé, le moteur **ne peut pas arbitrer REER contre CELI** :
 * 8 000 $ au REER coûtent moins de sa poche que 8 000 $ au CELI, et le CELI gagne par construction.
 * Ce réglage remet les deux à coût égal. Les tests ci-dessous figent cette propriété.
 */
import { describe, expect, it } from 'vitest';
import { projeter } from './projection';
import { projeterCouple } from './couple';
import type { HypothesesProjection, TypeCompte } from './types';
import type { HypothesesCouple, PersonneProjection } from './typesCouple';

const ORDRE: TypeCompte[] = ['NON_ENREGISTRE', 'CRI', 'FRV', 'REER', 'FERR', 'CELIAPP', 'CELI'];

function salarie(p: Partial<HypothesesProjection> = {}): HypothesesProjection {
  return {
    ageActuel: 45, ageRetraite: 62, ageDeces: 90, vitSeul: false, revenuEmploi: 130_000,
    croissanceSalaireReelle: 0, epargneAnnuelle: { REER: 12_000 },
    droitsCeliDisponibles: 90_000, droitsReerDisponibles: 60_000,
    comptes: [
      { type: 'REER', solde: 200_000, profil: 'equilibre' },
      { type: 'CELI', solde: 40_000, profil: 'dynamique' },
    ],
    immeubles: [], rrqA65: 16_000, svA65: 8_800, ageDebutRRQ: 65, ageDebutSV: 65,
    rentesEmployeur: [], depensesRetraite: 55_000, ordreDecaissement: ORDRE,
    inflation: 0.021, fraisGestion: 0.01, ...p,
  };
}

const premiereAnnee = (h: HypothesesProjection) => projeter(h, { trace: true }).annees[0];
/** Un poste de sortie, ramené en positif. La négation peut donner `-0` : comparer avec `toBeCloseTo`. */
const poste = (a: ReturnType<typeof premiereAnnee>, libelle: string) =>
  -(a.detail!.disponible.sorties.find((p) => p.libelle === libelle)?.montant ?? 0);

describe('réglage éteint : rien ne change', () => {
  it('le patrimoine et le train de vie sont identiques au comportement historique', () => {
    const sans = projeter(salarie());
    const explicite = projeter(salarie({ reinvestirRemboursementReer: false }));
    expect(explicite.valeurNetteAuDecesReelle).toBeCloseTo(sans.valeurNetteAuDecesReelle, 6);
    expect(explicite.annees[0].revenuDisponible).toBeCloseTo(sans.annees[0].revenuDisponible, 6);
  });

  it('aucun poste « remboursement réinvesti » n’apparaît', () => {
    expect(poste(premiereAnnee(salarie()), 'Remboursement d’impôt réinvesti')).toBeCloseTo(0, 6);
  });
});

describe('réglage allumé', () => {
  it('le remboursement vaut exactement l’impôt épargné par la déduction', () => {
    const a = premiereAnnee(salarie({ reinvestirRemboursementReer: true }));
    const d = a.detail!.impot;
    // Impôt de l'année tel que calculé, contre le même sans aucune déduction REER.
    const deduction = d.revenuImposable.find((p) => p.libelle === 'Déduction REER')!.montant;
    expect(deduction).toBeCloseTo(-12_000, 6); // 12 000 $ cotisés, droits suffisants
    const rembourse = poste(a, 'Remboursement d’impôt réinvesti');
    expect(rembourse).toBeGreaterThan(4_000); // ~47 % de taux marginal à 130 000 $
    expect(rembourse).toBeLessThan(12_000 * 0.55);
  });

  it('le remboursement quitte le train de vie pour aller à l’épargne', () => {
    const sans = premiereAnnee(salarie());
    const avec = premiereAnnee(salarie({ reinvestirRemboursementReer: true }));
    const rembourse = poste(avec, 'Remboursement d’impôt réinvesti');
    expect(avec.revenuDisponible).toBeCloseTo(sans.revenuDisponible - rembourse, 6);
    // Il finit bien dans un compte : la valeur nette de l'année est plus haute d'autant.
    expect(avec.valeurNette).toBeGreaterThan(sans.valeurNette + rembourse * 0.9);
  });

  it('il va au CELI puis au non-enregistré, JAMAIS au REER', () => {
    // L'y verser ouvrirait une nouvelle déduction, donc un nouveau remboursement : rétroaction
    // volontairement bornée à zéro itération.
    const sans = premiereAnnee(salarie());
    const avec = premiereAnnee(salarie({ reinvestirRemboursementReer: true }));
    expect(avec.soldes.REER).toBeCloseTo(sans.soldes.REER, 6);
    expect(avec.soldes.CELI).toBeGreaterThan(sans.soldes.CELI + 1_000);
  });

  it('sans droits CELI, il déborde au non-enregistré', () => {
    const avec = premiereAnnee(salarie({ reinvestirRemboursementReer: true, droitsCeliDisponibles: 0 }));
    const sans = premiereAnnee(salarie({ droitsCeliDisponibles: 0 }));
    expect(avec.soldes.NON_ENREGISTRE).toBeGreaterThan(sans.soldes.NON_ENREGISTRE + 1_000);
  });

  it('sans aucune déduction, il n’y a rien à réinvestir', () => {
    // Épargne uniquement au CELI : aucune déduction, donc aucun remboursement.
    const a = premiereAnnee(salarie({ epargneAnnuelle: { CELI: 12_000 }, reinvestirRemboursementReer: true }));
    expect(poste(a, 'Remboursement d’impôt réinvesti')).toBeCloseTo(0, 6);
  });

  it('la conservation tient : entrées − sorties = revenus nets', () => {
    const a = premiereAnnee(salarie({ reinvestirRemboursementReer: true }));
    const d = a.detail!.disponible;
    const somme = d.entrees.reduce((s, p) => s + p.montant, 0) + d.sorties.reduce((s, p) => s + p.montant, 0);
    expect(somme).toBeCloseTo(d.revenusNets, 6);
    expect(d.revenusNets).toBeCloseTo(a.revenuDisponible, 6);
  });
});

describe('ce que le réglage débloque : arbitrer REER contre CELI', () => {
  const patrimoine = (epargne: Partial<Record<TypeCompte, number>>, on: boolean) =>
    projeter(salarie({ epargneAnnuelle: epargne, reinvestirRemboursementReer: on })).valeurNetteAuDecesReelle;

  it('remboursement consommé : le CELI gagne, par construction', () => {
    // Le REER ne peut pas gagner : sa cotisation coûte le même montant nominal, et son avantage
    // fiscal part en consommation. C'est le biais que le réglage corrige.
    expect(patrimoine({ CELI: 18_000 }, false)).toBeGreaterThan(patrimoine({ REER: 18_000 }, false));
  });

  it('remboursement réinvesti : le REER reprend l’avantage qui lui revient', () => {
    // Salarié à 130 000 $ (taux marginal ~47 %) qui décaissera à un taux bien plus bas.
    expect(patrimoine({ REER: 18_000 }, true)).toBeGreaterThan(patrimoine({ CELI: 18_000 }, true));
  });

  it('le CELI seul est indifférent au réglage', () => {
    expect(patrimoine({ CELI: 18_000 }, true)).toBeCloseTo(patrimoine({ CELI: 18_000 }, false), 6);
  });
});

describe('mode couple', () => {
  const conjoint = (nom: string, p: Partial<PersonneProjection> = {}): PersonneProjection => ({
    nom, sexe: 'H', ageActuel: 45, ageRetraite: 62, ageDeces: 90, revenuEmploi: 120_000,
    croissanceSalaireReelle: 0, epargneAnnuelle: { REER: 12_000 }, epargneReerConjoint: 0,
    comptes: [
      { type: 'REER', solde: 180_000, profil: 'equilibre' },
      { type: 'CELI', solde: 30_000, profil: 'dynamique' },
    ],
    rrqA65: 15_000, svA65: 8_700, ageDebutRRQ: 65, ageDebutSV: 65, rentesEmployeur: [],
    droitsCeliDisponibles: 80_000, droitsReerDisponibles: 60_000, ...p,
  });
  const couple = (p: Partial<HypothesesCouple> = {}): HypothesesCouple => ({
    personne1: conjoint('A'), personne2: conjoint('B', { sexe: 'F', revenuEmploi: 60_000 }),
    depensesRetraite: 80_000, fractionSurvivant: 0.67, immeubles: [],
    ordreDecaissement: ORDRE, inflation: 0.021, fraisGestion: 0.01, ...p,
  });

  it('éteint, rien ne change', () => {
    expect(projeterCouple(couple({ reinvestirRemboursementReer: false })).valeurNetteAuDernierDecesReelle)
      .toBeCloseTo(projeterCouple(couple()).valeurNetteAuDernierDecesReelle, 6);
  });

  it('allumé, le remboursement du MÉNAGE est réparti au prorata des déductions', () => {
    const sans = projeterCouple(couple(), { trace: true }).annees[0];
    const avec = projeterCouple(couple({ reinvestirRemboursementReer: true }), { trace: true }).annees[0];
    const rembourse = -(avec.detail!.disponible.sorties
      .find((p) => p.libelle === 'Remboursement d’impôt réinvesti')?.montant ?? 0);
    expect(rembourse).toBeGreaterThan(5_000);
    expect(avec.revenuDisponible).toBeCloseTo(sans.revenuDisponible - rembourse, 6);
    // Les deux conjoints cotisent 12 000 $ : chacun reçoit sa part dans SON CELI.
    expect(avec.soldes1.CELI).toBeGreaterThan(sans.soldes1.CELI + 500);
    expect(avec.soldes2.CELI).toBeGreaterThan(sans.soldes2.CELI + 500);
  });

  it('la conservation du ménage tient', () => {
    const a = projeterCouple(couple({ reinvestirRemboursementReer: true }), { trace: true }).annees[0];
    const d = a.detail!.disponible;
    const somme = d.entrees.reduce((s, p) => s + p.montant, 0) + d.sorties.reduce((s, p) => s + p.montant, 0);
    expect(somme).toBeCloseTo(d.revenusNets, 6);
    expect(d.revenusNets).toBeCloseTo(a.revenuDisponible, 6);
  });
});
