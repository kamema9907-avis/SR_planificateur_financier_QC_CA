import { useRef, useState } from 'react';
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
  const conteneur = useRef<HTMLDivElement>(null);
  const [survol, setSurvol] = useState<number | null>(null);

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
  const xAge = (age: number) => x(Math.min(n - 1, Math.max(0, age - ageDe)));
  const etiquettesAge = annees
    .filter((a) => a.age % 10 === 0 || a.age === ageDe || a.age === ageA)
    .map((a) => a.age);

  /** Index de l'année sous le pointeur, calculé sur la largeur rendue (le SVG est mis à l'échelle). */
  const indexSousPointeur = (clientX: number): number | null => {
    const rect = conteneur.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return null;
    const xSvg = ((clientX - rect.left) / rect.width) * W;
    const i = Math.round(((xSvg - L) / plotW) * (n - 1));
    return i >= 0 && i < n ? i : null;
  };

  const a = survol != null ? annees[survol] : null;
  /** L'infobulle bascule à gauche du curseur dans le dernier tiers, pour ne pas sortir du cadre. */
  const fractionX = survol != null ? survol / Math.max(1, n - 1) : 0;

  return (
    <div>
      <div
        ref={conteneur}
        className="relative"
        onMouseMove={(e) => setSurvol(indexSousPointeur(e.clientX))}
        onMouseLeave={() => setSurvol(null)}
      >
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Évolution du patrimoine">
          {/* Bande de décaissement : la retraite se lit d'un coup d'œil */}
          {ageRetraite > ageDe && ageRetraite < ageA && (
            <rect x={xAge(ageRetraite)} y={T} width={W - R - xAge(ageRetraite)} height={plotH} fill="#0f172a" fillOpacity={0.03} />
          )}

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
          {aires.map((aire, i) => (
            <path key={i} d={aire.d} fill={aire.couleur} fillOpacity={0.85} />
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

          {/* Curseur de survol */}
          {survol != null && (
            <g>
              <line x1={x(survol)} y1={T} x2={x(survol)} y2={T + plotH} stroke="#0f172a" strokeWidth={1} strokeOpacity={0.35} />
              <circle cx={x(survol)} cy={y(totaux[survol])} r={3.5} fill="#0f172a" />
            </g>
          )}

          {/* Étiquettes d'âge */}
          {etiquettesAge.map((age) => (
            <text key={age} x={xAge(age)} y={H - 10} textAnchor="middle" className="fill-slate-400" fontSize={11}>
              {age}
            </text>
          ))}
        </svg>

        {/* Infobulle : ventilation de l'année survolée */}
        {a && (
          <div
            className="pointer-events-none absolute top-2 z-10 w-56 rounded-xl bg-white/95 p-3 text-xs shadow-lg ring-1 ring-slate-200 backdrop-blur-sm"
            style={fractionX > 0.62 ? { right: `${(1 - fractionX) * 100 + 2}%` } : { left: `${fractionX * 100 + 2}%` }}
          >
            <p className="mb-1.5 font-semibold text-slate-800">
              <span className="chiffres">{a.age}</span> ans
              {ageEpuisement != null && a.age >= ageEpuisement && (
                <span className="ml-1.5 font-normal text-rose-600">dépenses non financées</span>
              )}
            </p>
            <ul className="space-y-0.5">
              {SERIES.map((s) => {
                const v = valeurSerie(a, s);
                if (v < 0.5) return null;
                return (
                  <li key={s.label} className="flex items-center justify-between gap-3">
                    <span className="flex min-w-0 items-center gap-1.5">
                      <span className="h-2 w-2 shrink-0 rounded-sm" style={{ backgroundColor: s.couleur }} />
                      <span className="truncate text-slate-500">{s.label.split(' (')[0]}</span>
                    </span>
                    <span className="chiffres shrink-0 text-slate-700">{formatDollarsCompact(v)}</span>
                  </li>
                );
              })}
            </ul>
            <p className="mt-1.5 flex justify-between border-t border-slate-100 pt-1.5 font-semibold text-slate-900">
              <span>Valeur nette</span>
              <span className="chiffres">{formatDollars(totaux[survol!])}</span>
            </p>
          </div>
        )}
      </div>

      {/* Légende */}
      <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1.5">
        {SERIES.map((s) => (
          <div key={s.label} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: s.couleur }} />
            <span className="text-xs text-slate-600">{s.label}</span>
          </div>
        ))}
        <span className="ml-auto text-xs text-slate-400">La zone grisée est la phase de décaissement.</span>
      </div>
    </div>
  );
}
