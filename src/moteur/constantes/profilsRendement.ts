/**
 * Profils de rendement calibrés sur les Normes IQPF 2026.
 *
 * Chaque profil correspond à une répartition d'actifs (court terme / revenu fixe / actions).
 * Le rendement mixte BRUT est calculé à partir des rendements IQPF, puis les frais de gestion
 * sont soustraits dans la couche « comptes » pour obtenir le rendement NET.
 *
 * Pour les comptes non enregistrés, le rendement est ventilé en intérêt / dividendes / gain en
 * capital, car ces composantes sont imposées différemment (l'intérêt et les dividendes chaque
 * année, le gain en capital seulement à la réalisation).
 */
import { IQPF_2026 } from './iqpf2026';

export type ProfilRendement = 'prudent' | 'equilibre' | 'dynamique';

/** Frais de gestion annuels par défaut (soustraits du rendement brut). */
export const FRAIS_GESTION_DEFAUT = 0.01;

/** Rendement dividende présumé de la portion actions (fraction de la valeur), imposé annuellement. */
const RENDEMENT_DIVIDENDE_ACTIONS = 0.02;

/** Répartition d'actifs par profil (somme = 1). */
interface Repartition {
  readonly courtTerme: number;
  readonly revenuFixe: number;
  readonly actions: number;
}

const REPARTITIONS: Record<ProfilRendement, Repartition> = {
  prudent: { courtTerme: 0.05, revenuFixe: 0.65, actions: 0.3 },
  equilibre: { courtTerme: 0.05, revenuFixe: 0.35, actions: 0.6 },
  dynamique: { courtTerme: 0.02, revenuFixe: 0.13, actions: 0.85 },
};

/**
 * Rendement brut d'un portefeuille d'actions globalement diversifié, à partir des Normes IQPF
 * (pondération représentative canadiennes / américaines / internationales / marchés émergents).
 */
const RENDEMENT_ACTIONS_BRUT =
  0.3 * IQPF_2026.rendementsBruts.actionsCanadiennes +
  0.4 * IQPF_2026.rendementsBruts.actionsAmericaines +
  0.25 * IQPF_2026.rendementsBruts.actionsInternationales +
  0.05 * IQPF_2026.rendementsBruts.actionsMarchesEmergents;

/** Composantes du rendement brut, en fraction du solde. */
export interface ComposantesRendement {
  readonly interet: number;
  readonly dividendes: number;
  readonly gainCapital: number;
}

/** Ventile le rendement brut d'un profil en intérêt / dividendes / gain en capital. */
export function composantesRendementBrut(profil: ProfilRendement): ComposantesRendement {
  const r = REPARTITIONS[profil];
  const interet =
    r.courtTerme * IQPF_2026.rendementsBruts.courtTerme + r.revenuFixe * IQPF_2026.rendementsBruts.revenuFixe;
  const dividendes = r.actions * RENDEMENT_DIVIDENDE_ACTIONS;
  const gainCapital = r.actions * (RENDEMENT_ACTIONS_BRUT - RENDEMENT_DIVIDENDE_ACTIONS);
  return { interet, dividendes, gainCapital };
}

/** Rendement mixte brut total d'un profil (avant frais). */
export function rendementBrut(profil: ProfilRendement): number {
  const c = composantesRendementBrut(profil);
  return c.interet + c.dividendes + c.gainCapital;
}
