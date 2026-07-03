/**
 * Point d'entrée public du moteur fiscal (Phase 1).
 * L'interface (React) ne doit importer que d'ici.
 */
export type {
  Province,
  Palier,
  Cotisations,
  EntreeFiscale,
  BaseFiscale,
  DetailImpot,
  ResultatFiscal,
} from './types';

export { FEDERAL_2026 } from './constantes/federal2026';
export { QUEBEC_2026 } from './constantes/quebec2026';
export { IQPF_2026 } from './constantes/iqpf2026';
export { FONDS_TRAVAILLEURS_2026 } from './constantes/fondsTravailleurs2026';
export { COTISATIONS_2026, TAUX_CREDIT_SYNDICAL_QC, type ParametresCotisations } from './constantes/cotisations2026';
export { calculerCotisations, parametresCotisations } from './cotisations';
export {
  ANNEE_BASE,
  facteurIndexation,
  parametresFederal,
  parametresQuebec,
  type ParametresFederal,
  type ParametresQuebec,
} from './constantes/indexation';

export { impotProgressif, arrondirCents } from './bareme';
export {
  calculerImpot,
  construireBase,
  impotTotalPour,
  calculerTauxMarginal,
} from './moteurFiscal';

// --- Projection cycle de vie (Phase 2) ---
export type {
  TypeCompte,
  Compte,
  SourceRente,
  RenteEmployeur,
  HypothesesProjection,
  AnneeProjection,
  ResultatProjection,
} from './projection/types';
export { projeter } from './projection/projection';
export { renteEmployeurNominale, totalRentesEmployeur, calculerRREGOP, MGA_2026 } from './projection/rentesEmployeur';
export type { TypeImmeuble, Proprietaire, Immeuble } from './projection/immobilier';
export { APPRECIATION_IMMO, determinerBienAbrite } from './projection/immobilier';
export { renteSurvivantRRQ, MAX_RRQ_RETRAITE_65 } from './projection/rentesPubliques';

// --- Couple (Phase 3) ---
export type {
  PersonneProjection,
  HypothesesCouple,
  AnneeCouple,
  ResultatCouple,
} from './projection/typesCouple';
export { projeterCouple } from './projection/couple';
export { impotCoupleOptimal } from './projection/fractionnement';
export { optimiserProjection, optimiserCouple, type ResultatOptimisation } from './projection/optimiseur';
export {
  estImposableAuRetrait,
  estLibreImpot,
  estNonEnregistre,
  rendementNet,
} from './projection/comptes';
export { rendementBrut, type ProfilRendement } from './constantes/profilsRendement';
export { facteurAjustementRRQ, facteurAjustementSV } from './projection/rentesPubliques';
export { facteurRetraitMinimumFERR, AGE_CONVERSION_FERR } from './constantes/ferr';

/** Entrée fiscale vierge (valeurs par défaut) — pratique pour initialiser l'interface. */
import type { EntreeFiscale } from './types';
export function entreeVide(): EntreeFiscale {
  return {
    annee: 2026,
    province: 'QC',
    age: 40,
    vitSeul: false,
    revenuEmploi: 0,
    revenuRRQ: 0,
    renteSurvivantRRQ: 0,
    revenuPensionSV: 0,
    revenuPensionPrivee: 0,
    autresRevenus: 0,
    dividendesDetermines: 0,
    dividendesOrdinaires: 0,
    gainsCapital: 0,
    deductionReer: 0,
    autresDeductions: 0,
    cotisationFondsTravailleurs: 0,
    cotisationSyndicale: 0,
    primeAssuranceSalaire: 0,
    assuranceSalaireDeductible: false,
  };
}
