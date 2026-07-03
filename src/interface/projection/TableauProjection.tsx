import type { AnneeProjection } from '../../moteur';
import { formatDollars } from '../format';

interface TableauProps {
  annees: readonly AnneeProjection[];
  reel: boolean;
}

export function TableauProjection({ annees, reel }: TableauProps) {
  const f = (a: AnneeProjection, valeur: number) => (reel ? valeur * a.deflateurReel : valeur);

  return (
    <div className="max-h-[28rem] overflow-auto rounded-xl ring-1 ring-slate-200">
      <table className="w-full text-sm">
        <thead className="text-xs text-slate-500 [&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-slate-50">
          <tr>
            <th className="px-3 py-2 text-left font-medium">Âge</th>
            <th className="px-3 py-2 text-left font-medium">Phase</th>
            <th className="px-3 py-2 text-right font-medium">Revenu disponible</th>
            <th className="px-3 py-2 text-right font-medium">Impôt</th>
            <th className="px-3 py-2 text-right font-medium">Valeur nette</th>
          </tr>
        </thead>
        <tbody className="chiffres divide-y divide-slate-100">
          {annees.map((a) => (
            <tr key={a.annee} className={a.phase === 'decaissement' ? 'bg-marque-50/30' : ''}>
              <td className="px-3 py-1.5 text-left text-slate-700">{a.age}</td>
              <td className="px-3 py-1.5 text-left">
                <span
                  className={`inline-block rounded-full px-2 py-0.5 text-xs ${
                    a.phase === 'accumulation'
                      ? 'bg-sky-100 text-sky-700'
                      : 'bg-marque-100 text-marque-700'
                  }`}
                >
                  {a.phase === 'accumulation' ? 'Épargne' : 'Retraite'}
                </span>
              </td>
              <td className="px-3 py-1.5 text-right text-slate-700">{formatDollars(f(a, a.revenuDisponible))}</td>
              <td className="px-3 py-1.5 text-right text-slate-500">{formatDollars(f(a, a.impotTotal))}</td>
              <td className="px-3 py-1.5 text-right font-medium text-slate-900">{formatDollars(f(a, a.valeurNette))}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
