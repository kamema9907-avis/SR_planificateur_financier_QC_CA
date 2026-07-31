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
  estNonEnregistre,
  repartirCotisationCeliapp,
  soldesParType,
  valeurNette,
  REER_TAUX,
} from './comptes';
import { financerDepenses } from './decaissement';
import { rrqNominale, svNominale } from './rentesPubliques';
import { totalRentesEmployeur } from './rentesEmployeur';
import { totalRevenuTravail } from './periodesTravail';
import { totalHeritage } from './heritage';
import { placerCapital, placerSurplusRetraite, verserReerPrioritaire } from './placementSurplus';
import { remplirCeli } from './remplissageCeli';
import { clonerImmeubles, determinerBienAbrite, gainAuDeces, traiterImmeublesAnnee, type AgregatImmo, type EtatImmeuble, type VenteRealisee } from './immobilier';
import { fondreReer } from './fonteReer';
import {
  construireDetailFiscal,
  detaillerVentes,
  postesNonNuls,
  postesSignificatifs,
  sommePostes,
  type DetailAnnee,
  type DetailDisponible,
  type DetailDroitsAnnee,
  type DetailValeurNette,
  type Poste,
} from './trace';
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

/** Composantes brutes d'une année, capturées dans la boucle pour bâtir la traçabilité. */
interface ComposantesTrace {
  revenuEmploi: number;
  rrq: number;
  sv: number;
  renteEmp: number;
  minimumFERR: number;
  retraitEnr: number;
  retraitNonEnr: number;
  retraitLibre: number;
  loyers: number;
  ventes: number;
  /** Détail bien par bien des ventes de l'année (vide la plupart du temps). */
  ventesRealisees: readonly VenteRealisee[];
  /** Impôt réellement supporté à cause du gain de vente (provision − reliquat). */
  impotSupporteVente: number;
  /** Héritage encaissé cette année (non imposable). */
  heritage: number;
  /** Capital sorti du flux pour être placé dans les comptes (héritage + produit net de vente). */
  capitalPlace: number;
  /** Remboursement d'impôt réinvesti au lieu d'être consommé (0 si le réglage est éteint). */
  remboursementReinvesti: number;
  paiementImmo: number;
  retenues: number;
  cotisations: number;
  /** Cible TOTALE à financer = train de vie indexé + paiement hypothécaire. */
  cible: number;
  /** Cible telle que saisie, en dollars d'aujourd'hui. */
  cibleSaisie: number;
  facteurInflation: number;
  ventilSurplus: { celi: number; reer: number; nonEnr: number };
  /** Évolution des deux compteurs de droits de cotisation sur l'année (voir `DetailDroits`). */
  droits: DetailDroitsAnnee;
}

const LIBELLE_COMPTE: Record<TypeCompte, string> = {
  REER: 'REER', FERR: 'FERR', CELI: 'CELI', CELIAPP: 'CELIAPP', CRI: 'CRI', FRV: 'FRV',
  NON_ENREGISTRE: 'Non-enregistré', REEE: 'REEE',
};

