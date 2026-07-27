import { useId } from 'react';
import type { TypeCompte } from '../../moteur';
import { formatDollarsCompact } from '../format';
import type { PointPatrimoine } from './GraphiqueProjection';

const TYPES: readonly TypeCompte[] = ['REER', 'FERR', 'CRI', 'FRV', 'CELI', 'CELIAPP', 'NON_ENREGISTRE', 'REEE'];

const W = 320;
const H = 96;
const B = 14; // bande basse réservée aux âges

interface Props {
  annees: readonly PointPatrimoine[];
  reel: boolean;
  ageRetraite: number;
  ageEpuisement: number | null;
}

/**
 * Courbe de la valeur nette, taillée pour la colonne de résultat : assez petite pour rester
 * collée à l'écran pendant la saisie, assez lisible pour répondre à « est-ce que ça tient ? ».
 * Le graphique détaillé par catégorie de compte reste sous l'atelier, en pleine largeur.
 */
export function GraphiqueCompact({ annees, reel, ageRetraite, ageEpuisement }: Props) {
  const idDegrade = useId();
  if (annees.length < 2) return null;

  const total = (a: PointPatrimoine) =>
    (TYPES.reduce((s, t) => s + a.soldes[t], 0) + (a.immobilier ?? 0)) * (reel ? a.deflateurReel : 1);

  const valeurs = annees.map(total);
  const sommet = Math.max(0, ...valeurs);
  if (sommet < 1) {
    return (
      <p className="py-6 text-center text-xs text-slate-500">
        Renseignez vos comptes et vos dépenses : la courbe de votre patrimoine apparaîtra ici.
      </p>
    );
  }

  const maxY = sommet;
  const n = annees.length;
  const plotH = H - B;

  const x = (i: number) => (i / (n - 1)) * W;
  const y = (v: number) => plotH - (v / maxY) * (plotH - 4);

  const ligne = valeurs.map((v, i) => `${x(i)},${y(v)}`).join(' ');
  const aire = `M 0,${plotH} L ${ligne} L ${W},${plotH} Z`;

  const ageDe = annees[0].age;
  const ageA = annees[n - 1].age;
  const xAge = (age: number) => x(Math.min(n - 1, Math.max(0, age - ageDe)));

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Courbe de la valeur nette">
        <defs>
          <linearGradient id={idDegrade} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10b981" stopOpacity={0.35} />
            <stop offset="100%" stopColor="#10b981" stopOpacity={0.02} />
          </linearGradient>
        </defs>

        <line x1={0} y1={plotH} x2={W} y2={plotH} stroke="#e2e8f0" strokeWidth={1} />
        <path d={aire} fill={`url(#${idDegrade})`} />
        <polyline points={ligne} fill="none" stroke="#059669" strokeWidth={1.8} strokeLinejoin="round" />

        {ageRetraite > ageDe && ageRetraite < ageA && (
          <>
            <line x1={xAge(ageRetraite)} y1={0} x2={xAge(ageRetraite)} y2={plotH} stroke="#94a3b8" strokeWidth={1} strokeDasharray="3 3" />
            {/* Halo blanc : l'étiquette reste lisible même là où la courbe passe dessous. */}
            <text
              x={xAge(ageRetraite) + 3}
              y={9}
              className="fill-slate-500"
              fontSize={9}
              stroke="#ffffff"
              strokeWidth={2.5}
              paintOrder="stroke"
            >
              retraite {ageRetraite}
            </text>
          </>
        )}

        {ageEpuisement !== null && ageEpuisement >= ageDe && ageEpuisement <= ageA && (
          <line x1={xAge(ageEpuisement)} y1={0} x2={xAge(ageEpuisement)} y2={plotH} stroke="#ef4444" strokeWidth={1.5} />
        )}

        <text x={0} y={H - 3} className="fill-slate-400" fontSize={9}>
          {ageDe} ans
        </text>
        <text x={W} y={H - 3} textAnchor="end" className="fill-slate-400" fontSize={9}>
          {ageA} ans
        </text>
      </svg>
      <p className="mt-1 text-xs text-slate-500">
        Sommet du patrimoine : <span className="chiffres font-medium text-slate-600">{formatDollarsCompact(maxY)}</span>
      </p>
    </div>
  );
}
