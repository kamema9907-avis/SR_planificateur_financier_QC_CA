/** Ton d'une tuile d'indicateur : succès, alerte, ou neutre. */
export type TonTuile = 'ok' | 'alerte' | 'neutre';

const COULEUR: Record<TonTuile, string> = {
  ok: 'text-marque-700',
  alerte: 'text-rose-600',
  neutre: 'text-slate-900',
};

interface Props {
  label: string;
  valeur: string;
  ton?: TonTuile;
  aide?: string;
}

/** Tuile d'indicateur clé (libellé, grand chiffre, aide) — partagée par toutes les vues. */
export function Tuile({ label, valeur, ton = 'neutre', aide }: Props) {
  return (
    <div className="carte p-4">
      <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">{label}</p>
      <p className={`chiffres mt-1 text-xl font-bold ${COULEUR[ton]}`}>{valeur}</p>
      {aide && <p className="mt-0.5 text-xs text-slate-400">{aide}</p>}
    </div>
  );
}
