/**
 * Optimiseur de stratégie (Phase 4) — approche par RECHERCHE.
 *
 * On explore un espace de stratégies (ordre de décaissement, fonte du REER, âges de début RRQ/SV,
 * moment des ventes immobilières) en évaluant chacune avec le simulateur exact (`projeter` /
 * `projeterCouple`), et on garde la meilleure. Objectif : maximiser le patrimoine net au décès (réel),
 * en s'assurant que le capital ne s'épuise pas.
 *
 * Méthode : descente de coordonnées (on optimise un levier à la fois, en deux passes) — rapide et
 * proche de l'optimum, sans la complexité d'une programmation linéaire du régime fiscal.
 */
import { projeter } from './projection';
import { projeterCouple } from './couple';
import type { HypothesesProjection, ResultatProjection, TypeCompte } from './types';
import type { HypothesesCouple, ResultatCouple } from './typesCouple';

// --- Valeurs candidates des leviers ---
const ORDRES: readonly TypeCompte[][] = [
  ['NON_ENREGISTRE', 'CRI', 'FRV', 'REER', 'FERR', 'CELIAPP', 'CELI'], // non-enregistré d'abord
  ['REER', 'FERR', 'CRI', 'FRV', 'NON_ENREGISTRE', 'CELIAPP', 'CELI'], // enregistré d'abord
  ['CELI', 'CELIAPP', 'NON_ENREGISTRE', 'CRI', 'FRV', 'REER', 'FERR'], // CELI d'abord
  ['NON_ENREGISTRE', 'REER', 'FERR', 'CRI', 'FRV', 'CELIAPP', 'CELI'], // équilibré
];
const FONTE: readonly number[] = [0, 40_000, 50_000, 60_000, 75_000, 90_000];
/**
 * Seuil de taux marginal au-delà duquel l'épargne va au REER avant le CELI (voir `seuilReer.ts`).
 * `1` = comportement historique, CELI d'abord.
 */
const SEUILS_REER: readonly number[] = [1, 0.5, 0.45, 0.4, 0.36, 0.3, 0];
/**
 * Remplissage annuel du CELI depuis le non-enregistré (voir `remplissageCeli.ts`).
 *
 * **Pourquoi c'est un vrai levier, et non une évidence.** Le CELI est toujours le meilleur contenant :
 * un dollar y croît et en sort sans impôt. Mais il est **dernier dans l'ordre de décaissement**, si
 * bien qu'y transférer du non-enregistré prive le ménage de sa source de retrait la moins chère et le
 * pousse plus tôt dans son REER, imposable au premier dollar. Mesuré sur un retraité de 60 ans
 * (REER 300 000 $, non-enregistré 60 000 $, dépenses 45 000 $) : 52 000 $ déplacés vers le CELI ont
 * imposé 78 000 $ de retraits REER de plus, et le patrimoine au décès a reculé de 9 177 $.
 *
 * Le gain, lui, est majeur quand le non-enregistré est un surplus durable : sur un ménage héritant de
 * 2 M$ chacun, +8 M$ réels au dernier décès. C'est exactement le genre d'arbitrage que la recherche
 * doit trancher dossier par dossier, plutôt qu'une règle imposée.
 */
const REMPLISSAGE_CELI: readonly boolean[] = [true, false];
const AGES_RRQ: readonly number[] = [60, 62, 65, 67, 70, 72];
const AGES_SV: readonly number[] = [65, 67, 70];
const AGES_VENTE: readonly (number | null)[] = [null, 60, 65, 70, 75, 80];

const AMELIORATION_MIN = 1; // $ — seuil pour retenir une amélioration

/**
 * Âges de vente que l'optimiseur a le droit d'essayer pour un bien, en respectant un éventuel âge
 * minimum de vente (`ageVenteMin`). On conserve toujours `null` (ne jamais vendre) ; on retire les
 * âges antérieurs au minimum ; et on ajoute l'âge minimum exact comme option (vendre pile à ce moment).
 */
function agesVenteCandidats(ageVenteMin?: number): (number | null)[] {
  if (ageVenteMin == null) return [...AGES_VENTE];
  const candidats = AGES_VENTE.filter((a) => a === null || a >= ageVenteMin);
  if (!candidats.includes(ageVenteMin)) candidats.push(ageVenteMin);
  return candidats;
}

/**
 * Le seuil REER n'est un levier de STRATÉGIE que si le remboursement d'impôt est réinvesti.
 *
 * Raison : à remboursement consommé, déplacer de l'épargne du CELI vers le REER augmente le train de
 * vie (le remboursement part en consommation) et baisse le patrimoine. Le score ignorant la
 * consommation, l'optimiseur y verrait une pure perte et recommanderait toujours le CELI — pour la
 * mauvaise raison. Réinvesti, la consommation est identique de part et d'autre (`revenu − épargne −
 * impôt sans déduction`), et la comparaison porte enfin sur le seul choix de compte.
 *
 * Le réinvestissement lui-même n'est **pas** un levier : il convertit de la consommation en
 * patrimoine, donc le score le choisirait systématiquement sans rien apprendre à personne. C'est un
 * arbitrage de train de vie, qui appartient à l'utilisateur.
 */
const seuilsCandidats = (reinvestit: boolean | undefined): readonly number[] =>
  reinvestit ? SEUILS_REER : [];

