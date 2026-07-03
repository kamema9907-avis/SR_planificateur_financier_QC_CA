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
import type { EntreeFiscale } from '../types';
import {
  clonerComptes,
  croissanceAnnuelle,
  estLibreImpot,
  estNonEnregistre,
  soldesParType,
  valeurNette,
  type CroissanceCompte,
} from './comptes';
import { financerDepenses } from './decaissement';
import { rrqNominale, svNominale, renteSurvivantRRQ } from './rentesPubliques';
import { totalRentesEmployeur } from './rentesEmployeur';
import { impotCoupleOptimal } from './fractionnement';
import {
  clonerImmeubles,
  determinerBienAbrite,
  gainAuDeces,
  roulementImmeubles,
  traiterImmeublesAnnee,
  type AgregatImmo,
  type EtatImmeuble,
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
}

function nouvelleEntree(age: number, vitSeul: boolean): EntreeFiscale {
  return {
    annee: 2026, province: 'QC', age, vitSeul,
    revenuEmploi: 0, revenuRRQ: 0, revenuPensionSV: 0, revenuPensionPrivee: 0,
    autresRevenus: 0, dividendesDetermines: 0, dividendesOrdinaires: 0, gainsCapital: 0,
    deductionReer: 0, autresDeductions: 0, cotisationFondsTravailleurs: 0,
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
  encaisse: number;
  renteEmp: number;
  travaille: boolean;
  salaire: number;
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
  const salaire = travaille ? p.revenuEmploi * Math.pow((1 + inflation) * (1 + p.croissanceSalaireReelle), i) : 0;

  const entree: EntreeFiscale = {
    ...nouvelleEntree(age, etat.survivant),
    revenuEmploi: salaire,
    revenuRRQ: rrq,
    revenuPensionSV: sv,
    revenuPensionPrivee: minimumFERR + renteEmp,
    autresRevenus: interetNonEnr,
    dividendesDetermines: dividendesNonEnr,
  };
  return { age, croissances, entree, encaisse: salaire + rrq + sv + renteEmp + minimumFERR, renteEmp, travaille, salaire };
}

/** Applique les cotisations d'une personne (dont le REER de conjoint versé à l'autre). */
function appliquerCotisations(etat: EtatPersonne, facteurInflation: number, conjoint: EtatPersonne) {
  let deductible = 0;
  let cotisations = 0;
  for (const [type, montantAuj] of Object.entries(etat.p.epargneAnnuelle) as [TypeCompte, number][]) {
    if (!montantAuj) continue;
    const montant = montantAuj * facteurInflation;
    const c = trouverOuCreer(etat.comptes, type, etat.profilDefaut);
    c.solde += montant;
    cotisations += montant;
    if (type === 'REER' || type === 'CELIAPP') deductible += montant;
    if (type === 'NON_ENREGISTRE') c.coutBase = (c.coutBase ?? 0) + montant;
    if (type === 'REEE') c.solde += TAUX_SUBVENTION_REEE * Math.min(montant, PLAFOND_SUBVENTION_REEE * facteurInflation);
  }
  // REER de conjoint : déduit ici, versé au REER de l'autre.
  if (etat.p.epargneReerConjoint > 0) {
    const montant = etat.p.epargneReerConjoint * facteurInflation;
    trouverOuCreer(conjoint.comptes, 'REER', conjoint.profilDefaut).solde += montant;
    deductible += montant;
    cotisations += montant;
  }
  return { deductible, cotisations };
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
  return { impot: opt.impot, transfert: opt.transfert, disponible: encaisse - opt.impot, retraits };
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
function foldImmo(ctx: Contexte, a: AgregatImmo, etat: EtatPersonne): void {
  ctx.entree = {
    ...ctx.entree,
    autresRevenus: ctx.entree.autresRevenus + a.revenuImposable,
    gainsCapital: ctx.entree.gainsCapital + a.gainBrut,
  };
  ctx.encaisse += a.loyerCash;
  if (a.cashVente > 0) {
    const ne = trouverOuCreer(etat.comptes, 'NON_ENREGISTRE', etat.profilDefaut);
    ne.solde += a.cashVente;
    ne.coutBase = (ne.coutBase ?? 0) + a.cashVente;
  }
}

/** Équité totale des biens non vendus (valeur − hypothèque). */
function equiteTotale(etats: readonly EtatImmeuble[]): number {
  return etats.reduce((s, e) => (e.vendu ? s : s + Math.max(0, e.valeur - e.hypotheque)), 0);
}

/** Projette un couple sur tout le cycle de vie. */
export function projeterCouple(h: HypothesesCouple): ResultatCouple {
  const etat1: EtatPersonne = { p: h.personne1, comptes: clonerComptes(h.personne1.comptes), profilDefaut: h.personne1.comptes[0]?.profil ?? 'equilibre', survivant: false };
  const etat2: EtatPersonne = { p: h.personne2, comptes: clonerComptes(h.personne2.comptes), profilDefaut: h.personne2.comptes[0]?.profil ?? 'equilibre', survivant: false };

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

    let impotAnnee = 0;
    let revenuDisponible = 0;
    let fractionnement = 0;
    let phase: AnneeCouple['phase'];

    // Immobilier : amortissement, loyers, ventes, appréciation (par propriétaire).
    const ageProprio = (p: 1 | 2 | 'commun'): number | null =>
      p === 2 ? (vivant2 ? age2 : null) : p === 1 ? (vivant1 ? age1 : null) : vivant1 ? age1 : vivant2 ? age2 : null;
    const aggImmo = traiterImmeublesAnnee(etatsImmo, i, h.inflation, ageProprio, bienAbrite);
    const paiementImmo = aggImmo[1].paiement + aggImmo[2].paiement;
    const equiteImmo = aggImmo[1].equite + aggImmo[2].equite;

    if (vivant1 && vivant2) {
      const ctx1 = preparerPersonne(etat1, i, annee, h.inflation, h.fraisGestion, 0);
      const ctx2 = preparerPersonne(etat2, i, annee, h.inflation, h.fraisGestion, 0);
      foldImmo(ctx1, aggImmo[1], etat1);
      foldImmo(ctx2, aggImmo[2], etat2);

      if (!ctx1.travaille && !ctx2.travaille) {
        phase = 'decaissement';
        const cible = h.depensesRetraite * facteurInflation + paiementImmo;
        const res = financerCouple(etat1, etat2, ctx1, ctx2, cible, annee, h.ordreDecaissement);
        impotAnnee = res.impot;
        fractionnement = Math.abs(res.transfert);
        revenuDisponible = res.disponible;
        if (res.disponible > cible + 1) {
          const nonEnr = trouverOuCreer(etat1.comptes, 'NON_ENREGISTRE', etat1.profilDefaut);
          nonEnr.solde += res.disponible - cible;
          nonEnr.coutBase = (nonEnr.coutBase ?? 0) + (res.disponible - cible);
          revenuDisponible = cible;
        } else if (res.disponible < cible - 1 && anneeEpuisement === null) {
          anneeEpuisement = annee;
        }
      } else {
        phase = 'accumulation';
        const cot1 = appliquerCotisations(etat1, facteurInflation, etat2);
        const cot2 = appliquerCotisations(etat2, facteurInflation, etat1);
        const e1 = { ...ctx1.entree, deductionReer: cot1.deductible };
        const e2 = { ...ctx2.entree, deductionReer: cot2.deductible };
        const opt = impotCoupleOptimal(e1, e2, annee, splittable(e1, ctx1.age, ctx1.renteEmp), splittable(e2, ctx2.age, ctx2.renteEmp));
        impotAnnee = opt.impot;
        fractionnement = Math.abs(opt.transfert);
        revenuDisponible = ctx1.encaisse + ctx2.encaisse - impotAnnee - cot1.cotisations - cot2.cotisations - paiementImmo;
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
      foldImmo(ctx, aggImmo[idVivant], vivant);

      if (ctx.travaille) {
        const cot = appliquerCotisations(vivant, facteurInflation, vivant);
        const e = { ...ctx.entree, deductionReer: cot.deductible };
        impotAnnee = impotTotalPour(e, annee);
        revenuDisponible = ctx.encaisse - impotAnnee - cot.cotisations - paiementImmo;
      } else {
        const cible = h.depensesRetraite * h.fractionSurvivant * facteurInflation + paiementImmo;
        const res = financerDepenses(vivant.comptes, h.ordreDecaissement, ctx.entree, ctx.encaisse, cible, annee, ctx.age);
        impotAnnee = res.impot;
        revenuDisponible = res.disponible;
        if (res.disponible > cible + 1) {
          const nonEnr = trouverOuCreer(vivant.comptes, 'NON_ENREGISTRE', vivant.profilDefaut);
          nonEnr.solde += res.disponible - cible;
          nonEnr.coutBase = (nonEnr.coutBase ?? 0) + (res.disponible - cible);
          revenuDisponible = cible;
        } else if (res.disponible < cible - 1 && anneeEpuisement === null) {
          anneeEpuisement = annee;
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
