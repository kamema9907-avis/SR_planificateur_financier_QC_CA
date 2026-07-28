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
  { titre: 'Dépenses', v: (a) => a.detail?.disponible.depenses ?? null, agregat: 'depenses' },
  { titre: 'Surplus →', v: (a) => a.detail?.disponible.surplus ?? null, agregat: 'disponible' },
];

/**
 * Événements marquants d'une année. Le badge de vente **manquait** au tableau du ménage : une vente
 * n'y était pas même signalée. Il est ici, et cliquable — c'est le seul repère qui la rende
 * trouvable en balayant la colonne des âges.
 */
function Badges({ a, anneeEpuisement, onVente }: {
  a: AnneeCouple;
  anneeEpuisement: number | null;
  onVente: () => void;
}) {
  const badges: { e: string; t: string; onClic?: () => void }[] = [];
  if (a.phase === 'survie') badges.push({ e: '🕊️', t: 'Phase de survie (un seul conjoint)' });
  if (a.detail && a.detail.disponible.ventes.length > 0) {
    const noms = a.detail.disponible.ventes.map((v) => v.nom).join(', ');
    badges.push({ e: '🏠', t: `Vente : ${noms} — voir le détail`, onClic: onVente });
  }
  const heritage = a.detail?.disponible.entrees.find((p) => p.libelle.startsWith('Héritage') && p.montant > 0.5);
  if (heritage) badges.push({ e: '🎁', t: 'Héritage reçu (non imposable)' });
  if (a.detail && a.detail.disponible.surplus > 0.5) badges.push({ e: '💰', t: 'Surplus réinvesti' });
  if (anneeEpuisement != null && a.annee === anneeEpuisement) badges.push({ e: '⚠️', t: 'Capital épuisé' });
  if (badges.length === 0) return null;
  return (
    <span className="ml-1 inline-flex gap-0.5">
      {badges.map((b, i) =>
        b.onClic ? (
          <button
            key={i}
            type="button"
            onClick={b.onClic}
            aria-label={b.t}
            title={b.t}
            className="rounded text-xs transition hover:scale-125 focus-visible:ring-2 focus-visible:ring-marque focus-visible:outline-none"
          >
            {b.e}
          </button>
        ) : (
          <span key={i} title={b.t} className="text-xs">{b.e}</span>
        ),
      )}
    </span>
  );
}

function Cellule({ a, col, reel, onOuvrir }: { a: AnneeCouple; col: Colonne; reel: boolean; onOuvrir: (v: VueDrawerCouple) => void }) {
  const val = col.v(a);
  if (val == null || (col.format !== 'pourcent' && Math.abs(val) < 0.5)) return <span className="text-doux">—</span>;
  const texte = col.format === 'pourcent' ? formatPourcent(val) : formatDollars((reel ? a.deflateurReel : 1) * val);
  if (col.agregat) {
    return (
      <button
        type="button"
        onClick={() => onOuvrir({ agregat: col.agregat!, annee: a })}
        className="chiffres font-medium text-marque underline decoration-marque/50 decoration-dotted underline-offset-2 transition hover:decoration-marque"
      >
        {texte}
      </button>
    );
  }
  return <span className={`chiffres ${col.accent ? 'font-semibold text-titre' : 'text-corps'}`}>{texte}</span>;
}

function Tableau({ annees, colonnes, reel, anneeEpuisement, onOuvrir }: {
  annees: readonly AnneeCouple[]; colonnes: Colonne[]; reel: boolean; anneeEpuisement: number | null; onOuvrir: (v: VueDrawerCouple) => void;
}) {
  return (
    <div className="max-h-[30rem] overflow-auto rounded-xl ring-1 ring-bordure">
      <table className="w-full text-sm">
        <thead className="text-xs text-doux [&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-champ">
          <tr>
            <th className="px-3 py-2 text-left font-medium">Âges</th>
            {colonnes.map((c) => (
              <th key={c.titre} className="px-3 py-2 text-right font-medium whitespace-nowrap">{c.titre}</th>
            ))}
          </tr>
        </thead>
        <tbody className="chiffres divide-y divide-filet">
          {annees.map((a) => (
            <tr key={a.annee} className={a.phase !== 'accumulation' ? 'bg-marque-fond/30' : ''}>
              <td className="px-3 py-1.5 text-left whitespace-nowrap text-corps">
                {`${a.age1 ?? '—'} / ${a.age2 ?? '—'}`}
                <Badges a={a} anneeEpuisement={anneeEpuisement} onVente={() => onOuvrir({ agregat: 'vente', annee: a })} />
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
      <h4 className="text-sm font-semibold text-corps">{titre}</h4>
      <p className="mb-2 text-xs text-doux">{aide}</p>
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
    `rounded-md px-3 py-1 text-xs font-medium transition ${actif ? 'bg-carte text-marque shadow-sm' : 'text-corps hover:text-titre'}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-doux">Cliquez un montant <span className="text-marque underline decoration-dotted">souligné</span> pour ouvrir le détail (dont le fractionnement).</p>
        <div className="sansimpression inline-flex rounded-lg bg-panneau p-0.5 ring-1 ring-bordure">
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
