import { useEffect, useState } from 'react';
import type { AnneeProjection } from '../../moteur';
import { BlocDisponible, BlocImpotFiscal, BlocValeurNette } from './detailBriques';

/** Agrégat décomposable au clic. */
export type AgregatDrawer = 'disponible' | 'impot' | 'valeurNette';

/** Une vue du drawer : quel agrégat, pour quelle année. */
export interface VueDrawer {
  agregat: AgregatDrawer;
  annee: AnneeProjection;
}

const TITRES: Record<AgregatDrawer, string> = {
  disponible: 'Revenu disponible',
  impot: 'Impôt',
  valeurNette: 'Valeur nette',
};

/** Panneau latéral de drill-down, récursif (fil d'Ariane). `vue` = null → fermé. */
export function DrawerDetail({ vue, reel, onClose }: { vue: VueDrawer | null; reel: boolean; onClose: () => void }) {
  const [pile, setPile] = useState<VueDrawer[]>([]);
  useEffect(() => {
    setPile(vue ? [vue] : []);
  }, [vue]);

  const courante = pile[pile.length - 1];
  if (!courante) return null;

  const facteur = reel ? courante.annee.deflateurReel : 1;
  const d = courante.annee.detail!;
  const pousser = (agregat: AgregatDrawer) => setPile((p) => [...p, { agregat, annee: courante.annee }]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-slate-900/20 backdrop-blur-[1px]" onClick={onClose} />
      <div className="relative flex h-full w-full max-w-md flex-col bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 p-4">
          <div className="flex flex-wrap items-center gap-1.5">
            {pile.map((v, i) => (
              <span key={i} className="flex items-center gap-1.5">
                {i > 0 && <span className="text-slate-300">›</span>}
                <button
                  type="button"
                  onClick={() => setPile((p) => p.slice(0, i + 1))}
                  className={`text-sm ${i === pile.length - 1 ? 'font-semibold text-slate-800' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  {TITRES[v.agregat]}
                </button>
              </span>
            ))}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="flex h-7 w-7 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            ✕
          </button>
        </div>

        <div className="border-b border-slate-100 px-4 py-2 text-xs text-slate-400">
          {courante.annee.age} ans · {courante.annee.annee} · {reel ? "dollars d'aujourd'hui" : 'dollars nominaux'}
        </div>

        <div className="flex-1 overflow-auto p-4">
          {courante.agregat === 'disponible' && <BlocDisponible d={d.disponible} facteur={facteur} onImpot={() => pousser('impot')} />}
          {courante.agregat === 'impot' && <BlocImpotFiscal t={d.impot} facteur={facteur} />}
          {courante.agregat === 'valeurNette' && <BlocValeurNette v={d.valeurNette} total={courante.annee.valeurNette} facteur={facteur} />}
        </div>
      </div>
    </div>
  );
}
