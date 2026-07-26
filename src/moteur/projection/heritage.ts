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
import type { Heritage } from './types';

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
