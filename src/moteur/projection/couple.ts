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
import { calculerTauxMarginal, construireBase, impotTotalPour } from '../moteurFiscal';
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
  REER_TAUX,
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
import { placerCapital, placerSurplusRetraite, verserReerPrioritaire } from './placementSurplus';
import { remplirCeli } from './remplissageCeli';
import { totalHeritage } from './heritage';
import { impotCoupleOptimal } from './fractionnement';
import { fondreReer } from './fonteReer';
import {
  construireDetailFiscal,
  postesNonNuls,
  postesSignificatifs,
  sommePostes,
  type DetailCouple,
  type DetailDisponible,
  type DetailDroitsAnnee,
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
  /**
   * Journal des mouvements de droits de l'année en cours.
   *
   * Le mode solo attribue ses consommations avec de simples accumulateurs locaux : sa boucle contient
   * tout. Ici les mouvements sont dispersés dans des fonctions de module (`verserAuCeli`,
   * `appliquerCotisations`, `poserCapital`…) qui reçoivent déjà l'état — le journal voyage donc avec
   * lui, plutôt que d'ajouter un paramètre à chacune.
   */
  traceDroits: JournalDroits;
}

/** Mouvements de droits d'une personne sur une année, remis à zéro à chaque tour de boucle. */
interface JournalDroits {
  reportCeli: number;
  reportReer: number;
  ajoutsCeli: Poste[];
  ajoutsReer: Poste[];
  consoCeli: Poste[];
  consoReer: Poste[];
  /** Salaire ayant servi au 18 % ; 0 s'il n'y en a pas eu. */
  salaireReer: number;
}

const journalVide = (droitsCeli: number, droitsReer: number): JournalDroits => ({
  reportCeli: droitsCeli, reportReer: droitsReer,
  ajoutsCeli: [], ajoutsReer: [], consoCeli: [], consoReer: [], salaireReer: 0,
});

/** Ouvre une nouvelle année : le report du 1er janvier est le compteur d'avant tout mouvement. */
function ouvrirAnneeDroits(etat: EtatPersonne): void {
  etat.traceDroits = journalVide(etat.droitsCeli, etat.droitsReer);
}

/** Clôt l'année : la chaîne du journal doit redonner les compteurs (invariant testé). */
function fermerAnneeDroits(etat: EtatPersonne): DetailDroitsAnnee {
  const j = etat.traceDroits;
  return {
    celi: {
      report: j.reportCeli,
      ajouts: postesNonNuls(j.ajoutsCeli),
      consommations: postesNonNuls(j.consoCeli),
      restant: etat.droitsCeli,
      aRestaurerLAnProchain: etat.droitsCeliRestaures,
      salaireRetenu: 0,
    },
    reer: {
      report: j.reportReer,
      ajouts: postesNonNuls(j.ajoutsReer),
      consommations: postesNonNuls(j.consoReer),
      restant: etat.droitsReer,
      aRestaurerLAnProchain: 0, // le REER ne restaure rien au retrait
      salaireRetenu: j.salaireReer,
    },
  };
}

/**
 * Droits REER neufs d'une année, décomposés en postes qui somment à `droitsReerAnnuels`.
 * MUTE `etat.droitsReer` et son journal.
 */
function poserDroitsReerNeufs(etat: EtatPersonne, salaire: number, fe: number, annee: number): void {
  const plafond = plafondReerNominal(annee);
  const brut = REER_TAUX * Math.max(0, salaire);
  const plafonne = Math.min(brut, plafond);
  const feApplique = Math.min(Math.max(0, fe), plafonne);
  etat.droitsReer += droitsReerAnnuels(salaire, plafond, fe);
  etat.traceDroits.salaireReer = salaire;
  etat.traceDroits.ajoutsReer.push(
    { libelle: '18 % du salaire', montant: brut },
    { libelle: 'Plafond de l’année appliqué', montant: -(brut - plafonne) },
    { libelle: 'Facteur d’équivalence (régime à PD)', montant: -feApplique },
  );
}

/** Solde total des comptes CELI d'une personne. */
const soldeCeli = (etat: EtatPersonne) =>
  etat.comptes.filter((c) => c.type === 'CELI').reduce((s, c) => s + c.solde, 0);

/** Solde total non-enregistré d'une personne : la source du remplissage du CELI. */
const soldeNonEnr = (etat: EtatPersonne) =>
  etat.comptes.filter((c) => estNonEnregistre(c.type)).reduce((s, c) => s + c.solde, 0);

const LIBELLE_REMPLISSAGE = 'Transfert annuel du non-enregistré vers le CELI';

/**
 * Remplit le CELI d'une personne depuis son non-enregistré, AVANT le solveur. MUTE son état et son
 * contexte : le gain réalisé rejoint l'entrée fiscale, et c'est le solveur qui financera l'impôt
 * correspondant en même temps que la dépense de l'année.
 */
function remplirCeliAnnuel(etat: EtatPersonne, ctx: Contexte, plafond: number): void {
  const r = remplirCeli(etat.comptes, etat.profilDefaut, etat.droitsCeli, plafond);
  if (r.montant <= 0) return;
  etat.droitsCeli -= r.montant;
  etat.traceDroits.consoCeli.push({ libelle: LIBELLE_REMPLISSAGE, montant: -r.montant });
  ctx.entree = { ...ctx.entree, gainsCapital: ctx.entree.gainsCapital + r.gainRealise };
}

/**
 * Contexte du versement REER prioritaire d'une personne pour une année.
 *
 * Les mouvements d'épargne du couple traversent des fonctions de module qui ne connaissent ni
 * l'année ni l'entrée fiscale : ce petit objet les leur apporte, plutôt que d'ajouter cinq
 * paramètres à chacune.
 */
interface ContextePrioritaire {
  entree: EntreeFiscale;
  annee: number;
  age: number;
  seuil: number;
  libelle: string;
}

/** Étape prioritaire d'un versement : ne prend rien quand la règle est désactivée. */
type Prioritaire = (montant: number) => number;
const AUCUN_PRIORITAIRE: Prioritaire = () => 0;

/**
 * Verse au CELI d'une personne dans la limite de ses droits ; l'excédent déborde au non-enregistré.
 * `prioritaire` s'exécute AVANT le CELI (voir `seuilReer.ts`).
 * @returns la part qui a **consommé des droits CELI**, pour que l'appelant la nomme.
 */
function verserAuCeli(etat: EtatPersonne, montant: number, prioritaire: Prioritaire = AUCUN_PRIORITAIRE): number {
  montant -= prioritaire(montant);
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
  return auCeli;
}

/**
 * Verse au REER (compte du `destinataire`) dans la limite des droits du `cotisant` ; l'excédent
 * (argent du cotisant) suit SA chaîne CELI → non-enregistré.
 *
 * @returns la part déductible (= versée au REER) et les droits consommés de chaque côté : le
 * débordement au CELI en consomme aussi, et toujours chez le COTISANT.
 */
