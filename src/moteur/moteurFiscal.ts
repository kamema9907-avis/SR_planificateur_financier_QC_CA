import { FEDERAL_2026 as F } from './constantes/federal2026';
import { ANNEE_BASE, parametresFederal, parametresQuebec } from './constantes/indexation';
import { calculerImpotFederal } from './impotFederal';
import { calculerImpotQuebec } from './impotQuebec';
import type { BaseFiscale, EntreeFiscale, ResultatFiscal } from './types';

/** Construit la base fiscale intermédiaire à partir des données saisies. */
export function construireBase(entree: EntreeFiscale): BaseFiscale {
  const dividendesMajoresDetermines =
    entree.dividendesDetermines * (1 + F.dividendes.determines.majoration);
  const dividendesMajoresOrdinaires =
    entree.dividendesOrdinaires * (1 + F.dividendes.ordinaires.majoration);
  const gainsCapitalImposables = entree.gainsCapital * F.tauxInclusionGainCapital;

  const revenuTotalReel =
    entree.revenuEmploi +
    entree.revenuRRQ +
    entree.revenuPensionSV +
    entree.revenuPensionPrivee +
    entree.autresRevenus +
    entree.dividendesDetermines +
    entree.dividendesOrdinaires +
    entree.gainsCapital;

  const revenuTotalImpose =
    entree.revenuEmploi +
    entree.revenuRRQ +
    entree.revenuPensionSV +
    entree.revenuPensionPrivee +
    entree.autresRevenus +
    dividendesMajoresDetermines +
    dividendesMajoresOrdinaires +
    gainsCapitalImposables;

  const deductionsCommunes = entree.deductionReer + entree.autresDeductions;

  return {
    entree,
    dividendesMajoresDetermines,
    dividendesMajoresOrdinaires,
    gainsCapitalImposables,
    revenuTotalReel,
    revenuTotalImpose,
    deductionsCommunes,
  };
}

/**
 * Impôt total (fédéral net + Québec net) pour des données saisies.
 * `annee` sélectionne les barèmes (indexés à l'inflation pour une année future ; défaut 2026).
 */
export function impotTotalPour(entree: EntreeFiscale, annee: number = ANNEE_BASE): number {
  const base = construireBase(entree);
  return (
    calculerImpotFederal(base, parametresFederal(annee)).impotNet +
    calculerImpotQuebec(base, parametresQuebec(annee)).impotNet
  );
}

/**
 * Taux marginal sur le prochain dollar de revenu ordinaire.
 * Calculé numériquement (différence d'impôt pour +1 $ de revenu), ce qui capture
 * automatiquement l'effet des tranches, de la réduction des crédits et de l'abattement.
 */
export function calculerTauxMarginal(entree: EntreeFiscale, increment = 1, annee: number = ANNEE_BASE): number {
  const impotBase = impotTotalPour(entree, annee);
  const impotIncremente = impotTotalPour(
    { ...entree, autresRevenus: entree.autresRevenus + increment },
    annee,
  );
  return (impotIncremente - impotBase) / increment;
}

/**
 * Point d'entrée principal : calcule l'impôt complet pour une personne, une année.
 * `annee` sélectionne les barèmes (indexés pour une année future ; défaut 2026).
 */
export function calculerImpot(entree: EntreeFiscale, annee: number = ANNEE_BASE): ResultatFiscal {
  const base = construireBase(entree);
  const federal = calculerImpotFederal(base, parametresFederal(annee));
  const quebec = calculerImpotQuebec(base, parametresQuebec(annee));

  const impotTotal = federal.impotNet + quebec.impotNet;
  const revenuApresImpot = base.revenuTotalReel - impotTotal;
  const tauxMoyen = base.revenuTotalReel > 0 ? impotTotal / base.revenuTotalReel : 0;
  const tauxMarginal = calculerTauxMarginal(entree, 1, annee);

  return {
    entree,
    revenuTotalReel: base.revenuTotalReel,
    revenuTotalImpose: base.revenuTotalImpose,
    federal,
    quebec,
    impotTotal,
    revenuApresImpot,
    tauxMoyen,
    tauxMarginal,
  };
}
