/**
 * Facteurs de retrait minimum d'un FERR / FRV (règles fédérales post-2015).
 *
 * Le retrait minimum d'une année = facteur(âge au 1er janvier) × solde au 1er janvier.
 *  - Avant 71 ans (conversion volontaire) : facteur = 1 / (90 − âge).
 *  - De 71 à 94 ans : table prescrite.
 *  - 95 ans et plus : 20 %.
 */
const TABLE_MINIMUM: Record<number, number> = {
  71: 0.0528,
  72: 0.054,
  73: 0.0553,
  74: 0.0567,
  75: 0.0582,
  76: 0.0598,
  77: 0.0617,
  78: 0.0636,
  79: 0.0658,
  80: 0.0682,
  81: 0.0708,
  82: 0.0738,
  83: 0.0771,
  84: 0.0808,
  85: 0.0851,
  86: 0.0899,
  87: 0.0955,
  88: 0.1021,
  89: 0.1099,
  90: 0.1192,
  91: 0.1306,
  92: 0.1449,
  93: 0.1634,
  94: 0.1879,
};

/** Âge auquel un REER doit au plus tard être converti en FERR. */
export const AGE_CONVERSION_FERR = 71;

/** Facteur de retrait minimum FERR/FRV selon l'âge (au 1er janvier). */
export function facteurRetraitMinimumFERR(age: number): number {
  if (age < 71) return 1 / (90 - age);
  if (age >= 95) return 0.2;
  return TABLE_MINIMUM[age];
}
