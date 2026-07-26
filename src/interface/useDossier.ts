/**
 * État partagé des vues de saisie : persistance locale, bascule réel/nominal, optimiseur.
 *
 * Les trois vues (Impôt, Projection solo, Couple) répétaient le même trio `useState` +
 * `localStorage` + `useEffect`. Un seul endroit désormais : une correction (ex. quota dépassé,
 * migration d'un ancien format) profite à tout le monde.
 */
import { useCallback, useEffect, useState } from 'react';
import type { ResultatOptimisation } from '../moteur';

/** Lit un dossier sauvegardé, en complétant les champs manquants par les valeurs par défaut. */
function charger<H>(cle: string, defaut: () => H): H {
  try {
    const brut = localStorage.getItem(cle);
    if (brut) return { ...defaut(), ...JSON.parse(brut) };
  } catch {
    /* stockage indisponible ou JSON corrompu : on repart du défaut */
  }
  return defaut();
}

/**
 * Un « dossier » : les hypothèses saisies, persistées automatiquement sous `cle`.
 * `reinitialiser` demande confirmation à l'appelant (voir `BoutonReinitialiser`).
 */
export function useDossier<H>(cle: string, defaut: () => H) {
  const [donnees, setDonnees] = useState<H>(() => charger(cle, defaut));

  useEffect(() => {
    try {
      localStorage.setItem(cle, JSON.stringify(donnees));
    } catch {
      /* quota dépassé ou mode privé : la session reste utilisable, sans persistance */
    }
  }, [cle, donnees]);

  const reinitialiser = useCallback(() => setDonnees(defaut()), [defaut]);

  return { donnees, setDonnees, reinitialiser };
}

/** Bascule d'affichage « dollars d'aujourd'hui » (réel) ou « dollars nominaux ». */
export function useAffichageReel(initial = true) {
  const [reel, setReel] = useState(initial);
  return { reel, setReel };
}

/**
 * Pilote l'optimiseur : lancement différé (le temps de peindre l'état « Optimisation… »),
 * conservation du résultat, application de la stratégie trouvée.
 *
 * Le `setTimeout` laisse au navigateur une frame pour afficher l'état de calcul avant de bloquer
 * le fil principal. Le passage à un Web Worker (fil réellement séparé) est prévu au lot 4.
 */
export function useOptimiseur<H, R>(
  donnees: H,
  optimiser: (h: H) => ResultatOptimisation<H, R>,
  appliquer: (strategie: H) => void,
) {
  const [resultat, setResultat] = useState<ResultatOptimisation<H, R> | null>(null);
  const [calcul, setCalcul] = useState(false);

  const lancer = useCallback(() => {
    setCalcul(true);
    setTimeout(() => {
      setResultat(optimiser(donnees));
      setCalcul(false);
    }, 20);
  }, [donnees, optimiser]);

  const fermer = useCallback(() => setResultat(null), []);

  const appliquerStrategie = useCallback(() => {
    if (resultat) appliquer(resultat.strategie);
    setResultat(null);
  }, [appliquer, resultat]);

  return { resultat, calcul, lancer, fermer, appliquerStrategie };
}
