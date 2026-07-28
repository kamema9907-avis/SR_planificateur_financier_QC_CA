/**
 * Projection de couple (Phase 3) : deux personnes, année par année, avec fractionnement du revenu
 * de pension, décaissement coordonné (équilibrage des revenus imposables), REER de conjoint, et
 * phase de survie (roulement sans impôt + rente de survivant RRQ).
 *
 * Réutilise le moteur fiscal (un calcul d'impôt par personne par année) et les briques de la
 * projection solo.
 */
import { ANNEE_BASE } from '../constantes/indexation';
import { AGE_CONVERSION_FERR, facteurRetraitMinimumFERR } from '../constantes/ferr';
import type { ProfilRendement } from '../constantes/profilsRendement';
import { construireBase, impotTotalPour } from '../moteurFiscal';
import { calculerCotisations, parametresCotisations } from '../cotisations';
import type { EntreeFiscale } from '../types';
import {
  clonerComptes,
  croissanceAnnuelle,
  droitsCeliAnnuels,
  droitsCeliParDefaut,
  droitsReerAnnuels,
  feRegimePD,
  plafondReerNominal,
  estLibreImpot,
  estNonEnregistre,
  repartirCotisationCeliapp,
  soldesParType,
  valeurNette,
  type CroissanceCompte,
} from './comptes';
import { financerDepenses } from './decaissement';
import { rrqNominale, svNominale, renteSurvivantRRQ } from './rentesPubliques';
import { totalRentesEmployeur } from './rentesEmployeur';
import { totalRevenuTravail } from './periodesTravail';
import { placerCapital, placerSurplusRetraite } from './placementSurplus';
import { totalHeritage } from './heritage';
import { impotCoupleOptimal } from './fractionnement';
import { fondreReer } from './fonteReer';
import {
  construireDetailFiscal,
  postesSignificatifs,
  sommePostes,
  type DetailCouple,
  type DetailDisponible,
  type DetailFractionnement,
  type DetailValeurNette,
  type Poste,
} from './trace';
import { detaillerVentes } from './trace';
import {
  clonerImmeubles,
  determinerBienAbrite,
  gainAuDeces,
  roulementImmeubles,
  traiterImmeublesAnnee,
  type AgregatImmo,
  type EtatImmeuble,
  type VenteRealisee,
} from './immobilier';
import type { Compte, TypeCompte } from './types';
import type { AnneeCouple, HypothesesCouple, PersonneProjection, ResultatCouple } from './typesCouple';

const TYPES_ENREGISTRES: readonly TypeCompte[] = ['REER', 'FERR', 'CRI', 'FRV'];
const PLAFOND_SUBVENTION_REEE = 2_500;
const TAUX_SUBVENTION_REEE = 0.3;

/** État mutable d'une personne pendant la projection. */
interface EtatPersonne {
  p: PersonneProjection;
  comptes: Compte[];
  profilDefaut: ProfilRendement;
  survivant: boolean;
  /** Cumul nominal des cotisations CELIAPP (plafond à vie de 40 000 $). */
  celiappCotiseCumul: number;
  /** Droits de cotisation CELI disponibles (compteur vivant). */
  droitsCeli: number;
  /** Retraits CELI de l'année : restaurés en droits au 1er janvier suivant. */
  droitsCeliRestaures: number;
  /** Droits de cotisation REER disponibles (report ; aucune restauration au retrait). */
  droitsReer: number;
}

/** Solde total des comptes CELI d'une personne. */
const soldeCeli = (etat: EtatPersonne) =>
  etat.comptes.filter((c) => c.type === 'CELI').reduce((s, c) => s + c.solde, 0);

/** Verse au CELI d'une personne dans la limite de ses droits ; l'excédent déborde au non-enregistré. */
function verserAuCeli(etat: EtatPersonne, montant: number): void {
  const auCeli = Math.min(montant, Math.max(0, etat.droitsCeli));
  if (auCeli > 0) {
    trouverOuCreer(etat.comptes, 'CELI', etat.profilDefaut).solde += auCeli;
    etat.droitsCeli -= auCeli;
  }
  const reste = montant - auCeli;
  if (reste > 0) {
    const ne = trouverOuCreer(etat.comptes, 'NON_ENREGISTRE', etat.profilDefaut);
    ne.solde += reste;
    ne.coutBase = (ne.coutBase ?? 0) + reste;
  }
}

/**
 * Verse au REER (compte du `destinataire`) dans la limite des droits du `cotisant` ; l'excédent
 * (argent du cotisant) suit SA chaîne CELI → non-enregistré. Retourne la part déductible.
 */
function verserAuReer(cotisant: EtatPersonne, destinataire: EtatPersonne, montant: number): number {
  const auReer = Math.min(montant, Math.max(0, cotisant.droitsReer));
  if (auReer > 0) {
    trouverOuCreer(destinataire.comptes, 'REER', destinataire.profilDefaut).solde += auReer;
    cotisant.droitsReer -= auReer;
  }
  const excedent = montant - auReer;
  if (excedent > 0) verserAuCeli(cotisant, excedent);
  return auReer; // déductible
}

/** Accumulation annuelle des droits REER d'une personne : 18 % du salaire (plafonné) − facteur d'équivalence. */
function accrualReer(etat: EtatPersonne, salaireNominal: number, annee: number, facteurInflation: number): void {
  const fe =
    etat.p.facteurEquivalenceReer && etat.p.facteurEquivalenceReer > 0
      ? etat.p.facteurEquivalenceReer * facteurInflation
      : etat.p.regimeRetraitePD
        ? feRegimePD(salaireNominal)
        : 0;
  etat.droitsReer += droitsReerAnnuels(salaireNominal, plafondReerNominal(annee), fe);
}

function nouvelleEntree(age: number, vitSeul: boolean): EntreeFiscale {
  return {
    annee: 2026, province: 'QC', age, vitSeul,
    revenuEmploi: 0, revenuRRQ: 0, renteSurvivantRRQ: 0, revenuPensionSV: 0, revenuPensionPrivee: 0,
    autresRevenus: 0, dividendesDetermines: 0, dividendesOrdinaires: 0, gainsCapital: 0,
    deductionReer: 0, autresDeductions: 0, cotisationFondsTravailleurs: 0,
    cotisationSyndicale: 0, primeAssuranceSalaire: 0, assuranceSalaireDeductible: false,
  };
}

function trouverOuCreer(comptes: Compte[], type: TypeCompte, profil: ProfilRendement): Compte {
  let c = comptes.find((x) => x.type === type);
  if (!c) {
    c = { type, solde: 0, profil, coutBase: type === 'NON_ENREGISTRE' ? 0 : undefined };
    comptes.push(c);
  }
  return c;
}

const splittable = (e: EntreeFiscale, age: number, renteEmp: number) =>
  age >= 65 ? Math.max(0, e.revenuPensionPrivee) : Math.max(0, renteEmp);

