import { useEffect, useMemo, useState } from 'react';
import {
  optimiserProjection,
  projeter,
  type HypothesesProjection,
  type ResultatOptimisation,
  type ResultatProjection,
  type TypeCompte,
} from '../../moteur';
import { formatDollars } from '../format';
import { BoutonReinitialiser, Interrupteur } from '../Champ';
import { FormulaireProjection } from './FormulaireProjection';
import { GraphiqueProjection } from './GraphiqueProjection';
import { TableauProjection } from './TableauProjection';
import { TableauComptes } from './TableauComptes';
import { PanneauOptimisation } from './PanneauOptimisation';
import { VueCouple } from './VueCouple';

const LIBELLE_TYPE: Record<TypeCompte, string> = {
  REER: 'REER', FERR: 'FERR', CRI: 'CRI', FRV: 'FRV', CELI: 'CELI', CELIAPP: 'CELIAPP',
  NON_ENREGISTRE: 'Non-enregistré', REEE: 'REEE',
};

/** Décrit les leviers d'une stratégie optimisée. */
export function detailsStrategie(s: {
  cibleFonteReer?: number; ordreDecaissement: readonly TypeCompte[];
  ageDebutRRQ?: number; ageDebutSV?: number;
  immeubles: readonly { nom: string; ageVente: number | null }[];
}): { label: string; valeur: string }[] {
  const d: { label: string; valeur: string }[] = [];
  d.push({ label: 'Fonte du REER', valeur: s.cibleFonteReer && s.cibleFonteReer > 0 ? `${formatDollars(s.cibleFonteReer)} / an` : 'Aucune' });
  if (s.ageDebutRRQ != null) d.push({ label: 'Début RRQ', valeur: `${s.ageDebutRRQ} ans` });
  if (s.ageDebutSV != null) d.push({ label: 'Début SV', valeur: `${s.ageDebutSV} ans` });
  d.push({ label: 'Décaisser d’abord', valeur: LIBELLE_TYPE[s.ordreDecaissement[0]] });
  for (const im of s.immeubles) if (im.ageVente != null) d.push({ label: `Vendre « ${im.nom} »`, valeur: `${im.ageVente} ans` });
  return d;
}

const CLE_STOCKAGE = 'pf2026:projection';

/** Hypothèses vierges (champs à zéro) — comptes présents mais vides, paramètres du modèle par défaut. */
function defautHypotheses(): HypothesesProjection {
  return {
    ageActuel: 40,
    ageRetraite: 60,
    ageDeces: 95,
    vitSeul: false,
    revenuEmploi: 0,
    croissanceSalaireReelle: 0,
    epargneAnnuelle: {},
    comptes: [
      { type: 'REER', solde: 0, profil: 'equilibre' },
      { type: 'CELI', solde: 0, profil: 'dynamique' },
      { type: 'CELIAPP', solde: 0, profil: 'equilibre' },
      { type: 'CRI', solde: 0, profil: 'equilibre' },
      { type: 'NON_ENREGISTRE', solde: 0, profil: 'equilibre', coutBase: 0 },
      { type: 'REEE', solde: 0, profil: 'equilibre' },
    ],
    immeubles: [],
    rrqA65: 0,
    svA65: 0,
    ageDebutRRQ: 65,
    ageDebutSV: 65,
    rentesEmployeur: [],
    depensesRetraite: 0,
    ordreDecaissement: ['NON_ENREGISTRE', 'CRI', 'FRV', 'REER', 'FERR', 'CELIAPP', 'CELI'],
    inflation: 0.021,
    fraisGestion: 0.01,
  };
}

function charger(): HypothesesProjection {
  try {
    const brut = localStorage.getItem(CLE_STOCKAGE);
    if (brut) return { ...defautHypotheses(), ...JSON.parse(brut) };
  } catch {
    /* ignore */
  }
  return defautHypotheses();
}

function Tuile({ label, valeur, ton, aide }: { label: string; valeur: string; ton: 'ok' | 'alerte' | 'neutre'; aide?: string }) {
  const couleur =
    ton === 'ok' ? 'text-marque-700' : ton === 'alerte' ? 'text-rose-600' : 'text-slate-900';
  return (
    <div className="carte p-4">
      <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">{label}</p>
      <p className={`chiffres mt-1 text-xl font-bold ${couleur}`}>{valeur}</p>
      {aide && <p className="mt-0.5 text-xs text-slate-400">{aide}</p>}
    </div>
  );
}

