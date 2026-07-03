import type { TypeCompte } from '../../moteur';
import { formatDollars, formatDollarsCompact } from '../format';

/** Point minimal requis par le graphique (compatible PointPatrimoine et données de couple). */
export interface PointPatrimoine {
  age: number;
  soldes: Record<TypeCompte, number>;
  /** Équité immobilière (optionnelle). */
  immobilier?: number;
  deflateurReel: number;
}

interface GraphiqueProps {
  annees: readonly PointPatrimoine[];
  /** Afficher en dollars d'aujourd'hui (réels) plutôt que nominaux. */
  reel: boolean;
  ageRetraite: number;
  ageEpuisement: number | null;
}

interface Serie {
  label: string;
  couleur: string;
  types?: readonly TypeCompte[];
  immobilier?: boolean;
}

const SERIES: readonly Serie[] = [
  { label: 'Enregistré (REER/FERR/CRI/FRV)', couleur: '#fb7185', types: ['REER', 'FERR', 'CRI', 'FRV'] },
  { label: 'Libre d’impôt (CELI/CELIAPP)', couleur: '#10b981', types: ['CELI', 'CELIAPP'] },
  { label: 'Non-enregistré', couleur: '#38bdf8', types: ['NON_ENREGISTRE'] },
  { label: 'REEE', couleur: '#fbbf24', types: ['REEE'] },
  { label: 'Immobilier (équité)', couleur: '#a78bfa', immobilier: true },
];

const L = 66;
const R = 14;
const T = 16;
const B = 30;
const W = 820;
const H = 340;

/** Arrondit un maximum à une valeur « ronde » pour l'axe. */
function maxArrondi(v: number): number {
  if (v <= 0) return 1;
  const magnitude = Math.pow(10, Math.floor(Math.log10(v)));
  return Math.ceil(v / magnitude) * magnitude;
}

export function GraphiqueProjection({ annees, reel, ageRetraite, ageEpuisement }: GraphiqueProps) {
  if (annees.length === 0) return null;

  const facteur = (a: PointPatrimoine) => (reel ? a.deflateurReel : 1);
  const valeurSerie = (a: PointPatrimoine, s: Serie) =>
    (s.immobilier ? (a.immobilier ?? 0) : (s.types ?? []).reduce((somme, t) => somme + a.soldes[t], 0)) * facteur(a);

  const totaux = annees.map((a) => SERIES.reduce((somme, s) => somme + valeurSerie(a, s), 0));
  const maxY = maxArrondi(Math.max(1, ...totaux));

  const n = annees.length;
  const plotW = W - L - R;
  const plotH = H - T - B;
  const x = (i: number) => L + (n === 1 ? 0 : (i / (n - 1)) * plotW);
  const y = (v: number) => T + plotH - (v / maxY) * plotH;

  // Aires empilées : chaque série s'appuie sur la somme des précédentes.
  const cumul = annees.map(() => 0);
  const aires = SERIES.map((s) => {
    const bas = annees.map((_, i) => cumul[i]);
    annees.forEach((a, i) => {
      cumul[i] += valeurSerie(a, s);
    });
    const haut = [...cumul];
    const pointsHaut = annees.map((_, i) => `${x(i)},${y(haut[i])}`).join(' ');
    const pointsBas = annees
      .map((_, i) => `${x(n - 1 - i)},${y(bas[n - 1 - i])}`)
      .join(' ');
    return { couleur: s.couleur, d: `M ${pointsHaut} L ${pointsBas} Z` };
  });

  // Lignes de repère horizontales.
  const graduations = [0, 0.25, 0.5, 0.75, 1].map((f) => f * maxY);

  const ageDe = annees[0].age;
  const ageA = annees[n - 1].age;
  const xAge = (age: number) => x(age - ageDe);
  const etiquettesAge = annees
    .filter((a) => a.age % 10 === 0 || a.age === ageDe || a.age === ageA)
    .map((a) => a.age);

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Évolution du patrimoine">
        {/* Graduations horizontales + libellés */}
        {graduations.map((g, i) => (
          <g key={i}>
            <line x1={L} y1={y(g)} x2={W - R} y2={y(g)} stroke="#e2e8f0" strokeWidth={1} />
            <text x={L - 8} y={y(g) + 4} textAnchor="end" className="fill-slate-400" fontSize={11}>
              {formatDollarsCompact(g)}
            </text>
          </g>
        ))}

        {/* Aires empilées */}
        {aires.map((a, i) => (
          <path key={i} d={a.d} fill={a.couleur} fillOpacity={0.85} />
        ))}

        {/* Marqueur : retraite */}
        {ageRetraite >= ageDe && ageRetraite <= ageA && (
          <g>
            <line x1={xAge(ageRetraite)} y1={T} x2={xAge(ageRetraite)} y2={T + plotH} stroke="#475569" strokeWidth={1} strokeDasharray="4 3" />
            <text x={xAge(ageRetraite) + 4} y={T + 12} className="fill-slate-500" fontSize={11}>
              retraite {ageRetraite}
            </text>
          </g>
        )}

        {/* Marqueur : épuisement */}
        {ageEpuisement !== null && ageEpuisement >= ageDe && ageEpuisement <= ageA && (
          <line x1={xAge(ageEpuisement)} y1={T} x2={xAge(ageEpuisement)} y2={T + plotH} stroke="#ef4444" strokeWidth={1.5} />
        )}

        {/* Étiquettes d'âge */}
        {etiquettesAge.map((age) => (
          <text key={age} x={xAge(age)} y={H - 10} textAnchor="middle" className="fill-slate-400" fontSize={11}>
            {age}
          </text>
        ))}

        {/* Zones de survol (infobulle native) */}
        {annees.map((a, i) => (
          <rect
            key={i}
            x={x(i) - plotW / (2 * Math.max(1, n - 1))}
            y={T}
            width={plotW / Math.max(1, n - 1)}
            height={plotH}
            fill="transparent"
          >
            <title>{`Âge ${a.age} — Valeur nette : ${formatDollars(totaux[i])}`}</title>
          </rect>
        ))}
      </svg>

      {/* Légende */}
      <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1.5">
        {SERIES.map((s) => (
          <div key={s.label} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: s.couleur }} />
            <span className="text-xs text-slate-600">{s.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