/** Assemble la traçabilité (drill-down) complète d'une année : disponible, impôt, valeur nette. */
function construireDetailAnnee(
  phase: 'accumulation' | 'decaissement',
  c: ComposantesTrace,
  entreeAnnee: EntreeFiscale,
  annee: number,
  impotDeces: number,
  detailDeces: readonly Poste[],
  comptes: readonly Compte[],
  etatsImmo: readonly EtatImmeuble[],
): DetailAnnee {
  const fiscal = construireDetailFiscal(entreeAnnee, annee, impotDeces, detailDeces);
  const impotCourant = fiscal.impotCourant;

  const entreesBrut: Poste[] =
    phase === 'accumulation'
      ? [
          { libelle: 'Revenu d’emploi', montant: c.revenuEmploi },
          { libelle: 'RRQ', montant: c.rrq },
          { libelle: 'Sécurité de la vieillesse', montant: c.sv },
          { libelle: 'Rentes d’employeur', montant: c.renteEmp },
          { libelle: 'Retrait minimum FERR', montant: c.minimumFERR },
          { libelle: 'Loyers encaissés', montant: c.loyers },
          { libelle: 'Produit de vente / downsizing', montant: c.ventes, lien: 'vente' },
          { libelle: 'Héritage reçu (non imposable)', montant: c.heritage },
        ]
      : [
          { libelle: 'Revenu de travail', montant: c.revenuEmploi },
          { libelle: 'RRQ', montant: c.rrq },
          { libelle: 'Sécurité de la vieillesse', montant: c.sv },
          { libelle: 'Rentes d’employeur', montant: c.renteEmp },
          { libelle: 'Retrait minimum FERR', montant: c.minimumFERR },
          { libelle: 'Retraits REER/FERR (volontaires)', montant: c.retraitEnr },
          { libelle: 'Retraits non-enregistré', montant: c.retraitNonEnr },
          { libelle: 'Retraits CELI/CELIAPP', montant: c.retraitLibre },
          { libelle: 'Loyers encaissés', montant: c.loyers },
          { libelle: 'Produit de vente / downsizing', montant: c.ventes, lien: 'vente' },
          { libelle: 'Héritage reçu (non imposable)', montant: c.heritage },
        ];

  const sortiesBrut: Poste[] =
    phase === 'accumulation'
      ? [
          { libelle: 'Impôt', montant: -impotCourant, lien: 'impot' },
          { libelle: 'Cotisations (épargne)', montant: -c.cotisations },
          { libelle: 'Capital placé (héritage, vente)', montant: -c.capitalPlace },
          { libelle: 'Remboursement d’impôt réinvesti', montant: -c.remboursementReinvesti },
          { libelle: 'Retenues sur la paie (RRQ/AE/RQAP)', montant: -c.retenues },
        ]
      : [
          { libelle: 'Impôt', montant: -impotCourant, lien: 'impot' },
          { libelle: 'Retenues sur la paie (RRQ/AE/RQAP)', montant: -c.retenues },
        ];
  // Le versement hypothécaire est une sortie dans les DEUX phases. Il était auparavant fondu dans
  // « Dépenses » pendant le décaissement : le même dollar changeait de place selon l'année, et la
  // colonne dépassait la cible saisie sans explication.
  sortiesBrut.push({ libelle: 'Paiement hypothécaire', montant: -c.paiementImmo });

  const entrees = postesSignificatifs(entreesBrut);
  const sorties = postesSignificatifs(sortiesBrut);
  const revenusNets = sommePostes(entrees) + sommePostes(sorties); // les sorties sont déjà négatives
  // Train de vie visé, hypothèque exclue : elle vient d'être comptée dans les sorties. La
  // soustraction (et non le produit des composantes) garantit que revenusNets − depenses redonne
  // exactement le surplus d'avant ce changement.
  const depenses = c.cible > 0 ? c.cible - c.paiementImmo : 0;
  // Le surplus (revenus au-delà de la cible, réinvesti) n'a de sens qu'en décaissement — repéré
  // par une cible non nulle, pour rester symétrique du calcul de `depenses` ci-dessus.
  const surplus = c.cible > 0 ? Math.max(0, revenusNets - depenses) : 0;

  const disponible: DetailDisponible = {
    entrees,
    sorties,
    revenusNets,
    depenses,
    detailDepenses: {
      cibleSaisie: c.cibleSaisie,
      fractionSurvivant: 1, // pas de phase de survie en mode solo
      facteurInflation: c.facteurInflation,
    },
    ventes: detaillerVentes(c.ventesRealisees, c.impotSupporteVente),
    // Un héritage reçu la même année se place dans le MÊME bloc de capital : la ventilation ne
    // pourrait alors pas être attribuée à la vente seule.
    ventesSeuleSourceDeCapital: c.heritage <= 0.5,
    surplus,
    destinationSurplus: postesSignificatifs([
      { libelle: 'CELI', montant: c.ventilSurplus.celi },
      { libelle: 'REER', montant: c.ventilSurplus.reer },
      { libelle: 'Non-enregistré', montant: c.ventilSurplus.nonEnr },
    ]),
  };

  const valeurNette: DetailValeurNette = {
    comptes: postesSignificatifs(comptes.map((cpt) => ({ libelle: LIBELLE_COMPTE[cpt.type], montant: cpt.solde }))),
    immobilier: postesSignificatifs(
      etatsImmo.map((e) => ({ libelle: e.bien.nom, montant: e.vendu ? 0 : Math.max(0, e.valeur - e.hypotheque) })),
    ),
    impotDeces,
    // Le roulement au conjoint n'existe pas en mode solo : personne à qui transmettre sans impôt.
    roulement: [],
    roulementVers: null,
  };

  return { disponible, impot: fiscal, valeurNette, droits: c.droits };
}