/** Vue « Projection (cycle de vie) » — Phase 2. */
export function VueProjection() {
  const [h, setH] = useState<HypothesesProjection>(charger);
  const [reel, setReel] = useState(true);
  const [mode, setMode] = useState<'solo' | 'couple'>('solo');
  const [optim, setOptim] = useState<ResultatOptimisation<HypothesesProjection, ResultatProjection> | null>(null);
  const [calcul, setCalcul] = useState(false);

  const lancerOptim = () => {
    setCalcul(true);
    setTimeout(() => {
      setOptim(optimiserProjection(h));
      setCalcul(false);
    }, 20);
  };

  useEffect(() => {
    try {
      localStorage.setItem(CLE_STOCKAGE, JSON.stringify(h));
    } catch {
      /* ignore */
    }
  }, [h]);

  const resultat = useMemo(() => projeter(h), [h]);

  return (
    <div className="space-y-6">
      <div className="flex justify-center">
        <div className="inline-flex rounded-xl bg-slate-100 p-1 ring-1 ring-slate-200">
          {(['solo', 'couple'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`rounded-lg px-4 py-1.5 text-sm font-medium transition ${mode === m ? 'bg-white text-marque-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              {m === 'solo' ? 'Une personne' : 'Couple'}
            </button>
          ))}
        </div>
      </div>

      {mode === 'couple' ? (
        <VueCouple />
      ) : (
      <div className="grid gap-8 lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)]">
        <FormulaireProjection h={h} onChange={setH} />

      <div className="space-y-5">
        {/* Optimiseur */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={lancerOptim}
            disabled={calcul}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 3v4M3 5h4M13 3l2.5 6.5L22 12l-6.5 2.5L13 21l-2.5-6.5L4 12l6.5-2.5z" />
            </svg>
            {calcul ? 'Optimisation…' : 'Optimiser la stratégie'}
          </button>
          <span className="text-xs text-slate-400">Meilleure combinaison : décaissement, fonte du REER, RRQ/SV, ventes.</span>
          <div className="ml-auto">
            <BoutonReinitialiser onReset={() => setH(defautHypotheses())} />
          </div>
        </div>
        {optim && (
          <PanneauOptimisation
            gainPatrimoine={optim.gainPatrimoineReel}
            gainImpot={optim.gainImpotVieReel}
            details={detailsStrategie({
              cibleFonteReer: optim.strategie.cibleFonteReer,
              ordreDecaissement: optim.strategie.ordreDecaissement,
              ageDebutRRQ: optim.strategie.rrqA65 > 0 ? optim.strategie.ageDebutRRQ : undefined,
              ageDebutSV: optim.strategie.svA65 > 0 ? optim.strategie.ageDebutSV : undefined,
              immeubles: optim.strategie.immeubles,
            })}
            onAppliquer={() => { setH(optim.strategie); setOptim(null); }}
            onFermer={() => setOptim(null)}
          />
        )}

        {/* Indicateurs clés */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Tuile
            label="Autonomie du capital"
            valeur={resultat.suffisant ? `Dure jusqu'à ${h.ageDeces} ans` : `Épuisé à ${resultat.ageEpuisement} ans`}
            ton={resultat.suffisant ? 'ok' : 'alerte'}
            aide={resultat.suffisant ? 'Objectif de dépenses financé' : 'Dépenses non financées'}
          />
          <Tuile
            label="Valeur nette au décès"
            valeur={formatDollars(resultat.valeurNetteAuDecesReelle)}
            ton="neutre"
            aide="En $ d'aujourd'hui, après impôt au décès"
          />
          <Tuile
            label="Impôt total sur la vie"
            valeur={formatDollars(resultat.impotTotalVieReel)}
            ton="neutre"
            aide="En $ d'aujourd'hui"
          />
        </div>

        {/* Graphique */}
        <div className="carte p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-semibold text-slate-800">Évolution du patrimoine</h3>
            <label className="flex items-center gap-2 text-xs text-slate-500">
              <span>Dollars d'aujourd'hui</span>
              <Interrupteur label="" valeur={!reel} onChange={(v) => setReel(!v)} />
              <span>Nominaux</span>
            </label>
          </div>
          <GraphiqueProjection
            annees={resultat.annees.map((a) => ({ ...a, immobilier: a.equiteImmobiliere }))}
            reel={reel}
            ageRetraite={h.ageRetraite}
            ageEpuisement={resultat.ageEpuisement}
          />
        </div>

        {/* Tableau — revenus et impôt */}
        <div className="carte p-5">
          <h3 className="mb-1 font-semibold text-slate-800">Détail année par année — revenus et impôt</h3>
          <p className="mb-3 text-xs text-slate-400">Ce que vous encaissez et payez chaque année.</p>
          <TableauProjection annees={resultat.annees} reel={reel} />
        </div>

        {/* Tableau — soldes des comptes */}
        <div className="carte p-5">
          <h3 className="mb-1 font-semibold text-slate-800">Détail année par année — soldes des comptes</h3>
          <p className="mb-3 text-xs text-slate-400">
            Où est l'argent : solde de chaque compte, épargne versée (+) et retraits (−).
          </p>
          <TableauComptes annees={resultat.annees} reel={reel} />
        </div>
      </div>
      </div>
      )}
    </div>
  );
}
