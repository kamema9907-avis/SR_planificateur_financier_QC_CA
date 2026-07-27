/**
 * Thème clair / sombre.
 *
 * Trois choix et non deux : « Système » suit le réglage du système d'exploitation (et le suit
 * *en direct* : basculer le mode nuit de Windows change la page sans la recharger), tandis que
 * « Clair » et « Sombre » sont des décisions explicites qui survivent au redémarrage.
 *
 * Le thème s'applique en posant la classe `sombre` sur `<html>` ; toutes les couleurs découlent des
 * jetons sémantiques de `index.css`. Aucun composant n'a besoin de connaître le thème courant.
 */
import { useCallback, useEffect, useState } from 'react';

export type Theme = 'systeme' | 'clair' | 'sombre';

export const CLE_THEME = 'pf2026:theme';

/** Lit le choix enregistré ; « Système » si rien n'a jamais été choisi. */
export function lireTheme(): Theme {
  try {
    const brut = localStorage.getItem(CLE_THEME);
    if (brut === 'clair' || brut === 'sombre' || brut === 'systeme') return brut;
  } catch {
    /* mode privé ou stockage refusé : on retombe sur le réglage du système */
  }
  return 'systeme';
}

/** Le thème réellement affiché, une fois « Système » résolu. */
export function themeEffectif(choix: Theme, systemeSombre: boolean): 'clair' | 'sombre' {
  if (choix === 'systeme') return systemeSombre ? 'sombre' : 'clair';
  return choix;
}

/** Pose ou retire la classe sur `<html>`. Seul endroit qui touche au DOM global. */
export function appliquerTheme(effectif: 'clair' | 'sombre'): void {
  document.documentElement.classList.toggle('sombre', effectif === 'sombre');
}

/**
 * Le thème courant et de quoi en changer.
 *
 * Le suivi du système passe par `matchMedia` plutôt qu'une lecture ponctuelle : sans écouteur, un
 * utilisateur en mode « Système » qui bascule son OS le soir garderait la page en clair jusqu'au
 * prochain rechargement.
 */
export function useTheme() {
  const [choix, setChoix] = useState<Theme>(lireTheme);
  const [systemeSombre, setSystemeSombre] = useState(
    () => window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false,
  );

  useEffect(() => {
    const requete = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!requete) return;
    const surChangement = (e: MediaQueryListEvent) => setSystemeSombre(e.matches);
    requete.addEventListener('change', surChangement);
    return () => requete.removeEventListener('change', surChangement);
  }, []);

  const effectif = themeEffectif(choix, systemeSombre);

  useEffect(() => {
    appliquerTheme(effectif);
  }, [effectif]);

  const choisir = useCallback((t: Theme) => {
    setChoix(t);
    try {
      localStorage.setItem(CLE_THEME, t);
    } catch {
      /* le choix vaut alors pour la session seulement */
    }
  }, []);

  return { choix, effectif, choisir };
}
