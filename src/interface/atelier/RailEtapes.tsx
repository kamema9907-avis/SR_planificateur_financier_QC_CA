import type { Etape } from './types';
import { progression } from './types';

interface Props {
  etapes: readonly Etape[];
  actif: string;
  onChoisir: (id: string) => void;
}

/** Pastille d'état : numéro, ✓ si l'étape porte des données, contour pointillé si facultative. */
function Pastille({ numero, rempli, actif, optionnel }: { numero: number; rempli: boolean; actif: boolean; optionnel: boolean }) {
  const base = 'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold transition';
  if (actif) return <span className={`${base} bg-marque-500 text-white`}>{numero}</span>;
  if (rempli) return <span className={`${base} bg-marque-50 text-marque-700 ring-1 ring-marque-500/30`}>✓</span>;
  if (optionnel) return <span className={`${base} text-slate-400 ring-1 ring-dashed ring-slate-300`}>{numero}</span>;
  return <span className={`${base} text-slate-400 ring-1 ring-slate-200`}>{numero}</span>;
}

/** Point d'alerte : une étape dont les données sont incohérentes se repère sans l'ouvrir. */
function Signal({ alertes }: { alertes: Etape['alertes'] }) {
  if (!alertes || alertes.length === 0) return null;
  const erreur = alertes.some((a) => a.niveau === 'erreur');
  return (
    <span
      title={alertes.map((a) => a.message).join('\n')}
      aria-label={`${alertes.length} ${erreur ? 'erreur(s)' : 'point(s) à vérifier'}`}
      className={`ml-auto h-2 w-2 shrink-0 rounded-full ${erreur ? 'bg-rose-500' : 'bg-amber-400'}`}
    />
  );
}

/**
 * Navigation entre les étapes : colonne à gauche sur grand écran, bande défilable au-dessus du
 * formulaire sur petit écran.
 */
export function RailEtapes({ etapes, actif, onChoisir }: Props) {
  const { faites, total } = progression(etapes);

  return (
    <nav aria-label="Étapes de la saisie" className="sansimpression lg:sticky lg:top-6 lg:self-start">
      <ol className="flex gap-1.5 overflow-x-auto pb-2 lg:flex-col lg:gap-0.5 lg:overflow-visible lg:pb-0">
        {etapes.map((e, i) => {
          const estActif = e.id === actif;
          return (
            <li key={e.id} className="shrink-0 lg:shrink">
              <button
                type="button"
                onClick={() => onChoisir(e.id)}
                aria-current={estActif ? 'step' : undefined}
                className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition
                  focus-visible:ring-2 focus-visible:ring-marque-500 focus-visible:outline-none ${
                    estActif
                      ? 'bg-white font-semibold text-slate-900 ring-1 ring-slate-200 shadow-sm'
                      : 'text-slate-500 hover:bg-white/60 hover:text-slate-700'
                  }`}
              >
                <Pastille numero={i + 1} rempli={e.rempli} actif={estActif} optionnel={e.optionnel ?? false} />
                <span className="whitespace-nowrap lg:whitespace-normal">{e.titre}</span>
                <Signal alertes={e.alertes} />
              </button>
            </li>
          );
        })}
      </ol>

      <div className="mt-3 hidden px-2.5 lg:block">
        <div className="h-1 overflow-hidden rounded-full bg-slate-200">
          <div
            className="h-full rounded-full bg-marque-500 transition-all duration-500"
            style={{ width: `${total === 0 ? 0 : (faites / total) * 100}%` }}
          />
        </div>
        <p className="mt-1.5 text-xs text-slate-400">
          <span className="chiffres">{faites}</span> / {total} essentielles
        </p>
      </div>
    </nav>
  );
}
