import { useEffect, useState } from 'react';
import type { AnneeProjection, Poste } from '../../moteur';
import { formatDollars, formatPourcent } from '../format';

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

/** Une ligne « poste » (montant signé) ; cliquable si le poste porte un lien de drill-down. */
function LignePoste({ poste, facteur, onLien }: { poste: Poste; facteur: number; onLien?: () => void }) {
  const cliquable = poste.lien != null && onLien != null;
  return (
    <button
      type="button"
      disabled={!cliquable}
      onClick={onLien}
      className={`flex w-full items-center justify-between py-1.5 text-left ${
        cliquable ? '-mx-2 cursor-pointer rounded-md px-2 hover:bg-marque-50' : 'cursor-default'
      }`}
    >
      <span className="text-sm text-slate-600">
        {poste.libelle}
        {cliquable && <span className="ml-1.5 text-xs font-medium text-marque-500">détailler ›</span>}
      </span>
      <span className={`chiffres text-sm tabular-nums ${poste.montant < 0 ? 'text-rose-600' : 'text-slate-800'}`}>
        {formatDollars(poste.montant * facteur)}
      </span>
    </button>
  );
}

/** Une section titrée (liste de postes). */
function Section({ titre, postes, facteur, onLienImpot }: { titre: string; postes: readonly Poste[]; facteur: number; onLienImpot?: () => void }) {
  if (postes.length === 0) return null;
  return (
    <div className="mb-4">
      <p className="mb-1 text-xs font-semibold tracking-wide text-slate-400 uppercase">{titre}</p>
      <div className="divide-y divide-slate-50">
        {postes.map((p, i) => (
          <LignePoste key={i} poste={p} facteur={facteur} onLien={p.lien === 'impot' ? onLienImpot : undefined} />
        ))}
      </div>
    </div>
  );
}

/** Une ligne « total » mise en évidence. */
function LigneTotal({ libelle, montant, facteur, accent }: { libelle: string; montant: number; facteur: number; accent?: boolean }) {
  return (
    <div className={`mb-3 flex items-center justify-between rounded-lg px-3 py-2 ${accent ? 'bg-marque-50 ring-1 ring-marque-500/15' : 'bg-slate-50'}`}>
      <span className={`text-sm font-semibold ${accent ? 'text-marque-700' : 'text-slate-700'}`}>{libelle}</span>
      <span className={`chiffres text-sm font-bold tabular-nums ${accent ? 'text-marque-700' : 'text-slate-900'}`}>
        {formatDollars(montant * facteur)}
      </span>
    </div>
  );
}

function ContenuDisponible({ annee, facteur, onImpot }: { annee: AnneeProjection; facteur: number; onImpot: () => void }) {
  const d = annee.detail!.disponible;
  return (
    <>
      <Section titre="Entrées de liquidités" postes={d.entrees} facteur={facteur} />
      <Section titre="Sorties" postes={d.sorties} facteur={facteur} onLienImpot={onImpot} />
      <LigneTotal libelle="Revenus nets" montant={d.revenusNets} facteur={facteur} />
      {d.depenses > 0.5 && (
        <>
          <LigneTotal libelle="− Dépenses visées" montant={-d.depenses} facteur={facteur} />
          <LigneTotal libelle="= Surplus épargné" montant={d.surplus} facteur={facteur} accent />
          <Section titre="Réinvesti dans" postes={d.destinationSurplus} facteur={facteur} />
        </>
      )}
    </>
  );
}

function ContenuImpot({ annee, facteur }: { annee: AnneeProjection; facteur: number }) {
  const t = annee.detail!.impot;
  return (
    <>
      <Section titre="Revenu imposable (par source)" postes={t.revenuImposable} facteur={facteur} />
      <Section titre="Impôt fédéral" postes={t.federal} facteur={facteur} />
      <Section titre="Impôt du Québec" postes={t.quebec} facteur={facteur} />
      <LigneTotal libelle="Impôt de l'année" montant={t.impotCourant} facteur={facteur} />
      {t.impotDeces > 0.5 && (
        <>
          <Section titre="Impôt au décès — dispositions présumées" postes={t.detailDeces} facteur={facteur} />
          <LigneTotal libelle="Impôt au décès" montant={t.impotDeces} facteur={facteur} accent />
        </>
      )}
      <div className="mt-2 flex gap-4 border-t border-slate-100 pt-3 text-xs text-slate-500">
        <span>Taux moyen : <strong className="text-slate-700">{formatPourcent(t.tauxMoyen)}</strong></span>
        <span>Taux marginal : <strong className="text-slate-700">{formatPourcent(t.tauxMarginal)}</strong></span>
      </div>
    </>
  );
}

function ContenuValeurNette({ annee, facteur }: { annee: AnneeProjection; facteur: number }) {
  const v = annee.detail!.valeurNette;
  return (
    <>
      <Section titre="Comptes de placement" postes={v.comptes} facteur={facteur} />
      <Section titre="Immobilier (équité : valeur − hypothèque)" postes={v.immobilier} facteur={facteur} />
      <LigneTotal libelle="Valeur nette" montant={annee.valeurNette} facteur={facteur} accent />
    </>
  );
}

/** Panneau latéral de drill-down, récursif (fil d'Ariane). `vue` = null → fermé. */
export function DrawerDetail({ vue, reel, onClose }: { vue: VueDrawer | null; reel: boolean; onClose: () => void }) {
  const [pile, setPile] = useState<VueDrawer[]>([]);
  useEffect(() => {
    setPile(vue ? [vue] : []);
  }, [vue]);

  const courante = pile[pile.length - 1];
  if (!courante) return null;

  const facteur = reel ? courante.annee.deflateurReel : 1;
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
          {courante.agregat === 'disponible' && (
            <ContenuDisponible annee={courante.annee} facteur={facteur} onImpot={() => pousser('impot')} />
          )}
          {courante.agregat === 'impot' && <ContenuImpot annee={courante.annee} facteur={facteur} />}
          {courante.agregat === 'valeurNette' && <ContenuValeurNette annee={courante.annee} facteur={facteur} />}
        </div>
      </div>
    </div>
  );
}