/** Contexte annuel d'une personne : revenus forcés, croissance, minimum FERR déjà retiré. */
interface Contexte {
  age: number;
  croissances: Map<Compte, CroissanceCompte>;
  entree: EntreeFiscale;
  /** Encaisse de l'année, DÉJÀ nette des retenues sur la paie (RRQ/AE/RQAP). */
  encaisse: number;
  renteEmp: number;
  travaille: boolean;
  /** Revenu d'emploi brut (vie active OU travail à la retraite). */
  salaire: number;
  /** Retenues sur la paie (RRQ/AE/RQAP) déjà retranchées de `encaisse`. */
  retenuesPaie: number;
  /** Héritage reçu cette année (non imposable), déjà inclus dans `encaisse`. */
  heritageRecu: number;
  /** Produit d'une vente immobilière encaissé cette année, déjà inclus dans `encaisse`. */
  cashVente: number;
  /** Gain en capital imposable de cette vente (0 si exempté). */
  gainVente: number;
}

function preparerPersonne(
  etat: EtatPersonne, i: number, annee: number, inflation: number, frais: number, rrqSurvivant: number,
): Contexte {
  const p = etat.p;
  const age = p.ageActuel + i;

  const croissances = new Map<Compte, CroissanceCompte>();
  for (const c of etat.comptes) croissances.set(c, croissanceAnnuelle(c.solde, c.profil, frais, c.rendementPersonnalise));
  const nonEnr = etat.comptes.filter((c) => estNonEnregistre(c.type));
  const interetNonEnr = nonEnr.reduce((s, c) => s + croissances.get(c)!.interet, 0);
  const dividendesNonEnr = nonEnr.reduce((s, c) => s + croissances.get(c)!.dividendes, 0);

  const rrq = rrqNominale(p.rrqA65, p.ageDebutRRQ, age, annee, inflation) + rrqSurvivant;
  const sv = svNominale(p.svA65, p.ageDebutSV, age, annee, inflation);
  const renteEmp = totalRentesEmployeur(p.rentesEmployeur, age, p.ageActuel, inflation);

  let minimumFERR = 0;
  if (age > AGE_CONVERSION_FERR) {
    const facteur = facteurRetraitMinimumFERR(age);
    for (const c of etat.comptes.filter((x) => TYPES_ENREGISTRES.includes(x.type) && x.solde > 0)) {
      const r = Math.min(facteur * c.solde, c.solde);
      c.solde -= r;
      minimumFERR += r;
    }
  }

  const travaille = age < p.ageRetraite;
  const salaireVieActive = travaille
    ? p.revenuEmploi * Math.pow((1 + inflation) * (1 + p.croissanceSalaireReelle), i)
    : 0;
  // Travail poursuivi À LA RETRAITE (« retraité-actif ») : ne s'applique qu'une fois la retraite
  // atteinte ; rouvre des droits REER (jusqu'à 71 ans).
  const revenuTravailRetraite = travaille
    ? 0
    : totalRevenuTravail(p.periodesTravail, age, p.ageActuel, inflation);
  if (revenuTravailRetraite > 0 && age <= AGE_CONVERSION_FERR) {
    etat.droitsReer += droitsReerAnnuels(revenuTravailRetraite, plafondReerNominal(annee), 0);
  }
  const salaire = salaireVieActive + revenuTravailRetraite;
  const retenuesPaie = salaire > 0 ? calculerCotisations(salaire, parametresCotisations(annee)).total : 0;

  // Héritage reçu par CETTE personne cette année (non imposable). Un héritage n'est jamais commun :
  // une succession désigne un héritier, et au Québec il reste un bien propre.
  const heritageRecu = totalHeritage(p.heritages, age, p.ageActuel, inflation);

  const entree: EntreeFiscale = {
    ...nouvelleEntree(age, etat.survivant),
    revenuEmploi: salaire,
    revenuRRQ: rrq,
    revenuPensionSV: sv,
    revenuPensionPrivee: minimumFERR + renteEmp,
    autresRevenus: interetNonEnr,
    dividendesDetermines: dividendesNonEnr,
  };
  return {
    age,
    croissances,
    entree,
    encaisse: salaire - retenuesPaie + rrq + sv + renteEmp + minimumFERR + heritageRecu,
    renteEmp,
    travaille,
    salaire,
    retenuesPaie,
    heritageRecu,
    cashVente: 0,
    gainVente: 0,
  };
}

/**
 * Place l'héritage reçu par une personne dans SES comptes, en consommant SES droits.
 *
 * N'a de sens qu'en phase d'accumulation : en décaissement, l'héritage est déjà entré dans
 * `encaisse` et c'est le solveur qui décide ce qui est dépensé, le surplus étant replacé par
 * `placerSurplusRetraite`.
 */
function poserCapital(etat: EtatPersonne, ctx: Contexte, annee: number, deductionDejaPrevue: number) {
  const vide = { celi: 0, reer: 0, nonEnr: 0, deductible: 0, place: 0, provision: 0 };

  // Impôt attribuable au gain de la vente : le produit ne peut être placé que NET de cet impôt,
  // sinon le même argent servirait deux fois. Mesuré par personne, donc avant fractionnement — une
  // approximation de second ordre. Contrairement au mode solo, le couple ne restitue PAS de
  // reliquat : la provision non consommée reste simplement dans le revenu disponible de l'année.
  let provision = 0;
  if (ctx.cashVente > 0 && ctx.gainVente > 0) {
    const avec = { ...ctx.entree, deductionReer: deductionDejaPrevue };
    const sans = { ...avec, gainsCapital: Math.max(0, avec.gainsCapital - ctx.gainVente) };
    provision = Math.max(0, impotTotalPour(avec, annee) - impotTotalPour(sans, annee));
  }
  const aPlacer = ctx.heritageRecu + Math.max(0, ctx.cashVente - provision);
  if (aPlacer <= 0) return { ...vide, provision };

  // Revenu imposable restant après les déductions déjà prévues : borne le versement REER, car
  // au-delà la déduction serait perdue (le moteur ne modélise pas son report). Le gain de la vente
  // en fait partie — c'est ce qui permet « vendre puis cotiser au REER pour absorber le gain ».
  const base = construireBase({ ...ctx.entree, deductionReer: deductionDejaPrevue }, annee);
  const deductionUtilisable = Math.max(0, base.revenuTotalImpose - base.deductionsFederal);
  const droits = { droitsCeli: etat.droitsCeli, droitsReer: etat.droitsReer };
  const pose = placerCapital(etat.comptes, etat.profilDefaut, droits, aPlacer, ctx.age, deductionUtilisable);
  etat.droitsCeli = droits.droitsCeli;
  etat.droitsReer = droits.droitsReer;
  return { ...pose, place: aPlacer, provision };
}

/**
 * Impôt attribuable au gain d'une vente, par la convention « impôt avec le gain, moins impôt sans ».
 * Sert la traçabilité : il n'existe pas d'impôt « par bien », l'impôt porte sur le revenu total.
 */
