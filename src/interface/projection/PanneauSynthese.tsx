import type { ReactNode } from 'react';
import { Interrupteur } from '../Champ';
import { Tuile, type TonTuile } from '../ui/Tuile';
import { BarreOptimiseur } from './BarreOptimiseur';
import { GraphiqueCompact } from './GraphiqueCompact';
import type { PointPatrimoine } from './GraphiqueProjection';
import { Verdict, type DonneesVerdict } from './Verdict';

export interface IndicateurCle {
  label: string;
  valeur: string;
  ton?: TonTuile;
  aide?: string;
}

interface Props {
  /** Réponse à « est-ce que ça tient ? », en tête de colonne. */
  verdict: DonneesVerdict;
  indicateurs: readonly IndicateurCle[];
  points: readonly PointPatrimoine[];
  reel: boolean;
  onReel: (reel: boolean) => void;
  ageRetraite: number;
  ageEpuisement: number | null;
  /** Barre de lancement de l'optimiseur (label et texte d'aide propres au mode). */
  optimiseur: {
    label: string;
    aide: string;
    calcul: boolean;
    onLancer: () => void;
    onAnnuler: () => void;
    erreur?: string | null;
  };
  /** Panneau de stratégie optimisée, quand l'optimiseur a tourné. */
  optimisation?: ReactNode;
  /** Un recalcul est en cours : les chiffres affichés sont ceux de la saisie précédente. */
  enRetard?: boolean;
}

/**
 * Colonne de droite de l'atelier : ce qui répond à « est-ce que ça tient ? » sans jamais quitter
 * l'écran pendant la saisie. Le graphique détaillé par catégorie de compte et les tableaux année
 * par année restent sous l'atelier, en pleine largeur, là où ils ont la place d'être lus.
 */
export function PanneauSynthese({
  verdict,
  indicateurs,
  points,
  reel,
  onReel,
  ageRetraite,
  ageEpuisement,
  optimiseur,
  optimisation,
  enRetard = false,
}: Props) {
  return (
    <div className={`space-y-4 transition-opacity duration-200 ${enRetard ? 'opacity-60' : ''}`}>
      {/* La réponse d'abord, l'action ensuite : « ça ne tient pas » appelle « optimisez ». */}
      <Verdict v={verdict} />

      <BarreOptimiseur
        label={optimiseur.label}
        aide={optimiseur.aide}
        calcul={optimiseur.calcul}
        onLancer={optimiseur.onLancer}
        onAnnuler={optimiseur.onAnnuler}
      />

      {optimiseur.erreur && (
        <p role="alert" className="rounded-xl bg-rose-50/70 px-3.5 py-2.5 text-xs text-rose-800 ring-1 ring-rose-500/20">
          {optimiseur.erreur}
        </p>
      )}

      {optimisation}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1">
        {indicateurs.map((i) => (
          <Tuile key={i.label} label={i.label} valeur={i.valeur} ton={i.ton} aide={i.aide} />
        ))}
      </div>

      <div className="carte p-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-slate-800">Valeur nette</h3>
          <label className="flex items-center gap-1.5 text-[11px] text-slate-500">
            <span>$ d'aujourd'hui</span>
            <Interrupteur label="" valeur={!reel} onChange={(v) => onReel(!v)} />
            <span>Nominaux</span>
          </label>
        </div>
        <GraphiqueCompact
          annees={points}
          reel={reel}
          ageRetraite={ageRetraite}
          ageEpuisement={ageEpuisement}
        />
      </div>
    </div>
  );
}
