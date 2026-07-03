/**
 * Fractionnement du revenu de pension entre conjoints.
 *
 * Jusqu'à 50 % du revenu de pension admissible d'un conjoint peut être transféré à l'autre aux
 * fins d'impôt. On cherche le transfert qui MINIMISE l'impôt combiné du couple pour l'année.
 */
import { impotTotalPour } from '../moteurFiscal';
import type { EntreeFiscale } from '../types';

/**
 * Impôt combiné minimal du couple pour une année, en optimisant le fractionnement.
 * `splittable1`/`splittable2` = montant de revenu de pension admissible au fractionnement de
 * chaque conjoint (déjà inclus dans son `revenuPensionPrivee`).
 *
 * @returns impôt combiné minimal et transfert appliqué (> 0 : de p1 vers p2 ; < 0 : de p2 vers p1).
 */
export function impotCoupleOptimal(
  e1: EntreeFiscale,
  e2: EntreeFiscale,
  annee: number,
  splittable1: number,
  splittable2: number,
): { impot: number; transfert: number } {
  const evaluer = (t: number): number => {
    const a1: EntreeFiscale = { ...e1, revenuPensionPrivee: e1.revenuPensionPrivee - t };
    const a2: EntreeFiscale = { ...e2, revenuPensionPrivee: e2.revenuPensionPrivee + t };
    return impotTotalPour(a1, annee) + impotTotalPour(a2, annee);
  };

  let meilleur = { impot: evaluer(0), transfert: 0 };
  const considerer = (t: number) => {
    if (t > 0.5 * splittable1) return;
    if (-t > 0.5 * splittable2) return;
    const impot = evaluer(t);
    if (impot < meilleur.impot - 1e-6) meilleur = { impot, transfert: t };
  };

  // Balayage grossier dans les deux directions (p1->p2 et p2->p1).
  for (let f = 0.05; f <= 0.5 + 1e-9; f += 0.05) {
    considerer(f * splittable1);
    considerer(-f * splittable2);
  }

  // Raffinage local autour du meilleur candidat.
  const pas = 0.02 * Math.max(splittable1, splittable2, 1);
  for (let k = -5; k <= 5; k++) considerer(meilleur.transfert + k * pas);

  return meilleur;
}
