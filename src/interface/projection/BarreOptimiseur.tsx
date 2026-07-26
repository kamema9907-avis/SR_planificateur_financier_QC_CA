import type { ReactNode } from 'react';
import { IconeEtincelle } from '../ui/icones';

interface Props {
  /** Libellé du bouton au repos (ex. « Optimiser la stratégie »). */
  label: string;
  /** Ce que l'optimiseur explore, en une ligne. */
  aide: string;
  calcul: boolean;
  onLancer: () => void;
  /** Abandonne le calcul en cours (le worker est tué). */
  onAnnuler?: () => void;
  /** Actions alignées à droite (ex. le bouton « Réinitialiser »). */
  actions?: ReactNode;
}

/**
 * Barre de lancement de l'optimiseur, commune au solo et au couple.
 *
 * Le calcul tournant sur un fil séparé, il peut être abandonné : le bouton devient « Annuler »
 * pendant l'optimisation, au lieu de rester désactivé sans recours.
 */
export function BarreOptimiseur({ label, aide, calcul, onLancer, onAnnuler, actions }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      {calcul && onAnnuler ? (
        <button type="button" onClick={onAnnuler} className="bouton-secondaire">
          <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-slate-400 border-t-transparent" />
          Optimisation… annuler
        </button>
      ) : (
        <button type="button" onClick={onLancer} disabled={calcul} className="bouton-primaire">
          <IconeEtincelle />
          {calcul ? 'Optimisation…' : label}
        </button>
      )}
      <span className="text-xs text-slate-400">{aide}</span>
      {actions && <div className="ml-auto">{actions}</div>}
    </div>
  );
}
