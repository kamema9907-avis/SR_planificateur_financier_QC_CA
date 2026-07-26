import type { ReactNode } from 'react';
import { IconeEtincelle } from '../ui/icones';

interface Props {
  /** Libellé du bouton au repos (ex. « Optimiser la stratégie »). */
  label: string;
  /** Ce que l'optimiseur explore, en une ligne. */
  aide: string;
  calcul: boolean;
  onLancer: () => void;
  /** Actions alignées à droite (ex. le bouton « Réinitialiser »). */
  actions?: ReactNode;
}

/** Barre de lancement de l'optimiseur, commune au solo et au couple. */
export function BarreOptimiseur({ label, aide, calcul, onLancer, actions }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button type="button" onClick={onLancer} disabled={calcul} className="bouton-primaire">
        <IconeEtincelle />
        {calcul ? 'Optimisation…' : label}
      </button>
      <span className="text-xs text-slate-400">{aide}</span>
      {actions && <div className="ml-auto">{actions}</div>}
    </div>
  );
}
