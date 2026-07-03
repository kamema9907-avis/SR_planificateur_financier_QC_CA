import type { AnneeProjection, TypeCompte } from '../../moteur';
import { formatDollars } from '../format';

interface TableauComptesProps {
  annees: readonly AnneeProjection[];
  reel: boolean;
}

const LIBELLES: Record<TypeCompte, string> = {
  REER: 'REER',
  FERR: 'FERR',
  CELI: 'CELI',
  CELIAPP: 'CELIAPP',
  CRI: 'CRI',
  FRV: 'FRV',
  NON_ENREGISTRE: 'Non-enr.',
  REEE: 'REEE',
};

const ORDRE_TYPES: readonly TypeCompte[] = [
  'REER',
  'FERR',
  'CRI',
  'FRV',
  'CELI',
  'CELIAPP',
  'NON_ENREGISTRE',
  'REEE',
];

export function TableauComptes({ annees, reel }: TableauComptesProps) {
  const f = (a: AnneeProjection, valeur: number) => (reel ? valeur * a.deflateurReel : valeur);

  // N'afficher que les comptes réellement utilisés (solde non nul à un moment).
  const typesActifs = ORDRE_TYPES.filter((t) => annees.some((a) => a.soldes[t] > 0.5));

  const retraits = (a: AnneeProjection) =>
    a.retraitsEnregistres + a.retraitsNonEnregistres + a.retraitsLibresImpot;

  return (
    <div className="max-h-[28rem] overflow-auto rounded-xl ring-1 ring-slate-200">
      <table className="w-full text-sm">
        <thead className="text-xs text-slate-500 [&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-slate-50">
          <tr>
            <th className="px-3 py-2 text-left font-medium">Âge</th>
            {typesActifs.map((t) => (
              <th key={t} className="px-3 py-2 text-right font-medium">
                {LIBELLES[t]}
              </th>
            ))}
            <th className="px-3 py-2 text-right font-medium text-marque-700">Épargne (+)</th>
            <th className="px-3 py-2 text-right font-medium text-rose-600">Retraits (−)</th>
            <th className="px-3 py-2 text-right font-medium">Valeur nette</th>
          </tr>
        </thead>
        <tbody className="chiffres divide-y divide-slate-100">
          {annees.map((a) => (
            <tr key={a.annee} className={a.phase === 'decaissement' ? 'bg-marque-50/30' : ''}>
              <td className="px-3 py-1.5 text-left text-slate-700">{a.age}</td>
              {typesActifs.map((t) => (
                <td key={t} className="px-3 py-1.5 text-right text-slate-600">
                  {a.soldes[t] > 0.5 ? formatDollars(f(a, a.soldes[t])) : '—'}
                </td>
              ))}
              <td className="px-3 py-1.5 text-right text-marque-700">
                {a.cotisations > 0.5 ? formatDollars(f(a, a.cotisations)) : '—'}
              </td>
              <td className="px-3 py-1.5 text-right text-rose-600">
                {retraits(a) > 0.5 ? formatDollars(f(a, retraits(a))) : '—'}
              </td>
              <td className="px-3 py-1.5 text-right font-medium text-slate-900">
                {formatDollars(f(a, a.valeurNette))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