/** Projette une situation financière sur tout le cycle de vie. */
export function projeter(h: HypothesesProjection, options: { trace?: boolean } = {}): ResultatProjection {
  const comptes = clonerComptes(h.comptes);
  const profilDefaut: ProfilRendement = comptes[0]?.profil ?? 'equilibre';
  const etatsImmo = clonerImmeubles(h.immeubles);
  const bienAbrite = determinerBienAbrite(h.immeubles);
  const annees: AnneeProjection[] = [];

  let ageEpuisement: number | null = null;
  let impotTotalVieReel = 0;
  /**
   * Impôt des dispositions présumées au décès, retenu pour être **retranché du patrimoine transmis**.
   *
   * Il était calculé et compté dans l'impôt de la vie, mais jamais soustrait de la valeur nette —
   * alors que l'écran promettait « après impôt au décès ». Le mode couple le soustrayait déjà
   * (`couple.ts`) : les deux modes mesuraient donc avec des règles différentes.
   */
  let impotAuDeces = 0;
  let celiappCotiseCumul = h.celiappDejaCotise ?? 0; // cumul nominal des cotisations CELIAPP (plafond 40 000 $)
  // Droits CELI : compteur vivant — départ (ARC ou heuristique), +droits annuels chaque année,
  // −cotisations, +retraits de l'année précédente (restaurés au 1er janvier suivant).
  let droitsCeli = h.droitsCeliDisponibles ?? droitsCeliParDefaut(h.comptes);
  let droitsCeliRestaures = 0;
  let droitsReer = h.droitsReerDisponibles ?? 0; // droits REER (report), sans restauration au retrait
  const soldeCeliTotal = () => comptes.filter((c) => c.type === 'CELI').reduce((s, c) => s + c.solde, 0);
  const soldeNonEnrTotal = () =>
    comptes.filter((c) => estNonEnregistre(c.type)).reduce((s, c) => s + c.solde, 0);
  // Seuil du versement REER prioritaire. Absent ou ≥ 1 : règle désactivée, chaîne historique.
  const seuilReer = h.seuilMarginalReer ?? 1;
  // Absent vaut ACTIVÉ : voir `HypothesesProjection.remplirDroitsCeli`.
  const remplirDroitsCeli = h.remplirDroitsCeli ?? true;
  const LIBELLE_PRIORITAIRE = `Versement REER prioritaire (marginal > ${Math.round(seuilReer * 100)} %)`;

  for (let i = 0; h.ageActuel + i <= h.ageDeces; i++) {
    const age = h.ageActuel + i;
    const annee = ANNEE_BASE + i;

    // Traçabilité des droits : on capture le report AVANT l'ajout du 1er janvier, puis chaque
    // mouvement est nommé au moment où il se produit. La somme doit redonner le compteur final.
    const reportCeli = droitsCeli;
    const reportReer = droitsReer;
    const ajoutsCeli: Poste[] = [];
    const ajoutsReer: Poste[] = [];
    const consoCeli: Poste[] = [];
    const consoReer: Poste[] = [];
    let salaireDroitsReer = 0;

    if (i > 0) {
      const neufsCeli = droitsCeliAnnuels(annee, h.inflation);
      const restaures = droitsCeliRestaures;
      droitsCeli += neufsCeli + restaures;
      droitsCeliRestaures = 0;
      ajoutsCeli.push({ libelle: 'Droits CELI de l’année', montant: neufsCeli });
      // Un retrait CELI ne redonne ses droits qu'au 1er janvier SUIVANT : la ligne nomme donc l'âge
      // de l'année où le retrait a eu lieu, sinon elle semblerait tomber de nulle part.
      ajoutsCeli.push({ libelle: `Retraits CELI de ${age - 1} ans, restaurés`, montant: restaures });
    }

    /** Droits REER neufs d'une année, décomposés en postes qui somment à `droitsReerAnnuels`. */
    const ajouterDroitsReer = (salaire: number, fe: number) => {
      const plafond = plafondReerNominal(annee);
      const brut = REER_TAUX * Math.max(0, salaire);
      const plafonne = Math.min(brut, plafond);
      const feApplique = Math.min(Math.max(0, fe), plafonne); // ce qui est réellement retranché
      droitsReer += droitsReerAnnuels(salaire, plafond, fe);
      salaireDroitsReer = salaire;
      ajoutsReer.push({ libelle: '18 % du salaire', montant: brut });
      // Le plafond en dollars ne mord que sur les hauts salaires : l'afficher toujours serait du bruit.
      ajoutsReer.push({ libelle: 'Plafond de l’année appliqué', montant: -(brut - plafonne) });
      ajoutsReer.push({ libelle: 'Facteur d’équivalence (régime à PD)', montant: -feApplique });
    };
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

    // Héritage reçu cette année (non imposable ; commun aux deux phases).
    const heritageRecu = totalHeritage(h.heritages, age, h.ageActuel, h.inflation);

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
    const anneeImmo = traiterImmeublesAnnee(etatsImmo, i, h.inflation, () => age, bienAbrite);
    const aggImmo = anneeImmo.parProprietaire;
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

    // Captures pour la traçabilité (remplies au fil des branches ; utilisées si options.trace).
    let traceRetenues = 0;
    let traceCible = 0;
    let traceRetraitEnr = 0;
    let traceVentil = { celi: 0, reer: 0, nonEnr: 0 };
    /** Capital sorti du flux pour être placé (héritage + produit net de vente). */
    let capitalPlace = 0;
    /** Remboursement d'impôt réinvesti au lieu d'être consommé (0 si le réglage est éteint). */
    let remboursementReinvesti = 0;
    /** Provision d'impôt retenue sur le gain de vente, et part restituée ensuite (voir plus bas). */
    let impotSurGainVente = 0;
    let reliquatVente = 0;
    let traceImpotDeces = 0;
    let traceDetailDeces: Poste[] = [];

    if (phase === 'accumulation') {
      revenuEmploi = h.revenuEmploi * Math.pow((1 + h.inflation) * (1 + h.croissanceSalaireReelle), i);

      // Droits REER : accumulation annuelle = 18 % du salaire (plafonné) − facteur d'équivalence.
      const feReer =
        h.facteurEquivalenceReer && h.facteurEquivalenceReer > 0
          ? h.facteurEquivalenceReer * facteurInflation
          : h.regimeRetraitePD
            ? feRegimePD(revenuEmploi)
            : 0;
      ajouterDroitsReer(revenuEmploi, feReer);

      // Cotisations aux comptes (indexées à l'inflation).
      let deductible = 0;

      /**
       * Entrée fiscale de l'année pour une déduction et un gain donnés.
       *
       * Définie AVANT la boucle d'épargne — elle l'était après — parce que le versement REER
       * prioritaire a besoin du taux marginal pendant cette boucle. Tous les revenus qu'elle
       * référence sont déjà calculés à ce stade ; seule la déduction varie d'un appel à l'autre.
       */
      const entreeCourante = (dedReer: number, gain: number): EntreeFiscale => ({
        ...nouvelleEntree(age, h.vitSeul),
        revenuEmploi,
        revenuRRQ: rrq,
        revenuPensionSV: sv,
        revenuPensionPrivee: minimumFERR + renteEmp,
        autresRevenus: interetNonEnr + immo.revenuImposable,
        dividendesDetermines: dividendesNonEnr,
        gainsCapital: gain,
        deductionReer: dedReer,
      });

      /** Revenu imposable qu'il reste à effacer : au-delà, une déduction serait perdue. */
      const deductionUtilisableAvec = (dedDeja: number, gain: number) => {
        const b = construireBase(entreeCourante(dedDeja, gain), annee);
        return Math.max(0, b.revenuTotalImpose - b.deductionsFederal);
      };

      /**
       * Versement REER prioritaire : tant que la déduction rapporte plus que le seuil, cet argent
       * vaut mieux au REER qu'au CELI. Étape AJOUTÉE devant la chaîne existante — ce qu'elle ne
       * prend pas poursuit son chemin normal. MUTE `deductible`.
       */
      const reerPrioritaire = (montant: number, gain: number): number => {
        const droits = { droitsCeli, droitsReer };
        const verse = verserReerPrioritaire(
          comptes, profilDefaut, droits, montant, age,
          deductionUtilisableAvec(deductible, gain), seuilReer,
          (x) => calculerTauxMarginal(entreeCourante(deductible + x, gain), 1, annee),
        );
        droitsReer = droits.droitsReer;
        if (verse > 0) {
          deductible += verse;
          consoReer.push({ libelle: LIBELLE_PRIORITAIRE, montant: -verse });
        }
        return verse;
      };

      /**
       * Verse au CELI dans la limite des droits ; l'excédent déborde au non-enregistré.
       * @returns la part qui a **consommé des droits CELI**, pour que l'appelant la nomme.
       */
      const verserAuCeli = (montant: number): number => {
        // Étape prioritaire, devant le CELI. Sans effet quand la règle est désactivée, ou quand les
        // droits REER sont déjà épuisés — c'est notamment le cas du débordement venu du REER.
        const aPlacer = montant - reerPrioritaire(montant, immo.gainBrut);
        const auCeli = Math.min(aPlacer, Math.max(0, droitsCeli));
        if (auCeli > 0) {
          trouverOuCreer(comptes, 'CELI', profilDefaut).solde += auCeli;
          droitsCeli -= auCeli;
        }
        const reste = aPlacer - auCeli;
        if (reste > 0) {
          const ne = trouverOuCreer(comptes, 'NON_ENREGISTRE', profilDefaut);
          ne.solde += reste;
          ne.coutBase = (ne.coutBase ?? 0) + reste;
        }
        return auCeli;
      };

      /**
       * Verse au REER dans la limite des droits ; l'excédent déborde en chaîne CELI → non-enregistré.
       * @returns les droits consommés de chaque côté : le débordement au CELI en consomme aussi.
       */
      const verserAuReer = (montant: number): { reer: number; celi: number } => {
        const auReer = Math.min(montant, Math.max(0, droitsReer));
        if (auReer > 0) {
          trouverOuCreer(comptes, 'REER', profilDefaut).solde += auReer;
          deductible += auReer;
          droitsReer -= auReer;
          cotisations += auReer;
        }
        const excedent = montant - auReer;
        let celi = 0;
        if (excedent > 0) {
          celi = verserAuCeli(excedent);
          cotisations += excedent;
        }
        return { reer: auReer, celi };
      };

      // Fonds de travailleurs (FTQ/Fondaction) : donne SEULEMENT le crédit de 30 % (1er 5 000 $). La
      // cotisation elle-même est déjà saisie dans l'épargne REER (champ REER) — on n'ajoute donc rien au
      // REER ici (sinon double comptage). Le crédit est appliqué via cotisationFondsTravailleurs.
      const fondsTravailleursNominal = (h.fondsTravailleursAnnuel ?? 0) * facteurInflation;

      for (const [type, montantAujourdhui] of Object.entries(h.epargneAnnuelle) as [TypeCompte, number][]) {
        if (!montantAujourdhui) continue;
        const montant = montantAujourdhui * facteurInflation;

        // CELI : plafonné par les droits de cotisation (excédent → non-enregistré).
        if (type === 'CELI') {
          consoCeli.push({ libelle: 'Épargne CELI planifiée', montant: -verserAuCeli(montant) });
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
            // Redirigé (non déductible), dans la limite des droits CELI.
            consoCeli.push({ libelle: 'Excédent CELIAPP redirigé au CELI', montant: -verserAuCeli(excedent) });
            cotisations += excedent;
          }
          continue;
        }

        // REER : plafonné aux droits disponibles ; l'excédent suit la chaîne CELI → non-enregistré.
        if (type === 'REER') {
          const v = verserAuReer(montant);
          consoReer.push({ libelle: 'Épargne REER planifiée', montant: -v.reer });
          consoCeli.push({ libelle: 'Débordement de l’épargne REER vers le CELI', montant: -v.celi });
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

      // Héritage : capital non imposable, placé CELI → REER → non-enregistré dans la limite des
      // droits RESTANTS. L'épargne planifiée ci-dessus a servi la première : elle est choisie, alors
      // que l'héritage est un imprévu. La part versée au REER est déductible du revenu de l'année.
      // Capital reçu cette année : héritage (non imposable) et produit d'une vente immobilière.
      // La vente, elle, déclenche un gain en capital : on ne peut placer que le produit NET de
      // l'impôt qu'il engendre, sinon le même argent servirait deux fois — c'est ce que faisait
      // l'ancien code, qui plaçait le produit brut et laissait le revenu disponible partir en
      // négatif. (`entreeCourante` est défini plus haut : la boucle d'épargne en a besoin.)
      if (immo.cashVente > 0 && immo.gainBrut > 0) {
        // Mesuré AVANT tout versement REER issu de la vente : sinon le montant à placer dépendrait
        // de l'impôt, qui dépendrait du montant placé. On place donc un peu moins que le maximum
        // théorique, jamais plus.
        impotSurGainVente = Math.max(
          0,
          impotTotalPour(entreeCourante(deductible, immo.gainBrut), annee) -
            impotTotalPour(entreeCourante(deductible, 0), annee),
        );
      }
      const deductibleHorsCapital = deductible; // référence : ce que serait l'année sans la vente
      const venteAPlacer = Math.max(0, immo.cashVente - impotSurGainVente);
      const capitalAPlacer = heritageRecu + venteAPlacer;

      if (capitalAPlacer > 0) {
        // Étape prioritaire : la part du capital dont la déduction rapporte plus que le seuil va au
        // REER avant tout. Le reste suit la chaîne historique CELI → REER → non-enregistré.
        const prioritaire = reerPrioritaire(capitalAPlacer, immo.gainBrut);

        // Ce qu'il reste de revenu imposable une fois les déductions déjà prévues appliquées :
        // au-delà, un versement REER ne procurerait plus aucune économie d'impôt. Le gain de la
        // vente en fait partie — c'est ce qui permet la stratégie « vendre puis cotiser au REER
        // pour absorber le gain ».
        const deductionUtilisable = deductionUtilisableAvec(deductible, immo.gainBrut);

        const droits = { droitsCeli, droitsReer };
        const pose = placerCapital(comptes, profilDefaut, droits, capitalAPlacer - prioritaire, age, deductionUtilisable);
        droitsCeli = droits.droitsCeli;
        droitsReer = droits.droitsReer;
        deductible += pose.deductible;
        capitalPlace = capitalAPlacer;
        traceVentil = { celi: pose.celi, reer: pose.reer + prioritaire, nonEnr: pose.nonEnr };
        // Héritage et vente sont placés d'un seul bloc : le libellé dit laquelle des deux sources
        // alimente ce bloc, plutôt que de laisser croire à une attribution qui n'existe pas.
        const source =
          heritageRecu > 0.5 && venteAPlacer > 0.5
            ? 'd’un héritage et d’une vente'
            : heritageRecu > 0.5
              ? 'd’un héritage'
              : 'du produit d’une vente';
        consoCeli.push({ libelle: `Placement ${source}`, montant: -pose.celi });
        consoReer.push({ libelle: `Placement ${source}`, montant: -pose.reer });
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
        cotisationFondsTravailleurs: fondsTravailleursNominal, // crédit de 30 % (moteur plafonne à 5 000 $)
      };
      impotAnnee = impotTotalPour(entreeAnnee, annee);
      // Retenues sur la paie (RRQ + AE + RQAP) : sortie de trésorerie en plus de l'impôt.
      const retenuesPaie = calculerCotisations(revenuEmploi, parametresCotisations(annee)).total;
      traceRetenues = retenuesPaie;

      // La provision d'impôt retenue sur la vente s'est peut-être révélée trop élevée : un versement
      // REER issu de cette même vente réduit l'impôt du gain. On replace l'écart au non-enregistré,
      // comme `placerSurplusRetraite` le fait du remboursement qu'il obtient. Une seule itération :
      // la rétroaction est volontairement bornée, comme ailleurs dans le moteur.
      if (impotSurGainVente > 0) {
        // Référence : l'impôt qu'aurait donné une année SANS la vente — donc sans son gain et sans
        // la cotisation REER qu'elle a permise. Comparer à l'impôt recalculé avec cette cotisation
        // sous-estimerait le reliquat, l'argent placé venant précisément de la vente.
        const impotSansVente = impotTotalPour(entreeCourante(deductibleHorsCapital, 0), annee);
        reliquatVente = Math.max(0, impotSurGainVente - Math.max(0, impotAnnee - impotSansVente));
        if (reliquatVente > 0) {
          const ne = trouverOuCreer(comptes, 'NON_ENREGISTRE', profilDefaut);
          ne.solde += reliquatVente;
          ne.coutBase = (ne.coutBase ?? 0) + reliquatVente;
          traceVentil = { ...traceVentil, nonEnr: traceVentil.nonEnr + reliquatVente };
          capitalPlace += reliquatVente;
        }
      }

      /**
       * Réinvestir le remboursement d'impôt des déductions de l'année, au lieu de le laisser au
       * train de vie (voir `HypothesesProjection.reinvestirRemboursementReer`).
       *
       * Placé **CELI → non-enregistré**, jamais au REER : l'y verser ouvrirait une nouvelle
       * déduction, donc un nouveau remboursement. La rétroaction est bornée à zéro itération, dans
       * le même esprit que le reliquat de vente ci-dessus. `deductionUtilisable = 0` suffit à
       * l'interdire, sans dupliquer la logique de `placerCapital`.
       */
      if (h.reinvestirRemboursementReer && deductible > 0) {
        const impotSansDeduction = impotTotalPour({ ...entreeAnnee, deductionReer: 0 }, annee);
        const remboursement = Math.max(0, impotSansDeduction - impotAnnee);
        if (remboursement > 0.5) {
          const droits = { droitsCeli, droitsReer };
          const pose = placerCapital(comptes, profilDefaut, droits, remboursement, age, 0);
          droitsCeli = droits.droitsCeli;
          remboursementReinvesti = remboursement;
          consoCeli.push({ libelle: 'Remboursement d’impôt réinvesti', montant: -pose.celi });
        }
      }

      // Conservation, lisible telle quelle dans le tiroir de détail : tout ce qui entre (revenus,
      // loyers, produit de vente, héritage) ressort en impôt, cotisations, capital placé,
      // remboursement réinvesti ou disponible. Aucun dollar ne se crée ni ne disparaît.
      revenuDisponible =
        revenuEmploi + rrq + sv + minimumFERR + renteEmp + immo.loyerCash + immo.cashVente +
        heritageRecu - capitalPlace - remboursementReinvesti - immo.paiement - impotAnnee -
        cotisations - retenuesPaie;
    } else {
      // Revenu de travail poursuivi À LA RETRAITE (« retraité-actif ») : imposé comme emploi, net
      // des retenues (RRQ/AE/RQAP) dans l'encaisse, et rouvrant des droits REER (jusqu'à 71 ans).
      const revenuTravail = totalRevenuTravail(h.periodesTravail, age, h.ageActuel, h.inflation);
      const retenuesTravail =
        revenuTravail > 0 ? calculerCotisations(revenuTravail, parametresCotisations(annee)).total : 0;
      revenuEmploi = revenuTravail;
      if (revenuTravail > 0 && age <= AGE_CONVERSION_FERR) {
        ajouterDroitsReer(revenuTravail, 0);
      }

      const cible = h.depensesRetraite * facteurInflation + immo.paiement;
      const encaisseForcee =
        revenuTravail - retenuesTravail + rrq + sv + minimumFERR + renteEmp + immo.loyerCash +
        immo.cashVente + heritageRecu;

      /**
       * Remplissage annuel du CELI depuis le non-enregistré, AVANT le solveur (voir
       * `remplissageCeli.ts`). Le gain réalisé entre dans l'entrée fiscale de l'année et le solveur
       * financera l'impôt correspondant en même temps que la dépense — aucune rétroaction.
       *
       * On laisse liquide ce que les comptes devront fournir cette année (`cible` moins l'encaisse
       * déjà en main), sinon le solveur ressortirait du CELI ce qu'on vient d'y verser.
       */
      let gainRemplissage = 0;
      if (remplirDroitsCeli) {
        const r = remplirCeli(
          comptes, profilDefaut, droitsCeli,
          soldeNonEnrTotal() - Math.max(0, cible - encaisseForcee),
        );
        if (r.montant > 0) {
          droitsCeli -= r.montant;
          gainRemplissage = r.gainRealise;
          consoCeli.push({ libelle: 'Transfert annuel du non-enregistré vers le CELI', montant: -r.montant });
        }
      }

      const entreeForcee: EntreeFiscale = {
        ...nouvelleEntree(age, h.vitSeul),
        revenuEmploi: revenuTravail,
        revenuRRQ: rrq,
        revenuPensionSV: sv,
        revenuPensionPrivee: minimumFERR + renteEmp,
        autresRevenus: interetNonEnr + immo.revenuImposable,
        dividendesDetermines: dividendesNonEnr,
        gainsCapital: immo.gainBrut + gainRemplissage,
      };
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
      traceRetenues = retenuesTravail;
      traceCible = cible;
      traceRetraitEnr = res.retraitEnregistre;

      // Réinvestir un éventuel surplus (revenu de travail ou revenus fixes dépassant la cible) :
      // CELI → REER (≤ 71 ans, déductible) → non-enregistré.
      if (res.disponible > cible + 1) {
        let surplus = res.disponible - cible;

        /**
         * Étape prioritaire, devant le CELI.
         *
         * **Garde-fou** : jamais l'année d'une fonte du REER. `fondreReer` s'exécute quelques lignes
         * plus bas et retire des comptes enregistrés pour remplir les tranches basses — cotiser au
         * REER juste avant reviendrait à verser le matin ce qu'on fond l'après-midi.
         */
        let prioritaire = 0;
        if (seuilReer < 1 && !(h.cibleFonteReer && h.cibleFonteReer > 0)) {
          const baseSurplus = construireBase(entreeAnnee, annee);
          const droitsP = { droitsCeli, droitsReer };
          prioritaire = verserReerPrioritaire(
            comptes, profilDefaut, droitsP, surplus, age,
            Math.max(0, baseSurplus.revenuTotalImpose - baseSurplus.deductionsFederal), seuilReer,
            (x) => calculerTauxMarginal({ ...entreeAnnee, deductionReer: entreeAnnee.deductionReer + x }, 1, annee),
          );
          droitsReer = droitsP.droitsReer;
          if (prioritaire > 0) {
            // La déduction obtenue réduit l'impôt : le remboursement est du liquide en plus, replacé
            // avec le reste du surplus — même convention que `placerSurplusRetraite`.
            const e: EntreeFiscale = { ...entreeAnnee, deductionReer: entreeAnnee.deductionReer + prioritaire };
            const nouvelImpot = impotTotalPour(e, annee);
            surplus += Math.max(0, impotAnnee - nouvelImpot) - prioritaire;
            impotAnnee = nouvelImpot;
            entreeAnnee = e;
            consoReer.push({ libelle: LIBELLE_PRIORITAIRE, montant: -prioritaire });
          }
        }

        const droits = { droitsCeli, droitsReer };
        const pose = placerSurplusRetraite(
          comptes, profilDefaut, droits, surplus, age, entreeAnnee, impotAnnee,
          (montantReer) => {
            const e: EntreeFiscale = { ...entreeAnnee, deductionReer: entreeAnnee.deductionReer + montantReer };
            return { impot: impotTotalPour(e, annee), entree: e };
          },
        );
        droitsCeli = droits.droitsCeli;
        droitsReer = droits.droitsReer;
        impotAnnee = pose.impot;
        entreeAnnee = pose.entree;
        traceVentil = { ...pose.ventilation, reer: pose.ventilation.reer + prioritaire };
        revenuDisponible = cible;
        // En décaissement, un héritage ou une vente ne sont PAS placés d'un bloc : ils entrent dans
        // l'encaisse, financent les dépenses de l'année, et seul l'excédent est réinvesti. Le
        // libellé nomme donc le mécanisme (le surplus) et, entre parenthèses, sa provenance — sans
        // quoi un héritage de 120 000 $ apparaissait sous le seul mot « surplus ».
        const venue =
          heritageRecu > 0.5 && immo.cashVente > 0.5
            ? ' (héritage et vente cette année)'
            : heritageRecu > 0.5
              ? ' (héritage reçu cette année)'
              : immo.cashVente > 0.5
                ? ' (vente d’immeuble cette année)'
                : '';
        consoCeli.push({ libelle: `Surplus de retraite réinvesti${venue}`, montant: -pose.ventilation.celi });
        consoReer.push({ libelle: `Surplus de retraite réinvesti${venue}`, montant: -pose.ventilation.reer });
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
        consoCeli.push({ libelle: 'Fonte du REER réinvestie au CELI', montant: -f.celiUtilise });
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
      impotAuDeces = impotDeces;
      traceImpotDeces = impotDeces;
      traceDetailDeces = [
        { libelle: 'REER / FERR / CRI / FRV liquidés', montant: soldesEnr },
        { libelle: 'Gains en capital latents (non-enregistré)', montant: gainsLatents },
        { libelle: 'Gains immobiliers (dispositions présumées)', montant: gainsImmo },
      ];
    }

    /**
     * Impôt réellement supporté à cause du gain de vente. En accumulation, c'est la provision
     * MOINS le reliquat déjà restitué ; en décaissement, aucune provision n'est retenue et on
     * applique la même convention directement : impôt de l'année, moins ce qu'il aurait été sans
     * le gain. Une seule évaluation supplémentaire, et seulement les années de vente.
     */
    let impotSupporteVente = 0;
    if (immo.gainBrut > 0.5) {
      impotSupporteVente =
        phase === 'accumulation'
          ? Math.max(0, impotSurGainVente - reliquatVente)
          : Math.max(
              0,
              impotAnnee -
                impotTotalPour(
                  { ...entreeAnnee, gainsCapital: Math.max(0, entreeAnnee.gainsCapital - immo.gainBrut) },
                  annee,
                ),
            );
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
      detail: options.trace
        ? construireDetailAnnee(
            phase,
            {
              revenuEmploi,
              rrq,
              sv,
              renteEmp,
              minimumFERR,
              retraitEnr: traceRetraitEnr,
              retraitNonEnr: retraitsNonEnregistres,
              retraitLibre: retraitsLibresImpot,
              loyers: immo.loyerCash,
              ventes: immo.cashVente,
              ventesRealisees: anneeImmo.ventes,
              impotSupporteVente,
              heritage: heritageRecu,
              capitalPlace,
              remboursementReinvesti,
              paiementImmo: immo.paiement,
              cibleSaisie: h.depensesRetraite,
              facteurInflation,
              retenues: traceRetenues,
              cotisations,
              cible: traceCible,
              ventilSurplus: traceVentil,
              droits: {
                celi: {
                  report: reportCeli,
                  ajouts: postesNonNuls(ajoutsCeli),
                  consommations: postesNonNuls(consoCeli),
                  restant: droitsCeli,
                  // Retraits de CETTE année : ils ne reviendront qu'au 1er janvier prochain.
                  aRestaurerLAnProchain: droitsCeliRestaures,
                  salaireRetenu: 0,
                },
                reer: {
                  report: reportReer,
                  ajouts: postesNonNuls(ajoutsReer),
                  consommations: postesNonNuls(consoReer),
                  restant: droitsReer,
                  aRestaurerLAnProchain: 0, // le REER ne restaure rien au retrait
                  salaireRetenu: salaireDroitsReer,
                },
              },
            },
            entreeAnnee,
            annee,
            traceImpotDeces,
            traceDetailDeces,
            comptes,
            etatsImmo,
          )
        : undefined,
    });
  }

  const derniere = annees[annees.length - 1];
  return {
    annees,
    ageEpuisement,
    suffisant: ageEpuisement === null,
    // Patrimoine réellement TRANSMIS : les soldes bruts moins l'impôt des dispositions présumées.
    // `valeurNette` par année reste brute — le tableau et le tiroir listent les soldes compte par
    // compte, et leur somme doit continuer d'égaler le total affiché. Même formule que `couple.ts`,
    // sans clamp : un patrimoine transmis négatif signalerait une erreur de modèle qu'il faut voir.
    valeurNetteAuDecesReelle: derniere ? (derniere.valeurNette - impotAuDeces) * derniere.deflateurReel : 0,
    impotTotalVieReel,
  };
}
