import { useState, type ReactNode } from 'react';
import type { AnneeCouple, TypeCompte } from '../../moteur';
import { formatDollars, formatPourcent } from '../format';
import { DrawerDetailCouple, type AgregatCouple, type VueDrawerCouple } from './DrawerDetailCouple';

interface Props {
  annees: readonly AnneeCouple[];
  reel: boolean;
  anneeEpuisement: number | null;
}

const LIBELLES: Record<TypeCompte, string> = {
  REER: 'REER', FERR: 'FERR', CELI: 'CELI', CELIAPP: 'CELIAPP', CRI: 'CRI', FRV: 'FRV',
  NON_ENREGISTRE: 'Non-enr.', REEE: 'REEE',
};
const ORDRE_TYPES: readonly TypeCompte[] = ['REER', 'FERR', 'CRI', 'FRV', 'CELI', 'CELIAPP', 'NON_ENREGISTRE', 'REEE'];

interface Colonne {
  titre: string;
  v: (a: AnneeCouple) => number | null;
  agregat?: AgregatCouple;
  format?: 'pourcent';
  accent?: boolean;
}

const COLS_REVENUS: Colonne[] = [
  { titre: 'Revenus nets', v: (a) => a.detail?.disponible.revenusNets ?? a.revenuDisponible, agregat: 'disponible', accent: true },
  { titre: 'Dépenses', v: (a) => a.detail?.disponible.depenses ?? null },
  { titre: 'Surplus →', v: (a) => a.detail?.disponible.surplus ?? null, agregat: 'disponible' },
];

function Badges({ a, anneeEpuisement }: { a: AnneeCouple; anneeEpuisement: number | null }) {
  const badges: { e: string; t: string }[] = [];
  if (a.phase === 'survie') badges.push({ e: '🕊️', t: 'Phase de survie (un seul conjoint)' });
  if (a.detail && a.detail.disponible.surplus > 0.5) badges.push({ e: '💰', t: 'Surplus réinvesti' });
  if (anneeEpuisement != null && a.annee === anneeEpuisement) badges.push({ e: '⚠️', t: 'Capital épuisé' });
  if (badges.length === 0) return null;
  return <span className="ml-1 inline-flex gap-0.5">{badges.map((b, i) => <span key={i} title={b.t} className="text-xs">{b.e}</span>)}</span>;
}

