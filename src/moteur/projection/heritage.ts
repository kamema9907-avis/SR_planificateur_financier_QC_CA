/**
 * Héritage : apport d'argent ponctuel reçu d'une succession.
 *
 * **Non imposable pour le bénéficiaire** : au Canada, c'est la succession du défunt qui règle
 * l'impôt au décès (dispositions présumées de ses comptes enregistrés et gains latents). Le montant
 * reçu est donc net, et n'entre dans aucun champ de revenu imposable — seuls les *rendements
 * futurs* de cet argent seront imposés, selon le compte où il aboutit.
 *
 * Le montant est saisi en dollars d'aujourd'hui, comme tout le reste du modèle, et indexé à
 * l'inflation jusqu'à l'âge de réception.
 */
import { AGE_CONVERSION_FERR } from '../constantes/ferr';
import type { ProfilRendement } from '../constantes/profilsRendement';
import type { Compte, Heritage, TypeCompte } from './types';

/** Montant nominal reçu à un âge donné (0 si l'héritage ne tombe pas cette année-là). */
export function heritageNominal(h: Heritage, age: number, ageActuel: number, inflation: number): number {
  if (age !== h.age) return 0;
  return Math.max(0, h.montant) * Math.pow(1 + inflation, age - ageActuel);
}

/**
 * Somme nominale des héritages reçus à un âge donné. Plusieurs héritages peuvent tomber la même
 * année (deux successions rapprochées) : ils s'additionnent.
 */
export function totalHeritage(
  heritages: readonly Heritage[] | undefined,
  age: number,
  ageActuel: number,
  inflation: number,
): number {
  if (!heritages || heritages.length === 0) return 0;
  return heritages.reduce((somme, h) => somme + heritageNominal(h, age, ageActuel, inflation), 0);
}

/** Compteurs de droits de cotisation, mutés par le placement. */
export interface DroitsHeritage {
  droitsCeli: number;
  droitsReer: number;
}

/** Où l'héritage a abouti, et la part qui ouvre droit à une déduction. */
export interface PlacementHeritage {
  celi: number;
  reer: number;
  nonEnr: number;
  /** Part versée au REER : déductible du revenu de l'année. */
  deductible: number;
}

function trouverOuCreer(comptes: Compte[], type: TypeCompte, profil: ProfilRendement): Compte {
  let c = comptes.find((x) => x.type === type);
  if (!c) {
    c = { type, solde: 0, profil, coutBase: type === 'NON_ENREGISTRE' ? 0 : undefined };
    comptes.push(c);
  }
  return c;
}

/**
 * Place un héritage en **CELI → REER → non-enregistré**, dans la limite des droits. MUTE `comptes`
 * et `droits`.
 *
 * Contrairement à `placerSurplusRetraite`, cette fonction ne recalcule pas l'impôt : elle retourne
 * la part `deductible` que l'appelant intègre à l'entrée fiscale de l'année, avant de calculer
 * l'impôt. C'est indispensable en mode couple, où l'impôt est calculé conjointement avec
 * fractionnement — un recalcul isolé par personne y serait faux — et cela donne au passage un
 * traitement identique dans les deux modes.
 *
 * Le CELIAPP est volontairement exclu : le moteur ne peut pas vérifier l'admissibilité (achat d'une
 * première propriété). Le CRI et le FRV sont immobilisés, donc inéligibles à tout versement.
 * Au-delà de 71 ans, plus aucun versement REER n'est permis.
 */
export function placerHeritage(
  comptes: Compte[],
  profilDefaut: ProfilRendement,
  droits: DroitsHeritage,
  montant: number,
  age: number,
): PlacementHeritage {
  let reste = Math.max(0, montant);
  if (reste === 0) return { celi: 0, reer: 0, nonEnr: 0, deductible: 0 };

  const celi = Math.min(reste, Math.max(0, droits.droitsCeli));
  if (celi > 0) {
    trouverOuCreer(comptes, 'CELI', profilDefaut).solde += celi;
    droits.droitsCeli -= celi;
    reste -= celi;
  }

  let reer = 0;
  if (reste > 0 && age <= AGE_CONVERSION_FERR && droits.droitsReer > 0) {
    reer = Math.min(reste, droits.droitsReer);
    trouverOuCreer(comptes, 'REER', profilDefaut).solde += reer;
    droits.droitsReer -= reer;
    reste -= reer;
  }

  const nonEnr = reste;
  if (nonEnr > 0) {
    const ne = trouverOuCreer(comptes, 'NON_ENREGISTRE', profilDefaut);
    ne.solde += nonEnr;
    ne.coutBase = (ne.coutBase ?? 0) + nonEnr;
  }

  return { celi, reer, nonEnr, deductible: reer };
}
