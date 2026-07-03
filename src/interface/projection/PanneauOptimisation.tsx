import { formatDollars } from '../format';

interface Props {
  gainPatrimoine: number;
  gainImpot: number;
  details: { label: string; valeur: string }[];
  onAppliquer: () => void;
  onFermer: () => void;
}

/** Panneau présentant la stratégie optimisée trouvée et son amélioration. */
export function PanneauOptimisation({ gainPatrimoine, gainImpot, details, onAppliquer, onFermer }: Props) {
  const aucunGain = gainPatrimoine < 1 && gainImpot < 1;

  return (
    <div className="carte overflow-hidden ring-2 ring-marque-500/40">
      <div className="bg-gradient-to-br from-marque-600 to-sky-500 p-5 text-white">
        <div className="flex items-center gap-2">
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 3v4M3 5h4M6 17v4M4 19h4M13 3l2.5 6.5L22 12l-6.5 2.5L13 21l-2.5-6.5L4 12l6.5-2.5z" />
          </svg>
          <h3 className="font-semibold">
            {aucunGain ? 'Votre stratégie est déjà optimale' : 'Stratégie optimisée trouvée'}
          </h3>
        </div>
        {!aucunGain && (
          <div className="mt-3 flex flex-wrap gap-x-8 gap-y-2">
            <div>
              <p className="text-xs text-marque-50/90">Patrimoine au décès</p>
              <p className="chiffres text-2xl font-bold">+ {formatDollars(gainPatrimoine)}</p>
            </div>
            <div>
              <p className="text-xs text-marque-50/90">Impôt sur la vie</p>
              <p className="chiffres text-2xl font-bold">− {formatDollars(Math.max(0, gainImpot))}</p>
            </div>
          </div>
        )}
      </div>

      <div className="p-5">
        {aucunGain ? (
          <p className="text-sm text-slate-500">
            L'optimiseur n'a pas trouvé de meilleure combinaison que votre stratégie actuelle.
          </p>
        ) : (
          <>
            <p className="mb-2 text-sm font-medium text-slate-700">Stratégie recommandée</p>
            <div className="divide-y divide-slate-100">
              {details.map((d) => (
                <div key={d.label} className="flex items-baseline justify-between gap-4 py-1.5 text-sm">
                  <span className="text-slate-500">{d.label}</span>
                  <span className="chiffres font-medium text-slate-800">{d.valeur}</span>
                </div>
              ))}
            </div>
          </>
        )}
        <div className="mt-4 flex gap-2">
          {!aucunGain && (
            <button
              type="button"
              onClick={onAppliquer}
              className="rounded-lg bg-marque-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-marque-600"
            >
              Appliquer cette stratégie
            </button>
          )}
          <button
            type="button"
            onClick={onFermer}
            className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-600 ring-1 ring-slate-200 transition hover:bg-slate-200"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
