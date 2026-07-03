/**
 * Cotisations sociales d'un salarié (RRQ, assurance-emploi, RQAP), calculées à partir du salaire,
 * et ventilées selon leur traitement fiscal (crédit vs déduction). Voir `constantes/cotisations2026.ts`.
 */
import { COTISATIONS_2026, type ParametresCotisations } from './constantes/cotisations2026';
import { IQPF_2026 } from './constantes/iqpf2026';
import { ANNEE_BASE } from './constantes/indexation';
import type { Cotisations } from './types';

export type { Cotisations };

/**
 * Paramètres de cotisations indexés pour une année future.
 * Les plafonds en dollars (MGA, MSGA, maximums assurables) croissent au rythme du MGA (norme IQPF :
 * inflation + 1 % = 3,1 %). L'exemption générale du RRQ est gelée par la loi (non indexée). Les taux
 * sont fixes. En 2026, on retrouve les valeurs de base.
 */
export function parametresCotisations(annee: number = ANNEE_BASE): ParametresCotisations {
  const f = Math.pow(1 + IQPF_2026.croissanceMGA, annee - ANNEE_BASE);
  const b = COTISATIONS_2026;
  return {
    rrq: {
      exemption: b.rrq.exemption, // gelée
      mga: b.rrq.mga * f,
      msga: b.rrq.msga * f,
      tauxBase: b.rrq.tauxBase,
      tauxSupplementaire: b.rrq.tauxSupplementaire,
      tauxDeuxieme: b.rrq.tauxDeuxieme,
    },
    ae: { maxAssurable: b.ae.maxAssurable * f, taux: b.ae.taux },
    rqap: { maxAssurable: b.rqap.maxAssurable * f, taux: b.rqap.taux },
  };
}

/**
 * Cotisations sociales d'un salarié pour un revenu d'emploi donné.
 *  - RRQ base    = tauxBase × (min(salaire, MGA) − exemption)
 *  - RRQ bonifié = tauxSupplémentaire × (min(salaire, MGA) − exemption)
 *                + tauxDeuxième × (min(salaire, MSGA) − MGA)
 *  - AE   = taux × min(salaire, max assurable)   (aucune exemption)
 *  - RQAP = taux × min(salaire, max assurable)   (aucune exemption)
 */
export function calculerCotisations(
  revenuEmploi: number,
  params: ParametresCotisations = COTISATIONS_2026,
): Cotisations {
  const salaire = Math.max(0, revenuEmploi);
  const assiette1 = Math.max(0, Math.min(salaire, params.rrq.mga) - params.rrq.exemption);
  const assiette2 = Math.max(0, Math.min(salaire, params.rrq.msga) - params.rrq.mga);

  const rrqBase = params.rrq.tauxBase * assiette1;
  const rrqBonifie = params.rrq.tauxSupplementaire * assiette1 + params.rrq.tauxDeuxieme * assiette2;
  const ae = params.ae.taux * Math.min(salaire, params.ae.maxAssurable);
  const rqap = params.rqap.taux * Math.min(salaire, params.rqap.maxAssurable);

  return { rrqBase, rrqBonifie, ae, rqap, total: rrqBase + rrqBonifie + ae + rqap };
}