/** Score d'une projection : patrimoine net au décès si le capital dure, sinon pénalisé (longévité). */
function scoreSolo(r: ResultatProjection): number {
  return r.suffisant ? r.valeurNetteAuDecesReelle : -1e15 + (r.ageEpuisement ?? 0);
}
function scoreCouple(r: ResultatCouple): number {
  return r.suffisant ? r.valeurNetteAuDernierDecesReelle : -1e15 + (r.anneeEpuisement ?? 0);
}

/** Descente de coordonnées générique. `leviers` génère les hypothèses candidates à partir du meilleur courant. */
function descente<H, R>(
  base: H,
  leviers: readonly ((best: H) => H[])[],
  evaluer: (h: H) => R,
  score: (r: R) => number,
): { h: H; res: R } {
  let meilleurH = base;
  let meilleurRes = evaluer(base);
  let meilleurScore = score(meilleurRes);

  for (let pass = 0; pass < 2; pass++) {
    for (const lever of leviers) {
      for (const cand of lever(meilleurH)) {
        const res = evaluer(cand);
        const s = score(res);
        if (s > meilleurScore + AMELIORATION_MIN) {
          meilleurScore = s;
          meilleurRes = res;
          meilleurH = cand;
        }
      }
    }
  }
  return { h: meilleurH, res: meilleurRes };
}

export interface ResultatOptimisation<H, R> {
  strategie: H;
  resultat: R;
  base: R;
  /** Gain de patrimoine net au décès (réel) vs la stratégie actuelle. */
  gainPatrimoineReel: number;
  /** Réduction de l'impôt total sur la vie (réel) vs la stratégie actuelle. */
  gainImpotVieReel: number;
}

/** Optimise une projection solo. */
export function optimiserProjection(h: HypothesesProjection): ResultatOptimisation<HypothesesProjection, ResultatProjection> {
  const base = projeter(h);

  const leviers: ((b: HypothesesProjection) => HypothesesProjection[])[] = [
    (b) => ORDRES.map((ordreDecaissement) => ({ ...b, ordreDecaissement })),
    (b) => FONTE.map((cibleFonteReer) => ({ ...b, cibleFonteReer })),
    (b) => seuilsCandidats(b.reinvestirRemboursementReer).map((seuilMarginalReer) => ({ ...b, seuilMarginalReer })),
    (b) => REMPLISSAGE_CELI.map((remplirDroitsCeli) => ({ ...b, remplirDroitsCeli })),
    (b) => (b.rrqA65 > 0 ? AGES_RRQ.map((ageDebutRRQ) => ({ ...b, ageDebutRRQ })) : []),
    (b) => (b.svA65 > 0 ? AGES_SV.map((ageDebutSV) => ({ ...b, ageDebutSV })) : []),
    (b) =>
      b.immeubles.flatMap((bien, p) =>
        agesVenteCandidats(bien.ageVenteMin).map((ageVente) => ({
          ...b,
          immeubles: b.immeubles.map((im, i) => (i === p ? { ...im, ageVente } : im)),
        })),
      ),
  ];

  const { h: strategie, res: resultat } = descente(h, leviers, projeter, scoreSolo);
  return {
    strategie,
    resultat,
    base,
    gainPatrimoineReel: resultat.valeurNetteAuDecesReelle - base.valeurNetteAuDecesReelle,
    gainImpotVieReel: base.impotTotalVieReel - resultat.impotTotalVieReel,
  };
}

/** Optimise une projection de couple. */
export function optimiserCouple(h: HypothesesCouple): ResultatOptimisation<HypothesesCouple, ResultatCouple> {
  const base = projeterCouple(h);

  const leviers: ((b: HypothesesCouple) => HypothesesCouple[])[] = [
    (b) => ORDRES.map((ordreDecaissement) => ({ ...b, ordreDecaissement })),
    (b) => FONTE.map((cibleFonteReer) => ({ ...b, cibleFonteReer })),
    (b) => seuilsCandidats(b.reinvestirRemboursementReer).map((seuilMarginalReer) => ({ ...b, seuilMarginalReer })),
    (b) => REMPLISSAGE_CELI.map((remplirDroitsCeli) => ({ ...b, remplirDroitsCeli })),
    (b) => (b.personne1.rrqA65 > 0 ? AGES_RRQ.map((a) => ({ ...b, personne1: { ...b.personne1, ageDebutRRQ: a } })) : []),
    (b) => (b.personne2.rrqA65 > 0 ? AGES_RRQ.map((a) => ({ ...b, personne2: { ...b.personne2, ageDebutRRQ: a } })) : []),
    (b) => (b.personne1.svA65 > 0 ? AGES_SV.map((a) => ({ ...b, personne1: { ...b.personne1, ageDebutSV: a } })) : []),
    (b) => (b.personne2.svA65 > 0 ? AGES_SV.map((a) => ({ ...b, personne2: { ...b.personne2, ageDebutSV: a } })) : []),
    (b) =>
      b.immeubles.flatMap((bien, p) =>
        agesVenteCandidats(bien.ageVenteMin).map((ageVente) => ({
          ...b,
          immeubles: b.immeubles.map((im, i) => (i === p ? { ...im, ageVente } : im)),
        })),
      ),
  ];

  const { h: strategie, res: resultat } = descente(h, leviers, projeterCouple, scoreCouple);
  return {
    strategie,
    resultat,
    base,
    gainPatrimoineReel: resultat.valeurNetteAuDernierDecesReelle - base.valeurNetteAuDernierDecesReelle,
    gainImpotVieReel: base.impotTotalVieReel - resultat.impotTotalVieReel,
  };
}
