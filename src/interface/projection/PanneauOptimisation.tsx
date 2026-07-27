import { formatDollars } from '../format';
import { IconeEtincelleDouble } from '../ui/icones';
import { ComparaisonOptimisation, type Trajectoires } from './ComparaisonOptimisation';

interface Props {
  gainPatrimoine: number;
  gainImpot: number;
  details: { label: string; valeur: string }[];
  /** Trajectoires actuelle et optimisée, superposées sous la liste des leviers. */
  trajectoires?: Trajectoires;
  onAppliquer: () => void;
  onFermer: () => void;
}

/** Panneau présentant la stratégie optimisée trouvée et son amélioration. */
export function PanneauOptimisation({ gainPatrimoine, gainImpot, details, trajectoires, onAppliquer, onFermer }: Props) {
  const aucunGain = gainPatrimoine < 1 && gainImpot < 1;

  return (
    <div className="carte overflow-hidden ring-2 ring-marque-500/40">
      <div className="bg-gradient-to-br from-marque-800 to-sky-700 p-5 text-white">
        <div className="flex items-center gap-2">
          <IconeEtincelleDouble classe="h-5 w-5" />
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
            {trajectoires && (
              <div className="mt-4 border-t border-slate-100 pt-3">
                <ComparaisonOptimisation t={trajectoires} />
              </div>
            )}
          </>
        )}
        <div className="mt-4 flex gap-2">
          {!aucunGain && (
            <button type="button" onClick={onAppliquer} className="bouton-marque">
              Appliquer cette stratégie
            </button>
          )}
          <button type="button" onClick={onFermer} className="bouton-secondaire">
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
