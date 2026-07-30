import { useEffect, useState } from 'react';
import type { AnneeProjection } from '../../moteur';
import { BlocDepenses, BlocDisponible, BlocDroits, BlocImpotFiscal, BlocValeurNette, BlocVentes } from './detailBriques';

/** Agrégat décomposable au clic. */
export type AgregatDrawer = 'disponible' | 'impot' | 'valeurNette' | 'depenses' | 'vente' | 'droitsCeli' | 'droitsReer';

/** Une vue du drawer : quel agrégat, pour quelle année. */
export interface VueDrawer {
  agregat: AgregatDrawer;
  annee: AnneeProjection;
}

const TITRES: Record<AgregatDrawer, string> = {
  disponible: 'Revenu disponible',
  impot: 'Impôt',
  valeurNette: 'Valeur nette',
  depenses: 'Dépenses',
  vente: 'Vente immobilière',
  droitsCeli: 'Droits CELI',
  droitsReer: 'Droits REER',
};

/** Les droits de cotisation sont toujours nominaux : la bascule d'affichage ne les concerne pas. */
const TOUJOURS_NOMINAL: readonly AgregatDrawer[] = ['droitsCeli', 'droitsReer'];

/** Panneau latéral de drill-down, récursif (fil d'Ariane). `vue` = null → fermé. */
export function DrawerDetail({ vue, reel, onClose }: { vue: VueDrawer | null; reel: boolean; onClose: () => void }) {
  const [pile, setPile] = useState<VueDrawer[]>([]);
  useEffect(() => {
    setPile(vue ? [vue] : []);
  }, [vue]);

  const courante = pile[pile.length - 1];
  if (!courante) return null;

  const nominal = TOUJOURS_NOMINAL.includes(courante.agregat);
  const facteur = reel && !nominal ? courante.annee.deflateurReel : 1;
  const d = courante.annee.detail!;
  const pousser = (agregat: AgregatDrawer) => setPile((p) => [...p, { agregat, annee: courante.annee }]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-voile backdrop-blur-[1px]" onClick={onClose} />
      <div className="relative flex h-full w-full max-w-md flex-col bg-carte shadow-2xl">
        <div className="flex items-center justify-between border-b border-filet p-4">
          <div className="flex flex-wrap items-center gap-1.5">
            {pile.map((v, i) => (
              <span key={i} className="flex items-center gap-1.5">
                {i > 0 && <span className="text-doux">›</span>}
                <button
                  type="button"
                  onClick={() => setPile((p) => p.slice(0, i + 1))}
                  className={`text-sm ${i === pile.length - 1 ? 'font-semibold text-titre' : 'text-doux hover:text-corps'}`}
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
            className="flex h-7 w-7 items-center justify-center rounded-full text-doux transition hover:bg-panneau hover:text-corps"
          >
            ✕
          </button>
        </div>

        <div className="border-b border-filet px-4 py-2 text-xs text-doux">
          {courante.annee.age} ans · {courante.annee.annee} ·{' '}
          {nominal ? 'dollars nominaux (toujours)' : reel ? "dollars d'aujourd'hui" : 'dollars nominaux'}
        </div>

        <div className="flex-1 overflow-auto p-4">
          {courante.agregat === 'disponible' && <BlocDisponible d={d.disponible} facteur={facteur} onLien={pousser} />}
          {courante.agregat === 'impot' && <BlocImpotFiscal t={d.impot} facteur={facteur} />}
          {courante.agregat === 'valeurNette' && (
            <BlocValeurNette
              v={d.valeurNette}
              total={courante.annee.valeurNette}
              facteur={facteur}
              onImpot={() => pousser('impot')}
            />
          )}
          {courante.agregat === 'vente' && (
            <BlocVentes
              d={d.disponible}
              facteur={facteur}
              accumulation={courante.annee.phase === 'accumulation'}
              onImpot={() => pousser('impot')}
            />
          )}
          {courante.agregat === 'depenses' && (
            <BlocDepenses d={d.disponible} facteur={facteur} reel={reel} onRevenusNets={() => pousser('disponible')} />
          )}
          {courante.agregat === 'droitsCeli' && <BlocDroits d={d.droits.celi} age={courante.annee.age} celi />}
          {courante.agregat === 'droitsReer' && <BlocDroits d={d.droits.reer} age={courante.annee.age} celi={false} />}
        </div>
      </div>
    </div>
  );
}
