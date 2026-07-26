import { useCallback, useMemo } from 'react';
import {
  optimiserCouple,
  projeterCouple,
  type HypothesesCouple,
  type PersonneProjection,
  type TypeCompte,
} from '../../moteur';
import { formatDollars } from '../format';
import { BoutonReinitialiser, Interrupteur } from '../Champ';
import { Atelier } from '../atelier/Atelier';
import { BasculeAvance } from '../ui/ModeDetail';
import { useAffichageReel, useDossier, useOptimiseur } from '../useDossier';
import { groupeConjoint, groupeMenage } from './etapes';
import { GraphiqueProjection } from './GraphiqueProjection';
import { PanneauOptimisation } from './PanneauOptimisation';
import { PanneauSynthese } from './PanneauSynthese';
import { DetailAnneesCouple } from './DetailAnneesCouple';

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
    epargneAnnuelle: {}, celiappDejaCotise: 0, epargneReerConjoint: 0,
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

const TYPES: TypeCompte[] = ['REER', 'FERR', 'CRI', 'FRV', 'CELI', 'CELIAPP', 'NON_ENREGISTRE', 'REEE'];
function combineSoldes(a: Record<TypeCompte, number>, b: Record<TypeCompte, number>): Record<TypeCompte, number> {
  const r = {} as Record<TypeCompte, number>;
  for (const t of TYPES) r[t] = a[t] + b[t];
  return r;
}

export function VueCouple() {
  const { donnees: h, setDonnees: setH, reinitialiser } = useDossier(CLE_STOCKAGE, defautCouple);
  const { reel, setReel } = useAffichageReel();

  const appliquer = useCallback((strategie: HypothesesCouple) => setH(strategie), [setH]);
  const optim = useOptimiseur(h, optimiserCouple, appliquer);

  const resultat = useMemo(() => projeterCouple(h, { trace: true }), [h]);

  /** Le graphique du ménage est indexé sur l'âge de l'aîné. */
  const elderStart = Math.max(h.personne1.ageActuel, h.personne2.ageActuel);
  const points = resultat.annees.map((a) => ({
    age: elderStart + (a.annee - 2026),
    soldes: combineSoldes(a.soldes1, a.soldes2),
    immobilier: a.equiteImmobiliere,
    deflateurReel: a.deflateurReel,
  }));
  const ageRetraiteMarker = elderStart + Math.max(h.personne1.ageRetraite - h.personne1.ageActuel, h.personne2.ageRetraite - h.personne2.ageActuel);
  const ageEpuisementMarker = resultat.anneeEpuisement != null ? elderStart + (resultat.anneeEpuisement - 2026) : null;

  const majConjoint = (cle: 'personne1' | 'personne2') => (p: PersonneProjection) =>
    setH((cur) => ({ ...cur, [cle]: p }));

  return (
    <Atelier
      actions={
        <div className="flex items-center gap-2">
          <BasculeAvance />
          <BoutonReinitialiser onReset={reinitialiser} />
        </div>
      }
      groupes={[
        groupeConjoint('personne1', h, majConjoint('personne1')),
        groupeConjoint('personne2', h, majConjoint('personne2')),
        groupeMenage(h, setH),
      ]}
      resultat={
        <PanneauSynthese
          verdict={{
            suffisant: resultat.suffisant,
            ageEpuisement: ageEpuisementMarker,
            ageRetraite: ageRetraiteMarker,
            ageDeces: elderStart + (resultat.annees.length - 1),
            valeurNetteFinale: resultat.valeurNetteAuDernierDecesReelle,
            sujet: 'Les dépenses du ménage',
            evaluable: h.depensesRetraite > 0,
          }}
          indicateurs={[
            {
              label: 'Valeur nette au dernier décès',
              valeur: formatDollars(resultat.valeurNetteAuDernierDecesReelle),
              aide: "En $ d'aujourd'hui, après impôt",
            },
            {
              label: 'Impôt total sur la vie',
              valeur: formatDollars(resultat.impotTotalVieReel),
              aide: "Couple, en $ d'aujourd'hui",
            },
          ]}
          points={points}
          reel={reel}
          onReel={setReel}
          ageRetraite={ageRetraiteMarker}
          ageEpuisement={ageEpuisementMarker}
          optimiseur={{
            label: 'Optimiser le couple',
            aide: 'Fractionnement, décaissement coordonné, fonte, RRQ/SV, ventes.',
            calcul: optim.calcul,
            onLancer: optim.lancer,
          }}
          optimisation={
            optim.resultat && (
              <PanneauOptimisation
                gainPatrimoine={optim.resultat.gainPatrimoineReel}
                gainImpot={optim.resultat.gainImpotVieReel}
                details={detailsCouple(optim.resultat.strategie)}
                trajectoires={{
                  base: optim.resultat.base.annees.map((an) => an.valeurNette * an.deflateurReel),
                  optimisee: optim.resultat.resultat.annees.map((an) => an.valeurNette * an.deflateurReel),
                  ageDe: elderStart,
                  ageA: elderStart + (resultat.annees.length - 1),
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
            <p className="mb-3 text-xs text-slate-400">
              Le fractionnement du revenu de pension est optimisé automatiquement chaque année. Cliquez un montant souligné pour voir son calcul.
            </p>
            <DetailAnneesCouple annees={resultat.annees} reel={reel} anneeEpuisement={resultat.anneeEpuisement} />
          </div>
        </div>
      }
    />
  );
}
