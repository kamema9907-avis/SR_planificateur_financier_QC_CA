/**
 * Mode « Essentiel » ou « Avancé ».
 *
 * La plupart des champs experts ont un défaut sûr (croissance réelle du salaire à 0, appréciation
 * immobilière à la norme IQPF, indexation des rentes, facteur d'équivalence estimé…). Les afficher
 * en permanence donnait le même poids visuel à « Revenu d'emploi » qu'à « Facteur d'équivalence » et
 * gonflait chaque étape. Ils sont désormais masqués par défaut, derrière une bascule unique.
 *
 * Ce n'est qu'un réglage d'affichage : les valeurs restent dans le dossier et continuent d'être
 * calculées, qu'elles soient visibles ou non.
 */
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

const CLE_STOCKAGE = 'pf2026:modeAvance';

const Contexte = createContext<{ avance: boolean; setAvance: (v: boolean) => void }>({
  avance: false,
  setAvance: () => {},
});

export function ModeDetailProvider({ children }: { children: ReactNode }) {
  const [avance, setAvanceEtat] = useState(() => {
    try {
      return localStorage.getItem(CLE_STOCKAGE) === '1';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(CLE_STOCKAGE, avance ? '1' : '0');
    } catch {
      /* stockage indisponible : le réglage vaut pour la session */
    }
  }, [avance]);

  const setAvance = useCallback((v: boolean) => setAvanceEtat(v), []);

  return <Contexte.Provider value={{ avance, setAvance }}>{children}</Contexte.Provider>;
}

export const useModeDetail = () => useContext(Contexte);

/** N'affiche ses enfants qu'en mode avancé. */
export function Avance({ children }: { children: ReactNode }) {
  const { avance } = useModeDetail();
  return avance ? <>{children}</> : null;
}

/** Bascule Essentiel / Avancé, à placer dans la barre d'actions. */
export function BasculeAvance() {
  const { avance, setAvance } = useModeDetail();
  return (
    <div className="inline-flex rounded-lg bg-slate-100 p-0.5 ring-1 ring-slate-200">
      {[
        { v: false, label: 'Essentiel' },
        { v: true, label: 'Avancé' },
      ].map((o) => (
        <button
          key={o.label}
          type="button"
          onClick={() => setAvance(o.v)}
          aria-pressed={avance === o.v}
          title={
            o.v
              ? 'Affiche tous les réglages : indexation, facteur d’équivalence, appréciation…'
              : 'Masque les réglages experts, qui gardent leur valeur par défaut'
          }
          className={`rounded-md px-2.5 py-1 text-xs font-medium transition focus-visible:ring-2
            focus-visible:ring-marque-500 focus-visible:outline-none ${
              avance === o.v ? 'bg-white text-marque-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
