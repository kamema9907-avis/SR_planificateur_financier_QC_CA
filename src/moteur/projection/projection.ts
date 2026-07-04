/**
 * Boucle de projection cycle de vie : de l'âge actuel jusqu'au décès, année par année.
 * Phase d'accumulation (épargne) puis de décaissement (retraits pour financer les dépenses),
 * avec impôt calculé chaque année (barèmes indexés) et impôt au décès (dispositions présumées).
 *
 * Tous les montants internes sont NOMINAUX ; chaque année porte son déflateur pour l'affichage
 * en dollars d'aujourd'hui.
 */
import { ANNEE_BASE } from '../constantes/indexation';
import { AGE_CONVERSION_FERR, facteurRetraitMinimumFERR } from '../constantes/ferr';
import type { ProfilRendement } from '../constantes/profilsRendement';
import { impotTotalPour } from '../moteurFiscal';
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
  estNonEnregistre,
  repartirCotisationCeliapp,
  soldesParType,
  valeurNette,
} from './comptes';
import { financerDepenses } from './decaissement';
import { rrqNominale, svNominale } from './rentesPubliques';
import { totalRentesEmployeur } from './rentesEmployeur';
import { clonerImmeubles, determinerBienAbrite, gainAuDeces, traiterImmeublesAnnee, type AgregatImmo } from './immobilier';
import { fondreReer } from './fonteReer';
import type { AnneeProjection, Compte, HypothesesProjection, ResultatProjection, TypeCompte } from './types';

const TYPES_ENREGISTRES: readonly TypeCompte[] = ['REER', 'FERR', 'CRI', 'FRV'];
const PLAFOND_SUBVENTION_REEE = 2_500; // achat annuel donnant droit à la subvention (30 %)
const TAUX_SUBVENTION_REEE = 0.3; // SCEE 20 % + IQEE 10 %

/** Entrée fiscale vierge pour une année de projection. */
function nouvelleEntree(age: number, vitSeul: boolean): EntreeFiscale {
  return {
    annee: 2026,
    province: 'QC',
    age,
    vitSeul,
    revenuEmploi: 0,
    revenuRRQ: 0,
    renteSurvivantRRQ: 0,
    revenuPensionSV: 0,
    revenuPensionPrivee: 0,
    autresRevenus: 0,
    dividendesDetermines: 0,
    dividendesOrdinaires: 0,
    gainsCapital: 0,
    deductionReer: 0,
    autresDeductions: 0,
    cotisationFondsTravailleurs: 0,
    cotisationSyndicale: 0,
    primeAssuranceSalaire: 0,
    assuranceSalaireDeductible: false,
  };
}

function trouverOuCreer(comptes: Compte[], type: TypeCompte, profil: ProfilRendement): Compte {
  let compte = comptes.find((c) => c.type === type);
  if (!compte) {
    compte = { type, solde: 0, profil, coutBase: type === 'NON_ENREGISTRE' ? 0 : undefined };
    comptes.push(compte);
  }
  return compte;
}

