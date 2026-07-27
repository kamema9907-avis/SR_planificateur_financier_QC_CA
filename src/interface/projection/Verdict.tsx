import type { ReactNode } from 'react';
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
  /** « vos dépenses » en solo, « les dépenses du ménage » en couple. */
  sujet?: string;
  /**
   * Y a-t-il quelque chose à juger ? Sans cible de dépenses, le verdict serait « financé » — vrai
   * (zéro dépense est toujours finançable) mais trompeur pour qui ouvre l'outil pour la première
   * fois. On affiche alors une invitation neutre plutôt qu'un feu vert.
   */
  evaluable: boolean;
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
 * Zone d'annonce vocale, **toujours montée**, quel que soit l'état du verdict.
 *
 * Une région `aria-live` doit exister AVANT que son contenu change : si elle apparaît en même temps
 * que le texte, la plupart des lecteurs d'écran ne disent rien. C'est exactement ce qui se passait
 * quand l'attribut ne vivait que sur la carte « évaluable » — la transition entre « en attente de
 * vos chiffres » et le premier verdict, le moment le plus intéressant, passait sous silence.
 *
 * En « polite » l'annonce attend une pause dans la frappe au lieu de couper la parole, et
 * `aria-atomic` fait relire la phrase entière plutôt que le seul chiffre qui a changé.
 */
function ZoneAnnonce({ className, children }: { className: string; children: ReactNode }) {
  return (
    <div aria-live="polite" aria-atomic="true" className={className}>
      {children}
    </div>
  );
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

  if (!v.evaluable) {
    return (
      <ZoneAnnonce className="carte p-5">
        <p className="text-xs font-medium tracking-wide text-doux uppercase">En attente de vos chiffres</p>
        <p className="mt-1 text-lg leading-snug font-semibold text-corps">
          Indiquez vos comptes et votre cible de dépenses
        </p>
        <p className="mt-2 text-xs leading-relaxed text-doux">
          Le verdict s'affichera ici : combien d'années vos dépenses sont financées, ce qu'il reste au
          décès, et l'impôt payé sur toute la vie. Les étapes signalées par un point dans le rail
          attendent une valeur.
        </p>
      </ZoneAnnonce>
    );
  }

  const fraction = fractionFinancee(v);
  const anneesDecouvert = v.ageEpuisement != null ? Math.max(0, v.ageDeces - v.ageEpuisement) : 0;
  const patrimoineImmobilise = !v.suffisant && v.valeurNetteFinale > 1_000;

  return (
    <ZoneAnnonce
      className={`carte overflow-hidden ${v.suffisant ? '' : 'ring-2 ring-alerte/30'}`}
    >
      {/*
        Dégradés assombris d'un cran : le blanc sur émeraude 500 ne donnait que 2,5:1, et sur rose
        500 que 3,7:1 — sous la norme AA, y compris pour le titre en 24 px (qui exige 3:1). Sur le
        point le plus clair du nouveau dégradé, le titre atteint 5,5:1 et les libellés 4,8:1.
      */}
      <div className={`p-5 ${v.suffisant ? 'bg-gradient-to-br from-marque-800 to-marque-700' : 'bg-gradient-to-br from-rose-800 to-rose-700'} text-white`}>
        <p className="text-xs font-medium tracking-wide text-white/90 uppercase">
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
          className="h-2 overflow-hidden rounded-full bg-bordure"
          role="img"
          aria-label={`Retraite financée à ${Math.round(fraction * 100)} %`}
        >
          <div
            className={`h-full rounded-full transition-all duration-500 ${v.suffisant ? 'bg-vif' : 'bg-rose-600'}`}
            style={{ width: `${fraction * 100}%` }}
          />
        </div>
        <div className="mt-1.5 flex justify-between text-[11px] text-doux">
          <span>
            retraite <span className="chiffres">{v.ageRetraite}</span>
          </span>
          <span className="chiffres font-medium text-corps">
            {Math.round(fraction * 100)} % de la retraite financée
          </span>
          <span className="chiffres">{v.ageDeces}</span>
        </div>

        {/* Lève la contradiction apparente entre « non financé » et une valeur nette élevée. */}
        {patrimoineImmobilise && (
          <p className="mt-3 border-t border-filet pt-2.5 text-[11px] leading-relaxed text-doux">
            Un patrimoine de{' '}
            <span className="chiffres font-medium text-corps">{formatDollars(v.valeurNetteFinale)}</span>{' '}
            subsiste malgré tout au décès : il est <strong>immobilisé</strong> — un bien non vendu ne paie
            pas les dépenses courantes. Planifier une vente ou un downsizing peut combler l'écart.
          </p>
        )}
      </div>
    </ZoneAnnonce>
  );
}