function impotDuGainVente(entree: EntreeFiscale, gainVente: number, annee: number): number {
  if (gainVente <= 0.5) return 0;
  const sans = { ...entree, gainsCapital: Math.max(0, entree.gainsCapital - gainVente) };
  return Math.max(0, impotTotalPour(entree, annee) - impotTotalPour(sans, annee));
}

/** Applique les cotisations d'une personne (dont le REER de conjoint versé à l'autre). */
function appliquerCotisations(etat: EtatPersonne, facteurInflation: number, conjoint: EtatPersonne) {
  let deductible = 0;
  let cotisations = 0;

  // Fonds de travailleurs (FTQ/Fondaction) : donne SEULEMENT le crédit de 30 % (1er 5 000 $). La
  // cotisation est déjà comptée dans l'épargne REER (champ REER) — on n'ajoute rien au REER ici.
  const fondsTravailleurs =
    etat.p.fondsTravailleursAnnuel && etat.p.fondsTravailleursAnnuel > 0
      ? etat.p.fondsTravailleursAnnuel * facteurInflation
      : 0;

  for (const [type, montantAuj] of Object.entries(etat.p.epargneAnnuelle) as [TypeCompte, number][]) {
    if (!montantAuj) continue;
    const montant = montantAuj * facteurInflation;

    // CELI : plafonné par les droits de cotisation (excédent → non-enregistré).
    if (type === 'CELI') {
      verserAuCeli(etat, montant);
      cotisations += montant;
      continue;
    }

    // CELIAPP : plafonner (8 000 $/an, 40 000 $ à vie) ; l'excédent suit la chaîne CELI → non-enr.
    if (type === 'CELIAPP') {
      const { celiapp, excedent } = repartirCotisationCeliapp(montant, etat.celiappCotiseCumul);
      if (celiapp > 0) {
        trouverOuCreer(etat.comptes, 'CELIAPP', etat.profilDefaut).solde += celiapp;
        deductible += celiapp;
        etat.celiappCotiseCumul += celiapp;
        cotisations += celiapp;
      }
      if (excedent > 0) {
        verserAuCeli(etat, excedent); // redirigé (non déductible), dans la limite des droits CELI
        cotisations += excedent;
      }
      continue;
    }

    // REER : plafonné aux droits du cotisant ; l'excédent suit la chaîne CELI → non-enregistré.
    if (type === 'REER') {
      deductible += verserAuReer(etat, etat, montant);
      cotisations += montant;
      continue;
    }

    const c = trouverOuCreer(etat.comptes, type, etat.profilDefaut);
    c.solde += montant;
    cotisations += montant;
    if (type === 'NON_ENREGISTRE') c.coutBase = (c.coutBase ?? 0) + montant;
    if (type === 'REEE') c.solde += TAUX_SUBVENTION_REEE * Math.min(montant, PLAFOND_SUBVENTION_REEE * facteurInflation);
  }
  // REER de conjoint : consomme les droits du COTISANT (etat), versé au REER de l'autre.
  if (etat.p.epargneReerConjoint > 0) {
    const montant = etat.p.epargneReerConjoint * facteurInflation;
    deductible += verserAuReer(etat, conjoint, montant);
    cotisations += montant;
  }
  return { deductible, cotisations, fondsTravailleurs };
}

function appliquerCroissance(etat: EtatPersonne, croissances: Map<Compte, CroissanceCompte>) {
  for (const c of etat.comptes) {
    const g = croissances.get(c);
    if (!g) continue;
    c.solde += g.total;
    if (estNonEnregistre(c.type)) c.coutBase = (c.coutBase ?? 0) + g.interet + g.dividendes;
  }
}

const niveauImposable = (e: EntreeFiscale) => construireBase(e).revenuTotalImpose;

function fractionGain(c: Compte): number {
  if (c.solde <= 0) return 0;
  return Math.max(0, (c.solde - (c.coutBase ?? 0)) / c.solde);
}

function appliquerRetrait(e: EntreeFiscale, c: Compte, montant: number, age: number): EntreeFiscale {
  if (estLibreImpot(c.type)) return e;
  if (estNonEnregistre(c.type)) return { ...e, gainsCapital: e.gainsCapital + montant * fractionGain(c) };
  return age >= 65
    ? { ...e, revenuPensionPrivee: e.revenuPensionPrivee + montant }
    : { ...e, autresRevenus: e.autresRevenus + montant };
}

/** Décaissement coordonné du couple : finance la cible du ménage en équilibrant les revenus. */
function financerCouple(
  etat1: EtatPersonne, etat2: EtatPersonne, ctx1: Contexte, ctx2: Contexte,
  cible: number, annee: number, ordre: readonly TypeCompte[],
) {
  const TOL = 0.01;
  let e1 = ctx1.entree;
  let e2 = ctx2.entree;
  let encaisse = ctx1.encaisse + ctx2.encaisse;
  const retraits = { enr1: 0, nonenr1: 0, libre1: 0, enr2: 0, nonenr2: 0, libre2: 0 };

  const impotSansSplit = () => impotTotalPour(e1, annee) + impotTotalPour(e2, annee);
  const atteint = () => encaisse - impotSansSplit() >= cible - TOL;

  for (const type of ordre) {
    let garde = 0;
    while (!atteint() && garde++ < 200) {
      const cands: { c: Compte; owner: 1 | 2 }[] = [];
      for (const c of etat1.comptes) if (c.type === type && c.solde > TOL) cands.push({ c, owner: 1 });
      for (const c of etat2.comptes) if (c.type === type && c.solde > TOL) cands.push({ c, owner: 2 });
      if (cands.length === 0) break;

      let choisi: { c: Compte; owner: 1 | 2 };
      if (estLibreImpot(type)) {
        choisi = cands.reduce((a, b) => (b.c.solde > a.c.solde ? b : a));
      } else {
        const prefere: 1 | 2 = niveauImposable(e1) <= niveauImposable(e2) ? 1 : 2;
        choisi = cands.find((x) => x.owner === prefere) ?? cands[0];
      }
      const { c, owner } = choisi;
      const age = owner === 1 ? ctx1.age : ctx2.age;
      const courant = () => (owner === 1 ? e1 : e2);
      const poser = (ne: EntreeFiscale) => (owner === 1 ? (e1 = ne) : (e2 = ne));
      const dispoAvec = (w: number) => {
        const em = appliquerRetrait(courant(), c, w, age);
        const autre = owner === 1 ? impotTotalPour(e2, annee) : impotTotalPour(e1, annee);
        return encaisse + w - (impotTotalPour(em, annee) + autre);
      };

      let w: number;
      if (dispoAvec(c.solde) <= cible - TOL) {
        w = c.solde;
      } else {
        let lo = 0;
        let hi = c.solde;
        for (let k = 0; k < 50; k++) {
          const mid = (lo + hi) / 2;
          if (dispoAvec(mid) < cible) lo = mid;
          else hi = mid;
          if (hi - lo < TOL) break;
        }
        w = hi;
      }

      if (estNonEnregistre(c.type)) {
        c.coutBase = (c.coutBase ?? 0) * (1 - w / c.solde);
        if (owner === 1) retraits.nonenr1 += w; else retraits.nonenr2 += w;
      } else if (estLibreImpot(c.type)) {
        if (owner === 1) retraits.libre1 += w; else retraits.libre2 += w;
      } else {
        if (owner === 1) retraits.enr1 += w; else retraits.enr2 += w;
      }
      poser(appliquerRetrait(courant(), c, w, age));
      encaisse += w;
      c.solde -= w;
    }
  }

  const opt = impotCoupleOptimal(e1, e2, annee, splittable(e1, ctx1.age, ctx1.renteEmp), splittable(e2, ctx2.age, ctx2.renteEmp));
  return { impot: opt.impot, transfert: opt.transfert, disponible: encaisse - opt.impot, retraits, e1, e2 };
}

