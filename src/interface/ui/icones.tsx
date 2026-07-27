/** Icônes SVG en trait, partagées par l'interface. `classe` fixe la taille (ex. « h-4 w-4 »). */
import type { ReactNode } from 'react';

interface IconeProps {
  classe?: string;
}

function Trait({ classe = 'h-4 w-4', children }: IconeProps & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={classe}
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

/** Étincelle — l'optimiseur. */
export function IconeEtincelle({ classe }: IconeProps) {
  return (
    <Trait classe={classe}>
      <path d="M5 3v4M3 5h4M13 3l2.5 6.5L22 12l-6.5 2.5L13 21l-2.5-6.5L4 12l6.5-2.5z" />
    </Trait>
  );
}

/** Double étincelle — en-tête du panneau d'optimisation. */
export function IconeEtincelleDouble({ classe }: IconeProps) {
  return (
    <Trait classe={classe}>
      <path d="M5 3v4M3 5h4M6 17v4M4 19h4M13 3l2.5 6.5L22 12l-6.5 2.5L13 21l-2.5-6.5L4 12l6.5-2.5z" />
    </Trait>
  );
}

/** Flèche circulaire — réinitialiser. */
export function IconeReinitialiser({ classe = 'h-3.5 w-3.5' }: IconeProps) {
  return (
    <Trait classe={classe}>
      <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
      <path d="M3 3v5h5" />
    </Trait>
  );
}

/** Cadenas — confidentialité des données. */
export function IconeCadenas({ classe = 'h-3.5 w-3.5' }: IconeProps) {
  return (
    <Trait classe={classe}>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </Trait>
  );
}

/** Courbe croissante — logo de l'application. */
export function IconeCourbe({ classe = 'h-6 w-6' }: IconeProps) {
  return (
    <Trait classe={classe}>
      <path d="M4 16 L10 10 L14 13 L20 6" />
      <circle cx="20" cy="6" r="1.4" fill="currentColor" stroke="none" />
    </Trait>
  );
}

/** Écran — thème réglé par le système. */
export function IconeEcran({ classe = 'h-3.5 w-3.5' }: IconeProps) {
  return (
    <Trait classe={classe}>
      <rect x="2" y="4" width="20" height="13" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </Trait>
  );
}

/** Soleil — thème clair. */
export function IconeSoleil({ classe = 'h-3.5 w-3.5' }: IconeProps) {
  return (
    <Trait classe={classe}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </Trait>
  );
}

/** Lune — thème sombre. */
export function IconeLune({ classe = 'h-3.5 w-3.5' }: IconeProps) {
  return (
    <Trait classe={classe}>
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
    </Trait>
  );
}
