/**
 * Remplissage annuel du CELI à partir du non-enregistré, pendant le décaissement.
 *
 * **Le trou qu'il bouche.** En décaissement, le revenu de placement n'est pas de l'encaisse : il
 * grossit à l'intérieur des comptes. Le solveur retire donc des comptes *pile* la dépense visée, et
 * `disponible ≈ cible`. La condition `disponible > cible + 1` est fausse, aucun surplus n'est placé,
 * et **plus rien ne cotise jamais au CELI**. Les droits s'empilent indéfiniment pendant que du
 * capital pleinement imposable dort à côté. Mesuré sur un ménage de deux retraités détenant 4 M$ en
 * non-enregistré : 1 341 500 $ de droits CELI inutilisés par conjoint à 95 ans.
 *
 * Aucun planificateur ne laisse dormir de la place à l'abri en détenant du non-enregistré : le
 * transfert est gratuit, sauf l'impôt du gain latent qu'il réalise — un impôt qu'il aurait de toute
 * façon fallu payer un jour, et payé ici en échange d'une exonération définitive.
 *
 * **Pourquoi le transfert a lieu AVANT le solveur.** Le gain réalisé s'ajoute à l'entrée fiscale de
 * l'année, et c'est le solveur qui finance ensuite la cible **et** l'impôt supplémentaire. Aucune
 * rétroaction n'est nécessaire. Le faire après coup obligerait à un tour d'itération pour financer
 * son propre impôt, comme la provision des ventes immobilières.
 */
import type { ProfilRendement } from '../constantes/profilsRendement';
import { estNonEnregistre } from './comptes';
import type { Compte } from './types';

/** Ce qu'un remplissage a déplacé, et ce qu'il a rendu imposable. */
export interface RemplissageCeli {
  /** Montant transféré du non-enregistré au CELI (consomme autant de droits). */
  readonly montant: number;
  /** Gain en capital réalisé par le retrait, à ajouter à l'entrée fiscale de l'année. */
  readonly gainRealise: number;
}

const RIEN: RemplissageCeli = { montant: 0, gainRealise: 0 };

/** Part latente de gain d'un compte : ce que réaliserait un retrait d'un dollar. */
const fractionGain = (c: Compte) =>
  c.solde <= 0 ? 0 : Math.max(0, (c.solde - (c.coutBase ?? 0)) / c.solde);

/**
 * Transfère du non-enregistré vers le CELI, dans la limite des droits. MUTE `comptes`.
 *
 * @param droitsCeli Droits de cotisation CELI disponibles.
 * @param plafond    Ce qu'on s'autorise à déplacer cette année. L'appelant y met le solde
 *                   non-enregistré **moins la dépense de l'année** : sans cette borne, on enverrait
 *                   au CELI de l'argent que le solveur en ressortirait aussitôt.
 * @returns le montant déplacé et le gain en capital qu'il réalise.
 */
export function remplirCeli(
  comptes: Compte[],
  profilDefaut: ProfilRendement,
  droitsCeli: number,
  plafond: number,
): RemplissageCeli {
  const sources = comptes.filter((c) => estNonEnregistre(c.type) && c.solde > 0);
  const disponible = sources.reduce((s, c) => s + c.solde, 0);
  let reste = Math.min(Math.max(0, droitsCeli), Math.max(0, plafond), disponible);
  if (reste <= 0.5) return RIEN;

  let montant = 0;
  let gainRealise = 0;
  for (const c of sources) {
    if (reste <= 0) break;
    const pris = Math.min(reste, c.solde);
    // La fraction se lit AVANT la mutation : après, le solde et le coût de base ont changé.
    gainRealise += pris * fractionGain(c);
    c.coutBase = (c.coutBase ?? 0) * (1 - pris / c.solde);
    c.solde -= pris;
    montant += pris;
    reste -= pris;
  }

  let celi = comptes.find((c) => c.type === 'CELI');
  if (!celi) {
    celi = { type: 'CELI', solde: 0, profil: profilDefaut };
    comptes.push(celi);
  }
  celi.solde += montant;

  return { montant, gainRealise };
}
