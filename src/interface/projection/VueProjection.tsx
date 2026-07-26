import { useCallback, useMemo, useState } from 'react';
import {
  optimiserProjection,
  projeter,
  type HypothesesProjection,
  type TypeCompte,
} from '../../moteur';
import { formatDollars } from '../format';
import { BoutonReinitialiser, Interrupteur } from '../Champ';
import { Atelier } from '../atelier/Atelier';
import { BasculeAvance } from '../ui/ModeDetail';
import { useAffichageReel, useDossier, useOptimiseur } from '../useDossier';
import { groupeSolo } from './etapes';
import { GraphiqueProjection } from './GraphiqueProjection';
import { DetailAnnees } from './DetailAnnees';
import { PanneauOptimisation } from './PanneauOptimisation';
import { PanneauSynthese } from './PanneauSynthese';
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
    celiappDejaCotise: 0,
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

/** Vue « Projection (cycle de vie) » — Phase 2. */
export function VueProjection() {
  const { donnees: h, setDonnees: setH, reinitialiser } = useDossier(CLE_STOCKAGE, defautHypotheses);
  const { reel, setReel } = useAffichageReel();
  const [mode, setMode] = useState<'solo' | 'couple'>('solo');

  const appliquer = useCallback((strategie: HypothesesProjection) => setH(strategie), [setH]);
  const optim = useOptimiseur(h, optimiserProjection, appliquer);

  const resultat = useMemo(() => projeter(h, { trace: true }), [h]);
  const points = useMemo(
    () => resultat.annees.map((a) => ({ ...a, immobilier: a.equiteImmobiliere })),
    [resultat],
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="inline-flex rounded-xl bg-slate-100 p-1 ring-1 ring-slate-200">
          {(['solo', 'couple'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`rounded-lg px-4 py-1.5 text-sm font-medium transition focus-visible:ring-2
                focus-visible:ring-marque-500 focus-visible:outline-none ${
                  mode === m ? 'bg-white text-marque-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
            >
              {m === 'solo' ? 'Une personne' : 'Couple'}
            </button>
          ))}
        </div>
      </div>

      {mode === 'couple' ? (
        <VueCouple />
      ) : (
        <Atelier
          actions={
            <div className="flex items-center gap-2">
              <BasculeAvance />
              <BoutonReinitialiser onReset={reinitialiser} />
            </div>
          }
          groupes={[groupeSolo(h, setH)]}
          resultat={
            <PanneauSynthese
              indicateurs={[
                {
                  label: 'Autonomie du capital',
                  valeur: resultat.suffisant ? `Dure jusqu'à ${h.ageDeces} ans` : `Épuisé à ${resultat.ageEpuisement} ans`,
                  ton: resultat.suffisant ? 'ok' : 'alerte',
                  aide: resultat.suffisant ? 'Objectif de dépenses financé' : 'Dépenses non financées',
                },
                {
                  label: 'Valeur nette au décès',
                  valeur: formatDollars(resultat.valeurNetteAuDecesReelle),
                  aide: "En $ d'aujourd'hui, après impôt au décès",
                },
                {
                  label: 'Impôt total sur la vie',
                  valeur: formatDollars(resultat.impotTotalVieReel),
                  aide: "En $ d'aujourd'hui",
                },
              ]}
              points={points}
              reel={reel}
              onReel={setReel}
              ageRetraite={h.ageRetraite}
              ageEpuisement={resultat.ageEpuisement}
              optimiseur={{
                label: 'Optimiser la stratégie',
                aide: 'Décaissement, fonte du REER, RRQ/SV, ventes.',
                calcul: optim.calcul,
                onLancer: optim.lancer,
              }}
              optimisation={
                optim.resultat && (
                  <PanneauOptimisation
                    gainPatrimoine={optim.resultat.gainPatrimoineReel}
                    gainImpot={optim.resultat.gainImpotVieReel}
                    details={detailsStrategie({
                      cibleFonteReer: optim.resultat.strategie.cibleFonteReer,
                      ordreDecaissement: optim.resultat.strategie.ordreDecaissement,
                      ageDebutRRQ: optim.resultat.strategie.rrqA65 > 0 ? optim.resultat.strategie.ageDebutRRQ : undefined,
                      ageDebutSV: optim.resultat.strategie.svA65 > 0 ? optim.resultat.strategie.ageDebutSV : undefined,
                      immeubles: optim.resultat.strategie.immeubles,
                    })}
                    onAppliquer={optim.appliquerStrategie}
                    onFermer={optim.fermer}
                  />
                )
              }
            />
          }
          dessous={
            <div className="space-y-5">
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
                  annees={points}
                  reel={reel}
                  ageRetraite={h.ageRetraite}
                  ageEpuisement={resultat.ageEpuisement}
                />
              </div>

              <div className="carte p-5">
                <h3 className="mb-1 font-semibold text-slate-800">Détail année par année</h3>
                <p className="mb-3 text-xs text-slate-400">
                  Toute la traçabilité : revenus, impôt, comptes et patrimoine. Cliquez un montant souligné pour ouvrir son calcul.
                </p>
                <DetailAnnees annees={resultat.annees} reel={reel} ageEpuisement={resultat.ageEpuisement} />
              </div>
            </div>
          }
        />
      )}
    </div>
  );
}
