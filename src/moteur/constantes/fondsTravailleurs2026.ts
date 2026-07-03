/**
 * Crédit d'impôt pour l'acquisition d'actions de fonds de travailleurs — 2026.
 *
 * Deux fonds au Québec : le Fonds de solidarité FTQ et Fondaction (CSN).
 * Le crédit s'ajoute à la déduction REER lorsque les actions sont détenues dans un REER
 * (on obtient alors la déduction ET le crédit).
 *
 *  - Crédit fédéral (crédit relatif à une société à capital de risque de travailleurs) : 15 %.
 *  - Crédit du Québec (FTQ et Fondaction) : 15 %.
 *  - Achat annuel maximal donnant droit au crédit : 5 000 $ (crédit maximal de 750 $ par palier,
 *    soit 1 500 $ au total → « 30 % sur le premier 5 000 $ »).
 *
 * Note : le crédit du Québec fait l'objet d'une réduction pour les contribuables imposés au
 * taux marginal le plus élevé — non modélisé en Phase 1 (à raffiner).
 */
export const FONDS_TRAVAILLEURS_2026 = {
  tauxFederal: 0.15,
  tauxQuebec: 0.15,
  plafondAchat: 5_000,
} as const;
