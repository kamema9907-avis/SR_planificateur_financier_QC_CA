/**
 * Adresse partageable : l'endroit où vous êtes s'écrit dans l'URL.
 *
 * Sans cela, l'application n'a qu'une seule adresse. Recharger la page ramenait à l'onglet Impôt,
 * le bouton « Retour » du navigateur quittait l'application, et il était impossible d'envoyer un
 * lien qui ouvre directement le mode couple.
 *
 * **Pourquoi le dièse et pas un vrai chemin** : le site est hébergé sur GitHub Pages, qui sert des
 * fichiers statiques. Une adresse comme `/projection/couple` demanderait au serveur un fichier qui
 * n'existe pas — erreur 404 au rechargement. Ce qui suit le `#` n'est jamais envoyé au serveur :
 * c'est la seule forme qui survit à un rechargement sur un hébergement statique.
 *
 * Les deux fonctions de conversion sont pures, donc testables sans navigateur.
 */
import { useCallback, useEffect, useState } from 'react';

export type Onglet = 'impot' | 'projection';
export type ModeProjection = 'solo' | 'couple';

export interface Route {
  onglet: Onglet;
  /** Mode de l'onglet Projection. Conservé même sur l'onglet Impôt, mais absent de l'URL. */
  mode: ModeProjection;
  /** Groupe de l'atelier — en couple seulement : `personne1`, `personne2` ou `menage`. */
  groupe?: string;
  /** Étape active de l'atelier. Absente = la première du groupe. */
  etape?: string;
}

export const ROUTE_DEFAUT: Route = { onglet: 'impot', mode: 'solo' };

/**
 * Lit une adresse. **Ne rejette jamais** : un lien tronqué, mal recopié ou venant d'une version
 * précédente doit ouvrir l'application, pas afficher une erreur. Tout segment inconnu retombe sur
 * la valeur par défaut.
 */
export function lireRoute(hash: string): Route {
  const segments = hash
    .replace(/^#\/?/, '')
    .split('/')
    .map((s) => decodeURIComponent(s).trim().toLowerCase())
    .filter((s) => s.length > 0);

  if (segments[0] !== 'projection') return { ...ROUTE_DEFAUT };

  const mode: ModeProjection = segments[1] === 'couple' ? 'couple' : 'solo';
  // En solo l'atelier n'a qu'un groupe : il n'occupe pas de segment.
  const [groupe, etape] = mode === 'couple' ? [segments[2], segments[3]] : [undefined, segments[2]];

  return { onglet: 'projection', mode, groupe: groupe || undefined, etape: etape || undefined };
}

/** Écrit une adresse canonique. `lireRoute(ecrireRoute(r))` redonne toujours `r`. */
export function ecrireRoute(route: Route): string {
  if (route.onglet === 'impot') return '#/impot';

  const segments: string[] = ['projection', route.mode];
  if (route.mode === 'couple' && route.groupe) segments.push(route.groupe);
  // Une étape sans son groupe serait ambiguë à la relecture : on ne l'écrit pas seule.
  if (route.etape && (route.mode === 'solo' || route.groupe)) segments.push(route.etape);

  return '#/' + segments.map(encodeURIComponent).join('/');
}

/**
 * Adresse courante et navigation. Plusieurs composants peuvent l'appeler indépendamment : ils
 * écoutent tous `hashchange`, donc un changement fait par l'un met les autres à jour.
 */
export function useRoute() {
  const [route, setRoute] = useState<Route>(() => lireRoute(window.location.hash));

  useEffect(() => {
    const surChangement = () => setRoute(lireRoute(window.location.hash));
    window.addEventListener('hashchange', surChangement);

    // Normalisation à l'ouverture : une adresse nue ou approximative devient canonique, pour que
    // l'URL affichée soit toujours copiable. `replaceState` n'ajoute pas d'entrée d'historique,
    // sinon le premier « Retour » ne ferait que défaire cette réécriture.
    const canonique = ecrireRoute(lireRoute(window.location.hash));
    if (window.location.hash !== canonique) {
      window.history.replaceState(null, '', canonique);
      surChangement();
    }

    return () => window.removeEventListener('hashchange', surChangement);
  }, []);

  /**
   * Change une partie de l'adresse. L'affectation de `location.hash` ajoute une entrée
   * d'historique : « Retour » revient donc à l'étape ou à l'onglet précédent.
   */
  const naviguer = useCallback((partie: Partial<Route>) => {
    // On repart de l'URL et non de l'état, pour ne pas écraser un changement concurrent.
    const cible = ecrireRoute({ ...lireRoute(window.location.hash), ...partie });
    if (cible === window.location.hash) return;
    window.location.hash = cible;
  }, []);

  return { route, naviguer };
}
