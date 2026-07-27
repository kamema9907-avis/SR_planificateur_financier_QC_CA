import { useCallback, useDeferredValue, useMemo } from 'react';
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
import { useRoute } from '../routage';
import { useScenarios, type LigneComparaison } from '../scenarios';
import { useAffichageReel, useDossier, useOptimiseur } from '../useDossier';
import { PanneauScenarios } from './PanneauScenarios';
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
const CLE_SCENARIOS = 'pf2026:projection:scenarios';

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
  const { route, naviguer } = useRoute();
  const mode = route.mode;

  const appliquer = useCallback((strategie: HypothesesProjection) => setH(strategie), [setH]);
  const optim = useOptimiseur({ donnees: h, mode: 'solo', optimiserSync: optimiserProjection, appliquer });

  /**
   * La saisie reste prioritaire : `projeter` simule 55 années à chaque frappe, avec la trace
   * complète. React peint donc d'abord le champ modifié, puis rattrape le calcul — l'ancien
   * résultat reste affiché en attendant, légèrement estompé.
   */
  const hDiffere = useDeferredValue(h);
  const enRetard = hDiffere !== h;
  const resultat = useMemo(() => projeter(hDiffere, { trace: true }), [hDiffere]);
  const points = useMemo(
    () => resultat.annees.map((a) => ({ ...a, immobilier: a.equiteImmobiliere })),
    [resultat],
  );

  // Scénarios : chaque enregistrement est réévalué sans trace (inutile ici, et bien plus rapide).
  const { scenarios, enregistrer, supprimer, renommer } = useScenarios<HypothesesProjection>(CLE_SCENARIOS);
  const lignes = useMemo<LigneComparaison[]>(() => {
    const courante: LigneComparaison = {
      id: 'courant',
      nom: 'Simulation en cours',
      courant: true,
      suffisant: resultat.suffisant,
      ageEpuisement: resultat.ageEpuisement,
      valeurNette: resultat.valeurNetteAuDecesReelle,
      impotVie: resultat.impotTotalVieReel,
    };
    return [
      courante,
      ...scenarios.map((s) => {
        const r = projeter(s.hypotheses);
        return {
          id: s.id,
          nom: s.nom,
          courant: false,
          suffisant: r.suffisant,
          ageEpuisement: r.ageEpuisement,
          valeurNette: r.valeurNetteAuDecesReelle,
          impotVie: r.impotTotalVieReel,
        };
      }),
    ];
  }, [resultat, scenarios]);

  return (
    <div className="space-y-6">
      <div className="sansimpression flex items-center justify-between gap-3">
        <div className="inline-flex rounded-xl bg-panneau p-1 ring-1 ring-bordure">
          {(['solo', 'couple'] as const).map((m) => (
            <button
              key={m}
              type="button"
              // Changer de mode remet l'atelier à sa première étape : un identifiant d'étape du
              // couple ne veut rien dire en solo, et inversement.
              onClick={() => naviguer({ mode: m, groupe: undefined, etape: undefined })}
              aria-pressed={mode === m}
              className={`rounded-lg px-4 py-1.5 text-sm font-medium transition focus-visible:ring-2
                focus-visible:ring-marque focus-visible:outline-none ${
                  mode === m ? 'bg-carte text-marque shadow-sm' : 'text-corps hover:text-titre'
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
              verdict={{
                suffisant: resultat.suffisant,
                ageEpuisement: resultat.ageEpuisement,
                ageRetraite: h.ageRetraite,
                ageDeces: h.ageDeces,
                valeurNetteFinale: resultat.valeurNetteAuDecesReelle,
                evaluable: h.depensesRetraite > 0,
              }}
              indicateurs={[
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
              enRetard={enRetard}
              optimiseur={{
                label: 'Optimiser la stratégie',
                aide: 'Décaissement, fonte du REER, RRQ/SV, ventes.',
                calcul: optim.calcul,
                onLancer: optim.lancer,
                onAnnuler: optim.annuler,
                erreur: optim.erreur,
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
                    trajectoires={{
                      base: optim.resultat.base.annees.map((an) => an.valeurNette * an.deflateurReel),
                      optimisee: optim.resultat.resultat.annees.map((an) => an.valeurNette * an.deflateurReel),
                      ageDe: h.ageActuel,
                      ageA: h.ageDeces,
                    }}
                    onAppliquer={optim.appliquerStrategie}
                    onFermer={optim.fermer}
                  />
                )
              }
            />
          }
          dessous={
            <div className="space-y-5">
              <PanneauScenarios
                lignes={lignes}
                onEnregistrer={(nom) => enregistrer(h, nom)}
                onCharger={(id) => {
                  const s = scenarios.find((x) => x.id === id);
                  if (s) setH(s.hypotheses);
                }}
                onSupprimer={supprimer}
                onRenommer={renommer}
              />

              <div className="carte p-5">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="font-semibold text-titre">Évolution du patrimoine</h3>
                  <label className="sansimpression flex items-center gap-2 text-xs text-doux">
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
                <h3 className="mb-1 font-semibold text-titre">Détail année par année</h3>
                <p className="mb-3 text-xs text-doux">
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
