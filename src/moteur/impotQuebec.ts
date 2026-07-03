import { QUEBEC_2026 } from './constantes/quebec2026';
import { FONDS_TRAVAILLEURS_2026 as FT } from './constantes/fondsTravailleurs2026';
import type { ParametresQuebec } from './constantes/indexation';
import { impotProgressif } from './bareme';
import type { BaseFiscale, DetailImpot } from './types';

/** Déduction pour travailleur : min(6 % du revenu d'emploi, plafond). */
export function deductionTravailleurQuebec(
  revenuEmploi: number,
  params: ParametresQuebec = QUEBEC_2026,
): number {
  return Math.min(params.deductionTravailleur.taux * Math.max(0, revenuEmploi), params.deductionTravailleur.plafond);
}

/**
 * Montants « sociaux » du Québec (âge + personne vivant seule + revenus de retraite),
 * réduits ensemble selon le revenu net excédant le seuil.
 */
export function montantsSociauxQuebec(
  age: number,
  vitSeul: boolean,
  revenuPensionAdmissible: number,
  revenuNet: number,
  params: ParametresQuebec = QUEBEC_2026,
): number {
  const montantAge = age >= 65 ? params.montantAge : 0;
  const montantSeul = vitSeul ? params.montantPersonneVivantSeule : 0;
  const montantRetraite = Math.min(revenuPensionAdmissible, params.montantRevenusRetraite);
  const montantsBruts = montantAge + montantSeul + montantRetraite;

  const reduction =
    params.tauxReductionMontantsSociaux * Math.max(0, revenuNet - params.seuilReductionMontantsSociaux);
  return Math.max(0, montantsBruts - reduction);
}

/**
 * Calcule l'impôt du Québec net.
 * `params` permet d'utiliser des barèmes indexés pour une année future (défaut : 2026).
 */
export function calculerImpotQuebec(
  base: BaseFiscale,
  params: ParametresQuebec = QUEBEC_2026,
): DetailImpot {
  const { entree } = base;

  const deductionTravailleur = deductionTravailleurQuebec(entree.revenuEmploi, params);
  const revenuNet = base.revenuTotalImpose - base.deductionsCommunes - deductionTravailleur;
  const revenuImposable = Math.max(0, revenuNet);

  const impotParTranches = impotProgressif(revenuImposable, params.paliers);

  // Crédits non remboursables (montant de base + montants sociaux), valorisés au taux du crédit.
  const montantsSociaux = montantsSociauxQuebec(
    entree.age,
    entree.vitSeul,
    entree.revenuPensionPrivee,
    revenuNet,
    params,
  );
  const baseCredits = params.montantPersonnelBase + montantsSociaux;
  const creditsNonRemboursables = params.tauxCredit * baseCredits;

  // Crédit d'impôt pour dividendes (sur le dividende majoré).
  const creditDividendes =
    base.dividendesMajoresDetermines * params.dividendes.determines.creditSurMajore +
    base.dividendesMajoresOrdinaires * params.dividendes.ordinaires.creditSurMajore;

  // Crédit pour fonds de travailleurs (FTQ / Fondaction CSN).
  const creditFondsTravailleurs = FT.tauxQuebec * Math.min(entree.cotisationFondsTravailleurs, FT.plafondAchat);

  const impotNet = Math.max(
    0,
    impotParTranches - creditsNonRemboursables - creditDividendes - creditFondsTravailleurs,
  );

  return {
    palier: 'quebec',
    revenuImposable,
    impotParTranches,
    creditsNonRemboursables,
    creditDividendes,
    creditFondsTravailleurs,
    impotDeBase: impotNet,
    abattementQuebec: 0,
    recuperationPSV: 0,
    impotNet,
  };
}
