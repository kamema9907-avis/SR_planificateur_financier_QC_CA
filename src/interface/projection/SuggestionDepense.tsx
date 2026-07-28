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
  /** Biens sans âge de vente : leur équité ne financera jamais une dépense. */
  immobilise?: readonly { nom: string; equite: number }[];
  onUtiliser: (montant: number) => void;
}

/**
 * Le montant recommandé peut sembler absurdement bas quand un bien important n'est jamais vendu :
 * 650 000 $ de comptes et une maison de 420 000 $ donnent 49 500 $ par an, la maison n'ajoutant
 * pas un dollar. Sans cette phrase, le chiffre passe pour un bogue.
 *
 * On ne signale que les biens **sans âge de vente**, le seul cas sans ambiguïté. Un âge de vente
 * postérieur au décès n'est pas détecté : en mode couple, un bien roulé au survivant peut encore
 * être vendu par lui, et comparer à l'âge de décès du propriétaire initial serait faux.
 */
function PatrimoineImmobilise({ biens }: { biens: readonly { nom: string; equite: number }[] }) {
  const retenus = biens.filter((b) => b.equite > 1_000);
  if (retenus.length === 0) return null;

  const total = retenus.reduce((s, b) => s + b.equite, 0);
  const sujet =
    retenus.length === 1
      ? `« ${retenus[0].nom} »`
      : `${retenus.length} biens immobiliers`;

  return (
    <p className="mt-2 border-t border-filet pt-2 text-xs leading-relaxed text-doux">
      {sujet} n'{retenus.length === 1 ? 'a' : 'ont'} pas d'âge de vente :{' '}
      <span className="chiffres font-medium text-corps">{formatDollars(total)}</span> d'équité ne
      financeront aucune dépense. Planifier une vente augmenterait ce montant.
    </p>
  );
}

export function SuggestionDepense<H>({
  hypotheses,
  poserDepense,
  evaluer,
  aDesRessources,
  immobilise = [],
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
      <div className="mt-2">
        <p className="text-xs leading-relaxed text-alerte">
          Même sans aucune dépense, le capital ne couvre pas les charges de la retraite (versements
          hypothécaires compris). Revoyez les comptes, les rentes ou l'âge de la retraite.
        </p>
        <PatrimoineImmobilise biens={immobilise} />
      </div>
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
      <PatrimoineImmobilise biens={immobilise} />
    </div>
  );
}
