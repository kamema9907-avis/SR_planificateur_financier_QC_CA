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
  /** `annee` : nombre brut, sans séparateur ni symbole (2036, pas « 2 036 $ »). */
  format?: 'pourcent' | 'annee';
  accent?: boolean;
  /** Échappe à la bascule « dollars d'aujourd'hui » : la colonne reste en dollars de l'année. */
  nominal?: boolean;
  /** Affiche 0 $ au lieu de « — » : un zéro peut être l'information cherchée (aucun droit restant). */
  montrerZero?: boolean;
}

const retraits = (a: AnneeProjection) => a.retraitsEnregistres + a.retraitsNonEnregistres + a.retraitsLibresImpot;

const COLS_REVENUS: Colonne[] = [
  { titre: 'Emploi / travail', v: (a) => a.revenuEmploi },
  { titre: 'RRQ', v: (a) => a.rrq },
  { titre: 'SV', v: (a) => a.sv },
  { titre: 'Rentes', v: (a) => a.renteEmployeur },
  { titre: 'Retraits', v: retraits },
  { titre: 'Revenus nets', v: (a) => a.detail?.disponible.revenusNets ?? a.revenuDisponible, agregat: 'disponible', accent: true },
  { titre: 'Dépenses', v: (a) => a.detail?.disponible.depenses ?? null, agregat: 'depenses' },
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

/**
 * Droits de cotisation restants au 31 décembre.
 *
 * `nominal` : un droit est une quantité légale de l'année, pas un pouvoir d'achat — c'est le chiffre
 * de l'avis de l'ARC. `montrerZero` : « aucun droit REER » est précisément ce qu'on veut pouvoir
 * lire, et cliquer, plutôt qu'un tiret muet.
 */
const COL_DROITS_CELI: Colonne = { titre: 'Droits CELI', v: (a) => a.detail?.droits.celi.restant ?? null, agregat: 'droitsCeli', nominal: true, montrerZero: true };
const COL_DROITS_REER: Colonne = { titre: 'Droits REER', v: (a) => a.detail?.droits.reer.restant ?? null, agregat: 'droitsReer', nominal: true, montrerZero: true };

// L'année civile n'apparaît que dans ce bloc : c'est la clé de rapprochement avec un avis de l'ARC,
// qui est annuel. Ailleurs l'âge suffit et la colonne serait du bruit.
const COLS_DROITS: Colonne[] = [
  { titre: 'Année', v: (a) => a.annee, format: 'annee' },
  COL_DROITS_CELI,
  COL_DROITS_REER,
];

const COLS_PATRIMOINE_FIN: Colonne[] = [
  { titre: 'Épargne', v: (a) => a.cotisations },
  { titre: 'Équité immo', v: (a) => a.equiteImmobiliere },
  { titre: 'Valeur nette', v: (a) => a.valeurNette, agregat: 'valeurNette', accent: true },
];

/**
 * Petites icônes signalant les événements spéciaux d'une année.
 *
 * Le badge de vente est **cliquable** : c'est le seul repère qui rende une vente trouvable en
 * balayant le tableau, alors que le montant, lui, est enfoui dans un tiroir.
 */
function Badges({ a, ageEpuisement, onVente }: {
  a: AnneeProjection;
  ageEpuisement: number | null;
  onVente: () => void;
}) {
  const badges: { e: string; t: string; onClic?: () => void }[] = [];
  const d = a.detail;
  if (d && d.impot.impotDeces > 0.5) badges.push({ e: '💀', t: 'Décès — impôt sur dispositions présumées' });
  if (d && d.disponible.ventes.length > 0) {
    const noms = d.disponible.ventes.map((v) => v.nom).join(', ');
    badges.push({ e: '🏠', t: `Vente : ${noms} — voir le détail`, onClic: onVente });
  }
  const heritage = d?.disponible.entrees.find((p) => p.libelle.startsWith('Héritage') && p.montant > 0.5);
  if (heritage) badges.push({ e: '🎁', t: 'Héritage reçu (non imposable)' });
  if (d && d.disponible.surplus > 0.5) badges.push({ e: '💰', t: 'Surplus réinvesti' });
  if (ageEpuisement != null && a.age === ageEpuisement) badges.push({ e: '⚠️', t: 'Capital épuisé' });
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

/** Une cellule : « — » si nulle, sinon un montant (ou %), cliquable si liée à un agrégat. */
function Cellule({ a, col, reel, onOuvrir }: { a: AnneeProjection; col: Colonne; reel: boolean; onOuvrir: (v: VueDrawer) => void }) {
  const val = col.v(a);
  if (val == null || (col.format == null && Math.abs(val) < 0.5 && !col.montrerZero)) {
    return <span className="text-doux">—</span>;
  }
  const facteur = reel && !col.nominal ? a.deflateurReel : 1;
  const texte =
    col.format === 'pourcent' ? formatPourcent(val)
    : col.format === 'annee' ? String(val)
    : formatDollars(facteur * val);
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

function Tableau({ annees, colonnes, reel, ageEpuisement, onOuvrir, etroit }: {
  annees: readonly AnneeProjection[];
  colonnes: Colonne[];
  reel: boolean;
  ageEpuisement: number | null;
  onOuvrir: (v: VueDrawer) => void;
  /** Peu de colonnes : borner la largeur, sinon les chiffres flottent au bout d'un tableau vide. */
  etroit?: boolean;
}) {
  return (
    <div className={`max-h-[30rem] overflow-auto rounded-xl ring-1 ring-bordure ${etroit ? 'max-w-lg' : ''}`}>
      <table className="w-full text-sm">
        <thead className="text-xs text-doux [&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-champ">
          <tr>
            <th className="px-3 py-2 text-left font-medium">Âge</th>
            {colonnes.map((c) => (
              <th key={c.titre} className="px-3 py-2 text-right font-medium whitespace-nowrap">{c.titre}</th>
            ))}
          </tr>
        </thead>
        <tbody className="chiffres divide-y divide-filet">
          {annees.map((a) => (
            <tr key={a.annee} className={a.phase === 'decaissement' ? 'bg-marque-fond/30' : ''}>
              <td className="px-3 py-1.5 text-left whitespace-nowrap text-corps">
                {a.age}
                <Badges a={a} ageEpuisement={ageEpuisement} onVente={() => onOuvrir({ agregat: 'vente', annee: a })} />
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

/** Tableaux « détail année par année » avec drill-down (drawer) et deux modes d'affichage. */
export function DetailAnnees({ annees, reel, ageEpuisement }: Props) {
  const [modeComplet, setModeComplet] = useState(false);
  const [drawer, setDrawer] = useState<VueDrawer | null>(null);

  const typesActifs = ORDRE_TYPES.filter((t) => annees.some((a) => a.soldes[t] > 0.5));
  const colsComptes: Colonne[] = typesActifs.map((t) => ({ titre: LIBELLES[t], v: (a) => (a.soldes[t] > 0.5 ? a.soldes[t] : null) }));

  const ong = (actif: boolean) =>
    `rounded-md px-3 py-1 text-xs font-medium transition ${actif ? 'bg-carte text-marque shadow-sm' : 'text-corps hover:text-titre'}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-doux">Cliquez un montant <span className="text-marque underline decoration-dotted">souligné</span> pour ouvrir le détail du calcul.</p>
        <div className="sansimpression inline-flex rounded-lg bg-panneau p-0.5 ring-1 ring-bordure">
          <button type="button" onClick={() => setModeComplet(false)} className={ong(!modeComplet)}>Par thème</button>
          <button type="button" onClick={() => setModeComplet(true)} className={ong(modeComplet)}>Tout voir</button>
        </div>
      </div>

      {modeComplet ? (
        <BlocTableau titre="Tableau complet" aide="Toutes les colonnes sur une même ligne — défilement horizontal. Les deux colonnes de droits restent en dollars de l'année.">
          <Tableau annees={annees} colonnes={[...COLS_REVENUS, ...COLS_IMPOT, ...colsComptes, ...COLS_PATRIMOINE_FIN, COL_DROITS_CELI, COL_DROITS_REER]} reel={reel} ageEpuisement={ageEpuisement} onOuvrir={setDrawer} />
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
          <BlocTableau
            titre="Droits de cotisation"
            aide="Place inutilisée au 31 décembre, reportée à l'année suivante. Toujours en dollars de l'année, comme votre avis de l'ARC : ce bloc ignore la bascule d'affichage."
          >
            <Tableau annees={annees} colonnes={COLS_DROITS} reel={reel} ageEpuisement={ageEpuisement} onOuvrir={setDrawer} etroit />
          </BlocTableau>
        </div>
      )}

      <DrawerDetail vue={drawer} reel={reel} onClose={() => setDrawer(null)} />
    </div>
  );
}
