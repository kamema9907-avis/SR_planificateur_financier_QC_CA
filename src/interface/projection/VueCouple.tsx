import { useEffect, useMemo, useState } from 'react';
import {
  optimiserCouple,
  projeterCouple,
  type HypothesesCouple,
  type PersonneProjection,
  type ResultatCouple,
  type ResultatOptimisation,
  type TypeCompte,
} from '../../moteur';
import { formatDollars } from '../format';
import { BoutonReinitialiser, ChampMonetaire, ChampPourcent, Interrupteur, TitreSection } from '../Champ';
import { FormulairePersonne } from './FormulairePersonne';
import { SectionImmobilier } from './SectionImmobilier';
import { GraphiqueProjection } from './GraphiqueProjection';
import { PanneauOptimisation } from './PanneauOptimisation';

/** Décrit les leviers d'une stratégie de couple optimisée. */
function detailsCouple(s: HypothesesCouple): { label: string; valeur: string }[] {
  const d: { label: string; valeur: string }[] = [];
  d.push({ label: 'Fonte du REER', valeur: s.cibleFonteReer && s.cibleFonteReer > 0 ? `${formatDollars(s.cibleFonteReer)} / an` : 'Aucune' });
  if (s.personne1.rrqA65 > 0) d.push({ label: `Début RRQ — ${s.personne1.nom}`, valeur: `${s.personne1.ageDebutRRQ} ans` });
  if (s.personne2.rrqA65 > 0) d.push({ label: `Début RRQ — ${s.personne2.nom}`, valeur: `${s.personne2.ageDebutRRQ} ans` });
  if (s.personne1.svA65 > 0) d.push({ label: `Début SV — ${s.personne1.nom}`, valeur: `${s.personne1.ageDebutSV} ans` });
  if (s.personne2.svA65 > 0) d.push({ label: `Début SV — ${s.personne2.nom}`, valeur: `${s.personne2.ageDebutSV} ans` });
  for (const im of s.immeubles) if (im.ageVente != null) d.push({ label: `Vendre « ${im.nom} »`, valeur: `${im.ageVente} ans` });
  return d;
}

const CLE_STOCKAGE = 'pf2026:couple';

/** Conjoint vierge (champs à zéro) — comptes de base présents mais vides. */
function personneDefaut(nom: string, sexe: 'H' | 'F', ageActuel: number, ageDeces: number): PersonneProjection {
  return {
    nom, sexe, ageActuel, ageRetraite: 62, ageDeces,
    revenuEmploi: 0, croissanceSalaireReelle: 0,
    epargneAnnuelle: {}, epargneReerConjoint: 0,
    comptes: [
      { type: 'REER', solde: 0, profil: 'equilibre' },
      { type: 'CELI', solde: 0, profil: 'dynamique' },
      { type: 'NON_ENREGISTRE', solde: 0, profil: 'equilibre', coutBase: 0 },
    ],
    rrqA65: 0, svA65: 0, ageDebutRRQ: 65, ageDebutSV: 65, rentesEmployeur: [],
  };
}

function defautCouple(): HypothesesCouple {
  return {
    personne1: personneDefaut('Conjoint 1', 'H', 45, 89),
    personne2: personneDefaut('Conjoint 2', 'F', 43, 92),
    depensesRetraite: 0,
    fractionSurvivant: 0.67,
    immeubles: [],
    ordreDecaissement: ['NON_ENREGISTRE', 'CRI', 'FRV', 'REER', 'FERR', 'CELIAPP', 'CELI'],
    inflation: 0.021,
    fraisGestion: 0.01,
  };
}

function charger(): HypothesesCouple {
  try {
    const brut = localStorage.getItem(CLE_STOCKAGE);
    if (brut) return { ...defautCouple(), ...JSON.parse(brut) };
  } catch {
    /* ignore */
  }
  return defautCouple();
}

const TYPES: TypeCompte[] = ['REER', 'FERR', 'CRI', 'FRV', 'CELI', 'CELIAPP', 'NON_ENREGISTRE', 'REEE'];
function combineSoldes(a: Record<TypeCompte, number>, b: Record<TypeCompte, number>): Record<TypeCompte, number> {
  const r = {} as Record<TypeCompte, number>;
  for (const t of TYPES) r[t] = a[t] + b[t];
  return r;
}

