import type { ReactNode } from 'react';

/**
 * Une étape de saisie : un écran court (une dizaine de champs), au lieu d'une section noyée dans
 * une page qui défile. Le rail affiche son titre et son état ; l'atelier affiche son contenu.
 */
export interface Etape {
  /** Identifiant stable, partagé entre les groupes de même nature (les deux conjoints ont
   *  `vie-active`), afin de rester sur la même étape en changeant de personne. */
  id: string;
  titre: string;
  /** UNE phrase, affichée sous le titre. Le détail va dans `aide`. */
  description?: string;
  /** Explication longue, repliée derrière le bouton « ? » à côté du titre. */
  aide?: ReactNode;
  /** Anomalies détectées dans cette étape (voir `validation.ts`). */
  alertes?: readonly { message: string; niveau: 'erreur' | 'attention' }[];
  /** Vrai dès qu'une donnée y a été saisie → pastille ✓ dans le rail. */
  rempli: boolean;
  /** Étape facultative (immobilier, travail à la retraite…) : la laisser vide n'est pas un manque. */
  optionnel?: boolean;
  contenu: ReactNode;
}

/**
 * Un ensemble d'étapes présenté d'un bloc. Le mode solo n'en a qu'un (masqué) ; le mode couple en
 * a trois : chaque conjoint, puis le ménage.
 */
export interface Groupe {
  id: string;
  label: string;
  etapes: Etape[];
}

/** Nombre d'étapes essentielles remplies sur le total, pour la barre de progression du rail. */
export function progression(etapes: readonly Etape[]): { faites: number; total: number } {
  const essentielles = etapes.filter((e) => !e.optionnel);
  return { faites: essentielles.filter((e) => e.rempli).length, total: essentielles.length };
}
