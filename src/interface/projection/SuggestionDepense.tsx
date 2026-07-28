/**
 * Suggestion de dépense de retraite, sous le champ de saisie.
 *
 * L'utilisateur devait deviner la donnée qui commande tout le verdict. Le moteur sait la calculer :
 * on affiche le maximum que son capital finance jusqu'au décès, et 85 % de ce montant par prudence.
 *
 * Trois règles de comportement, tirées de `PLAN_DEPENSE_RECOMMANDEE.md` :
 * 1. **Rien n'est jamais écrit sans un clic.** La suggestion n'est qu'une suggestion.
 * 2. **Elle ne bouge pas pendant qu'on tape dans le champ** — voir la note sur la mémoïsation.
 * 3. **Le montant exclut les versements hypothécaires**, que le moteur ajoute par-dessus la cible.
 *
 * Générique sur les hypothèses : le mode couple s'en sert avec `projeterCouple`.
 */
import { useMemo } from 'react';
import { depenseMaximale, depenseRecommandee } from '../../moteur';
import { formatDollars } from '../format';
import { usePartConsommee } from './partConsommee';

interface Props<H> {
  /** Hypothèses complètes ; la dépense courante y figure mais n'influe pas sur le calcul. */
  hypotheses: H;
  poserDepense: (h: H, montant: number) => H;
  evaluer: (h: H) => { suffisant: boolean };
  /** Y a-t-il du capital, une rente ou un revenu ? Sinon il n'y a rien à suggérer. */
  aDesRessources: boolean;
  onUtiliser: (montant: number) => void;
}

export function SuggestionDepense<H>({
  hypotheses,
  poserDepense,
  evaluer,
  aDesRessources,
  onUtiliser,
}: Props<H>) {
  // Réglable en mode Avancé ; partagée par contexte pour que le curseur et la suggestion
  // s'accordent immédiatement.
  const { part: fraction } = usePartConsommee();
  /**
   * Clé de mémoïsation **excluant la dépense courante**.
   *
   * Le maximum soutenable ne dépend pas de la valeur saisie — c'est justement la variable sur
   * laquelle on cherche. Sans cette précaution, chaque frappe dans le champ relancerait une
   * dichotomie complète (11,6 ms en solo, 54,9 ms en couple, mesuré) pour un résultat identique,
   * et la suggestion clignoterait sous les doigts de l'utilisateur.
   */
  const cle = useMemo(
    () => JSON.stringify(poserDepense(hypotheses, 0)),
    [hypotheses, poserDepense],
  );

  const maximum = useMemo(
    () => (aDesRessources ? depenseMaximale(hypotheses, poserDepense, evaluer) : 0),
    // `hypotheses` est volontairement absent : `cle` en tient lieu, sans la dépense courante.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [cle, aDesRessources],
  );

  if (!aDesRessources) return null;

  if (maximum <= 0) {
    return (
      <p className="mt-2 text-xs leading-relaxed text-alerte">
        Même sans aucune dépense, le capital ne couvre pas les charges de la retraite (versements
        hypothécaires compris). Revoyez les comptes, les rentes ou l'âge de la retraite.
      </p>
    );
  }

  const recommande = depenseRecommandee(maximum, fraction);

  return (
    <div className="mt-2 rounded-lg bg-champ p-3 ring-1 ring-bordure">
      <p className="text-xs leading-relaxed text-doux">
        Votre capital soutient jusqu'à{' '}
        <span className="chiffres font-semibold text-corps">{formatDollars(maximum)}</span> par an,
        hors versements hypothécaires.
      </p>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="text-xs text-doux">Recommandé :</span>
        <span className="chiffres text-sm font-semibold text-marque">{formatDollars(recommande)}</span>
        <button
          type="button"
          onClick={() => onUtiliser(recommande)}
          className="bouton-fantome sansimpression"
        >
          Utiliser
        </button>
      </div>
      <p className="mt-1 text-xs text-doux">
        {Math.round(fraction * 100)} % du maximum, par prudence.
      </p>
    </div>
  );
}