function Cellule({ a, col, reel, onOuvrir }: { a: AnneeCouple; col: Colonne; reel: boolean; onOuvrir: (v: VueDrawerCouple) => void }) {
  const val = col.v(a);
  if (val == null || (col.format !== 'pourcent' && Math.abs(val) < 0.5)) return <span className="text-slate-300">—</span>;
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

function Tableau({ annees, colonnes, reel, anneeEpuisement, onOuvrir }: {
  annees: readonly AnneeCouple[]; colonnes: Colonne[]; reel: boolean; anneeEpuisement: number | null; onOuvrir: (v: VueDrawerCouple) => void;
}) {
  return (
    <div className="max-h-[30rem] overflow-auto rounded-xl ring-1 ring-slate-200">
      <table className="w-full text-sm">
        <thead className="text-xs text-slate-500 [&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-slate-50">
          <tr>
            <th className="px-3 py-2 text-left font-medium">Âges</th>
            {colonnes.map((c) => (
              <th key={c.titre} className="px-3 py-2 text-right font-medium whitespace-nowrap">{c.titre}</th>
            ))}
          </tr>
        </thead>
        <tbody className="chiffres divide-y divide-slate-100">
          {annees.map((a) => (
            <tr key={a.annee} className={a.phase !== 'accumulation' ? 'bg-marque-50/30' : ''}>
              <td className="px-3 py-1.5 text-left whitespace-nowrap text-slate-700">
                {`${a.age1 ?? '—'} / ${a.age2 ?? '—'}`}
                <Badges a={a} anneeEpuisement={anneeEpuisement} />
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

/** Tableaux « détail année par année » du couple, avec drill-down et deux modes d'affichage. */
export function DetailAnneesCouple({ annees, reel, anneeEpuisement }: Props) {
  const [modeComplet, setModeComplet] = useState(false);
  const [drawer, setDrawer] = useState<VueDrawerCouple | null>(null);

  const nom1 = annees[0]?.detail?.nom1 ?? 'Conjoint 1';
  const nom2 = annees[0]?.detail?.nom2 ?? 'Conjoint 2';

  const colsImpot: Colonne[] = [
    { titre: `Impôt ${nom1}`, v: (a) => a.detail?.impot1?.impotCourant ?? null },
    { titre: `Impôt ${nom2}`, v: (a) => a.detail?.impot2?.impotCourant ?? null },
    { titre: 'Économie fract.', v: (a) => a.detail?.fractionnement.economie ?? null, agregat: 'fractionnement' },
    { titre: 'Impôt ménage', v: (a) => a.impotTotal, agregat: 'impot', accent: true },
  ];

  const typesActifs = ORDRE_TYPES.filter((t) => annees.some((a) => a.soldes1[t] + a.soldes2[t] > 0.5));
  const colsComptes: Colonne[] = typesActifs.map((t) => ({
    titre: LIBELLES[t],
    v: (a) => (a.soldes1[t] + a.soldes2[t] > 0.5 ? a.soldes1[t] + a.soldes2[t] : null),
  }));
  const colsPatrimoine: Colonne[] = [...colsComptes, { titre: 'Valeur nette', v: (a) => a.valeurNette, agregat: 'valeurNette', accent: true }];

  const ong = (actif: boolean) =>
    `rounded-md px-3 py-1 text-xs font-medium transition ${actif ? 'bg-white text-marque-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-slate-400">Cliquez un montant <span className="text-marque-600 underline decoration-dotted">souligné</span> pour ouvrir le détail (dont le fractionnement).</p>
        <div className="inline-flex rounded-lg bg-slate-100 p-0.5 ring-1 ring-slate-200">
          <button type="button" onClick={() => setModeComplet(false)} className={ong(!modeComplet)}>Par thème</button>
          <button type="button" onClick={() => setModeComplet(true)} className={ong(modeComplet)}>Tout voir</button>
        </div>
      </div>

      {modeComplet ? (
        <BlocTableau titre="Tableau complet" aide="Toutes les colonnes sur une même ligne — défilement horizontal.">
          <Tableau annees={annees} colonnes={[...COLS_REVENUS, ...colsImpot, ...colsPatrimoine]} reel={reel} anneeEpuisement={anneeEpuisement} onOuvrir={setDrawer} />
        </BlocTableau>
      ) : (
        <div className="space-y-5">
          <BlocTableau titre="Revenus & liquidités (ménage)" aide="Ce que le ménage encaisse net, les dépenses, et le surplus réinvesti.">
            <Tableau annees={annees} colonnes={COLS_REVENUS} reel={reel} anneeEpuisement={anneeEpuisement} onOuvrir={setDrawer} />
          </BlocTableau>
          <BlocTableau titre="Impôt & fractionnement" aide="Impôt de chaque conjoint, économie du fractionnement, impôt total du ménage.">
            <Tableau annees={annees} colonnes={colsImpot} reel={reel} anneeEpuisement={anneeEpuisement} onOuvrir={setDrawer} />
          </BlocTableau>
          <BlocTableau titre="Comptes & patrimoine" aide="Soldes combinés des deux conjoints et valeur nette du ménage.">
            <Tableau annees={annees} colonnes={colsPatrimoine} reel={reel} anneeEpuisement={anneeEpuisement} onOuvrir={setDrawer} />
          </BlocTableau>
        </div>
      )}

      <DrawerDetailCouple vue={drawer} reel={reel} onClose={() => setDrawer(null)} />
    </div>
  );
}
