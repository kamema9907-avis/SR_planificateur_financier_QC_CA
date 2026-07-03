/**
 * Logique des comptes de placement : classification fiscale et croissance annuelle.
 */
import { composantesRendementBrut, rendementBrut } from '../constantes/profilsRendement';
import type { ProfilRendement } from '../constantes/profilsRendement';
import type { Compte, TypeCompte } from './types';

/** Comptes dont le retrait est pleinement imposable comme revenu ordinaire. */
const IMPOSABLES_AU_RETRAIT: readonly TypeCompte[] = ['REER', 'FERR', 'CRI', 'FRV'];
/** Comptes dont les retraits sont libres d'impôt. */
const LIBRES_IMPOT: readonly TypeCompte[] = ['CELI', 'CELIAPP'];

export function estImposableAuRetrait(type: TypeCompte): boolean {
  return IMPOSABLES_AU_RETRAIT.includes(type);
}
export function estLibreImpot(type: TypeCompte): boolean {
  return LIBRES_IMPOT.includes(type);
}
export function estNonEnregistre(type: TypeCompte): boolean {
  return type === 'NON_ENREGISTRE';
}

/** CELIAPP : plafonds de cotisation fixés par la loi (montants NOMINAUX, non indexés). */
export const CELIAPP_PLAFOND_ANNUEL = 8_000;
export const CELIAPP_PLAFOND_VIE = 40_000;

/**
 * CELI : cumul maximal des droits 2009→2026 (personne de 18 ans+ en 2009 n'ayant jamais cotisé).
 * Ce n'est PAS un plafond à vie : les droits croissent chaque année et un retrait les restaure
 * l'année suivante. Sert seulement au défaut heuristique du champ « droits disponibles ».
 */
export const CELI_DROITS_MAX_2026 = 109_000;
/** Plafond annuel CELI de l'année de base (indexé à l'inflation, arrondi au 500 $ près). */
export const CELI_PLAFOND_ANNUEL_2026 = 7_000;
const ANNEE_BASE_CELI = 2026;

/** Nouveaux droits CELI accordés une année donnée : 7 000 $ indexé, arrondi au 500 $ le plus près. */
export function droitsCeliAnnuels(annee: number, inflation: number): number {
  const indexe = CELI_PLAFOND_ANNUEL_2026 * Math.pow(1 + inflation, annee - ANNEE_BASE_CELI);
  return Math.round(indexe / 500) * 500;
}

/**
 * Défaut heuristique des droits CELI disponibles aujourd'hui : 109 000 $ (cumul 2026) moins le
 * solde actuel des comptes CELI. À remplacer par le chiffre exact de « Mon dossier » (ARC).
 */
export function droitsCeliParDefaut(comptes: readonly Compte[]): number {
  const soldeCeli = comptes.filter((c) => c.type === 'CELI').reduce((s, c) => s + c.solde, 0);
  return Math.max(0, CELI_DROITS_MAX_2026 - soldeCeli);
}

/**
 * Répartit une cotisation CELIAPP voulue (montant NOMINAL d'une année) entre la part admissible
 * au CELIAPP — plafonnée à 8 000 $/an ET à 40 000 $ à vie — et l'excédent (à rediriger, p. ex. au
 * CELI). `dejaCotiseCumul` = total nominal déjà cotisé au CELIAPP jusqu'ici.
 */
export function repartirCotisationCeliapp(
  montant: number,
  dejaCotiseCumul: number,
): { celiapp: number; excedent: number } {
  const roomVie = Math.max(0, CELIAPP_PLAFOND_VIE - dejaCotiseCumul);
  const celiapp = Math.max(0, Math.min(montant, CELIAPP_PLAFOND_ANNUEL, roomVie));
  return { celiapp, excedent: Math.max(0, montant - celiapp) };
}

/** Rendement net annuel d'un profil (brut − frais de gestion). */
export function rendementNet(profil: ProfilRendement, frais: number): number {
  return rendementBrut(profil) - frais;
}

/** Croissance annuelle d'un compte, avec ventilation fiscale (utile pour le non-enregistré). */
export interface CroissanceCompte {
  /** Croissance nette totale ($). */
  readonly total: number;
  /** Intérêt ($) — imposable annuellement dans un compte non enregistré. */
  readonly interet: number;
  /** Dividendes déterminés ($) — imposables annuellement dans un compte non enregistré. */
  readonly dividendes: number;
  /** Appréciation ($) — gain en capital différé (imposé à la réalisation). */
  readonly gainCapitalAccru: number;
}

/**
 * Croissance d'un compte pour une année. Les frais de gestion réduisent la portion
 * « gain en capital » (l'intérêt et les dividendes reçus sont considérés bruts de frais,
 * simplification raisonnable).
 *
 * Si `rendementPersonnalise` est fourni (fraction), il remplace le profil : le compte croît à
 * ce taux NET (aucun frais additionnel), la ventilation fiscale suivant les proportions du profil
 * équilibré (utile uniquement pour un compte non enregistré).
 */
export function croissanceAnnuelle(
  solde: number,
  profil: ProfilRendement,
  frais: number,
  rendementPersonnalise?: number,
): CroissanceCompte {
  if (rendementPersonnalise != null) {
    const eq = composantesRendementBrut('equilibre');
    const total = eq.interet + eq.dividendes + eq.gainCapital;
    const r = rendementPersonnalise;
    return {
      total: solde * r,
      interet: solde * r * (eq.interet / total),
      dividendes: solde * r * (eq.dividendes / total),
      gainCapitalAccru: solde * r * (eq.gainCapital / total),
    };
  }
  const c = composantesRendementBrut(profil);
  const interet = solde * c.interet;
  const dividendes = solde * c.dividendes;
  const gainCapitalAccru = solde * Math.max(0, c.gainCapital - frais);
  return { total: interet + dividendes + gainCapitalAccru, interet, dividendes, gainCapitalAccru };
}

/** Clone profond de la liste de comptes (pour ne pas muter les hypothèses d'entrée). */
export function clonerComptes(comptes: readonly Compte[]): Compte[] {
  return comptes.map((c) => ({ ...c }));
}

/** Somme des soldes (valeur nette brute des placements). */
export function valeurNette(comptes: readonly Compte[]): number {
  return comptes.reduce((somme, c) => somme + c.solde, 0);
}

/** Regroupe les soldes par type de compte (0 pour les types absents). */
export function soldesParType(comptes: readonly Compte[]): Record<TypeCompte, number> {
  const soldes: Record<TypeCompte, number> = {
    REER: 0,
    FERR: 0,
    CELI: 0,
    CELIAPP: 0,
    CRI: 0,
    FRV: 0,
    NON_ENREGISTRE: 0,
    REEE: 0,
  };
  for (const c of comptes) soldes[c.type] += c.solde;
  return soldes;
}
