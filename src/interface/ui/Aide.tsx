import { useEffect, useId, useRef, useState, type ReactNode } from 'react';

/**
 * Bouton « ? » ouvrant une explication détaillée.
 *
 * Les étapes portaient jusqu'à cinq lignes de texte gris avant le premier champ — lu une fois, puis
 * ignoré, tout en repoussant la saisie vers le bas. Le détail passe ici : disponible d'un clic,
 * invisible le reste du temps.
 */
export function Aide({ titre, children }: { titre: string; children: ReactNode }) {
  const [ouvert, setOuvert] = useState(false);
  const id = useId();
  const conteneur = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!ouvert) return;
    const auClic = (e: MouseEvent) => {
      if (!conteneur.current?.contains(e.target as Node)) setOuvert(false);
    };
    const auClavier = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOuvert(false);
    };
    document.addEventListener('mousedown', auClic);
    document.addEventListener('keydown', auClavier);
    return () => {
      document.removeEventListener('mousedown', auClic);
      document.removeEventListener('keydown', auClavier);
    };
  }, [ouvert]);

  return (
    <span ref={conteneur} className="sansimpression relative inline-block align-middle">
      <button
        type="button"
        onClick={() => setOuvert((o) => !o)}
        aria-expanded={ouvert}
        aria-controls={id}
        aria-label={`Aide : ${titre}`}
        className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold transition
          focus-visible:ring-2 focus-visible:ring-marque-500 focus-visible:outline-none ${
            ouvert
              ? 'bg-marque-500 text-white'
              : 'bg-slate-100 text-slate-500 ring-1 ring-slate-200 hover:bg-slate-200 hover:text-slate-700'
          }`}
      >
        ?
      </button>

      {ouvert && (
        <span
          id={id}
          role="tooltip"
          className="absolute top-7 left-0 z-30 block w-72 rounded-xl bg-white p-3.5 text-xs
            leading-relaxed font-normal text-slate-600 shadow-lg ring-1 ring-slate-200"
        >
          <span className="mb-1 block text-sm font-semibold text-slate-800">{titre}</span>
          {children}
        </span>
      )}
    </span>
  );
}