function roulement(defunt: EtatPersonne, survivant: EtatPersonne) {
  for (const c of defunt.comptes) {
    if (c.solde <= 0) continue;
    const dest = trouverOuCreer(survivant.comptes, c.type, survivant.profilDefaut);
    dest.solde += c.solde;
    if (estNonEnregistre(c.type)) dest.coutBase = (dest.coutBase ?? 0) + (c.coutBase ?? c.solde);
    c.solde = 0;
  }
}

function impotAuDeces(etat: EtatPersonne, age: number, annee: number, gainImmo: number): number {
  const registres = etat.comptes.filter((c) => TYPES_ENREGISTRES.includes(c.type)).reduce((s, c) => s + c.solde, 0);
  const gains = etat.comptes.filter((c) => estNonEnregistre(c.type)).reduce((s, c) => s + Math.max(0, c.solde - (c.coutBase ?? 0)), 0);
  const e: EntreeFiscale = { ...nouvelleEntree(age, true), revenuPensionPrivee: registres, gainsCapital: gains + gainImmo };
  return impotTotalPour(e, annee);
}

/** Injecte l'immobilier d'un propriétaire dans son contexte fiscal (revenus, loyers, produit de vente). */
function foldImmo(ctx: Contexte, a: AgregatImmo): void {
  ctx.entree = {
    ...ctx.entree,
    autresRevenus: ctx.entree.autresRevenus + a.revenuImposable,
    gainsCapital: ctx.entree.gainsCapital + a.gainBrut,
  };
  // Le produit rejoint l'encaisse, comme en mode solo : en décaissement il finance les dépenses de
  // l'année avant tout placement ; en accumulation, `poserCapital` le place net de l'impôt du gain.
  ctx.encaisse += a.loyerCash + a.cashVente;
  ctx.cashVente = a.cashVente;
  ctx.gainVente = a.gainBrut;
}

/** Équité totale des biens non vendus (valeur − hypothèque). */
function equiteTotale(etats: readonly EtatImmeuble[]): number {
  return etats.reduce((s, e) => (e.vendu ? s : s + Math.max(0, e.valeur - e.hypotheque)), 0);
}

const LIBELLE_COMPTE: Record<TypeCompte, string> = {
  REER: 'REER', FERR: 'FERR', CELI: 'CELI', CELIAPP: 'CELIAPP', CRI: 'CRI', FRV: 'FRV',
  NON_ENREGISTRE: 'Non-enregistré', REEE: 'REEE',
};

/** Composantes agrégées du ménage pour bâtir la traçabilité d'une année de couple. */
interface CompMenage {
  travail: number;
  rentesPubliques: number;
  rentesPrivees: number;
  retraits: number;
  loyers: number;
  /** Produit encaissé d'une vente immobilière. */
  ventes: number;
  /** Héritages reçus (non imposables). */
  heritage: number;
  /** Capital sorti du flux pour être placé (héritage + produit net de vente). */
  capitalPlace: number;
  retenues: number;
  cotisations: number;
  paiementImmo: number;
  /** Détail bien par bien des ventes de l'année. */
  ventesRealisees: readonly VenteRealisee[];
  /** Impôt réellement supporté à cause des gains de vente. */
  impotSupporteVente: number;
  /** Cible TOTALE à financer = train de vie indexé + paiement hypothécaire. */
  cible: number;
  /** Cible du ménage telle que saisie, en dollars d'aujourd'hui. */
  cibleSaisie: number;
  /** Part conservée par le survivant ; 1 tant que les deux conjoints vivent. */
  fractionSurvivant: number;
  facteurInflation: number;
  ventilSurplus: { celi: number; reer: number; nonEnr: number };
}

/**
 * Assemble la traçabilité d'une année de couple : disponible du ménage, impôt de chaque conjoint
 * (post-fractionnement) + économie du fractionnement, valeur nette du ménage. `e1`/`e2` sont les
 * entrées fiscales FINALES de chaque conjoint (null si décédé) ; `transfert` est le fractionnement
 * optimal appliqué (> 0 : conjoint 1 → conjoint 2).
 */
