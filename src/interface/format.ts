/** Utilitaires de formatage en français canadien (fr-CA). */

const dollars0 = new Intl.NumberFormat('fr-CA', {
  style: 'currency',
  currency: 'CAD',
  maximumFractionDigits: 0,
});

const dollars2 = new Intl.NumberFormat('fr-CA', {
  style: 'currency',
  currency: 'CAD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const pourcent = new Intl.NumberFormat('fr-CA', {
  style: 'percent',
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

/** Montant en dollars, arrondi (sans cents) — pour les grands chiffres. */
export const formatDollars = (n: number): string => dollars0.format(n);

/** Montant en dollars avec les cents — pour les détails précis. */
export const formatDollarsCents = (n: number): string => dollars2.format(n);

/** Pourcentage (ex. 0.3612 → « 36,1 % »). */
export const formatPourcent = (n: number): string => pourcent.format(n);

const dollarsCompact = new Intl.NumberFormat('fr-CA', {
  style: 'currency',
  currency: 'CAD',
  notation: 'compact',
  maximumFractionDigits: 1,
});

/** Montant compact pour les axes de graphique (ex. 2 500 000 → « 2,5 M $ »). */
export const formatDollarsCompact = (n: number): string => dollarsCompact.format(n);
