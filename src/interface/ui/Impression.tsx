/**
 * Impression et export PDF (« Imprimer » → « Enregistrer au format PDF » du navigateur).
 *
 * Deux obstacles à lever. D'abord l'atelier ne montre qu'une étape à la fois : un PDF qui ne
 * contiendrait qu'une étape sur huit n'aurait aucune valeur. Ensuite l'impression doit se déclencher
 * APRÈS que React ait affiché toutes les étapes — `beforeprint` arrive trop tard pour un rendu.
 *
 * D'où ce contexte : le bouton demande le mode impression, un effet attend le rendu, puis appelle
 * `window.print()` et rétablit l'affichage normal.
 */
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

const Contexte = createContext(false);

/** Vrai pendant la préparation et le rendu d'impression : tout doit alors être visible. */
export const useImpression = () => useContext(Contexte);

export function ImpressionProvider({ children }: { children: ReactNode }) {
  const [impression, setImpression] = useState(false);

  useEffect(() => {
    if (!impression) return;
    // Deux frames : la première applique le mode, la seconde garantit que le DOM est peint.
    let annule = false;
    const id = requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        if (annule) return;
        window.print();
        setImpression(false);
      }),
    );
    return () => {
      annule = true;
      cancelAnimationFrame(id);
    };
  }, [impression]);

  return (
    <Contexte.Provider value={impression}>
      <ImprimerContexte.Provider value={() => setImpression(true)}>{children}</ImprimerContexte.Provider>
    </Contexte.Provider>
  );
}

const ImprimerContexte = createContext<() => void>(() => {});

/** Bouton « Imprimer » — l'utilisateur choisit ensuite l'imprimante ou « Enregistrer en PDF ». */
export function BoutonImprimer() {
  const imprimer = useContext(ImprimerContexte);
  return (
    <button
      type="button"
      onClick={imprimer}
      className="bouton-fantome"
      title="Imprimer ou enregistrer en PDF : toutes les étapes et les résultats sont dépliés"
    >
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M6 9V3h12v6M6 18H4v-7h16v7h-2M8 14h8v7H8z" />
      </svg>
      Imprimer
    </button>
  );
}
