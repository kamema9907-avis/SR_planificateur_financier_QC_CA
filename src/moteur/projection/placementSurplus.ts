/**
 * Placement du surplus d'un retraité-actif.
 *
 * Quand le revenu de travail (net d'impôt et de retenues) dépasse les dépenses cibles, le surplus
 * est réinvesti dans l'ordre fiscalement optimal : CELI → REER (jusqu'à 71 ans, déductible) →
 * non-enregistré. Le REER n'est intéressant AVANT le non-enregistré que parce que la cotisation est
 * déductible : on modélise donc la déduction (via un rappel de recalcul d'impôt) et on réinvestit le
 * remboursement obtenu.
 */
import { AGE_CONVERSION_FERR } from '../constantes/ferr';
import type { ProfilRendement } from '../constantes/profilsRendement';
import type { EntreeFiscale } from '../types';
import type { Compte, TypeCompte } from './types';

/** Compteurs de droits de cotisation (mutés par le placement). */
export interface DroitsCotisation {
  droitsCeli: number;
  droitsReer: number;
}

function trouverOuCreer(comptes: Compte[], type: TypeCompte, profil: ProfilRendement): Compte {
  let c = comptes.find((x) => x.type === type);
  if (!c) {
    c = { type, solde: 0, profil, coutBase: type === 'NON_ENREGISTRE' ? 0 : undefined };
    comptes.push(c);
  }
  return c;
}

/**
 * Place un surplus NET (déjà après impôt et retenues) dans l'ordre CELI → REER (≤ 71 ans, déductible)
 * → non-enregistré. MUTE `comptes` et `droits`.
 *
 * Si un versement REER est possible, `recalculerImpotAvecDeduction(montantReer)` est appelé : il doit
 * renvoyer le NOUVEL impôt total (déduction appliquée) et l'entrée fiscale mise à jour. Le
 * remboursement d'impôt (impôt courant − nouvel impôt) est du liquide additionnel, réinvesti au
 * non-enregistré (aucune seconde itération : la rétroaction est volontairement bornée à un tour).
 *
 * @returns l'impôt final et l'entrée fiscale (inchangés s'il n'y a eu aucun versement REER).
 */
export function placerSurplusRetraite(
  comptes: Compte[],
  profilDefaut: ProfilRendement,
  droits: DroitsCotisation,
  surplusNet: number,
  age: number,
  entree: EntreeFiscale,
  impotCourant: number,
  recalculerImpotAvecDeduction: (montantReer: number) => { impot: number; entree: EntreeFiscale },
): { impot: number; entree: EntreeFiscale; ventilation: { celi: number; reer: number; nonEnr: number } } {
  let reste = surplusNet;
  let impot = impotCourant;
  let entreeMaj = entree;
  let auReer = 0;

  // 1. CELI (aucune limite d'âge) — dans la limite des droits ; l'excédent poursuit la chaîne.
  const auCeli = Math.min(reste, Math.max(0, droits.droitsCeli));
  if (auCeli > 0) {
    trouverOuCreer(comptes, 'CELI', profilDefaut).solde += auCeli;
    droits.droitsCeli -= auCeli;
    reste -= auCeli;
  }

  // 2. REER (déductible) — permis jusqu'à 71 ans, dans la limite des droits.
  if (reste > 0 && age <= AGE_CONVERSION_FERR && droits.droitsReer > 0) {
    auReer = Math.min(reste, droits.droitsReer);
    trouverOuCreer(comptes, 'REER', profilDefaut).solde += auReer;
    droits.droitsReer -= auReer;
    reste -= auReer;
    const rec = recalculerImpotAvecDeduction(auReer);
    const remboursement = Math.max(0, impot - rec.impot);
    impot = rec.impot;
    entreeMaj = rec.entree;
    reste += remboursement; // le remboursement d'impôt est du liquide à replacer
  }

  // 3. Non-enregistré — le reste (surplus au-delà des abris + remboursement d'impôt du REER).
  const auNonEnr = Math.max(0, reste);
  if (reste > 0) {
    const ne = trouverOuCreer(comptes, 'NON_ENREGISTRE', profilDefaut);
    ne.solde += reste;
    ne.coutBase = (ne.coutBase ?? 0) + reste;
  }

  return { impot, entree: entreeMaj, ventilation: { celi: auCeli, reer: auReer, nonEnr: auNonEnr } };
}

