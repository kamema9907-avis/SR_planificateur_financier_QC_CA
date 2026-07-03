/**
 * Indexation des paramètres fiscaux pour une année future.
 *
 * Le moteur de la Phase 1 utilise les barèmes fixes 2026. Pour une projection long terme,
 * il faut des barèmes indexés : tous les MONTANTS en dollars (seuils de tranches, montant
 * personnel de base, crédits, seuils de récupération…) croissent avec l'inflation, tandis que
 * les TAUX (marginaux, de crédit, d'inclusion) restent inchangés.
 *
 * Convention de projection : indexation uniforme au taux d'inflation IQPF (2,1 %), comme le
 * font les planificateurs pour des projections « réalistes et justifiables ». Certains seuils
 * réels s'indexent à un taux légèrement différent — simplification assumée (Phase 2).
 */
import { FEDERAL_2026 } from './federal2026';
import { QUEBEC_2026 } from './quebec2026';
import { IQPF_2026 } from './iqpf2026';
import type { Palier } from '../types';

export const ANNEE_BASE = 2026;

/** Forme des paramètres fédéraux consommés par le moteur (indexable). */
export interface ParametresFederal {
  readonly paliers: readonly Palier[];
  readonly tauxCredit: number;
  readonly montantPersonnelBase: {
    readonly max: number;
    readonly min: number;
    readonly seuilReductionDebut: number;
    readonly seuilReductionFin: number;
  };
  readonly montantAge: { readonly montant: number; readonly seuilReduction: number; readonly tauxReduction: number };
  readonly montantPensionMax: number;
  readonly dividendes: {
    readonly determines: { readonly majoration: number; readonly creditSurMajore: number };
    readonly ordinaires: { readonly majoration: number; readonly creditSurMajore: number };
  };
  readonly tauxInclusionGainCapital: number;
  readonly psv: { readonly seuilRecuperation: number; readonly tauxRecuperation: number };
  readonly abattementQuebec: number;
}

/** Forme des paramètres québécois consommés par le moteur (indexable). */
export interface ParametresQuebec {
  readonly paliers: readonly Palier[];
  readonly tauxCredit: number;
  readonly montantPersonnelBase: number;
  readonly montantAge: number;
  readonly montantRevenusRetraite: number;
  readonly montantPersonneVivantSeule: number;
  readonly seuilReductionMontantsSociaux: number;
  readonly tauxReductionMontantsSociaux: number;
  readonly deductionTravailleur: { readonly taux: number; readonly plafond: number };
  readonly dividendes: {
    readonly determines: { readonly majoration: number; readonly creditSurMajore: number };
    readonly ordinaires: { readonly majoration: number; readonly creditSurMajore: number };
  };
  readonly tauxInclusionGainCapital: number;
}

/** Facteur d'indexation cumulatif entre l'année de base (2026) et l'année visée. */
export function facteurIndexation(annee: number, inflation: number = IQPF_2026.inflation): number {
  return Math.pow(1 + inflation, annee - ANNEE_BASE);
}

function indexerPaliers(paliers: readonly Palier[], f: number): Palier[] {
  return paliers.map((p) => ({
    plafond: Number.isFinite(p.plafond) ? p.plafond * f : p.plafond,
    taux: p.taux,
  }));
}

/** Paramètres fédéraux indexés pour l'année donnée (2026 → valeurs de base identiques). */
export function parametresFederal(annee: number, inflation: number = IQPF_2026.inflation): ParametresFederal {
  const f = facteurIndexation(annee, inflation);
  const b = FEDERAL_2026;
  return {
    paliers: indexerPaliers(b.paliers, f),
    tauxCredit: b.tauxCredit,
    montantPersonnelBase: {
      max: b.montantPersonnelBase.max * f,
      min: b.montantPersonnelBase.min * f,
      seuilReductionDebut: b.montantPersonnelBase.seuilReductionDebut * f,
      seuilReductionFin: b.montantPersonnelBase.seuilReductionFin * f,
    },
    montantAge: {
      montant: b.montantAge.montant * f,
      seuilReduction: b.montantAge.seuilReduction * f,
      tauxReduction: b.montantAge.tauxReduction,
    },
    montantPensionMax: b.montantPensionMax * f,
    dividendes: b.dividendes,
    tauxInclusionGainCapital: b.tauxInclusionGainCapital,
    psv: {
      seuilRecuperation: b.psv.seuilRecuperation * f,
      tauxRecuperation: b.psv.tauxRecuperation,
    },
    abattementQuebec: b.abattementQuebec,
  };
}

/** Paramètres québécois indexés pour l'année donnée (2026 → valeurs de base identiques). */
export function parametresQuebec(annee: number, inflation: number = IQPF_2026.inflation): ParametresQuebec {
  const f = facteurIndexation(annee, inflation);
  const b = QUEBEC_2026;
  return {
    paliers: indexerPaliers(b.paliers, f),
    tauxCredit: b.tauxCredit,
    montantPersonnelBase: b.montantPersonnelBase * f,
    montantAge: b.montantAge * f,
    montantRevenusRetraite: b.montantRevenusRetraite * f,
    montantPersonneVivantSeule: b.montantPersonneVivantSeule * f,
    seuilReductionMontantsSociaux: b.seuilReductionMontantsSociaux * f,
    tauxReductionMontantsSociaux: b.tauxReductionMontantsSociaux,
    deductionTravailleur: {
      taux: b.deductionTravailleur.taux,
      plafond: b.deductionTravailleur.plafond * f,
    },
    dividendes: b.dividendes,
    tauxInclusionGainCapital: b.tauxInclusionGainCapital,
  };
}