function verserAuReer(
  cotisant: EtatPersonne, destinataire: EtatPersonne, montant: number,
  prioritaire: Prioritaire = AUCUN_PRIORITAIRE,
): { deductible: number; reer: number; celi: number } {
  const auReer = Math.min(montant, Math.max(0, cotisant.droitsReer));
  if (auReer > 0) {
    trouverOuCreer(destinataire.comptes, 'REER', destinataire.profilDefaut).solde += auReer;
    cotisant.droitsReer -= auReer;
  }
  const excedent = montant - auReer;
  const celi = excedent > 0 ? verserAuCeli(cotisant, excedent, prioritaire) : 0;
  return { deductible: auReer, reer: auReer, celi };
}

/** Accumulation annuelle des droits REER d'une personne : 18 % du salaire (plafonné) − facteur d'équivalence. */
function accrualReer(etat: EtatPersonne, salaireNominal: number, annee: number, facteurInflation: number): void {
  const fe =
    etat.p.facteurEquivalenceReer && etat.p.facteurEquivalenceReer > 0
      ? etat.p.facteurEquivalenceReer * facteurInflation
      : etat.p.regimeRetraitePD
        ? feRegimePD(salaireNominal)
        : 0;
  poserDroitsReerNeufs(etat, salaireNominal, fe, annee);
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
    poserDroitsReerNeufs(etat, revenuTravailRetraite, 0, annee);
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
function poserCapital(
  etat: EtatPersonne, ctx: Contexte, annee: number, deductionDejaPrevue: number,
  prio: ContextePrioritaire | null = null,
) {
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

  // Étape prioritaire, devant le CELI. Le reste suit la chaîne historique.
  const prioritaire = prio
    ? verserReerPrioritaire(
        etat.comptes, etat.profilDefaut, droits, aPlacer, ctx.age, deductionUtilisable, prio.seuil,
        (x) => calculerTauxMarginal({ ...ctx.entree, deductionReer: deductionDejaPrevue + x }, 1, annee),
      )
    : 0;
  if (prioritaire > 0) etat.traceDroits.consoReer.push({ libelle: prio!.libelle, montant: -prioritaire });

  const pose = placerCapital(
    etat.comptes, etat.profilDefaut, droits, aPlacer - prioritaire, ctx.age,
    deductionUtilisable - prioritaire,
  );
  etat.droitsCeli = droits.droitsCeli;
  etat.droitsReer = droits.droitsReer;
  // Héritage et vente sont placés d'un seul bloc : le libellé dit laquelle des deux sources
  // l'alimente, plutôt que de laisser croire à une attribution qui n'existe pas.
  const source =
    ctx.heritageRecu > 0.5 && ctx.cashVente > 0.5
      ? 'd’un héritage et d’une vente'
      : ctx.heritageRecu > 0.5
        ? 'd’un héritage'
        : 'du produit d’une vente';
  etat.traceDroits.consoCeli.push({ libelle: `Placement ${source}`, montant: -pose.celi });
  etat.traceDroits.consoReer.push({ libelle: `Placement ${source}`, montant: -pose.reer });
  return {
    ...pose,
    reer: pose.reer + prioritaire,
    deductible: pose.deductible + prioritaire,
    place: aPlacer,
    provision,
  };
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
function appliquerCotisations(
  etat: EtatPersonne, facteurInflation: number, conjoint: EtatPersonne,
  prio: ContextePrioritaire | null = null,
) {
  let deductible = 0;
  let cotisations = 0;

  /**
   * Étape prioritaire, devant le CELI : ce dont la déduction rapporte plus que le seuil vaut mieux
   * au REER. Fermeture, parce qu'elle doit lire et faire grandir `deductible` au fil de la boucle —
   * chaque versement rend le suivant un peu moins rentable.
   */
  const verserPrioritaire: Prioritaire = (montant) => {
    if (!prio) return 0;
    const avec = (x: number): EntreeFiscale => ({
      ...prio.entree,
      deductionReer: prio.entree.deductionReer + deductible + x,
    });
    const base = construireBase(avec(0), prio.annee);
    const droits = { droitsCeli: etat.droitsCeli, droitsReer: etat.droitsReer };
    const verse = verserReerPrioritaire(
      etat.comptes, etat.profilDefaut, droits, montant, prio.age,
      Math.max(0, base.revenuTotalImpose - base.deductionsFederal), prio.seuil,
      (x) => calculerTauxMarginal(avec(x), 1, prio.annee),
    );
    etat.droitsReer = droits.droitsReer;
    if (verse > 0) {
      deductible += verse;
      etat.traceDroits.consoReer.push({ libelle: prio.libelle, montant: -verse });
    }
    return verse;
  };

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
      etat.traceDroits.consoCeli.push({
        libelle: 'Épargne CELI planifiée', montant: -verserAuCeli(etat, montant, verserPrioritaire),
      });
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
        // Redirigé (non déductible), dans la limite des droits CELI.
        etat.traceDroits.consoCeli.push({
          libelle: 'Excédent CELIAPP redirigé au CELI', montant: -verserAuCeli(etat, excedent, verserPrioritaire),
        });
        cotisations += excedent;
      }
      continue;
    }

    // REER : plafonné aux droits du cotisant ; l'excédent suit la chaîne CELI → non-enregistré.
    if (type === 'REER') {
      const v = verserAuReer(etat, etat, montant, verserPrioritaire);
      deductible += v.deductible;
      etat.traceDroits.consoReer.push({ libelle: 'Épargne REER planifiée', montant: -v.reer });
      etat.traceDroits.consoCeli.push({ libelle: 'Débordement de l’épargne REER vers le CELI', montant: -v.celi });
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
    const v = verserAuReer(etat, conjoint, montant, verserPrioritaire);
    deductible += v.deductible;
    // Le nom du destinataire est indispensable : sans lui, la ligne semblerait dire que l'argent
    // est allé dans le REER de la personne qui perd les droits, ce qui est précisément l'inverse.
    etat.traceDroits.consoReer.push({
      libelle: `REER de conjoint (versé à ${conjoint.p.nom})`, montant: -v.reer,
    });
    etat.traceDroits.consoCeli.push({
      libelle: 'Débordement du REER de conjoint vers votre CELI', montant: -v.celi,
    });
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

/**
 * Retrait qui hisse le revenu imposable de `courant` à celui de `autre`. Renvoie 0 s'il est déjà au
 * moins aussi élevé, ou si retirer de ce compte n'a **aucun** effet fiscal — il n'y a alors rien à
 * égaliser, et l'appelant se rabat sur un partage à parts égales.
 *
 * `revenuTotalImpose` est LINÉAIRE en le montant retiré, pour un type de compte donné : une seule
 * évaluation suffit à en mesurer la pente. On évite ainsi de coder en dur le taux d'inclusion des
 * gains en capital, qui n'appartient pas à ce module et qui peut changer.
 */
function retraitEgalisant(courant: EntreeFiscale, autre: EntreeFiscale, c: Compte, age: number): number {
  const base = niveauImposable(courant);
  const ecart = niveauImposable(autre) - base;
  if (ecart <= 0) return 0;
  const PAS = 1_000;
  const pente = (niveauImposable(appliquerRetrait(courant, c, PAS, age)) - base) / PAS;
  return pente > 1e-9 ? ecart / pente : 0;
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
        const n1 = niveauImposable(e1);
        const n2 = niveauImposable(e2);
        // À revenus imposables ÉGAUX, servir le plus gros solde. Le retrait coûte alors exactement
        // la même chose des deux côtés : autant puiser là où il y a le plus, ce qui garde les deux
        // capitaux comparables — donc les revenus de placement futurs partagés. L'ancien `<=`
        // désignait le conjoint 1 à chaque égalité, et le vidait année après année.
        const soldeDe = (o: 1 | 2) => cands.reduce((s, x) => (x.owner === o ? s + x.c.solde : s), 0);
        const prefere: 1 | 2 =
          Math.abs(n1 - n2) < TOL ? (soldeDe(1) >= soldeDe(2) ? 1 : 2) : n1 < n2 ? 1 : 2;
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

      /** Compte de MÊME type chez le conjoint : sans lui, il n'y a personne avec qui partager. */
      const jumelle = estLibreImpot(type) ? undefined : cands.find((x) => x.owner !== owner);
      const aEgalite = jumelle != null && Math.abs(niveauImposable(e1) - niveauImposable(e2)) < TOL;

      /** Disponible si CHACUN des deux conjoints retirait `w` de son compte de ce type. */
      const dispoAvecDeux = (w: number) => {
        const em = appliquerRetrait(courant(), c, w, age);
        const ageJ = jumelle!.owner === 1 ? ctx1.age : ctx2.age;
        const ej = appliquerRetrait(jumelle!.owner === 1 ? e1 : e2, jumelle!.c, w, ageJ);
        return encaisse + 2 * w - (impotTotalPour(em, annee) + impotTotalPour(ej, annee));
      };

      const dichotomie = (haut: number, dispo: (w: number) => number) => {
        if (dispo(haut) <= cible - TOL) return haut;
        let lo = 0;
        let hi = haut;
        for (let k = 0; k < 50; k++) {
          const mid = (lo + hi) / 2;
          if (dispo(mid) < cible) lo = mid;
          else hi = mid;
          if (hi - lo < TOL) break;
        }
        return hi;
      };

      /**
       * **À égalité, on résout le partage, on ne l'approxime pas.**
       *
       * Chercher le retrait qui atteint la cible en supposant UN SEUL payeur le surestime : ce payeur
       * unique supporte tout l'impôt, donc il faut retirer davantage. En prendre la moitié donnait
       * un partage à 59 / 41, pas à 50 / 50, et les deux conjoints affichaient des impôts différents
       * une année sur deux. On cherche donc directement le `w` tel que `w` de CHAQUE côté atteigne
       * la cible, et on n'en sert qu'un ici : le tour suivant servira l'autre, à égalité parfaite,
       * puisqu'il ne restera exactement que ce montant-là à combler.
       */
      let w = aEgalite
        ? dichotomie(Math.min(c.solde, jumelle!.c.solde), dispoAvecDeux)
        : dichotomie(c.solde, dispoAvec);

      /**
       * **Plafonner au point d'égalisation.** La dichotomie ci-dessus prend tout le besoin de
       * l'année d'un seul coup : la boucle `while`, censée réévaluer qui est le moins imposé à
       * chaque tour, ne s'exécutait donc qu'UNE fois, et l'on dépassait largement l'égalité que le
       * décaissement coordonné prétend viser.
       *
       * Conséquence mesurée sur un ménage héritant de 2 M$ chacun : le conjoint 1 finançait seul le
       * train de vie, son capital fondait pendant que l'autre composait, et comme il avait dès lors
       * moins de revenu il restait « le moins imposé » — donc repris l'année suivante. Le choix se
       * verrouillait. À 40 ans : 10 178 $ d'impôt d'un côté, 61 129 $ de l'autre, et un capital
       * réduit à 768 000 $ contre 7 818 000 $.
       *
       * Le plancher à `w / 2` garantit la progression quand les deux revenus sont DÉJÀ égaux
       * (`retraitEgalisant` renvoie alors 0) : chacun prend la moitié du besoin restant, et la
       * boucle converge géométriquement. Il couvre aussi le cas d'un retrait sans effet fiscal — un
       * non-enregistré sans gain latent — où il n'y a rien à égaliser mais tout à gagner à ne pas
       * vider un seul des deux.
       *
       * Aucun plafond si le conjoint n'a aucun compte de ce type : il n'y a alors personne avec qui
       * partager, et plafonner ne ferait que multiplier les tours de boucle. Aucun non plus dans le
       * cas d'égalité traité ci-dessus, où le partage est déjà exact.
       */
      if (jumelle && !aEgalite) {
        const egalisant = retraitEgalisant(courant(), owner === 1 ? e2 : e1, c, age);
        w = Math.min(w, Math.max(egalisant, w / 2));
      }

      /**
       * ORDRE CRITIQUE : imposer d'abord, réduire le coût de base ensuite, le solde en dernier —
       * exactement comme `financerDepenses` en solo.
       *
       * L'inverse (coût de base réduit avant le calcul du gain) faisait déclarer un gain qui
       * n'existe pas. Pour un retrait `w` sur un compte de solde `S` et de coût de base `B`, le gain
       * correct vaut `w(S−B)/S` ; lu après la mutation du seul coût de base, il valait
       * `w(S−B)/S + w²B/S²`. Le terme de trop varie en `w²/S` : discret sur un gros compte, il
       * explose à mesure qu'il se vide. Mesuré sur un ménage héritant de 2 M$ chacun — donc à coût
       * de base ÉGAL au solde, où le retrait devrait être entièrement non imposable — 7 231 $ de
       * gain inventé dès la première année, et 1 338 $ d'impôt supporté par le seul conjoint qui
       * décaissait.
       */
      poser(appliquerRetrait(courant(), c, w, age));
      if (estNonEnregistre(c.type)) {
        c.coutBase = (c.coutBase ?? 0) * (1 - w / c.solde);
        if (owner === 1) retraits.nonenr1 += w; else retraits.nonenr2 += w;
      } else if (estLibreImpot(c.type)) {
        if (owner === 1) retraits.libre1 += w; else retraits.libre2 += w;
      } else {
        if (owner === 1) retraits.enr1 += w; else retraits.enr2 += w;
      }
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

/**
 * Ce sur quoi l'impôt du décès porte, poste par poste — même découpage qu'en mode solo, pour que le
 * tiroir raconte la même histoire dans les deux modes.
 */
function postesDispositionsPresumees(etat: EtatPersonne, gainImmo: number): Poste[] {
  return [
    {
      libelle: 'REER / FERR / CRI / FRV liquidés',
      montant: etat.comptes.filter((c) => TYPES_ENREGISTRES.includes(c.type)).reduce((s, c) => s + c.solde, 0),
    },
    {
      libelle: 'Gains en capital latents (non-enregistré)',
      montant: etat.comptes.filter((c) => estNonEnregistre(c.type))
        .reduce((s, c) => s + Math.max(0, c.solde - (c.coutBase ?? 0)), 0),
    },
    { libelle: 'Gains immobiliers (dispositions présumées)', montant: gainImmo },
  ];
}

/**
 * Comptes qui passeront au survivant, lus AVANT le roulement.
 *
 * Sans cette liste, les soldes du défunt disparaissaient d'une ligne du tableau à l'autre et ceux du
 * survivant gonflaient d'autant, sans qu'aucun clic ne l'explique.
 */
function postesRoulement(mort: EtatPersonne): Poste[] {
  return mort.comptes
    .filter((c) => c.solde > 0.5)
    .map((c) => ({ libelle: `${LIBELLE_COMPTE[c.type]} — ${mort.p.nom}`, montant: c.solde }));
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

/**
 * Où le capital réinvesti d'une année a abouti, **par conjoint**.
 *
 * Le total seul ne suffisait pas : il montrait bien « 3 964 326 $ au non-enregistré » sans dire que
 * la totalité atterrissait chez un seul des deux. C'est précisément ce que le tiroir devait rendre
 * visible.
 */
interface VentilationSurplus {
  celi1: number; reer1: number; nonEnr1: number;
  celi2: number; reer2: number; nonEnr2: number;
}

const VENTILATION_VIDE: VentilationSurplus = {
  celi1: 0, reer1: 0, nonEnr1: 0, celi2: 0, reer2: 0, nonEnr2: 0,
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
  /** Remboursement d'impôt réinvesti au lieu d'être consommé (0 si le réglage est éteint). */
  remboursementReinvesti: number;
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
  ventilSurplus: VentilationSurplus;
  /** Apport de chaque conjoint au pot commun : la clé de répartition du surplus (0/0 s'il n'y en a pas). */
  apports: { p1: number; p2: number };
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
  droits1: DetailDroitsAnnee | null,
  droits2: DetailDroitsAnnee | null,
  /** Dispositions présumées de l'année, par conjoint (0 et [] hors année d'un décès final). */
  deces: { impot1: number; impot2: number; postes1: readonly Poste[]; postes2: readonly Poste[] },
  /** Comptes roulés au survivant, lus avant la mutation. */
  roulement: { postes: readonly Poste[]; vers: string | null },
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
          { libelle: 'Remboursement d’impôt réinvesti', montant: -comp.remboursementReinvesti },
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
    // Chaque destination nomme SON conjoint : c'est la seule façon de voir qu'un placement part
    // tout entier d'un côté. Même motif que les postes de valeur nette, plus bas.
    destinationSurplus: postesSignificatifs([
      { libelle: `CELI — ${nom1}`, montant: comp.ventilSurplus.celi1 },
      { libelle: `REER — ${nom1}`, montant: comp.ventilSurplus.reer1 },
      { libelle: `Non-enregistré — ${nom1}`, montant: comp.ventilSurplus.nonEnr1 },
      { libelle: `CELI — ${nom2}`, montant: comp.ventilSurplus.celi2 },
      { libelle: `REER — ${nom2}`, montant: comp.ventilSurplus.reer2 },
      { libelle: `Non-enregistré — ${nom2}`, montant: comp.ventilSurplus.nonEnr2 },
    ]),
    apportsSurplus: postesSignificatifs([
      { libelle: `Apport de ${nom1}`, montant: comp.apports.p1 },
      { libelle: `Apport de ${nom2}`, montant: comp.apports.p2 },
    ]),
  };

  // Détail fiscal de chaque conjoint sur son entrée POST-fractionnement.
  const a1 = e1 ? { ...e1, revenuPensionPrivee: e1.revenuPensionPrivee - transfert } : null;
  const a2 = e2 ? { ...e2, revenuPensionPrivee: e2.revenuPensionPrivee + transfert } : null;
  const impot1 = a1 ? construireDetailFiscal(a1, annee, deces.impot1, deces.postes1) : null;
  const impot2 = a2 ? construireDetailFiscal(a2, annee, deces.impot2, deces.postes2) : null;
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
    // Somme des deux successions : deux conjoints peuvent mourir la même année.
    impotDeces: deces.impot1 + deces.impot2,
    roulement: postesSignificatifs(roulement.postes),
    roulementVers: roulement.vers,
  };

  return { disponible, nom1, nom2, impot1, impot2, droits1, droits2, impotMenage, fractionnement, valeurNette };
}

/** Projette un couple sur tout le cycle de vie. */
export function projeterCouple(h: HypothesesCouple, options: { trace?: boolean } = {}): ResultatCouple {
  const etatDepart = (p: PersonneProjection): EtatPersonne => {
    const droitsCeli = p.droitsCeliDisponibles ?? droitsCeliParDefaut(p.comptes);
    const droitsReer = p.droitsReerDisponibles ?? 0;
    return {
      p, comptes: clonerComptes(p.comptes), profilDefaut: p.comptes[0]?.profil ?? 'equilibre',
      survivant: false, celiappCotiseCumul: p.celiappDejaCotise ?? 0,
      droitsCeli, droitsCeliRestaures: 0, droitsReer,
      traceDroits: journalVide(droitsCeli, droitsReer),
    };
  };
  const etat1 = etatDepart(h.personne1);
  const etat2 = etatDepart(h.personne2);

  // Seuil du versement REER prioritaire. Absent ou ≥ 1 : règle désactivée, chaîne historique.
  const seuilReer = h.seuilMarginalReer ?? 1;
  const LIBELLE_PRIORITAIRE = `Versement REER prioritaire (marginal > ${Math.round(seuilReer * 100)} %)`;
  /**
   * Contexte du versement prioritaire, ou `null` quand la règle ne doit pas jouer.
   *
   * **Garde-fou** : `fonteActive` neutralise la règle les années où `fondreReer` s'exécute — cotiser
   * juste avant reviendrait à verser le matin ce qu'on fond l'après-midi. La fonte n'existant qu'en
   * décaissement, l'accumulation n'est jamais concernée.
   */
  const contextePrio = (ctx: Contexte, annee: number, fonteActive: boolean): ContextePrioritaire | null =>
    seuilReer >= 1 || fonteActive
      ? null
      : { entree: ctx.entree, annee, age: ctx.age, seuil: seuilReer, libelle: LIBELLE_PRIORITAIRE };
  const fonteActive = (h.cibleFonteReer ?? 0) > 0;
  // Absent vaut ACTIVÉ : voir `HypothesesCouple.remplirDroitsCeli`.
  const remplirDroitsCeli = h.remplirDroitsCeli ?? true;

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

    // Le journal des droits s'ouvre AVANT tout mouvement : son report est le compteur du 1er janvier.
    ouvrirAnneeDroits(etat1);
    ouvrirAnneeDroits(etat2);

    // Droits CELI : +droits annuels + retraits de l'an dernier (restaurés au 1er janvier).
    if (i > 0) {
      const neufs = droitsCeliAnnuels(annee, h.inflation);
      for (const [etat, age] of [[etat1, age1], [etat2, age2]] as const) {
        etat.droitsCeli += neufs + etat.droitsCeliRestaures;
        etat.traceDroits.ajoutsCeli.push(
          { libelle: 'Droits CELI de l’année', montant: neufs },
          // Un retrait CELI ne redonne ses droits qu'au 1er janvier SUIVANT : la ligne nomme l'âge
          // de l'année du retrait, sinon elle semblerait tomber de nulle part.
          { libelle: `Retraits CELI de ${age - 1} ans, restaurés`, montant: etat.droitsCeliRestaures },
        );
        etat.droitsCeliRestaures = 0;
      }
    }

    let impotAnnee = 0;
    let revenuDisponible = 0;
    let fractionnement = 0;
    let phase: AnneeCouple['phase'];

    // Capture pour la traçabilité (remplie dans chaque branche ; assemblée au push, après la croissance).
    let traceData: { phase: AnneeCouple['phase']; comp: CompMenage; e1: EntreeFiscale | null; e2: EntreeFiscale | null; transfert: number } | null = null;
    let traceVentil: VentilationSurplus = { ...VENTILATION_VIDE };
    let traceApports = { p1: 0, p2: 0 };

    // Immobilier : amortissement, loyers, ventes, appréciation (par propriétaire).
    const ageProprio = (p: 1 | 2 | 'commun'): number | null =>
      p === 2 ? (vivant2 ? age2 : null) : p === 1 ? (vivant1 ? age1 : null) : vivant1 ? age1 : vivant2 ? age2 : null;
    const anneeImmo = traiterImmeublesAnnee(etatsImmo, i, h.inflation, ageProprio, bienAbrite);
    const aggImmo = anneeImmo.parProprietaire;
    const paiementImmo = aggImmo[1].paiement + aggImmo[2].paiement;
    const equiteImmo = aggImmo[1].equite + aggImmo[2].equite;

    /** Capital placé cette année (héritage + produit net de vente), retiré du flux consommable. */
    let capitalPlaceAnnee = 0;
    /** Remboursement d'impôt réinvesti au lieu d'être consommé (0 si le réglage est éteint). */
    let remboursementReinvestiAnnee = 0;

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

        /**
         * Remplissage annuel du CELI, avant le solveur (voir `remplissageCeli.ts`).
         *
         * On laisse liquide ce que les comptes devront fournir cette année — `cible` moins
         * l'encaisse déjà en main — réparti au prorata du non-enregistré de chacun. Sans cette
         * réserve, le solveur ressortirait du CELI ce qu'on vient d'y verser.
         */
        if (remplirDroitsCeli) {
          const n1 = soldeNonEnr(etat1);
          const n2 = soldeNonEnr(etat2);
          const besoin = Math.max(0, cible - ctx1.encaisse - ctx2.encaisse);
          const reserve = (part: number) => (n1 + n2 > 0 ? (besoin * part) / (n1 + n2) : 0);
          remplirCeliAnnuel(etat1, ctx1, n1 - reserve(n1));
          remplirCeliAnnuel(etat2, ctx2, n2 - reserve(n2));
        }

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
          // Après la retraite, un héritage ou une vente ne sont PAS placés d'un bloc : ils entrent
          // dans l'encaisse, financent les dépenses, et seul l'excédent est réinvesti. Le libellé
          // nomme le mécanisme et, entre parenthèses, la provenance de l'argent.
          const heritageMenage = ctx1.heritageRecu + ctx2.heritageRecu;
          const venteMenage = ctx1.cashVente + ctx2.cashVente;
          const venueSurplus =
            heritageMenage > 0.5 && venteMenage > 0.5
              ? ' (héritage et vente cette année)'
              : heritageMenage > 0.5
                ? ' (héritage reçu cette année)'
                : venteMenage > 0.5
                  ? ' (vente d’immeuble cette année)'
                  : '';
          const cibleId: 1 | 2 = niveauImposable(e1Courant) >= niveauImposable(e2Courant) ? 1 : 2;
          const autreId: 1 | 2 = cibleId === 1 ? 2 : 1;
          const etatCible = cibleId === 1 ? etat1 : etat2;
          const etatAutre = cibleId === 1 ? etat2 : etat1;
          const ctxCible = cibleId === 1 ? ctx1 : ctx2;
          let entreeCible = cibleId === 1 ? e1Courant : e2Courant;

          const ventil: VentilationSurplus = { ...VENTILATION_VIDE };
          const noter = (id: 1 | 2, cle: 'celi' | 'reer' | 'nonEnr', montant: number) => {
            ventil[`${cle}${id}` as keyof VentilationSurplus] += montant;
          };

          // Étape prioritaire, devant les deux CELI : chez le conjoint le plus imposé, c'est là que
          // la déduction vaut le plus. Neutralisée l'année d'une fonte du REER.
          let prioritaire = 0;
          if (seuilReer < 1 && !fonteActive) {
            const baseP = construireBase(entreeCible, annee);
            const droitsP = { droitsCeli: etatCible.droitsCeli, droitsReer: etatCible.droitsReer };
            prioritaire = verserReerPrioritaire(
              etatCible.comptes, etatCible.profilDefaut, droitsP, surplus, ctxCible.age,
              Math.max(0, baseP.revenuTotalImpose - baseP.deductionsFederal), seuilReer,
              (x) => calculerTauxMarginal({ ...entreeCible, deductionReer: entreeCible.deductionReer + x }, 1, annee),
            );
            etatCible.droitsReer = droitsP.droitsReer;
            if (prioritaire > 0) {
              // Le remboursement d'impôt obtenu est du liquide en plus, replacé avec le reste.
              entreeCible = { ...entreeCible, deductionReer: entreeCible.deductionReer + prioritaire };
              if (cibleId === 1) e1Courant = entreeCible;
              else e2Courant = entreeCible;
              const opt = impotCoupleOptimal(e1Courant, e2Courant, annee, splittable(e1Courant, ctx1.age, ctx1.renteEmp), splittable(e2Courant, ctx2.age, ctx2.renteEmp));
              surplus += Math.max(0, impotAnnee - opt.impot) - prioritaire;
              impotAnnee = opt.impot;
              fractionnement = Math.abs(opt.transfert);
              etatCible.traceDroits.consoReer.push({ libelle: LIBELLE_PRIORITAIRE, montant: -prioritaire });
              noter(cibleId, 'reer', prioritaire);
            }
          }

          // Le CELI d'abord, chez les DEUX conjoints. Un dollar au CELI rapporte autant chez l'un
          // que chez l'autre : réserver tout le surplus au conjoint le plus imposé (ce qui se
          // justifie pour le REER, dont la déduction vaut le taux marginal) laissait dormir les
          // droits du second — jusqu'à 109 000 $ envoyés au non-enregistré pour rien.
          //
          // Cette étape reste volontairement PARTAGÉE, même après la répartition par propriétaire
          // ci-dessous : donner à son conjoint de quoi cotiser à SON CELI est permis, et c'est le
          // seul cas où le revenu échappe aux règles d'attribution (al. 74.5(12)c) LIR).
          for (const [etat, id] of [[etatCible, cibleId], [etatAutre, autreId]] as const) {
            const montant = Math.min(surplus, Math.max(0, etat.droitsCeli));
            if (montant <= 0) continue;
            trouverOuCreer(etat.comptes, 'CELI', etat.profilDefaut).solde += montant;
            etat.droitsCeli -= montant;
            surplus -= montant;
            noter(id, 'celi', montant);
            etat.traceDroits.consoCeli.push({ libelle: `Surplus du ménage réinvesti${venueSurplus}`, montant: -montant });
          }

          /**
           * Le reste revient à chacun **au prorata de son apport** au pot commun de l'année.
           *
           * L'ancienne règle envoyait tout chez le conjoint le plus imposé. Cela se défend pour une
           * déduction REER, qui vaut le taux marginal — pas pour du non-enregistré, dont les revenus
           * sont imposés dans les mains du propriétaire. Le défaut était double : le choix
           * s'auto-entretenait (le placement rendait son bénéficiaire encore plus imposé, donc cible
           * à perpétuité), et il faisait **changer de propriétaire** l'héritage de l'autre conjoint —
           * un transfert qui n'existe pas, et qui déclencherait sinon les règles d'attribution
           * (art. 74.1 LIR, art. 462 LI). Mesuré sur un ménage héritant de 2 M$ chacun : 3 964 326 $
           * chez le conjoint 1 et zéro chez le 2, tout l'impôt de placement sur une seule tête.
           *
           * L'apport contient déjà tout ce qu'une personne verse au pot : salaire net de retenues,
           * rentes, minimum FERR, héritage, loyers, produit de vente (`encaisse`) et retraits de SES
           * comptes. Dépenses et impôt du ménage sont donc partagés au prorata, ce qui est la
           * convention voulue. La phase d'accumulation fait déjà exactement cela via `poserCapital` :
           * c'est l'écart entre les deux branches qui trahissait le défaut.
           */
          if (surplus > 0.5) {
            const apport1 = Math.max(0, ctx1.encaisse + res.retraits.enr1 + res.retraits.nonenr1 + res.retraits.libre1);
            const apport2 = Math.max(0, ctx2.encaisse + res.retraits.enr2 + res.retraits.nonenr2 + res.retraits.libre2);
            const totalApports = apport1 + apport2;
            traceApports = { p1: apport1, p2: apport2 };
            // Repli à parts égales : un surplus sans apport mesurable n'a pas de propriétaire désigné.
            const part1 = totalApports > 0 ? (surplus * apport1) / totalApports : surplus / 2;

            for (const [id, part] of [[1, part1], [2, surplus - part1]] as const) {
              if (part <= 0.5) continue;
              const etat = id === 1 ? etat1 : etat2;
              const ctx = id === 1 ? ctx1 : ctx2;
              const entree = id === 1 ? e1Courant : e2Courant;
              const droits = { droitsCeli: etat.droitsCeli, droitsReer: etat.droitsReer };
              const pose = placerSurplusRetraite(
                etat.comptes, etat.profilDefaut, droits, part, ctx.age, entree, impotAnnee,
                (montantReer) => {
                  const eMaj: EntreeFiscale = { ...entree, deductionReer: entree.deductionReer + montantReer };
                  const e1n = id === 1 ? eMaj : e1Courant;
                  const e2n = id === 2 ? eMaj : e2Courant;
                  const opt = impotCoupleOptimal(e1n, e2n, annee, splittable(e1n, ctx1.age, ctx1.renteEmp), splittable(e2n, ctx2.age, ctx2.renteEmp));
                  fractionnement = Math.abs(opt.transfert);
                  return { impot: opt.impot, entree: eMaj };
                },
              );
              etat.droitsCeli = droits.droitsCeli;
              etat.droitsReer = droits.droitsReer;
              impotAnnee = pose.impot;
              if (id === 1) e1Courant = pose.entree;
              else e2Courant = pose.entree;
              // Le CELI de ce conjoint a déjà été servi par le partage ci-dessus : sa part CELI est
              // nulle ici, le poste sera donc filtré.
              etat.traceDroits.consoCeli.push({ libelle: `Surplus du ménage réinvesti${venueSurplus}`, montant: -pose.ventilation.celi });
              etat.traceDroits.consoReer.push({ libelle: `Surplus du ménage réinvesti${venueSurplus}`, montant: -pose.ventilation.reer });
              noter(id, 'celi', pose.ventilation.celi);
              noter(id, 'reer', pose.ventilation.reer);
              noter(id, 'nonEnr', pose.ventilation.nonEnr);
            }
          }
          traceVentil = ventil;
          revenuDisponible = cible;
        } else if (res.disponible < cible - 1 && anneeEpuisement === null) {
          anneeEpuisement = annee;
        }
        if (h.cibleFonteReer && h.cibleFonteReer > 0) {
          const cibleNom = h.cibleFonteReer * facteurInflation;
          const f1 = fondreReer(etat1.comptes, e1Courant, cibleNom, annee, ctx1.age, etat1.profilDefaut, etat1.droitsCeli);
          etat1.droitsCeli -= f1.celiUtilise;
          etat1.traceDroits.consoCeli.push({ libelle: 'Fonte du REER réinvestie au CELI', montant: -f1.celiUtilise });
          const f2 = fondreReer(etat2.comptes, e2Courant, cibleNom, annee, ctx2.age, etat2.profilDefaut, etat2.droitsCeli);
          etat2.droitsCeli -= f2.celiUtilise;
          etat2.traceDroits.consoCeli.push({ libelle: 'Fonte du REER réinvestie au CELI', montant: -f2.celiUtilise });
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
              remboursementReinvesti: remboursementReinvestiAnnee,
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
              apports: traceApports,
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
        // La fonte du REER n'a pas lieu en accumulation : le garde-fou ne s'y applique pas.
        const cot1 = appliquerCotisations(etat1, facteurInflation, etat2, contextePrio(ctx1, annee, false));
        const cot2 = appliquerCotisations(etat2, facteurInflation, etat1, contextePrio(ctx2, annee, false));
        // Héritage : placé après l'épargne planifiée (qui a la priorité sur les droits), et avant le
        // calcul de l'impôt — la déduction REER qu'il ouvre doit entrer dans le fractionnement optimal.
        const her1 = poserCapital(etat1, ctx1, annee, cot1.deductible, contextePrio(ctx1, annee, false));
        const her2 = poserCapital(etat2, ctx2, annee, cot2.deductible, contextePrio(ctx2, annee, false));
        capitalPlaceAnnee = her1.place + her2.place;
        const e1 = { ...ctx1.entree, deductionReer: cot1.deductible + her1.deductible, cotisationFondsTravailleurs: cot1.fondsTravailleurs };
        const e2 = { ...ctx2.entree, deductionReer: cot2.deductible + her2.deductible, cotisationFondsTravailleurs: cot2.fondsTravailleurs };
        const opt = impotCoupleOptimal(e1, e2, annee, splittable(e1, ctx1.age, ctx1.renteEmp), splittable(e2, ctx2.age, ctx2.renteEmp));
        impotAnnee = opt.impot;
        fractionnement = Math.abs(opt.transfert);

        /**
         * Réinvestir le remboursement d'impôt des déductions de l'année (voir
         * `HypothesesCouple.reinvestirRemboursementReer`). Mesuré sur l'impôt du **ménage**, ce qui
         * est ici gratuit : les deux `impotCoupleOptimal` remplacent l'unique calcul d'impôt du solo.
         *
         * Réparti entre les conjoints **au prorata de leur déduction**, chacun le plaçant dans SES
         * comptes (CELI → non-enregistré, jamais au REER : pas de seconde déduction, donc pas de
         * rétroaction).
         */
        if (h.reinvestirRemboursementReer) {
          const dedTotale = e1.deductionReer + e2.deductionReer;
          if (dedTotale > 0) {
            const sans = impotCoupleOptimal(
              { ...e1, deductionReer: 0 }, { ...e2, deductionReer: 0 }, annee,
              splittable(e1, ctx1.age, ctx1.renteEmp), splittable(e2, ctx2.age, ctx2.renteEmp),
            );
            const remboursement = Math.max(0, sans.impot - impotAnnee);
            if (remboursement > 0.5) {
              for (const [etat, ctx, ded] of [[etat1, ctx1, e1.deductionReer], [etat2, ctx2, e2.deductionReer]] as const) {
                const part = remboursement * (ded / dedTotale);
                if (part <= 0.5) continue;
                const droits = { droitsCeli: etat.droitsCeli, droitsReer: etat.droitsReer };
                const pose = placerCapital(etat.comptes, etat.profilDefaut, droits, part, ctx.age, 0);
                etat.droitsCeli = droits.droitsCeli;
                etat.traceDroits.consoCeli.push({ libelle: 'Remboursement d’impôt réinvesti', montant: -pose.celi });
              }
              remboursementReinvestiAnnee = remboursement;
            }
          }
        }

        // Les retenues sur la paie sont déjà déduites de l'encaisse (voir preparerPersonne).
        // Le capital placé (héritage + produit net de vente) n'est pas disponible pour vivre ; la
        // provision d'impôt retenue sur la vente, elle, sert justement à payer cet impôt.
        revenuDisponible =
          ctx1.encaisse + ctx2.encaisse - her1.place - her2.place - remboursementReinvestiAnnee -
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
              remboursementReinvesti: remboursementReinvestiAnnee,
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
              // Chaque conjoint place SON capital dans SES comptes : la ventilation le dit
              // désormais poste par poste, au lieu de fondre les deux en un seul total.
              ventilSurplus: {
                celi1: her1.celi, reer1: her1.reer, nonEnr1: her1.nonEnr,
                celi2: her2.celi, reer2: her2.reer, nonEnr2: her2.nonEnr,
              },
              apports: { p1: her1.place, p2: her2.place },
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
        // Survivant encore en vie active : la fonte du REER ne s'exécute pas dans cette branche.
        const cot = appliquerCotisations(vivant, facteurInflation, vivant, contextePrio(ctx, annee, false));
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
              remboursementReinvesti: remboursementReinvestiAnnee,
              retenues: ctx.retenuesPaie,
              cotisations: cot.cotisations,
              paiementImmo,
              ventesRealisees: anneeImmo.ventes,
              impotSupporteVente: impotDuGainVente(e, ctx.gainVente, annee),
              cible: 0,
              cibleSaisie: h.depensesRetraite,
              fractionSurvivant: h.fractionSurvivant,
              facteurInflation,
              ventilSurplus: { ...VENTILATION_VIDE },
              apports: { p1: 0, p2: 0 },
            },
            e1: idVivant === 1 ? e : null,
            e2: idVivant === 2 ? e : null,
            transfert: 0,
          };
        }
      } else {
        const cible = h.depensesRetraite * h.fractionSurvivant * facteurInflation + paiementImmo;
        // Remplissage annuel du CELI, comme en décaissement à deux : la survie décaisse elle aussi.
        if (remplirDroitsCeli) {
          remplirCeliAnnuel(vivant, ctx, soldeNonEnr(vivant) - Math.max(0, cible - ctx.encaisse));
        }
        const celiAvant = soldeCeli(vivant);
        const res = financerDepenses(vivant.comptes, h.ordreDecaissement, ctx.entree, ctx.encaisse, cible, annee, ctx.age);
        vivant.droitsCeliRestaures += Math.max(0, celiAvant - soldeCeli(vivant));
        impotAnnee = res.impot;
        revenuDisponible = res.disponible;
        let entreeCourante = res.entree;
        // Surplus (revenu de travail à la retraite ou revenus fixes) : CELI → REER (≤ 71) → non-enr.
        if (res.disponible > cible + 1) {
          let surplus = res.disponible - cible;
          let entreeSurplus = res.entree;

          // Étape prioritaire, devant le CELI. Neutralisée l'année d'une fonte du REER.
          let prioritaire = 0;
          if (seuilReer < 1 && !fonteActive) {
            const baseP = construireBase(entreeSurplus, annee);
            const droitsP = { droitsCeli: vivant.droitsCeli, droitsReer: vivant.droitsReer };
            prioritaire = verserReerPrioritaire(
              vivant.comptes, vivant.profilDefaut, droitsP, surplus, ctx.age,
              Math.max(0, baseP.revenuTotalImpose - baseP.deductionsFederal), seuilReer,
              (x) => calculerTauxMarginal({ ...entreeSurplus, deductionReer: entreeSurplus.deductionReer + x }, 1, annee),
            );
            vivant.droitsReer = droitsP.droitsReer;
            if (prioritaire > 0) {
              entreeSurplus = { ...entreeSurplus, deductionReer: entreeSurplus.deductionReer + prioritaire };
              const nouvelImpot = impotTotalPour(entreeSurplus, annee);
              surplus += Math.max(0, impotAnnee - nouvelImpot) - prioritaire;
              impotAnnee = nouvelImpot;
              vivant.traceDroits.consoReer.push({ libelle: LIBELLE_PRIORITAIRE, montant: -prioritaire });
            }
          }

          const droits = { droitsCeli: vivant.droitsCeli, droitsReer: vivant.droitsReer };
          const pose = placerSurplusRetraite(
            vivant.comptes, vivant.profilDefaut, droits, surplus, ctx.age, entreeSurplus, impotAnnee,
            (montantReer) => {
              const e: EntreeFiscale = { ...entreeSurplus, deductionReer: entreeSurplus.deductionReer + montantReer };
              return { impot: impotTotalPour(e, annee), entree: e };
            },
          );
          vivant.droitsCeli = droits.droitsCeli;
          vivant.droitsReer = droits.droitsReer;
          impotAnnee = pose.impot;
          // Une seule personne vivante : tout est porté à sa colonne, jamais à celle du défunt.
          traceVentil = {
            ...VENTILATION_VIDE,
            [`celi${idVivant}`]: pose.ventilation.celi,
            [`reer${idVivant}`]: pose.ventilation.reer + prioritaire,
            [`nonEnr${idVivant}`]: pose.ventilation.nonEnr,
          };
          entreeCourante = pose.entree;
          revenuDisponible = cible;
          const venue =
            ctx.heritageRecu > 0.5 && ctx.cashVente > 0.5
              ? ' (héritage et vente cette année)'
              : ctx.heritageRecu > 0.5
                ? ' (héritage reçu cette année)'
                : ctx.cashVente > 0.5
                  ? ' (vente d’immeuble cette année)'
                  : '';
          vivant.traceDroits.consoCeli.push({ libelle: `Surplus réinvesti${venue}`, montant: -pose.ventilation.celi });
          vivant.traceDroits.consoReer.push({ libelle: `Surplus réinvesti${venue}`, montant: -pose.ventilation.reer });
        } else if (res.disponible < cible - 1 && anneeEpuisement === null) {
          anneeEpuisement = annee;
        }
        if (h.cibleFonteReer && h.cibleFonteReer > 0) {
          const f = fondreReer(vivant.comptes, entreeCourante, h.cibleFonteReer * facteurInflation, annee, ctx.age, vivant.profilDefaut, vivant.droitsCeli);
          vivant.droitsCeli -= f.celiUtilise;
          vivant.traceDroits.consoCeli.push({ libelle: 'Fonte du REER réinvestie au CELI', montant: -f.celiUtilise });
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
              remboursementReinvesti: remboursementReinvestiAnnee,
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
              apports: { p1: 0, p2: 0 },
            },
            e1: idVivant === 1 ? entreeCourante : null,
            e2: idVivant === 2 ? entreeCourante : null,
            transfert: 0,
          };
        }
      }
      appliquerCroissance(vivant, ctx.croissances);
    }

    /**
     * Décès de fin d'année : on MESURE d'abord, on MUTE ensuite.
     *
     * La mesure doit précéder l'enregistrement de l'année, pour que le tiroir puisse expliquer
     * l'impôt des dispositions présumées et le roulement — sans quoi le chiffre de tête était net
     * sans que rien ne le dise. La mutation (roulement, extinction des comptes) doit le suivre :
     * sinon les soldes du défunt disparaîtraient de la ligne de sa propre année de décès.
     */
    const meurt1 = vivant1 && age1 === h.personne1.ageDeces;
    const meurt2 = vivant2 && age2 === h.personne2.ageDeces;
    /** Un décès avec conjoint survivant : roulement, aucun impôt. Au plus un par année. */
    const premierDeces =
      meurt1 && vivant2 && !meurt2 ? { mort: etat1, survivant: etat2, mortId: 1 as const, survId: 2 as const }
      : meurt2 && vivant1 && !meurt1 ? { mort: etat2, survivant: etat1, mortId: 2 as const, survId: 1 as const }
      : null;
    /**
     * Décès sans conjoint survivant : dispositions présumées. Il peut y en avoir DEUX la même année,
     * et c'est le cas que le code manquait — l'ancienne affectation de `valeurNetteFinaleReelle`
     * écrasait la première succession, faisant disparaître les comptes d'un conjoint.
     */
    const decesFinaux: { etat: EtatPersonne; id: 1 | 2; age: number; impot: number; postes: Poste[] }[] = [];
    for (const [meurt, etat, id, age] of [[meurt1, etat1, 1, age1], [meurt2, etat2, 2, age2]] as const) {
      if (!meurt || (premierDeces && premierDeces.mort === etat)) continue;
      const gainImmo = gainAuDeces(etatsImmo, bienAbrite, id);
      decesFinaux.push({
        etat, id, age,
        impot: impotAuDeces(etat, age, annee, gainImmo),
        postes: postesDispositionsPresumees(etat, gainImmo),
      });
    }
    const impotDecesAnnee = decesFinaux.reduce((s, d) => s + d.impot, 0);
    const impotDe = (id: 1 | 2) => decesFinaux.find((d) => d.id === id)?.impot ?? 0;
    const postesDe = (id: 1 | 2) => decesFinaux.find((d) => d.id === id)?.postes ?? [];

    impotTotalVieReel += (impotAnnee + impotDecesAnnee) * deflateur;
    annees.push({
      annee,
      age1: vivant1 ? age1 : null,
      age2: vivant2 ? age2 : null,
      phase,
      revenuDisponible,
      impotTotal: impotAnnee + impotDecesAnnee,
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
              // Les droits s'éteignent avec la personne : rien à montrer pour un conjoint décédé.
              vivant1 ? fermerAnneeDroits(etat1) : null,
              vivant2 ? fermerAnneeDroits(etat2) : null,
              { impot1: impotDe(1), impot2: impotDe(2), postes1: postesDe(1), postes2: postesDe(2) },
              premierDeces
                ? { postes: postesRoulement(premierDeces.mort), vers: premierDeces.survivant.p.nom }
                : { postes: [], vers: null },
            )
          : undefined,
    });

    // --- Mutations, après l'enregistrement de l'année ---
    if (premierDeces) {
      roulement(premierDeces.mort, premierDeces.survivant);
      roulementImmeubles(etatsImmo, premierDeces.mortId, premierDeces.survId); // sans impôt
      premierDeces.survivant.survivant = true;
      defunt = premierDeces.mort.p;
    }
    if (decesFinaux.length > 0) {
      // CUMUL, et non affectation : deux conjoints peuvent mourir la même année. L'équité
      // immobilière, elle, ne s'ajoute qu'UNE fois — les biens sont comptés en entier, pas par
      // propriétaire (`gainAuDeces` répartit déjà un bien commun à 50 % pour l'impôt).
      const comptesTransmis = decesFinaux.reduce((s, d) => s + valeurNette(d.etat.comptes) - d.impot, 0);
      valeurNetteFinaleReelle = (comptesTransmis + equiteTotale(etatsImmo)) * deflateur;
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