/** Compteurs de droits de cotisation, mutés par le placement. */
export interface DroitsPlacement {
  droitsCeli: number;
  droitsReer: number;
}

/** Où le capital a abouti, et la part qui ouvre droit à une déduction. */
export interface RepartitionCapital {
  celi: number;
  reer: number;
  nonEnr: number;
  /** Part versée au REER : déductible du revenu de l'année. */
  deductible: number;
}

/**
 * Place un **capital reçu** (héritage, produit net d'une vente immobilière) en
 * **CELI → REER → non-enregistré**, dans la limite des droits. MUTE `comptes` et `droits`.
 *
 * Contrairement à `placerSurplusRetraite`, cette fonction ne recalcule pas l'impôt : elle retourne
 * la part `deductible` que l'appelant intègre à l'entrée fiscale de l'année, avant de calculer
 * l'impôt. C'est indispensable en mode couple, où l'impôt est calculé conjointement avec
 * fractionnement — un recalcul isolé par personne y serait faux — et cela donne au passage un
 * traitement identique dans les deux modes.
 *
 * Le CELIAPP est volontairement exclu : le moteur ne peut pas vérifier l'admissibilité (achat d'une
 * première propriété). Le CRI et le FRV sont immobilisés, donc inéligibles à tout versement.
 * Au-delà de 71 ans, plus aucun versement REER n'est permis.
 *
 * `deductionUtilisable` borne le versement REER au revenu imposable qu'il reste à effacer cette
 * année-là. Sans cette borne, un apport de 200 000 $ avec de gros droits REER accumulés créait une
 * déduction de 166 000 $ sur un revenu de 123 000 $ : l'impôt tombait à zéro et les 43 000 $
 * excédentaires étaient **perdus**, alors que dans la réalité une cotisation non déduite est
 * reportable indéfiniment. Le moteur ne modélisant pas ce report, on préfère ne verser au REER que
 * ce qui procure une déduction immédiate — conservateur, et jamais trompeur sur l'impôt de l'année.
 */
export function placerCapital(
  comptes: Compte[],
  profilDefaut: ProfilRendement,
  droits: DroitsPlacement,
  montant: number,
  age: number,
  deductionUtilisable: number,
): RepartitionCapital {
  let reste = Math.max(0, montant);
  if (reste === 0) return { celi: 0, reer: 0, nonEnr: 0, deductible: 0 };

  const celi = Math.min(reste, Math.max(0, droits.droitsCeli));
  if (celi > 0) {
    trouverOuCreer(comptes, 'CELI', profilDefaut).solde += celi;
    droits.droitsCeli -= celi;
    reste -= celi;
  }

  let reer = 0;
  const plafondReer = Math.min(droits.droitsReer, Math.max(0, deductionUtilisable));
  if (reste > 0 && age <= AGE_CONVERSION_FERR && plafondReer > 0) {
    reer = Math.min(reste, plafondReer);
    trouverOuCreer(comptes, 'REER', profilDefaut).solde += reer;
    droits.droitsReer -= reer;
    reste -= reer;
  }

  const nonEnr = reste;
  if (nonEnr > 0) {
    const ne = trouverOuCreer(comptes, 'NON_ENREGISTRE', profilDefaut);
    ne.solde += nonEnr;
    ne.coutBase = (ne.coutBase ?? 0) + nonEnr;
  }

  return { celi, reer, nonEnr, deductible: reer };
}
