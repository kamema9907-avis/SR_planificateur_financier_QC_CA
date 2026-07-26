/**
 * État partagé des vues de saisie : persistance locale, bascule réel/nominal, optimiseur.
 *
 * Les trois vues (Impôt, Projection solo, Couple) répétaient le même trio `useState` +
 * `localStorage` + `useEffect`. Un seul endroit désormais : une correction (ex. quota dépassé,
 * migration d'un ancien format) profite à tout le monde.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ResultatOptimisation } from '../moteur';
import type { DemandeOptimisation, ReponseOptimisation } from './optimiseur.worker';

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
 * Pilote l'optimiseur sur un **fil séparé** (Web Worker) : la page reste utilisable pendant le
 * calcul, et celui-ci devient annulable.
 *
 * `optimiserSync` sert de repli lorsque les workers de module ne sont pas disponibles — le calcul
 * bloque alors le fil principal comme avant, plutôt que de ne pas fonctionner du tout.
 */
export function useOptimiseur<H, R>({
  donnees,
  mode,
  optimiserSync,
  appliquer,
}: {
  donnees: H;
  mode: 'solo' | 'couple';
  optimiserSync: (h: H) => ResultatOptimisation<H, R>;
  appliquer: (strategie: H) => void;
}) {
  const [resultat, setResultat] = useState<ResultatOptimisation<H, R> | null>(null);
  const [calcul, setCalcul] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const worker = useRef<Worker | null>(null);
  /** Numéro de la demande en cours : toute réponse d'un autre numéro est périmée. */
  const demande = useRef(0);

  /** Crée le worker au premier usage ; `null` si l'environnement ne le permet pas. */
  const obtenirWorker = useCallback((): Worker | null => {
    if (worker.current) return worker.current;
    try {
      worker.current = new Worker(new URL('./optimiseur.worker.ts', import.meta.url), {
        type: 'module',
      });
      return worker.current;
    } catch {
      return null; // repli synchrone
    }
  }, []);

  useEffect(() => {
    return () => {
      worker.current?.terminate();
      worker.current = null;
    };
  }, []);

  const lancer = useCallback(() => {
    setErreur(null);
    setCalcul(true);
    const id = ++demande.current;
    const w = obtenirWorker();

    if (!w) {
      // Repli : une frame pour peindre l'état « Optimisation… », puis calcul bloquant.
      setTimeout(() => {
        if (id !== demande.current) return;
        try {
          setResultat(optimiserSync(donnees));
        } catch (e) {
          setErreur(e instanceof Error ? e.message : String(e));
        }
        setCalcul(false);
      }, 20);
      return;
    }

    w.onmessage = (e: MessageEvent<ReponseOptimisation>) => {
      if (e.data.id !== demande.current) return; // réponse d'un calcul remplacé
      if (e.data.ok) setResultat(e.data.resultat as ResultatOptimisation<H, R>);
      else setErreur(e.data.erreur);
      setCalcul(false);
    };
    w.onerror = (e) => {
      setErreur(e.message || "L'optimisation a échoué.");
      setCalcul(false);
    };

    const message: DemandeOptimisation = { id, mode, hypotheses: donnees };
    w.postMessage(message);
  }, [donnees, mode, obtenirWorker, optimiserSync]);

  /** Abandonne le calcul en cours : on tue le worker, le prochain lancement en recrée un. */
  const annuler = useCallback(() => {
    demande.current += 1;
    worker.current?.terminate();
    worker.current = null;
    setCalcul(false);
  }, []);

  const fermer = useCallback(() => {
    setResultat(null);
    setErreur(null);
  }, []);

  const appliquerStrategie = useCallback(() => {
    if (resultat) appliquer(resultat.strategie);
    setResultat(null);
  }, [appliquer, resultat]);

  return { resultat, calcul, erreur, lancer, annuler, fermer, appliquerStrategie };
}
