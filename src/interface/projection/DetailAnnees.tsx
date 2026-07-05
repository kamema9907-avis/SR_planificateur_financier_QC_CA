import { useState, type ReactNode } from 'react';
import { sommePostes, type AnneeProjection, type TypeCompte } from '../../moteur';
import { formatDollars, formatPourcent } from '../format';
import { DrawerDetail, type AgregatDrawer, type VueDrawer } from './DrawerDetail';

interface Props {
  annees: readonly AnneeProjection[];
  reel: boolean;
  ageEpuisement: number | null;
}

const LIBELLES: Record<TypeCompte, string> = {
  REER: 'REER', FERR: 'FERR', CELI: 'CELI', CELIAPP: 'CELIAPP', CRI: 'CRI', FRV: 'FRV',
  NON_ENREGISTRE: 'Non-enr.', REEE: 'REEE',
};
const ORDRE_TYPES: readonly TypeCompte[] = ['REER', 'FERR', 'CRI', 'FRV', 'CELI', 'CELIAPP', 'NON_ENREGISTRE', 'REEE'];

/** Définition d'une colonne d'un tableau détaillé. */
interface Colonne {
  titre: string;
  v: (a: AnneeProjection) => number | null;
  agregat?: AgregatDrawer;
  format?: 'pourcent';
  accent?: boolean;
}

const retraits = (a: AnneeProjection) => a.retraitsEnregistres + a.retraitsNonEnregistres + a.retraitsLibresImpot;

const COLS_REVENUS: Colonne[] = [
  { titre: 'Emploi / travail', v: (a) => a.revenuEmploi },
  { titre: 'RRQ', v: (a) => a.rrq },
  { titre: 'SV', v: (a) => a.sv },
  { titre: 'Rentes', v: (a) => a.renteEmployeur },
  { titre: 'Retraits', v: retraits },
  { titre: 'Revenus nets', v: (a) => a.detail?.disponible.revenusNets ?? a.revenuDisponible, agregat: 'disponible', accent: true },
  { titre: 'Dépenses', v: (a) => a.detail?.disponible.depenses ?? null },
  { titre: 'Surplus →', v: (a) => a.detail?.disponible.surplus ?? null, agregat: 'disponible' },
];

const COLS_IMPOT: Colonne[] = [
  { titre: 'Rev. imposable', v: (a) => (a.detail ? sommePostes(a.detail.impot.revenuImposable) : null) },
  { titre: 'Impôt féd.', v: (a) => (a.detail ? sommePostes(a.detail.impot.federal) : null) },
  { titre: 'Impôt QC', v: (a) => (a.detail ? sommePostes(a.detail.impot.quebec) : null) },
  { titre: 'Impôt total', v: (a) => a.impotTotal, agregat: 'impot', accent: true },
  { titre: 'Taux moyen', v: (a) => a.detail?.impot.tauxMoyen ?? null, format: 'pourcent' },
  { titre: 'Taux marg.', v: (a) => a.detail?.impot.tauxMarginal ?? null, format: 'pourcent' },
];

const COLS_PATRIMOINE_FIN: Colonne[] = [
  { titre: 'Épargne', v: (a) => a.cotisations },
  { titre: 'Équité immo', v: (a) => a.equiteImmobiliere },
  { titre: 'Valeur nette', v: (a) => a.valeurNette, agregat: 'valeurNette', accent: true },
];

/** Petites icônes signalant les événements spéciaux d'une année. */
function Badges({ a, ageEpuisement }: { a: AnneeProjection; ageEpuisement: number | null }) {
  const badges: { e: string; t: string }[] = [];
  const d = a.detail;
  if (d && d.impot.impotDeces > 0.5) badges.push({ e: '💀', t: 'Décès — impôt sur dispositions présumées' });
  const vente = d?.disponible.entrees.find((p) => p.libelle.startsWith('Produit de vente') && p.montant > 0.5);
  if (vente) badges.push({ e: '🏠', t: 'Vente / downsizing immobilier' });
  if (d && d.disponible.surplus > 0.5) badges.push({ e: '💰', t: 'Surplus réinvesti' });
  if (ageEpuisement != null && a.age === ageEpuisement) badges.push({ e: '⚠️', t: 'Capital épuisé' });
  if (badges.length === 0) return null;
  return (
    <span className="ml-1 inline-flex gap-0.5">
      {badges.map((b, i) => (
        <span key={i} title={b.t} className="text-xs">{b.e}</span>
      ))}
    </span>
  );
}

/** Une cellule : « — » si nulle, sinon un montant (ou %), cliquable si liée à un agrégat. */
function Cellule({ a, col, reel, onOuvrir }: { a: AnneeProjection; col: Colonne; reel: boolean; onOuvrir: (v: VueDrawer) => void }) {
  const val = col.v(a);
  if (val == null || (col.format !== 'pourcent' && Math.abs(val) < 0.5)) {
    return <span className="text-slate-300">—</span>;
  }
  const texte = col.format === 'pourcent' ? formatPourcent(val) : formatDollars((reel ? a.deflateurReel : 1) * val);
  if (col.agregat) {
    return (
      <button
        type="button"
        onClick={() => onOuvrir({ agregat: col.agregat!, annee: a })}
        className="chiffres font-medium text-marque-700 underline decoration-marque-300 decoration-dotted underline-offset-2 transition hover:decoration-marque-600"
      >
        {texte}
      </button>
    );
  }
  return <span className={`chiffres ${col.accent ? 'font-semibold text-slate-900' : 'text-slate-600'}`}>{texte}</span>;
}

