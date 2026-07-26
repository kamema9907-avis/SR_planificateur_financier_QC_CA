import { formatDollarsCompact } from '../format';

const W = 300;
const H = 72;

/** Deux trajectoires de valeur nette à comparer, en dollars d'aujourd'hui. */
export interface Trajectoires {
  /** Stratégie actuelle. */
  base: readonly number[];
  /** Stratégie proposée par l'optimiseur. */
  optimisee: readonly number[];
  ageDe: number;
  ageA: number;
}

function chemin(valeurs: readonly number[], maxY: number): string {
  const n = valeurs.length;
  if (n < 2) return '';
  return valeurs
    .map((v, i) => `${(i / (n - 1)) * W},${H - (v / maxY) * (H - 4)}`)
    .join(' ');
}

/**
 * Superpose la trajectoire actuelle et la trajectoire optimisée.
 *
 * Le panneau d'optimisation listait les leviers et le gain chiffré, mais rien ne montrait *quand*
 * l'écart se creuse — or c'est ce qui rend une stratégie compréhensible : voir le patrimoine
 * décrocher à partir de la fonte du REER, ou tenir plus longtemps grâce au report de la RRQ.
 */
export function ComparaisonOptimisation({ t }: { t: Trajectoires }) {
  const maxY = Math.max(1, ...t.base, ...t.optimisee);
  if (t.base.length < 2 || t.optimisee.length < 2) return null;

  return (
    <div>
      <p className="mb-1.5 text-sm font-medium text-slate-700">Trajectoire du patrimoine</p>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Comparaison des trajectoires">
        <polyline points={chemin(t.base, maxY)} fill="none" stroke="#94a3b8" strokeWidth={1.6} strokeDasharray="4 3" />
        <polyline points={chemin(t.optimisee, maxY)} fill="none" stroke="#059669" strokeWidth={2} />
      </svg>
      <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500">
        <span className="flex items-center gap-1.5">
          {/* Un SVG plutôt qu'une bordure CSS : le pointillé doit être identique à celui de la courbe. */}
          <svg width="18" height="4" aria-hidden="true">
            <line x1="0" y1="2" x2="18" y2="2" stroke="#94a3b8" strokeWidth={1.6} strokeDasharray="4 3" />
          </svg>
          Actuelle
        </span>
        <span className="flex items-center gap-1.5">
          <svg width="18" height="4" aria-hidden="true">
            <line x1="0" y1="2" x2="18" y2="2" stroke="#059669" strokeWidth={2} />
          </svg>
          Optimisée
        </span>
        <span className="ml-auto chiffres">
          {t.ageDe} → {t.ageA} ans · sommet {formatDollarsCompact(maxY)}
        </span>
      </div>
    </div>
  );
}