function construireDetailCouple(
  phase: AnneeCouple['phase'],
  comp: CompMenage,
  annee: number,
  e1: EntreeFiscale | null,
  e2: EntreeFiscale | null,
  transfert: number,
  impotMenage: number,
  nom1: string,
  nom2: string,
  comptes1: readonly Compte[],
  comptes2: readonly Compte[],
  etatsImmo: readonly EtatImmeuble[],
): DetailCouple {
  const entreesBrut: Poste[] = [
    { libelle: 'Revenus de travail', montant: comp.travail },
    { libelle: 'Rentes publiques (RRQ + SV)', montant: comp.rentesPubliques },
    { libelle: 'Rentes privées / FERR minimum', montant: comp.rentesPrivees },
    { libelle: 'Retraits de comptes', montant: comp.retraits },
    { libelle: 'Loyers encaissés', montant: comp.loyers },
    { libelle: 'Produit de vente / downsizing', montant: comp.ventes, lien: 'vente' },
    { libelle: 'Héritage reçu (non imposable)', montant: comp.heritage },
  ];
  const sortiesBrut: Poste[] =
    phase === 'accumulation'
      ? [
          { libelle: 'Impôt du ménage', montant: -impotMenage, lien: 'impot' },
          { libelle: 'Cotisations (épargne)', montant: -comp.cotisations },
          { libelle: 'Capital placé (héritage, vente)', montant: -comp.capitalPlace },
          { libelle: 'Retenues sur la paie', montant: -comp.retenues },
        ]
      : [
          { libelle: 'Impôt du ménage', montant: -impotMenage, lien: 'impot' },
          { libelle: 'Retenues sur la paie', montant: -comp.retenues },
        ];
  // Sortie dans les DEUX phases : voir la note équivalente dans `projection.ts`.
  sortiesBrut.push({ libelle: 'Paiement hypothécaire', montant: -comp.paiementImmo });
  const entrees = postesSignificatifs(entreesBrut);
  const sorties = postesSignificatifs(sortiesBrut);
  const revenusNets = sommePostes(entrees) + sommePostes(sorties);
  // Hypothèque exclue : elle vient d'être comptée dans les sorties.
  // Le test porte sur la CIBLE et non sur la phase : le couple en a trois, et la phase « survie »
  // décaisse elle aussi. Se fier à `phase === 'decaissement'` mettait les dépenses à zéro pendant
  // toute la survie du conjoint restant.
  const depenses = comp.cible > 0 ? comp.cible - comp.paiementImmo : 0;
  // Même raisonnement que pour `depenses` : la phase « survie » décaisse elle aussi, et le
  // survivant peut dégager un surplus réinvesti. Se fier à `phase === 'decaissement'` affichait un
  // surplus nul alors que la ventilation du réinvestissement, elle, était renseignée.
  const surplus = comp.cible > 0 ? Math.max(0, revenusNets - depenses) : 0;

  const disponible: DetailDisponible = {
    entrees,
    sorties,
    revenusNets,
    depenses,
    detailDepenses: {
      cibleSaisie: comp.cibleSaisie,
      fractionSurvivant: comp.fractionSurvivant,
      facteurInflation: comp.facteurInflation,
    },
    ventes: detaillerVentes(comp.ventesRealisees, comp.impotSupporteVente),
    ventesSeuleSourceDeCapital: comp.heritage <= 0.5,
    surplus,
    destinationSurplus: postesSignificatifs([
      { libelle: 'CELI', montant: comp.ventilSurplus.celi },
      { libelle: 'REER', montant: comp.ventilSurplus.reer },
      { libelle: 'Non-enregistré', montant: comp.ventilSurplus.nonEnr },
    ]),
  };

  // Détail fiscal de chaque conjoint sur son entrée POST-fractionnement.
  const a1 = e1 ? { ...e1, revenuPensionPrivee: e1.revenuPensionPrivee - transfert } : null;
  const a2 = e2 ? { ...e2, revenuPensionPrivee: e2.revenuPensionPrivee + transfert } : null;
  const impot1 = a1 ? construireDetailFiscal(a1, annee, 0, []) : null;
  const impot2 = a2 ? construireDetailFiscal(a2, annee, 0, []) : null;
  const impotSans = (e1 ? impotTotalPour(e1, annee) : 0) + (e2 ? impotTotalPour(e2, annee) : 0);
  const fractionnement: DetailFractionnement = {
    nom1,
    nom2,
    transfert,
    impotSans,
    impotAvec: impotMenage,
    economie: Math.max(0, impotSans - impotMenage),
  };

  const valeurNette: DetailValeurNette = {
    comptes: postesSignificatifs([
      ...comptes1.map((c) => ({ libelle: `${LIBELLE_COMPTE[c.type]} — ${nom1}`, montant: c.solde })),
      ...comptes2.map((c) => ({ libelle: `${LIBELLE_COMPTE[c.type]} — ${nom2}`, montant: c.solde })),
    ]),
    immobilier: postesSignificatifs(
      etatsImmo.map((e) => ({ libelle: e.bien.nom, montant: e.vendu ? 0 : Math.max(0, e.valeur - e.hypotheque) })),
    ),
  };

  return { disponible, nom1, nom2, impot1, impot2, impotMenage, fractionnement, valeurNette };
}

