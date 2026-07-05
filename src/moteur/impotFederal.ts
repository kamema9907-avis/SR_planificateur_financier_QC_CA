import { FEDERAL_2026 } from './constantes/federal2026';
import { FONDS_TRAVAILLEURS_2026 as FT } from './constantes/fondsTravailleurs2026';
import type { ParametresFederal } from './constantes/indexation';
import { impotProgressif } from './bareme';
import type { BaseFiscale, DetailImpot } from './types';

/**
 * Montant personnel de base fédéral, réduit progressivement entre les deux seuils
 * de revenu net pour les hauts revenus.
 */
export function montantPersonnelBaseFederal(
  revenuNet: number,
  params: ParametresFederal = FEDERAL_2026,
): number {
  const { max, min, seuilReductionDebut, seuilReductionFin } = params.montantPersonnelBase;
  if (revenuNet <= seuilReductionDebut) return max;
  if (revenuNet >= seuilReductionFin) return min;
  const proportion = (revenuNet - seuilReductionDebut) / (seuilReductionFin - seuilReductionDebut);
  return max - proportion * (max - min);
}

/** Montant en raison de l'âge (65 ans et plus), réduit selon le revenu net. */
export function montantAgeFederal(
  age: number,
  revenuNet: number,
  params: ParametresFederal = FEDERAL_2026,
): number {
  if (age < 65) return 0;
  const { montant, seuilReduction, tauxReduction } = params.montantAge;
  const reduction = tauxReduction * Math.max(0, revenuNet - seuilReduction);
  return Math.max(0, montant - reduction);
}

/**
 * Calcule l'impôt fédéral net (incluant abattement du Québec et récupération de la PSV).
 * `params` permet d'utiliser des barèmes indexés pour une année future (défaut : 2026).
 */
export function calculerImpotFederal(
  base: BaseFiscale,
  params: ParametresFederal = FEDERAL_2026,
): DetailImpot {
  const { entree } = base;

  const revenuNet = base.revenuTotalImpose - base.deductionsFederal;
  const revenuImposable = Math.max(0, revenuNet);

  const impotParTranches = impotProgressif(revenuImposable, params.paliers);

  // Crédits non remboursables (valorisés au taux du crédit).
  const mpb = montantPersonnelBaseFederal(revenuNet, params);
  const montantAge = montantAgeFederal(entree.age, revenuNet, params);
  const montantPension = Math.min(entree.revenuPensionPrivee, params.montantPensionMax);
  const baseCredits = mpb + montantAge + montantPension;
  const creditsNonRemboursables = params.tauxCredit * baseCredits;

  // Crédit pour cotisations RRQ de base + AE + RQAP (la portion bonifiée du RRQ est plutôt déduite).
  const creditCotisations =
    params.tauxCredit * (base.cotisations.rrqBase + base.cotisations.ae + base.cotisations.rqap);

  // Crédit d'impôt pour dividendes (sur le dividende majoré).
  const creditDividendes =
    base.dividendesMajoresDetermines * params.dividendes.determines.creditSurMajore +
    base.dividendesMajoresOrdinaires * params.dividendes.ordinaires.creditSurMajore;

  const impotDeBase = Math.max(
    0,
    impotParTranches - creditsNonRemboursables - creditCotisations - creditDividendes,
  );

  // Abattement du Québec : 16,5 % de l'impôt fédéral de base.
  const abattementQuebec = impotDeBase * params.abattementQuebec;

  // Crédit pour fonds de travailleurs (appliqué après l'abattement, comme sur la déclaration T1).
  // Le fonds EST un REER : le crédit exige une cotisation REER en contrepartie, donc on le plafonne à
  // la déduction REER effective (sans cotisation REER, pas de crédit).
  const fondsAdmissible = Math.min(entree.cotisationFondsTravailleurs, entree.deductionReer, FT.plafondAchat);
  const creditFondsTravailleurs = FT.tauxFederal * fondsAdmissible;

  // Récupération de la PSV : ne bénéficie pas de l'abattement ni des crédits.
  const recuperationPSV = Math.min(
    entree.revenuPensionSV,
    params.psv.tauxRecuperation * Math.max(0, revenuNet - params.psv.seuilRecuperation),
  );

  const impotNet =
    Math.max(0, impotDeBase - abattementQuebec - creditFondsTravailleurs) + recuperationPSV;

  return {
    palier: 'federal',
    revenuImposable,
    impotParTranches,
    creditsNonRemboursables,
    creditCotisations,
    creditDividendes,
    creditFondsTravailleurs,
    impotDeBase,
    abattementQuebec,
    recuperationPSV,
    impotNet,
  };
}