function Tableau({ annees, colonnes, reel, ageEpuisement, onOuvrir }: {
  annees: readonly AnneeProjection[];
  colonnes: Colonne[];
  reel: boolean;
  ageEpuisement: number | null;
  onOuvrir: (v: VueDrawer) => void;
}) {
  return (
    <div className="max-h-[30rem] overflow-auto rounded-xl ring-1 ring-slate-200">
      <table className="w-full text-sm">
        <thead className="text-xs text-slate-500 [&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-slate-50">
          <tr>
            <th className="px-3 py-2 text-left font-medium">Âge</th>
            {colonnes.map((c) => (
              <th key={c.titre} className="px-3 py-2 text-right font-medium whitespace-nowrap">{c.titre}</th>
            ))}
          </tr>
        </thead>
        <tbody className="chiffres divide-y divide-slate-100">
          {annees.map((a) => (
            <tr key={a.annee} className={a.phase === 'decaissement' ? 'bg-marque-50/30' : ''}>
              <td className="px-3 py-1.5 text-left whitespace-nowrap text-slate-700">
                {a.age}
                <Badges a={a} ageEpuisement={ageEpuisement} />
              </td>
              {colonnes.map((c) => (
                <td key={c.titre} className="px-3 py-1.5 text-right whitespace-nowrap">
                  <Cellule a={a} col={c} reel={reel} onOuvrir={onOuvrir} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BlocTableau({ titre, aide, children }: { titre: string; aide: string; children: ReactNode }) {
  return (
    <div>
      <h4 className="text-sm font-semibold text-slate-700">{titre}</h4>
      <p className="mb-2 text-xs text-slate-400">{aide}</p>
      {children}
    </div>
  );
}

/** Tableaux « détail année par année » avec drill-down (drawer) et deux modes d'affichage. */
export function DetailAnnees({ annees, reel, ageEpuisement }: Props) {
  const [modeComplet, setModeComplet] = useState(false);
  const [drawer, setDrawer] = useState<VueDrawer | null>(null);

  const typesActifs = ORDRE_TYPES.filter((t) => annees.some((a) => a.soldes[t] > 0.5));
  const colsComptes: Colonne[] = typesActifs.map((t) => ({ titre: LIBELLES[t], v: (a) => (a.soldes[t] > 0.5 ? a.soldes[t] : null) }));

  const ong = (actif: boolean) =>
    `rounded-md px-3 py-1 text-xs font-medium transition ${actif ? 'bg-white text-marque-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-slate-400">Cliquez un montant <span className="text-marque-600 underline decoration-dotted">souligné</span> pour ouvrir le détail du calcul.</p>
        <div className="inline-flex rounded-lg bg-slate-100 p-0.5 ring-1 ring-slate-200">
          <button type="button" onClick={() => setModeComplet(false)} className={ong(!modeComplet)}>Par thème</button>
          <button type="button" onClick={() => setModeComplet(true)} className={ong(modeComplet)}>Tout voir</button>
        </div>
      </div>

      {modeComplet ? (
        <BlocTableau titre="Tableau complet" aide="Toutes les colonnes sur une même ligne — défilement horizontal.">
          <Tableau annees={annees} colonnes={[...COLS_REVENUS, ...COLS_IMPOT, ...colsComptes, ...COLS_PATRIMOINE_FIN]} reel={reel} ageEpuisement={ageEpuisement} onOuvrir={setDrawer} />
        </BlocTableau>
      ) : (
        <div className="space-y-5">
          <BlocTableau titre="Revenus & liquidités" aide="Ce que vous encaissez, ce qui reste (revenus nets), et le surplus réinvesti.">
            <Tableau annees={annees} colonnes={COLS_REVENUS} reel={reel} ageEpuisement={ageEpuisement} onOuvrir={setDrawer} />
          </BlocTableau>
          <BlocTableau titre="Impôt" aide="Revenu imposable, impôt fédéral et québécois, taux moyen et marginal.">
            <Tableau annees={annees} colonnes={COLS_IMPOT} reel={reel} ageEpuisement={ageEpuisement} onOuvrir={setDrawer} />
          </BlocTableau>
          <BlocTableau titre="Comptes & patrimoine" aide="Solde de chaque compte, épargne versée, équité immobilière et valeur nette.">
            <Tableau annees={annees} colonnes={[...colsComptes, ...COLS_PATRIMOINE_FIN]} reel={reel} ageEpuisement={ageEpuisement} onOuvrir={setDrawer} />
          </BlocTableau>
        </div>
      )}

      <DrawerDetail vue={drawer} reel={reel} onClose={() => setDrawer(null)} />
    </div>
  );
}
