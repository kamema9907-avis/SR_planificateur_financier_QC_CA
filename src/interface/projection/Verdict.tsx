import { formatDollars } from '../format';

export interface DonneesVerdict {
  /** Le capital finance-t-il les dépenses jusqu'au dernier décès ? */
  suffisant: boolean;
  /** Âge auquel le capital tombe à zéro (null si suffisant). */
  ageEpuisement: number | null;
  ageRetraite: number;
  ageDeces: number;
  /** Valeur nette au décès, en dollars d'aujourd'hui. */
  valeurNetteFinale: number;
  /** « votre capital » en solo, « le capital du ménage » en couple. */
  sujet?: string;
}

/**
 * Part de la retraite effectivement financée par le capital, entre 0 et 1.
 * Exportée pour être testée : c'est le seul calcul de cette vue.
 */
export function fractionFinancee(v: DonneesVerdict): number {
  if (v.suffisant || v.ageEpuisement == null) return 1;
  const duree = v.ageDeces - v.ageRetraite;
  if (duree <= 0) return 0;
  return Math.min(1, Math.max(0, (v.ageEpuisement - v.ageRetraite) / duree));
}

/**
 * La réponse à la question qu'on se pose vraiment, en grand : « est-ce que ça tient ? ».
 *
 * Vocabulaire : le moteur marque une année d'« épuisement » dès que les retraits ne suffisent plus
 * à financer la cible de dépenses — ce n'est PAS « le patrimoine tombe à zéro ». Un immeuble non
 * vendu peut laisser une valeur nette élevée au décès tout en ne payant pas l'épicerie. Le verdict
 * parle donc de dépenses financées, et signale explicitement le patrimoine resté immobilisé.
 */
export function Verdict({ v }: { v: DonneesVerdict }) {
  const sujet = v.sujet ?? 'Vos dépenses';
  const fraction = fractionFinancee(v);
  const anneesDecouvert = v.ageEpuisement != null ? Math.max(0, v.ageDeces - v.ageEpuisement) : 0;
  const patrimoineImmobilise = !v.suffisant && v.valeurNetteFinale > 1_000;

  return (
    <div className={`carte overflow-hidden ${v.suffisant ? '' : 'ring-2 ring-rose-500/30'}`}>
      <div className={`p-5 ${v.suffisant ? 'bg-gradient-to-br from-marque-600 to-marque-500' : 'bg-gradient-to-br from-rose-600 to-rose-500'} text-white`}>
        <p className="text-xs font-medium tracking-wide text-white/80 uppercase">
          {v.suffisant ? 'Objectif financé' : 'Objectif non financé'}
        </p>
        <p className="mt-1 text-2xl leading-tight font-bold">
          {v.suffisant ? (
            <>
              {sujet} sont financées
              <br />
              jusqu'à <span className="chiffres">{v.ageDeces}</span> ans
            </>
          ) : (
            <>
              {sujet} ne sont plus
              <br />
              financées dès <span className="chiffres">{v.ageEpuisement}</span> ans
            </>
          )}
        </p>
        <p className="mt-2 text-sm text-white/90">
          {v.suffisant ? (
            <>
              Il resterait{' '}
              <span className="chiffres font-semibold">{formatDollars(v.valeurNetteFinale)}</span> après
              l'impôt au décès.
            </>
          ) : (
            <>
              <span className="chiffres font-semibold">{anneesDecouvert}</span>{' '}
              {anneesDecouvert > 1 ? 'années' : 'année'} à découvert avant{' '}
              <span className="chiffres">{v.ageDeces}</span> ans.
            </>
          )}
        </p>
      </div>

      {/* Jauge : quelle part de la retraite le capital finance-t-il ? */}
      <div className="p-4">
        <div
          className="h-2 overflow-hidden rounded-full bg-slate-200"
          role="img"
          aria-label={`Retraite financée à ${Math.round(fraction * 100)} %`}
        >
          <div
            className={`h-full rounded-full transition-all duration-500 ${v.suffisant ? 'bg-marque-500' : 'bg-rose-500'}`}
            style={{ width: `${fraction * 100}%` }}
          />
        </div>
        <div className="mt-1.5 flex justify-between text-[11px] text-slate-400">
          <span>
            retraite <span className="chiffres">{v.ageRetraite}</span>
          </span>
          <span className="chiffres font-medium text-slate-600">
            {Math.round(fraction * 100)} % de la retraite financée
          </span>
          <span className="chiffres">{v.ageDeces}</span>
        </div>

        {/* Lève la contradiction apparente entre « non financé » et une valeur nette élevée. */}
        {patrimoineImmobilise && (
          <p className="mt-3 border-t border-slate-100 pt-2.5 text-[11px] leading-relaxed text-slate-500">
            Un patrimoine de{' '}
            <span className="chiffres font-medium text-slate-700">{formatDollars(v.valeurNetteFinale)}</span>{' '}
            subsiste malgré tout au décès : il est <strong>immobilisé</strong> — un bien non vendu ne paie
            pas les dépenses courantes. Planifier une vente ou un downsizing peut combler l'écart.
          </p>
        )}
      </div>
    </div>
  );
}