/** Projette un couple sur tout le cycle de vie. */
export function projeterCouple(h: HypothesesCouple, options: { trace?: boolean } = {}): ResultatCouple {
  const etat1: EtatPersonne = { p: h.personne1, comptes: clonerComptes(h.personne1.comptes), profilDefaut: h.personne1.comptes[0]?.profil ?? 'equilibre', survivant: false, celiappCotiseCumul: h.personne1.celiappDejaCotise ?? 0, droitsCeli: h.personne1.droitsCeliDisponibles ?? droitsCeliParDefaut(h.personne1.comptes), droitsCeliRestaures: 0, droitsReer: h.personne1.droitsReerDisponibles ?? 0 };
  const etat2: EtatPersonne = { p: h.personne2, comptes: clonerComptes(h.personne2.comptes), profilDefaut: h.personne2.comptes[0]?.profil ?? 'equilibre', survivant: false, celiappCotiseCumul: h.personne2.celiappDejaCotise ?? 0, droitsCeli: h.personne2.droitsCeliDisponibles ?? droitsCeliParDefaut(h.personne2.comptes), droitsCeliRestaures: 0, droitsReer: h.personne2.droitsReerDisponibles ?? 0 };

  const etatsImmo = clonerImmeubles(h.immeubles);
  const bienAbrite = determinerBienAbrite(h.immeubles);

  const annees: AnneeCouple[] = [];
  let impotTotalVieReel = 0;
  let anneeEpuisement: number | null = null;
  let valeurNetteFinaleReelle = 0;
  let defunt: PersonneProjection | null = null;

  const iFin = Math.max(h.personne1.ageDeces - h.personne1.ageActuel, h.personne2.ageDeces - h.personne2.ageActuel);

  for (let i = 0; i <= iFin; i++) {
    const annee = ANNEE_BASE + i;
    const facteurInflation = Math.pow(1 + h.inflation, i);
    const deflateur = 1 / facteurInflation;
    const age1 = h.personne1.ageActuel + i;
    const age2 = h.personne2.ageActuel + i;
    const vivant1 = age1 <= h.personne1.ageDeces;
    const vivant2 = age2 <= h.personne2.ageDeces;
    if (!vivant1 && !vivant2) break;

    // Droits CELI : +droits annuels + retraits de l'an dernier (restaurés au 1er janvier).
    if (i > 0) {
      for (const etat of [etat1, etat2]) {
        etat.droitsCeli += droitsCeliAnnuels(annee, h.inflation) + etat.droitsCeliRestaures;
        etat.droitsCeliRestaures = 0;
      }
    }

    let impotAnnee = 0;
    let revenuDisponible = 0;
    let fractionnement = 0;
    let phase: AnneeCouple['phase'];

    // Capture pour la traçabilité (remplie dans chaque branche ; assemblée au push, après la croissance).
    let traceData: { phase: AnneeCouple['phase']; comp: CompMenage; e1: EntreeFiscale | null; e2: EntreeFiscale | null; transfert: number } | null = null;
    let traceVentil = { celi: 0, reer: 0, nonEnr: 0 };

    // Immobilier : amortissement, loyers, ventes, appréciation (par propriétaire).
    const ageProprio = (p: 1 | 2 | 'commun'): number | null =>
      p === 2 ? (vivant2 ? age2 : null) : p === 1 ? (vivant1 ? age1 : null) : vivant1 ? age1 : vivant2 ? age2 : null;
    const anneeImmo = traiterImmeublesAnnee(etatsImmo, i, h.inflation, ageProprio, bienAbrite);
    const aggImmo = anneeImmo.parProprietaire;
    const paiementImmo = aggImmo[1].paiement + aggImmo[2].paiement;
    const equiteImmo = aggImmo[1].equite + aggImmo[2].equite;

    /** Capital placé cette année (héritage + produit net de vente), retiré du flux consommable. */
    let capitalPlaceAnnee = 0;

    if (vivant1 && vivant2) {
      const ctx1 = preparerPersonne(etat1, i, annee, h.inflation, h.fraisGestion, 0);
      const ctx2 = preparerPersonne(etat2, i, annee, h.inflation, h.fraisGestion, 0);
      foldImmo(ctx1, aggImmo[1]);
      foldImmo(ctx2, aggImmo[2]);

      // Le décaissement commence dès que le PREMIER conjoint est à la retraite : c'est à ce
      // moment que le ménage adopte son budget de retraite. Attendre le second créait un trou —
      // le conjoint déjà retraité ne gagnait plus rien, et pourtant aucune dépense n'était
      // prélevée, ce qui surestimait le patrimoine de plusieurs années de dépenses.
      //
      // Le salaire de celui qui travaille encore entre dans l'encaisse : le solveur ne retire que
      // le manque, et rien du tout si ce salaire couvre la cible. Le surplus éventuel est
      // réinvesti par `placerSurplusRetraite`, qui remplace alors l'épargne planifiée.
      if (!ctx1.travaille || !ctx2.travaille) {
        phase = 'decaissement';
        const cible = h.depensesRetraite * facteurInflation + paiementImmo;
        const celiAvant1 = soldeCeli(etat1);
        const celiAvant2 = soldeCeli(etat2);
        const res = financerCouple(etat1, etat2, ctx1, ctx2, cible, annee, h.ordreDecaissement);
        // Les retraits CELI restaurent les droits équivalents l'année suivante.
        etat1.droitsCeliRestaures += Math.max(0, celiAvant1 - soldeCeli(etat1));
        etat2.droitsCeliRestaures += Math.max(0, celiAvant2 - soldeCeli(etat2));
        impotAnnee = res.impot;
        fractionnement = Math.abs(res.transfert);
        revenuDisponible = res.disponible;
        let e1Courant = res.e1;
        let e2Courant = res.e2;
        // Surplus (revenu de travail à la retraite, produit de vente, revenus dépassant la cible).
        if (res.disponible > cible + 1) {
          let surplus = res.disponible - cible;
          const cibleId: 1 | 2 = niveauImposable(e1Courant) >= niveauImposable(e2Courant) ? 1 : 2;
          const etatCible = cibleId === 1 ? etat1 : etat2;
          const etatAutre = cibleId === 1 ? etat2 : etat1;
          const ctxCible = cibleId === 1 ? ctx1 : ctx2;
          const entreeCible = cibleId === 1 ? e1Courant : e2Courant;

          // Le CELI d'abord, chez les DEUX conjoints. Un dollar au CELI rapporte autant chez l'un
          // que chez l'autre : réserver tout le surplus au conjoint le plus imposé (ce qui se
          // justifie pour le REER, dont la déduction vaut le taux marginal) laissait dormir les
          // droits du second — jusqu'à 109 000 $ envoyés au non-enregistré pour rien.
          let celiPartage = 0;
          for (const etat of [etatCible, etatAutre]) {
            const montant = Math.min(surplus, Math.max(0, etat.droitsCeli));
            if (montant <= 0) continue;
            trouverOuCreer(etat.comptes, 'CELI', etat.profilDefaut).solde += montant;
            etat.droitsCeli -= montant;
            surplus -= montant;
            celiPartage += montant;
          }
          if (surplus <= 0.5) {
            traceVentil = { celi: celiPartage, reer: 0, nonEnr: 0 };
          } else {

          // Le reste suit la chaîne chez le conjoint le plus imposé : son CELI étant désormais
          // plein, `placerSurplusRetraite` enchaîne sur le REER (déduction la plus utile) puis le
          // non-enregistré.
          const droits = { droitsCeli: etatCible.droitsCeli, droitsReer: etatCible.droitsReer };
          const pose = placerSurplusRetraite(
            etatCible.comptes, etatCible.profilDefaut, droits, surplus, ctxCible.age, entreeCible, impotAnnee,
            (montantReer) => {
              const eCible: EntreeFiscale = { ...entreeCible, deductionReer: entreeCible.deductionReer + montantReer };
              const e1n = cibleId === 1 ? eCible : e1Courant;
              const e2n = cibleId === 2 ? eCible : e2Courant;
              const opt = impotCoupleOptimal(e1n, e2n, annee, splittable(e1n, ctx1.age, ctx1.renteEmp), splittable(e2n, ctx2.age, ctx2.renteEmp));
              fractionnement = Math.abs(opt.transfert);
              return { impot: opt.impot, entree: eCible };
            },
          );
          etatCible.droitsCeli = droits.droitsCeli;
          etatCible.droitsReer = droits.droitsReer;
          impotAnnee = pose.impot;
          traceVentil = { ...pose.ventilation, celi: pose.ventilation.celi + celiPartage };
          if (cibleId === 1) e1Courant = pose.entree;
          else e2Courant = pose.entree;
          }
          revenuDisponible = cible;
        } else if (res.disponible < cible - 1 && anneeEpuisement === null) {
          anneeEpuisement = annee;
        }
        if (h.cibleFonteReer && h.cibleFonteReer > 0) {
          const cibleNom = h.cibleFonteReer * facteurInflation;
          const f1 = fondreReer(etat1.comptes, e1Courant, cibleNom, annee, ctx1.age, etat1.profilDefaut, etat1.droitsCeli);
          etat1.droitsCeli -= f1.celiUtilise;
          const f2 = fondreReer(etat2.comptes, e2Courant, cibleNom, annee, ctx2.age, etat2.profilDefaut, etat2.droitsCeli);
          etat2.droitsCeli -= f2.celiUtilise;
          const opt = impotCoupleOptimal(f1.entree, f2.entree, annee, splittable(f1.entree, ctx1.age, ctx1.renteEmp), splittable(f2.entree, ctx2.age, ctx2.renteEmp));
          impotAnnee = opt.impot;
          fractionnement = Math.abs(opt.transfert);
          e1Courant = f1.entree;
          e2Courant = f2.entree;
        }
        if (options.trace) {
          const t = impotCoupleOptimal(e1Courant, e2Courant, annee, splittable(e1Courant, ctx1.age, ctx1.renteEmp), splittable(e2Courant, ctx2.age, ctx2.renteEmp)).transfert;
          const rentesPub = (c: Contexte) => c.entree.revenuRRQ + c.entree.renteSurvivantRRQ + c.entree.revenuPensionSV;
          traceData = {
            phase: 'decaissement',
            comp: {
              travail: ctx1.salaire + ctx2.salaire,
              rentesPubliques: rentesPub(ctx1) + rentesPub(ctx2),
              rentesPrivees: ctx1.entree.revenuPensionPrivee + ctx2.entree.revenuPensionPrivee,
              retraits: res.retraits.enr1 + res.retraits.nonenr1 + res.retraits.libre1 + res.retraits.enr2 + res.retraits.nonenr2 + res.retraits.libre2,
              loyers: aggImmo[1].loyerCash + aggImmo[2].loyerCash,
              ventes: aggImmo[1].cashVente + aggImmo[2].cashVente,
              heritage: ctx1.heritageRecu + ctx2.heritageRecu,
              capitalPlace: capitalPlaceAnnee,
              retenues: ctx1.retenuesPaie + ctx2.retenuesPaie,
              cotisations: 0,
              paiementImmo,
              ventesRealisees: anneeImmo.ventes,
              impotSupporteVente:
                impotDuGainVente(e1Courant ?? ctx1.entree, ctx1.gainVente, annee) +
                impotDuGainVente(e2Courant ?? ctx2.entree, ctx2.gainVente, annee),
              cible,
              cibleSaisie: h.depensesRetraite,
              fractionSurvivant: 1,
              facteurInflation,
              ventilSurplus: traceVentil,
            },
            e1: e1Courant,
            e2: e2Courant,
            transfert: t,
          };
        }
      } else {
        phase = 'accumulation';
        // Accumulation des droits REER de vie active seulement ; le travail à la retraite est déjà
        // traité dans preparerPersonne (évite le double comptage).
        if (ctx1.travaille) accrualReer(etat1, ctx1.salaire, annee, facteurInflation);
        if (ctx2.travaille) accrualReer(etat2, ctx2.salaire, annee, facteurInflation);
        const cot1 = appliquerCotisations(etat1, facteurInflation, etat2);
        const cot2 = appliquerCotisations(etat2, facteurInflation, etat1);
        // Héritage : placé après l'épargne planifiée (qui a la priorité sur les droits), et avant le
        // calcul de l'impôt — la déduction REER qu'il ouvre doit entrer dans le fractionnement optimal.
        const her1 = poserCapital(etat1, ctx1, annee, cot1.deductible);
        const her2 = poserCapital(etat2, ctx2, annee, cot2.deductible);
        capitalPlaceAnnee = her1.place + her2.place;
        const e1 = { ...ctx1.entree, deductionReer: cot1.deductible + her1.deductible, cotisationFondsTravailleurs: cot1.fondsTravailleurs };
        const e2 = { ...ctx2.entree, deductionReer: cot2.deductible + her2.deductible, cotisationFondsTravailleurs: cot2.fondsTravailleurs };
        const opt = impotCoupleOptimal(e1, e2, annee, splittable(e1, ctx1.age, ctx1.renteEmp), splittable(e2, ctx2.age, ctx2.renteEmp));
        impotAnnee = opt.impot;
        fractionnement = Math.abs(opt.transfert);
        // Les retenues sur la paie sont déjà déduites de l'encaisse (voir preparerPersonne).
        // Le capital placé (héritage + produit net de vente) n'est pas disponible pour vivre ; la
        // provision d'impôt retenue sur la vente, elle, sert justement à payer cet impôt.
        revenuDisponible =
          ctx1.encaisse + ctx2.encaisse - her1.place - her2.place -
          impotAnnee - cot1.cotisations - cot2.cotisations - paiementImmo;
        if (options.trace) {
          const rentesPub = (c: Contexte) => c.entree.revenuRRQ + c.entree.renteSurvivantRRQ + c.entree.revenuPensionSV;
          traceData = {
            phase: 'accumulation',
            comp: {
              travail: ctx1.salaire + ctx2.salaire,
              rentesPubliques: rentesPub(ctx1) + rentesPub(ctx2),
              rentesPrivees: ctx1.entree.revenuPensionPrivee + ctx2.entree.revenuPensionPrivee,
              retraits: 0,
              loyers: aggImmo[1].loyerCash + aggImmo[2].loyerCash,
              ventes: aggImmo[1].cashVente + aggImmo[2].cashVente,
              heritage: ctx1.heritageRecu + ctx2.heritageRecu,
              capitalPlace: capitalPlaceAnnee,
              retenues: ctx1.retenuesPaie + ctx2.retenuesPaie,
              cotisations: cot1.cotisations + cot2.cotisations,
              paiementImmo,
              ventesRealisees: anneeImmo.ventes,
              // En accumulation, c'est la PROVISION qui a été retenue sur le placement : l'utiliser
              // garantit « produit brut − impôt supporté = ce qui a été placé ».
              impotSupporteVente: her1.provision + her2.provision,
              cible: 0,
              cibleSaisie: h.depensesRetraite,
              fractionSurvivant: 1,
              facteurInflation,
              ventilSurplus: {
                celi: her1.celi + her2.celi,
                reer: her1.reer + her2.reer,
                nonEnr: her1.nonEnr + her2.nonEnr,
              },
            },
            e1,
            e2,
            transfert: opt.transfert,
          };
        }
      }

      appliquerCroissance(etat1, ctx1.croissances);
      appliquerCroissance(etat2, ctx2.croissances);
    } else {
      // Phase de survie : une seule personne vivante.
      phase = 'survie';
      const vivant = vivant1 ? etat1 : etat2;
      const rrqSurvivantAddl = defunt
        ? renteSurvivantRRQ(
            rrqNominale(defunt.rrqA65, defunt.ageDebutRRQ, defunt.ageActuel + i, annee, h.inflation),
            rrqNominale(vivant.p.rrqA65, vivant.p.ageDebutRRQ, vivant.p.ageActuel + i, annee, h.inflation),
            vivant.p.ageActuel + i,
          )
        : 0;
      const idVivant: 1 | 2 = vivant1 ? 1 : 2;
      const ctx = preparerPersonne(vivant, i, annee, h.inflation, h.fraisGestion, rrqSurvivantAddl);
      foldImmo(ctx, aggImmo[idVivant]);

      if (ctx.travaille) {
        accrualReer(vivant, ctx.salaire, annee, facteurInflation);
        const cot = appliquerCotisations(vivant, facteurInflation, vivant);
        const e = { ...ctx.entree, deductionReer: cot.deductible, cotisationFondsTravailleurs: cot.fondsTravailleurs };
        impotAnnee = impotTotalPour(e, annee);
        // Les retenues sur la paie sont déjà déduites de l'encaisse (voir preparerPersonne).
        revenuDisponible = ctx.encaisse - impotAnnee - cot.cotisations - paiementImmo;
        if (options.trace) {
          traceData = {
            phase: 'survie',
            comp: {
              travail: ctx.salaire,
              rentesPubliques: ctx.entree.revenuRRQ + ctx.entree.renteSurvivantRRQ + ctx.entree.revenuPensionSV,
              rentesPrivees: ctx.entree.revenuPensionPrivee,
              retraits: 0,
              loyers: aggImmo[idVivant].loyerCash,
              ventes: aggImmo[idVivant].cashVente,
              heritage: ctx.heritageRecu,
              capitalPlace: capitalPlaceAnnee,
              retenues: ctx.retenuesPaie,
              cotisations: cot.cotisations,
              paiementImmo,
              ventesRealisees: anneeImmo.ventes,
              impotSupporteVente: impotDuGainVente(e, ctx.gainVente, annee),
              cible: 0,
              cibleSaisie: h.depensesRetraite,
              fractionSurvivant: h.fractionSurvivant,
              facteurInflation,
              ventilSurplus: { celi: 0, reer: 0, nonEnr: 0 },
            },
            e1: idVivant === 1 ? e : null,
            e2: idVivant === 2 ? e : null,
            transfert: 0,
          };
        }
      } else {
        const cible = h.depensesRetraite * h.fractionSurvivant * facteurInflation + paiementImmo;
        const celiAvant = soldeCeli(vivant);
        const res = financerDepenses(vivant.comptes, h.ordreDecaissement, ctx.entree, ctx.encaisse, cible, annee, ctx.age);
        vivant.droitsCeliRestaures += Math.max(0, celiAvant - soldeCeli(vivant));
        impotAnnee = res.impot;
        revenuDisponible = res.disponible;
        let entreeCourante = res.entree;
        // Surplus (revenu de travail à la retraite ou revenus fixes) : CELI → REER (≤ 71) → non-enr.
        if (res.disponible > cible + 1) {
          const surplus = res.disponible - cible;
          const droits = { droitsCeli: vivant.droitsCeli, droitsReer: vivant.droitsReer };
          const pose = placerSurplusRetraite(
            vivant.comptes, vivant.profilDefaut, droits, surplus, ctx.age, res.entree, impotAnnee,
            (montantReer) => {
              const e: EntreeFiscale = { ...res.entree, deductionReer: res.entree.deductionReer + montantReer };
              return { impot: impotTotalPour(e, annee), entree: e };
            },
          );
          vivant.droitsCeli = droits.droitsCeli;
          vivant.droitsReer = droits.droitsReer;
          impotAnnee = pose.impot;
          traceVentil = pose.ventilation;
          entreeCourante = pose.entree;
          revenuDisponible = cible;
        } else if (res.disponible < cible - 1 && anneeEpuisement === null) {
          anneeEpuisement = annee;
        }
        if (h.cibleFonteReer && h.cibleFonteReer > 0) {
          const f = fondreReer(vivant.comptes, entreeCourante, h.cibleFonteReer * facteurInflation, annee, ctx.age, vivant.profilDefaut, vivant.droitsCeli);
          vivant.droitsCeli -= f.celiUtilise;
          impotAnnee = f.impot;
          entreeCourante = f.entree;
        }
        if (options.trace) {
          traceData = {
            phase: 'survie',
            comp: {
              travail: ctx.salaire,
              rentesPubliques: ctx.entree.revenuRRQ + ctx.entree.renteSurvivantRRQ + ctx.entree.revenuPensionSV,
              rentesPrivees: ctx.entree.revenuPensionPrivee,
              retraits: res.retraitEnregistre + res.retraitNonEnregistre + res.retraitLibreImpot,
              loyers: aggImmo[idVivant].loyerCash,
              ventes: aggImmo[idVivant].cashVente,
              heritage: ctx.heritageRecu,
              capitalPlace: capitalPlaceAnnee,
              retenues: ctx.retenuesPaie,
              cotisations: 0,
              paiementImmo,
              ventesRealisees: anneeImmo.ventes,
              impotSupporteVente: impotDuGainVente(entreeCourante, ctx.gainVente, annee),
              cible,
              cibleSaisie: h.depensesRetraite,
              fractionSurvivant: h.fractionSurvivant,
              facteurInflation,
              ventilSurplus: traceVentil,
            },
            e1: idVivant === 1 ? entreeCourante : null,
            e2: idVivant === 2 ? entreeCourante : null,
            transfert: 0,
          };
        }
      }
      appliquerCroissance(vivant, ctx.croissances);
    }

    impotTotalVieReel += impotAnnee * deflateur;
    annees.push({
      annee,
      age1: vivant1 ? age1 : null,
      age2: vivant2 ? age2 : null,
      phase,
      revenuDisponible,
      impotTotal: impotAnnee,
      fractionnement,
      equiteImmobiliere: equiteImmo,
      valeurNette: valeurNette(etat1.comptes) + valeurNette(etat2.comptes) + equiteImmo,
      soldes1: soldesParType(etat1.comptes),
      soldes2: soldesParType(etat2.comptes),
      deflateurReel: deflateur,
      detail:
        options.trace && traceData
          ? construireDetailCouple(
              traceData.phase, traceData.comp, annee, traceData.e1, traceData.e2, traceData.transfert,
              impotAnnee, etat1.p.nom, etat2.p.nom, etat1.comptes, etat2.comptes, etatsImmo,
            )
          : undefined,
    });

    // Traitement des décès en fin d'année. La fonction RETOURNE le nouveau défunt (le cas échéant) ;
    // l'affectation de `defunt` reste en ligne dans la boucle pour que l'analyse de flux la voie.
    const deces = (
      mort: EtatPersonne, autre: EtatPersonne, mortId: 1 | 2, survId: 1 | 2, ageMort: number, autreSurvit: boolean,
    ): PersonneProjection | null => {
      if (autreSurvit) {
        roulement(mort, autre);
        roulementImmeubles(etatsImmo, mortId, survId); // biens roulés au survivant, sans impôt
        autre.survivant = true;
        return mort.p;
      }
      const gainImmo = gainAuDeces(etatsImmo, bienAbrite, mortId);
      const tt = impotAuDeces(mort, ageMort, annee, gainImmo);
      impotTotalVieReel += tt * deflateur;
      annees[annees.length - 1].impotTotal += tt;
      valeurNetteFinaleReelle = (valeurNette(mort.comptes) + equiteTotale(etatsImmo) - tt) * deflateur;
      return null;
    };
    if (vivant1 && age1 === h.personne1.ageDeces) {
      const d = deces(etat1, etat2, 1, 2, age1, vivant2 && age2 < h.personne2.ageDeces);
      if (d) defunt = d;
    }
    if (vivant2 && age2 === h.personne2.ageDeces) {
      const d = deces(etat2, etat1, 2, 1, age2, vivant1 && age1 < h.personne1.ageDeces);
      if (d) defunt = d;
    }
  }

  return {
    annees,
    anneeEpuisement,
    suffisant: anneeEpuisement === null,
    valeurNetteAuDernierDecesReelle: valeurNetteFinaleReelle,
    impotTotalVieReel,
  };
}
