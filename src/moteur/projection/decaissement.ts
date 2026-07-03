/**
 * Solveur de décaissement : détermine les retraits nécessaires pour financer une cible de
 * dépenses NETTE d'impôt, en puisant dans les comptes selon un ordre donné.
 *
 * L'impôt dépend de la composition des retraits (compte imposable vs libre vs gain en capital)
 * et est progressif : on résout donc par bissection, compte par compte, en recalculant l'impôt
 * total à chaque itération.
 */
import { impotTotalPour } from '../moteurFiscal';
import { estLibreImpot, estNonEnregistre } from './comptes';
import type { Compte, TypeCompte } from './types';
import type { EntreeFiscale } from '../types';

const TOLERANCE = 0.01; // $
const MAX_ITERATIONS = 60;

/** Fraction du solde qui est un gain en capital latent (non-enregistré). */
function fractionGain(compte: Compte): number {
  if (compte.solde <= 0) return 0;
  return Math.max(0, (compte.solde - (compte.coutBase ?? 0)) / compte.solde);
}

/** Ajoute la portion imposable d'un retrait au bon champ de l'entrée fiscale. */
function ajouterRetraitImpot(entree: EntreeFiscale, compte: Compte, montant: number, age: number): EntreeFiscale {
  if (estLibreImpot(compte.type)) return entree; // CELI / CELIAPP : non imposable
  if (estNonEnregistre(compte.type)) {
    return { ...entree, gainsCapital: entree.gainsCapital + montant * fractionGain(compte) };
  }
  // Compte enregistré (REER/FERR/CRI/FRV) : revenu ordinaire ; admissible au crédit de pension à 65+.
  return age >= 65
    ? { ...entree, revenuPensionPrivee: entree.revenuPensionPrivee + montant }
    : { ...entree, autresRevenus: entree.autresRevenus + montant };
}

/** Revenu disponible (encaisse − impôt) pour une entrée fiscale donnée. */
function disponible(entree: EntreeFiscale, encaisse: number, annee: number): number {
  return encaisse - impotTotalPour(entree, annee);
}

export interface ResultatDecaissement {
  readonly entree: EntreeFiscale;
  readonly impot: number;
  readonly disponible: number;
  readonly retraitEnregistre: number;
  readonly retraitNonEnregistre: number;
  readonly retraitLibreImpot: number;
}

/**
 * Puise dans les comptes (déjà nets du minimum FERR forcé) pour atteindre la cible nette.
 * MUTE les soldes/coûts de base des comptes retirés.
 *
 * @param comptes         Comptes disponibles au décaissement (working copy, seront mutés).
 * @param ordre           Ordre de priorité des types de compte.
 * @param entreeForcee    Entrée fiscale incluant déjà RRQ, SV, minimum FERR, revenus de placement.
 * @param encaisseForcee  Encaisse déjà reçue (RRQ + SV + minimum FERR).
 * @param cible           Cible de dépenses nette d'impôt (nominale).
 */
export function financerDepenses(
  comptes: Compte[],
  ordre: readonly TypeCompte[],
  entreeForcee: EntreeFiscale,
  encaisseForcee: number,
  cible: number,
  annee: number,
  age: number,
): ResultatDecaissement {
  let entree = entreeForcee;
  let encaisse = encaisseForcee;
  let retraitEnregistre = 0;
  let retraitNonEnregistre = 0;
  let retraitLibreImpot = 0;

  const estAtteint = () => disponible(entree, encaisse, annee) >= cible - TOLERANCE;

  for (const type of ordre) {
    if (estAtteint()) break;
    for (const compte of comptes.filter((c) => c.type === type && c.solde > TOLERANCE)) {
      if (estAtteint()) break;

      const wMax = compte.solde;
      const entreeMax = ajouterRetraitImpot(entree, compte, wMax, age);
      const dispoMax = disponible(entreeMax, encaisse + wMax, annee);

      let w: number;
      if (dispoMax <= cible - TOLERANCE) {
        w = wMax; // vider le compte, on aura encore besoin d'autres retraits
      } else {
        // Bissection : trouver w tel que le disponible atteigne exactement la cible.
        let lo = 0;
        let hi = wMax;
        for (let i = 0; i < MAX_ITERATIONS; i++) {
          const mid = (lo + hi) / 2;
          const d = disponible(ajouterRetraitImpot(entree, compte, mid, age), encaisse + mid, annee);
          if (d < cible) lo = mid;
          else hi = mid;
          if (hi - lo < TOLERANCE) break;
        }
        w = hi;
      }

      // Appliquer le retrait : imposition, encaisse, réduction du solde et du coût de base.
      entree = ajouterRetraitImpot(entree, compte, w, age);
      encaisse += w;
      if (estNonEnregistre(compte.type)) {
        compte.coutBase = (compte.coutBase ?? 0) * (1 - w / compte.solde);
        retraitNonEnregistre += w;
      } else if (estLibreImpot(compte.type)) {
        retraitLibreImpot += w;
      } else {
        retraitEnregistre += w;
      }
      compte.solde -= w;
    }
  }

  const impot = impotTotalPour(entree, annee);
  return {
    entree,
    impot,
    disponible: encaisse - impot,
    retraitEnregistre,
    retraitNonEnregistre,
    retraitLibreImpot,
  };
}
