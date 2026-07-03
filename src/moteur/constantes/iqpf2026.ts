/**
 * Normes d'hypothèses de projection 2026 — Institut de planification financière & FP Canada.
 *
 * Source : « Normes d'hypothèses de projection 2026 », Institut de planification financière
 * et Conseil des normes de FP Canada (publiées en avril 2026). Chiffres extraits du document
 * officiel (rendements BRUTS, avant frais de gestion et d'administration).
 *
 * Ces hypothèses ne servent pas au moteur fiscal (Phase 1) ; elles alimenteront la projection
 * long terme (Phase 2). Elles sont figées ici pour garantir des projections « réalistes et
 * justifiables », conformes au standard utilisé par les planificateurs professionnels.
 *
 * Règle d'écart acceptable : le planificateur peut s'écarter d'au plus ± 0,5 % d'une norme
 * de rendement tout en étant réputé la respecter.
 */
export const IQPF_2026 = {
  annee: 2026,
  source:
    "Normes d'hypothèses de projection 2026 — Institut de planification financière & FP Canada (avril 2026)",

  /** Taux d'inflation normé. */
  inflation: 0.021,

  /** Taux d'emprunt normé. */
  tauxEmprunt: 0.044,

  /** Croissance du maximum des gains admissibles (MGA / MGAP) = inflation + 1 %. */
  croissanceMGA: 0.031,

  /**
   * Rendements BRUTS par catégorie d'actif (avant frais).
   * Pour obtenir le rendement net, soustraire les frais de gestion et d'administration.
   */
  rendementsBruts: {
    courtTerme: 0.024,
    revenuFixe: 0.032,
    actionsCanadiennes: 0.063,
    actionsAmericaines: 0.064,
    actionsInternationales: 0.066,
    actionsMarchesEmergents: 0.075,
    /** Nouvelle norme 2026 : appréciation de la résidence principale = inflation + 1 %. */
    immobilierResidentiel: 0.031,
  },

  /** Écart acceptable par rapport à une norme de rendement (± 0,5 %). */
  ecartAcceptable: 0.005,

  /**
   * Table de survie (norme CPM 2014, générationnelle).
   * Âge atteint pour une probabilité de survie de 50 % (médiane), selon l'âge actuel.
   *  - h  : homme seul
   *  - f  : femme seule
   *  - couple : au moins un membre d'un couple homme/femme survit
   * Utile pour fixer par défaut l'horizon de décaissement (Phase 2).
   */
  survie50: {
    50: { h: 89, f: 92, couple: 95 },
    55: { h: 89, f: 92, couple: 95 },
    60: { h: 89, f: 91, couple: 94 },
    65: { h: 89, f: 91, couple: 94 },
    70: { h: 89, f: 91, couple: 94 },
    75: { h: 90, f: 92, couple: 94 },
    80: { h: 90, f: 92, couple: 95 },
    85: { h: 92, f: 93, couple: 95 },
    90: { h: 94, f: 95, couple: 97 },
    95: { h: 97, f: 98, couple: 99 },
  } as Record<number, { h: number; f: number; couple: number }>,
} as const;
