/** Briques d'affichage partagées par les drawers de drill-down (solo et couple). */
import type { DetailDisponible, DetailImpotAnnee, DetailValeurNette, Poste } from '../../moteur';
import { formatDollars, formatPourcent } from '../format';

/** Une ligne « poste » (montant signé) ; cliquable si le poste porte un lien de drill-down. */
export function LignePoste({ poste, facteur, onLien }: { poste: Poste; facteur: number; onLien?: () => void }) {
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
export function Section({ titre, postes, facteur, onLienImpot }: { titre: string; postes: readonly Poste[]; facteur: number; onLienImpot?: () => void }) {
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
export function LigneTotal({ libelle, montant, facteur, accent }: { libelle: string; montant: number; facteur: number; accent?: boolean }) {
  return (
    <div className={`mb-3 flex items-center justify-between rounded-lg px-3 py-2 ${accent ? 'bg-marque-50 ring-1 ring-marque-500/15' : 'bg-slate-50'}`}>
      <span className={`text-sm font-semibold ${accent ? 'text-marque-700' : 'text-slate-700'}`}>{libelle}</span>
      <span className={`chiffres text-sm font-bold tabular-nums ${accent ? 'text-marque-700' : 'text-slate-900'}`}>
        {formatDollars(montant * facteur)}
      </span>
    </div>
  );
}

/** Cascade du revenu disponible : entrées − sorties = nets, puis dépenses / surplus / destination. */
export function BlocDisponible({ d, facteur, onImpot }: { d: DetailDisponible; facteur: number; onImpot: () => void }) {
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

/** Détail fiscal d'une personne : revenu imposable, impôt fédéral/QC, décès, taux. */
export function BlocImpotFiscal({ t, facteur, titre }: { t: DetailImpotAnnee; facteur: number; titre?: string }) {
  return (
    <>
      {titre && <p className="mb-2 text-sm font-semibold text-slate-700">{titre}</p>}
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
      <div className="mt-2 mb-4 flex gap-4 border-t border-slate-100 pt-3 text-xs text-slate-500">
        <span>Taux moyen : <strong className="text-slate-700">{formatPourcent(t.tauxMoyen)}</strong></span>
        <span>Taux marginal : <strong className="text-slate-700">{formatPourcent(t.tauxMarginal)}</strong></span>
      </div>
    </>
  );
}

/** Valeur nette : comptes + immobilier + total. */
export function BlocValeurNette({ v, total, facteur }: { v: DetailValeurNette; total: number; facteur: number }) {
  return (
    <>
      <Section titre="Comptes de placement" postes={v.comptes} facteur={facteur} />
      <Section titre="Immobilier (équité : valeur − hypothèque)" postes={v.immobilier} facteur={facteur} />
      <LigneTotal libelle="Valeur nette" montant={total} facteur={facteur} accent />
    </>
  );
}