/** Projette une situation financière sur tout le cycle de vie. */
export function projeter(h: HypothesesProjection): ResultatProjection {
  const comptes = clonerComptes(h.comptes);
  const profilDefaut: ProfilRendement = comptes[0]?.profil ?? 'equilibre';
  const etatsImmo = clonerImmeubles(h.immeubles);
  const bienAbrite = determinerBienAbrite(h.immeubles);
  const annees: AnneeProjection[] = [];

  let ageEpuisement: number | null = null;
  let impotTotalVieReel = 0;
  let celiappCotiseCumul = h.celiappDejaCotise ?? 0; // cumul nominal des cotisations CELIAPP (plafond 40 000 $)
  // Droits CELI : compteur vivant — départ (ARC ou heuristique), +droits annuels chaque année,
  // −cotisations, +retraits de l'année précédente (restaurés au 1er janvier suivant).
  let droitsCeli = h.droitsCeliDisponibles ?? droitsCeliParDefaut(h.comptes);
  let droitsCeliRestaures = 0;
  let droitsReer = h.droitsReerDisponibles ?? 0; // droits REER (report), sans restauration au retrait
  const soldeCeliTotal = () => comptes.filter((c) => c.type === 'CELI').reduce((s, c) => s + c.solde, 0);

  for (let i = 0; h.ageActuel + i <= h.ageDeces; i++) {
    const age = h.ageActuel + i;
    const annee = ANNEE_BASE + i;
    if (i > 0) {
      droitsCeli += droitsCeliAnnuels(annee, h.inflation) + droitsCeliRestaures;
      droitsCeliRestaures = 0;
    }
    const facteurInflation = Math.pow(1 + h.inflation, i);
    const deflateurReel = 1 / facteurInflation;
    const phase = age < h.ageRetraite ? 'accumulation' : 'decaissement';

    // Croissance de chaque compte, calculée sur le solde de début d'année.
    const croissances = new Map<Compte, ReturnType<typeof croissanceAnnuelle>>();
    for (const c of comptes)
      croissances.set(c, croissanceAnnuelle(c.solde, c.profil, h.fraisGestion, c.rendementPersonnalise));
    const revenuPlacementNonEnr = comptes
      .filter((c) => estNonEnregistre(c.type))
      .reduce((s, c) => s + croissances.get(c)!.interet + croissances.get(c)!.dividendes, 0);
    const interetNonEnr = comptes
      .filter((c) => estNonEnregistre(c.type))
      .reduce((s, c) => s + croissances.get(c)!.interet, 0);
    const dividendesNonEnr = revenuPlacementNonEnr - interetNonEnr;

    // Rentes publiques (communes aux deux phases).
    const rrq = rrqNominale(h.rrqA65, h.ageDebutRRQ, age, annee, h.inflation);
    const sv = svNominale(h.svA65, h.ageDebutSV, age, annee, h.inflation);
    const renteEmp = totalRentesEmployeur(h.rentesEmployeur, age, h.ageActuel, h.inflation);

    // Minimum FERR/FRV forcé à partir de 72 ans (retiré des comptes enregistrés).
    let minimumFERR = 0;
    if (age > AGE_CONVERSION_FERR) {
      const facteur = facteurRetraitMinimumFERR(age);
      for (const c of comptes.filter((x) => TYPES_ENREGISTRES.includes(x.type) && x.solde > 0)) {
        const retrait = Math.min(facteur * c.solde, c.solde);
        c.solde -= retrait;
        minimumFERR += retrait;
      }
    }

    // Immobilier : amortissement, loyers, ventes planifiées, appréciation.
    const aggImmo = traiterImmeublesAnnee(etatsImmo, i, h.inflation, () => age, bienAbrite);
    const immo: AgregatImmo = {
      paiement: aggImmo[1].paiement + aggImmo[2].paiement,
      loyerCash: aggImmo[1].loyerCash + aggImmo[2].loyerCash,
      revenuImposable: aggImmo[1].revenuImposable + aggImmo[2].revenuImposable,
      gainBrut: aggImmo[1].gainBrut + aggImmo[2].gainBrut,
      cashVente: aggImmo[1].cashVente + aggImmo[2].cashVente,
      equite: aggImmo[1].equite + aggImmo[2].equite,
    };

    let impotAnnee: number;
    let revenuDisponible: number;
    let revenuEmploi = 0;
    let cotisations = 0;
    let retraitsEnregistres = minimumFERR;
    let retraitsNonEnregistres = 0;
    let retraitsLibresImpot = 0;
    let entreeAnnee: EntreeFiscale;

    if (phase === 'accumulation') {
      revenuEmploi = h.revenuEmploi * Math.pow((1 + h.inflation) * (1 + h.croissanceSalaireReelle), i);

      // Droits REER : accumulation annuelle = 18 % du salaire (plafonné) − facteur d'équivalence.
      const feReer =
        h.facteurEquivalenceReer && h.facteurEquivalenceReer > 0
          ? h.facteurEquivalenceReer * facteurInflation
          : h.regimeRetraitePD
            ? feRegimePD(revenuEmploi)
            : 0;
      droitsReer += droitsReerAnnuels(revenuEmploi, plafondReerNominal(annee), feReer);

      // Cotisations aux comptes (indexées à l'inflation).
      let deductible = 0;

      // Verse au CELI dans la limite des droits ; l'excédent déborde au non-enregistré.
      const verserAuCeli = (montant: number) => {
        const auCeli = Math.min(montant, Math.max(0, droitsCeli));
        if (auCeli > 0) {
          trouverOuCreer(comptes, 'CELI', profilDefaut).solde += auCeli;
          droitsCeli -= auCeli;
        }
        const reste = montant - auCeli;
        if (reste > 0) {
          const ne = trouverOuCreer(comptes, 'NON_ENREGISTRE', profilDefaut);
          ne.solde += reste;
          ne.coutBase = (ne.coutBase ?? 0) + reste;
        }
      };

      for (const [type, montantAujourdhui] of Object.entries(h.epargneAnnuelle) as [TypeCompte, number][]) {
        if (!montantAujourdhui) continue;
        const montant = montantAujourdhui * facteurInflation;

        // CELI : plafonné par les droits de cotisation (excédent → non-enregistré).
        if (type === 'CELI') {
          verserAuCeli(montant);
          cotisations += montant;
          continue;
        }

        // CELIAPP : plafonner (8 000 $/an, 40 000 $ à vie) ; l'excédent suit la chaîne CELI → non-enr.
        if (type === 'CELIAPP') {
          const { celiapp, excedent } = repartirCotisationCeliapp(montant, celiappCotiseCumul);
          if (celiapp > 0) {
            trouverOuCreer(comptes, 'CELIAPP', profilDefaut).solde += celiapp;
            deductible += celiapp; // seule la part réellement versée au CELIAPP est déductible
            celiappCotiseCumul += celiapp;
            cotisations += celiapp;
          }
          if (excedent > 0) {
            verserAuCeli(excedent); // redirigé (non déductible), dans la limite des droits CELI
            cotisations += excedent;
          }
          continue;
        }

        // REER : plafonné aux droits disponibles ; l'excédent suit la chaîne CELI → non-enregistré.
        if (type === 'REER') {
          const auReer = Math.min(montant, Math.max(0, droitsReer));
          if (auReer > 0) {
            trouverOuCreer(comptes, 'REER', profilDefaut).solde += auReer;
            deductible += auReer; // seule la part réellement versée au REER est déductible
            droitsReer -= auReer;
            cotisations += auReer;
          }
          const excedent = montant - auReer;
          if (excedent > 0) {
            verserAuCeli(excedent);
            cotisations += excedent;
          }
          continue;
        }

        const compte = trouverOuCreer(comptes, type, profilDefaut);
        compte.solde += montant;
        cotisations += montant;
        if (type === 'NON_ENREGISTRE') compte.coutBase = (compte.coutBase ?? 0) + montant;
        if (type === 'REEE') {
          compte.solde += TAUX_SUBVENTION_REEE * Math.min(montant, PLAFOND_SUBVENTION_REEE * facteurInflation);
        }
      }

      entreeAnnee = {
        ...nouvelleEntree(age, h.vitSeul),
        revenuEmploi,
        revenuRRQ: rrq,
        revenuPensionSV: sv,
        revenuPensionPrivee: minimumFERR + renteEmp,
        autresRevenus: interetNonEnr + immo.revenuImposable,
        dividendesDetermines: dividendesNonEnr,
        gainsCapital: immo.gainBrut,
        deductionReer: deductible,
      };
      impotAnnee = impotTotalPour(entreeAnnee, annee);
      // Retenues sur la paie (RRQ + AE + RQAP) : sortie de trésorerie en plus de l'impôt.
      const retenuesPaie = calculerCotisations(revenuEmploi, parametresCotisations(annee)).total;
      revenuDisponible =
        revenuEmploi + rrq + sv + minimumFERR + renteEmp + immo.loyerCash -
        immo.paiement - impotAnnee - cotisations - retenuesPaie;
      if (immo.cashVente > 0) {
        const nonEnr = trouverOuCreer(comptes, 'NON_ENREGISTRE', profilDefaut);
        nonEnr.solde += immo.cashVente;
        nonEnr.coutBase = (nonEnr.coutBase ?? 0) + immo.cashVente;
      }
    } else {
      const cible = h.depensesRetraite * facteurInflation + immo.paiement;
      const entreeForcee: EntreeFiscale = {
        ...nouvelleEntree(age, h.vitSeul),
        revenuRRQ: rrq,
        revenuPensionSV: sv,
        revenuPensionPrivee: minimumFERR + renteEmp,
        autresRevenus: interetNonEnr + immo.revenuImposable,
        dividendesDetermines: dividendesNonEnr,
        gainsCapital: immo.gainBrut,
      };
      const encaisseForcee = rrq + sv + minimumFERR + renteEmp + immo.loyerCash + immo.cashVente;
      const celiAvantRetraits = soldeCeliTotal();
      const res = financerDepenses(comptes, h.ordreDecaissement, entreeForcee, encaisseForcee, cible, annee, age);
      // Un retrait CELI restaure les droits équivalents l'année suivante (règle du 1er janvier).
      droitsCeliRestaures += Math.max(0, celiAvantRetraits - soldeCeliTotal());

      entreeAnnee = res.entree;
      impotAnnee = res.impot;
      revenuDisponible = res.disponible;
      retraitsEnregistres += res.retraitEnregistre;
      retraitsNonEnregistres = res.retraitNonEnregistre;
      retraitsLibresImpot = res.retraitLibreImpot;

      // Réinvestir un éventuel surplus (revenus fixes dépassant la cible) au non-enregistré.
      if (res.disponible > cible + 1) {
        const surplus = res.disponible - cible;
        const nonEnr = trouverOuCreer(comptes, 'NON_ENREGISTRE', profilDefaut);
        nonEnr.solde += surplus;
        nonEnr.coutBase = (nonEnr.coutBase ?? 0) + surplus;
        revenuDisponible = cible;
      }

      // Épuisement du capital : impossible de financer la cible.
      if (res.disponible < cible - 1 && ageEpuisement === null) ageEpuisement = age;

      // Fonte anticipée du REER (optionnelle) : remplir les tranches basses, réinvestir au CELI
      // dans la limite des droits (le reste au non-enregistré).
      if (h.cibleFonteReer && h.cibleFonteReer > 0) {
        const f = fondreReer(comptes, entreeAnnee, h.cibleFonteReer * facteurInflation, annee, age, profilDefaut, droitsCeli);
        retraitsEnregistres += f.retraitSupplementaire;
        impotAnnee = f.impot;
        entreeAnnee = f.entree;
        droitsCeli -= f.celiUtilise;
      }
    }

    // Appliquer la croissance de l'année (sur les soldes de début), après les mouvements.
    for (const c of comptes) {
      const g = croissances.get(c);
      if (!g) continue; // compte créé cette année : pas de croissance
      c.solde += g.total;
      if (estNonEnregistre(c.type)) c.coutBase = (c.coutBase ?? 0) + g.interet + g.dividendes;
    }

    impotTotalVieReel += impotAnnee * deflateurReel;

    // Impôt au décès : dispositions présumées (comptes enregistrés + gains latents non enregistrés).
    if (age === h.ageDeces) {
      const soldesEnr = comptes
        .filter((c) => TYPES_ENREGISTRES.includes(c.type))
        .reduce((s, c) => s + c.solde, 0);
      const gainsLatents = comptes
        .filter((c) => estNonEnregistre(c.type))
        .reduce((s, c) => s + Math.max(0, c.solde - (c.coutBase ?? 0)), 0);
      const gainsImmo = gainAuDeces(etatsImmo, bienAbrite, 1);
      const entreeDeces: EntreeFiscale = {
        ...entreeAnnee,
        revenuPensionPrivee: entreeAnnee.revenuPensionPrivee + soldesEnr,
        gainsCapital: entreeAnnee.gainsCapital + gainsLatents + gainsImmo,
      };
      const impotDeces = impotTotalPour(entreeDeces, annee) - impotTotalPour(entreeAnnee, annee);
      impotAnnee += impotDeces;
      impotTotalVieReel += impotDeces * deflateurReel;
    }

    annees.push({
      annee,
      age,
      phase,
      revenuEmploi,
      rrq,
      sv,
      renteEmployeur: renteEmp,
      retraitsEnregistres,
      retraitsNonEnregistres,
      retraitsLibresImpot,
      revenuPlacementNonEnr,
      impotTotal: impotAnnee,
      revenuDisponible,
      cotisations,
      soldes: soldesParType(comptes),
      equiteImmobiliere: immo.equite,
      valeurNette: valeurNette(comptes) + immo.equite,
      deflateurReel,
    });
  }

  const derniere = annees[annees.length - 1];
  return {
    annees,
    ageEpuisement,
    suffisant: ageEpuisement === null,
    valeurNetteAuDecesReelle: derniere ? derniere.valeurNette * derniere.deflateurReel : 0,
    impotTotalVieReel,
  };
}
