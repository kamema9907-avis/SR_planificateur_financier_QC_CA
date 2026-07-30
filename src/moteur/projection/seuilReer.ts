/**
 * Versement REER prioritaire : cotiser tant que la déduction rapporte plus qu'un seuil.
 *
 * Jusqu'ici, tout argent excédentaire suivait `CELI → REER → non-enregistré`. Le CELI d'abord est un
 * défaut défendable mais aveugle : il ignore que la déduction REER vaut le **taux marginal du jour**.
 * Pour un salarié à 47 % de taux marginal, mettre un dollar au CELI plutôt qu'au REER laisse 47 ¢ sur
 * la table, alors que le même dollar ressortira à la retraite autour de 30 %.
 *
 * **Ce module ne décide de rien** : il calcule un montant. Les appelants insèrent l'étape AVANT le
 * CELI, sans retirer l'étape REER qui suit — d'où la propriété qui rend le changement sûr :
 *
 *     seuil ≥ 100 %  ⇒  versement nul  ⇒  chaîne inchangée, au dollar près.
 *
 * Le seuil est donc à la fois le réglage et l'interrupteur.
 *
 * **Limite assumée** : le taux marginal est mesuré sur l'entrée fiscale de la personne, pas sur
 * l'impôt du ménage après re-optimisation du fractionnement. Même approximation de second ordre que
 * la provision d'impôt de vente dans `couple.ts` — et pour la même raison : `impotCoupleOptimal`
 * coûte une soixantaine de calculs d'impôt, insoutenable à chaque sonde d'une dichotomie.
 */

/** Pas d'arrondi du versement, en dollars. Toujours vers le BAS. */
const PAS = 100;

/**
 * Plus grand versement REER dont **chaque dollar** procure encore une économie supérieure à `seuil`.
 *
 * @param plafond       Borne supérieure : droits REER restants, argent disponible, déduction utilisable.
 * @param seuil         Fraction (0,36 = 36 %). ≥ 1 désactive la règle ; ≤ 0 verse tout le plafond.
 * @param tauxMarginal  `tauxMarginal(x)` = économie du dollar SUIVANT, une déduction de `x` étant déjà posée.
 *
 * **Pourquoi une dichotomie n'est pas suffisante à elle seule** : le taux marginal n'est pas monotone
 * en fonction du versement. La récupération de la SV et l'extinction des crédits créent des zones où
 * faire baisser le revenu fait *monter* le taux. La dichotomie trouve donc *un* point de bascule, pas
 * forcément le premier ; la revérification descendante garantit qu'on ne renvoie jamais un versement
 * dont le dernier dollar ne rapporte pas le seuil — quitte à être trop prudent.
 */
export function versementReerAuSeuil(
  plafond: number,
  seuil: number,
  tauxMarginal: (versement: number) => number,
): number {
  if (plafond <= 0) return 0;
  if (seuil >= 1) return 0; // règle désactivée : comportement d'avant, exactement
  if (seuil <= 0) return plafond; // tout est rentable, aucune sonde nécessaire

  /** Le dollar SUIVANT rapporte-t-il encore plus que le seuil ? */
  const rentable = (x: number) => tauxMarginal(x) > seuil;

  if (!rentable(0)) return 0; // même le premier dollar ne vaut pas le coup
  if (rentable(plafond)) return plafond; // le plafond mord avant le seuil

  // `bas` rapporte encore, `haut` ne rapporte plus.
  let bas = 0;
  let haut = plafond;
  while (haut - bas > PAS) {
    const milieu = (bas + haut) / 2;
    if (rentable(milieu)) bas = milieu;
    else haut = milieu;
  }

  let resultat = Math.floor(bas / PAS) * PAS;
  // Garde-fou : le DERNIER dollar versé doit encore rapporter le seuil. On recule tant que ce n'est
  // pas le cas — c'est ce qui rattrape une bosse que la dichotomie aurait enjambée.
  for (let i = 0; i < 30 && resultat > 0 && !rentable(Math.max(0, resultat - 1)); i++) {
    resultat -= PAS;
  }
  return Math.max(0, resultat);
}
