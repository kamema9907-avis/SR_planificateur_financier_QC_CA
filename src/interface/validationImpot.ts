/**
 * Cohérence des données saisies dans l'onglet « Impôt (1 année) ».
 *
 * Pendant du `projection/validation.ts` : le moteur fiscal calcule ce qu'on lui donne, sans juger
 * si la situation est possible. Une pension de la Sécurité de la vieillesse à 50 ans produit un
 * résultat parfaitement calculé — et parfaitement irréel.
 *
 * Fonctions pures, sans React : testables comme le moteur.
 */
import type { EntreeFiscale } from '../moteur';
import type { AlerteAffichable } from './ui/ListeAlertes';

/** Âge minimal d'admissibilité à la Sécurité de la vieillesse. */
const AGE_MIN_SV = 65;
/** Âge minimal d'admissibilité à une rente de retraite du RRQ. */
const AGE_MIN_RRQ = 60;

export function validerEntreeFiscale(e: EntreeFiscale): AlerteAffichable[] {
  const a: AlerteAffichable[] = [];

  if (e.revenuPensionSV > 0 && e.age < AGE_MIN_SV) {
    a.push({
      niveau: 'attention',
      message: `La Sécurité de la vieillesse n'est versée qu'à partir de ${AGE_MIN_SV} ans ; l'âge saisi est ${e.age}.`,
    });
  }

  if (e.revenuRRQ > 0 && e.age < AGE_MIN_RRQ) {
    a.push({
      niveau: 'attention',
      message: `Une rente de retraite du RRQ ne peut débuter avant ${AGE_MIN_RRQ} ans ; l'âge saisi est ${e.age}. Une rente d'invalidité ou de survivant se saisit dans les champs prévus.`,
    });
  }

  if (e.renteSurvivantRRQ > 0 && e.revenuRRQ > 0 && e.age >= AGE_MIN_SV) {
    a.push({
      niveau: 'attention',
      message: "À 65 ans et plus, la rente de survivant est combinée à votre rente de retraite et plafonnée : saisir les deux séparément peut surestimer le total.",
    });
  }

  const cotisations = e.cotisationSyndicale + e.primeAssuranceSalaire;
  if (cotisations > 0 && e.revenuEmploi <= 0) {
    a.push({
      niveau: 'attention',
      message: "Cotisation syndicale ou assurance-salaire saisie sans revenu d'emploi : ces retenues suivent normalement un salaire.",
    });
  }

  if (e.deductionReer > 0 && e.revenuEmploi <= 0 && e.autresRevenus <= 0) {
    a.push({
      niveau: 'attention',
      message: 'Une déduction REER sans revenu gagné : les droits de cotisation proviennent du revenu de travail des années antérieures.',
    });
  }

  return a;
}
