/**
 * Y a-t-il de quoi calculer une dépense soutenable ?
 *
 * Cette garde décide si la **recommandation de dépense** s'affiche. Quand elle est fausse,
 * `SuggestionDepense` ne rend rien du tout — encadré, montant et bouton « Utiliser » compris. Sans
 * elle, un dossier vierge afficherait le message rouge « même sans aucune dépense, le capital ne
 * couvre pas les charges », alarmant et faux pour quelqu'un qui n'a encore rien saisi.
 *
 * **Le trou qu'elle avait.** Elle ne regardait que les comptes, les rentes, le salaire et l'épargne
 * planifiée. Un héritage à venir, un revenu de travail à la retraite ou un immeuble n'y figuraient
 * pas — et `ChampsPersonne` ne déclare même pas `immeubles`, donc elle ne pouvait pas les voir. Un
 * ménage dont toute la richesse vient d'une succession était jugé « sans ressources », et perdait la
 * recommandation entière. Le solveur, lui, savait parfaitement en tirer un montant : c'est
 * l'affichage qui était aveugle, pas le moteur.
 *
 * Fonctions pures, sans React : testables comme le moteur — d'où ce module séparé d'`etapes.tsx`.
 */
import type { Immeuble } from '../../moteur';
import type { ChampsPersonne } from './champsPersonne';

/** Une personne a-t-elle déjà de l'épargne annuelle en cours ? */
export const epargneNonNulle = (p: ChampsPersonne) =>
  Object.values(p.epargneAnnuelle).some((v) => (v ?? 0) > 0);

/**
 * Équité totale des biens : ce qu'ils vaudraient une fois l'hypothèque éteinte.
 *
 * Tous les biens comptent, **y compris ceux dont la vente est planifiée** — ce sont même les
 * premiers à financer des dépenses. À ne pas confondre avec `immobilise()` d'`etapes.tsx`, qui
 * retient exactement l'inverse (les biens SANS âge de vente) pour avertir que leur valeur ne
 * financera rien.
 */
export const equiteImmobiliere = (immeubles: readonly Immeuble[]) =>
  immeubles.reduce((s, b) => s + Math.max(0, b.valeur - b.hypotheque), 0);

/**
 * @param equite Équité immobilière du ménage. En couple les biens appartiennent au ménage, pas à une
 *               personne : l'appelant la calcule une fois et la passe aux deux conjoints.
 */
export function aDesRessources(p: ChampsPersonne, equite = 0): boolean {
  const revenus =
    p.revenuEmploi > 0 ||
    p.rrqA65 > 0 ||
    p.svA65 > 0 ||
    p.rentesEmployeur.length > 0 ||
    (p.periodesTravail ?? []).some((t) => t.montant > 0);

  const capital =
    p.comptes.some((c) => c.solde > 0) ||
    equite > 0 ||
    // Un héritage à montant nul est ignoré, comme dans `validation.ts`.
    (p.heritages ?? []).some((x) => x.montant > 0);

  return revenus || capital || epargneNonNulle(p);
}