function Tuile({ label, valeur, ton, aide }: { label: string; valeur: string; ton: 'ok' | 'alerte' | 'neutre'; aide?: string }) {
  const couleur = ton === 'ok' ? 'text-marque-700' : ton === 'alerte' ? 'text-rose-600' : 'text-slate-900';
  return (
    <div className="carte p-4">
      <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">{label}</p>
      <p className={`chiffres mt-1 text-xl font-bold ${couleur}`}>{valeur}</p>
      {aide && <p className="mt-0.5 text-xs text-slate-400">{aide}</p>}
    </div>
  );
}

export function VueCouple() {
  const [h, setH] = useState<HypothesesCouple>(charger);
  const [reel, setReel] = useState(true);
  const [optim, setOptim] = useState<ResultatOptimisation<HypothesesCouple, ResultatCouple> | null>(null);
  const [calcul, setCalcul] = useState(false);

  const lancerOptim = () => {
    setCalcul(true);
    setTimeout(() => {
      setOptim(optimiserCouple(h));
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

  const resultat = useMemo(() => projeterCouple(h), [h]);

  const elderStart = Math.max(h.personne1.ageActuel, h.personne2.ageActuel);
  const points = resultat.annees.map((a) => ({
    age: elderStart + (a.annee - 2026),
    soldes: combineSoldes(a.soldes1, a.soldes2),
    immobilier: a.equiteImmobiliere,
    deflateurReel: a.deflateurReel,
  }));
  const ageRetraiteMarker = elderStart + Math.max(h.personne1.ageRetraite - h.personne1.ageActuel, h.personne2.ageRetraite - h.personne2.ageActuel);
  const ageEpuisementMarker = resultat.anneeEpuisement != null ? elderStart + (resultat.anneeEpuisement - 2026) : null;

  const f = (a: { deflateurReel: number }, valeur: number) => (reel ? valeur * a.deflateurReel : valeur);

  return (
    <div className="space-y-8">
      {/* Deux colonnes : les conjoints */}
      <div className="grid gap-6 lg:grid-cols-2">
        {([h.personne1, h.personne2] as const).map((p, idx) => (
          <div key={idx} className="space-y-4">
            <div className="rounded-xl bg-gradient-to-br from-marque-500/10 to-sky-500/10 px-4 py-2 ring-1 ring-marque-500/15">
              <span className="text-sm font-semibold text-slate-700">{p.nom}</span>
            </div>
            <FormulairePersonne
              p={p}
              fraisGestion={h.fraisGestion}
              onChange={(np) => setH((cur) => ({ ...cur, [idx === 0 ? 'personne1' : 'personne2']: np }))}
            />
          </div>
        ))}
      </div>

      {/* Immobilier du ménage */}
      <SectionImmobilier immeubles={h.immeubles} onChange={(immeubles) => setH((c) => ({ ...c, immeubles }))} couple numero={5} />

      {/* Ménage */}
      <section className="carte p-6">
        <TitreSection numero={6} titre="Ménage" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <ChampMonetaire label="Dépenses du ménage" valeur={h.depensesRetraite} onChange={(v) => setH((c) => ({ ...c, depensesRetraite: v }))} indice="Net d'impôt, en $ d'aujourd'hui" />
          <ChampPourcent label="Dépenses du survivant" valeur={h.fractionSurvivant} onChange={(v) => setH((c) => ({ ...c, fractionSurvivant: v }))} indice="% des dépenses du couple" pas={1} />
          <ChampPourcent label="Inflation" valeur={h.inflation} onChange={(v) => setH((c) => ({ ...c, inflation: v }))} />
          <ChampPourcent label="Frais de gestion" valeur={h.fraisGestion} onChange={(v) => setH((c) => ({ ...c, fraisGestion: v }))} />
        </div>
      </section>

      {/* Résultats */}
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
            {calcul ? 'Optimisation…' : 'Optimiser la stratégie du couple'}
          </button>
          <span className="text-xs text-slate-400">Fractionnement, décaissement coordonné, fonte, RRQ/SV, ventes.</span>
          <div className="ml-auto">
            <BoutonReinitialiser onReset={() => setH(defautCouple())} />
          </div>
        </div>
        {optim && (
          <PanneauOptimisation
            gainPatrimoine={optim.gainPatrimoineReel}
            gainImpot={optim.gainImpotVieReel}
            details={detailsCouple(optim.strategie)}
            onAppliquer={() => { setH(optim.strategie); setOptim(null); }}
            onFermer={() => setOptim(null)}
          />
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Tuile
            label="Autonomie du capital"
            valeur={resultat.suffisant ? 'Suffisant' : `Épuisé en ${resultat.anneeEpuisement}`}
            ton={resultat.suffisant ? 'ok' : 'alerte'}
            aide={resultat.suffisant ? 'Dépenses financées jusqu’au dernier décès' : 'Dépenses non financées'}
          />
          <Tuile label="Valeur nette au dernier décès" valeur={formatDollars(resultat.valeurNetteAuDernierDecesReelle)} ton="neutre" aide="En $ d'aujourd'hui, après impôt" />
          <Tuile label="Impôt total sur la vie" valeur={formatDollars(resultat.impotTotalVieReel)} ton="neutre" aide="Couple, en $ d'aujourd'hui" />
        </div>

        <div className="carte p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-semibold text-slate-800">Patrimoine du ménage</h3>
            <label className="flex items-center gap-2 text-xs text-slate-500">
              <span>Dollars d'aujourd'hui</span>
              <Interrupteur label="" valeur={!reel} onChange={(v) => setReel(!v)} />
              <span>Nominaux</span>
            </label>
          </div>
          <GraphiqueProjection annees={points} reel={reel} ageRetraite={ageRetraiteMarker} ageEpuisement={ageEpuisementMarker} />
        </div>

        <div className="carte p-5">
          <h3 className="mb-1 font-semibold text-slate-800">Détail année par année — ménage</h3>
          <p className="mb-3 text-xs text-slate-400">Le fractionnement du revenu de pension est optimisé automatiquement chaque année.</p>
          <div className="max-h-[28rem] overflow-auto rounded-xl ring-1 ring-slate-200">
            <table className="w-full text-sm">
              <thead className="text-xs text-slate-500 [&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-slate-50">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Âges</th>
                  <th className="px-3 py-2 text-left font-medium">Phase</th>
                  <th className="px-3 py-2 text-right font-medium">Disponible</th>
                  <th className="px-3 py-2 text-right font-medium">Impôt</th>
                  <th className="px-3 py-2 text-right font-medium">Fractionné</th>
                  <th className="px-3 py-2 text-right font-medium">Valeur nette</th>
                </tr>
              </thead>
              <tbody className="chiffres divide-y divide-slate-100">
                {resultat.annees.map((a) => (
                  <tr key={a.annee} className={a.phase !== 'accumulation' ? 'bg-marque-50/30' : ''}>
                    <td className="px-3 py-1.5 text-left text-slate-700">{`${a.age1 ?? '—'} / ${a.age2 ?? '—'}`}</td>
                    <td className="px-3 py-1.5 text-left">
                      <span className={`inline-block rounded-full px-2 py-0.5 text-xs ${a.phase === 'accumulation' ? 'bg-sky-100 text-sky-700' : a.phase === 'survie' ? 'bg-amber-100 text-amber-700' : 'bg-marque-100 text-marque-700'}`}>
                        {a.phase === 'accumulation' ? 'Épargne' : a.phase === 'survie' ? 'Survie' : 'Retraite'}
                      </span>
                    </td>
                    <td className="px-3 py-1.5 text-right text-slate-700">{formatDollars(f(a, a.revenuDisponible))}</td>
                    <td className="px-3 py-1.5 text-right text-slate-500">{formatDollars(f(a, a.impotTotal))}</td>
                    <td className="px-3 py-1.5 text-right text-slate-500">{a.fractionnement > 1 ? formatDollars(f(a, a.fractionnement)) : '—'}</td>
                    <td className="px-3 py-1.5 text-right font-medium text-slate-900">{formatDollars(f(a, a.valeurNette))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
