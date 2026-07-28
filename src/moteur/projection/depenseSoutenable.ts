/**
 * Dépense de retraite soutenable : le montant que l'application peut RECOMMANDER, au lieu de
 * demander à l'utilisateur de le deviner.
 *
 * L'étape « Décaissement » réclame une cible annuelle nette d'impôt. C'est pourtant la donnée qui
 * commande tout le verdict : 45 000 $ et le plan tient, 65 000 $ et le capital s'épuise à 79 ans.
 * Or le moteur connaît déjà le capital, les rentes, l'horizon et la fiscalité — il peut calculer ce
 * montant.
 *
 * **Ce que « soutenable » veut dire ici** : rien de nouveau. C'est la définition déjà en vigueur
 * dans le moteur, `suffisant === true`, c'est-à-dire que la cible a été financée **chaque année**
 * jusqu'à l'âge de décès saisi. Deux conséquences héritées du solveur, assumées telles quelles :
 *
 * - un bien immobilier sans âge de vente n'est **jamais** consommé, donc le maximum est borné par
 *   les comptes liquides et la maison va à la succession ;
 * - le paiement hypothécaire s'**ajoute** à la cible, donc le montant retourné est un budget de vie
 *   *hors* versements hypothécaires.
 *
 * Voir `PLAN_DEPENSE_RECOMMANDEE.md` pour la conception complète et les limites.
 */

/** Part du maximum qu'on accepte de consommer, par convention de prudence. */
export const FRACTION_CONSOMMEE_DEFAUT = 0.85;

/** Pas d'arrondi du montant retourné, en dollars. Toujours vers le BAS. */
const PAS_ARRONDI = 100;

export interface OptionsDepenseMaximale {
  /** Largeur finale de l'encadrement, en $ d'aujourd'hui. Défaut : 250. */
  precision?: number;
  /** Borne de sécurité de la recherche, en $ d'aujourd'hui. Défaut : 2 000 000. */
  plafond?: number;
}

/** Arrondi vers le bas au pas donné : un montant affiché doit être réellement finançable. */
const arrondirBas = (montant: number) => Math.floor(montant / PAS_ARRONDI) * PAS_ARRONDI;

/**
 * Plus grande dépense annuelle (en $ d'aujourd'hui) que la stratégie finance jusqu'au décès.
 *
 * Générique sur solo / couple, comme la descente de coordonnées de l'optimiseur : l'appelant
 * fournit de quoi poser la dépense dans ses hypothèses et de quoi les évaluer.
 *
 * **Pourquoi une dichotomie est licite** : la soutenabilité décroît quand la dépense augmente.
 * Vérifié par balayage fin (pas de 250 $ en solo, 500 $ en couple) sur un dossier réaliste, dans
 * les deux modes, sans aucun re-succès après un échec — mais un essai n'est pas une preuve, et le
 * moteur est fiscalement non linéaire. D'où la revérification finale ci-dessous.
 *
 * Coût : environ 20 projections, soit ~19 ms en solo.
 *
 * @returns 0 si même une dépense nulle n'est pas finançable (hypothèque impayable, par exemple).
 */
export function depenseMaximale<H>(
  hypotheses: H,
  poserDepense: (h: H, montant: number) => H,
  evaluer: (h: H) => { suffisant: boolean },
  options: OptionsDepenseMaximale = {},
): number {
  const precision = options.precision ?? 250;
  const plafond = options.plafond ?? 2_000_000;
  const tient = (montant: number) => evaluer(poserDepense(hypotheses, montant)).suffisant;

  // Cas dégénéré : le capital ne couvre même pas les charges incompressibles.
  if (!tient(0)) return 0;

  // Amorçage : on double jusqu'à trouver une borne haute qui ÉCHOUE, pour encadrer le maximum
  // sans rien supposer de l'ordre de grandeur du dossier.
  let bas = 0;
  let haut = 20_000;
  while (tient(haut)) {
    bas = haut;
    if (haut >= plafond) return arrondirBas(plafond);
    haut = Math.min(haut * 2, plafond);
  }

  // Dichotomie : `bas` finance toujours, `haut` jamais.
  while (haut - bas > precision) {
    const milieu = (bas + haut) / 2;
    if (tient(milieu)) bas = milieu;
    else haut = milieu;
  }

  // Revérification : sous monotonie, arrondir vers le bas ne peut pas casser la soutenabilité.
  // Ce garde-fou ne sert que si elle est mise en défaut — on ne retourne jamais un montant qui
  // échoue, quitte à être trop prudent.
  let resultat = arrondirBas(bas);
  for (let i = 0; i < 20 && resultat > 0 && !tient(resultat); i++) resultat -= PAS_ARRONDI;
  return Math.max(0, resultat);
}

/**
 * Montant recommandé : la fraction du maximum qu'on accepte de consommer.
 *
 * **Ce n'est pas une mesure de risque.** C'est un abattement forfaitaire, assumé comme une
 * convention de prudence : 85 % du maximum laisse un coussin, sans prétendre modéliser quoi que ce
 * soit. Le traitement réel du risque de marché relève du taux de réussite probabiliste
 * (`PLAN_MONTE_CARLO.md`).
 *
 * @param fraction Part consommée, entre 0 et 1 (0,85 = on dépense 85 % du maximum).
 */
export function depenseRecommandee(
  maximum: number,
  fraction: number = FRACTION_CONSOMMEE_DEFAUT,
): number {
  const part = Math.min(Math.max(fraction, 0), 1);
  return Math.max(0, arrondirBas(maximum * part));
}
