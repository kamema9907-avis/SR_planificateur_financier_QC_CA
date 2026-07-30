/**
 * Cohérence des hypothèses saisies.
 *
 * Le moteur accepte n'importe quels nombres et produit une projection : une retraite avant l'âge
 * actuel ou une rente qui se termine avant de commencer donnent un résultat silencieusement faux.
 * Ces contrôles signalent ces cas à l'étape concernée, avant que l'utilisateur ne lise un chiffre
 * qui ne veut rien dire.
 *
 * Fonctions pures, sans React : testables comme le moteur.
 */
import type { HypothesesCouple, HypothesesProjection, Immeuble, TypeCompte } from '../../moteur';
import { droitsReerAnnuels, feRegimePD, REER_PLAFOND_DOLLAR_2026, REER_TAUX } from '../../moteur';
import type { ChampsPersonne } from './champsPersonne';

/** Une anomalie détectée, rattachée à l'étape où on peut la corriger. */
export interface Alerte {
  /** Identifiant de l'étape concernée (voir `etapes.tsx`). */
  etape: string;
  message: string;
  /** `erreur` = résultat certainement faux ; `attention` = à vérifier. */
  niveau: 'erreur' | 'attention';
}

const TYPES_EPARGNE: readonly TypeCompte[] = ['REER', 'CELI', 'CELIAPP', 'NON_ENREGISTRE', 'REEE'];

const epargneTotale = (p: ChampsPersonne) =>
  TYPES_EPARGNE.reduce((s, t) => s + (p.epargneAnnuelle[t] ?? 0), 0);

/** Une entrée de capital à venir : produit d'une vente d'immeuble, ou héritage. */
interface Apport {
  /** Phrase déjà tournée, insérée telle quelle dans le message (« la vente de « Chalet » à 65 ans »). */
  libelle: string;
  age: number;
}

/**
 * En deçà de ce report, le levier de la déduction REER ne pèse plus rien face à un apport de capital.
 * Seuil volontairement grossier : l'alerte n'a qu'à rompre le silence, pas à chiffrer quoi que ce soit.
 */
const SEUIL_DROITS_REER = 10_000;

/**
 * Droits REER estimés au moment d'un apport de capital, en dollars d'aujourd'hui.
 *
 * Réutilise la formule du moteur (`droitsReerAnnuels`) plutôt que de la redire : 18 % du salaire
 * plafonné, moins le facteur d'équivalence, par année de travail restante — moins ce que l'épargne
 * annuelle consomme au passage. On ne rejoue PAS la projection ici : il s'agit seulement de savoir
 * si le levier de la déduction existera, pas de le chiffrer.
 */
function droitsReerEstimesA(p: ChampsPersonne, age: number): number {
  const anneesDeSalaire = Math.max(0, Math.min(age, p.ageRetraite) - p.ageActuel);
  const fe =
    p.facteurEquivalenceReer && p.facteurEquivalenceReer > 0
      ? p.facteurEquivalenceReer
      : p.regimeRetraitePD
        ? feRegimePD(p.revenuEmploi)
        : 0;
  const gainAnnuel = droitsReerAnnuels(p.revenuEmploi, REER_PLAFOND_DOLLAR_2026, fe);
  const consommeAnnuel = (p.epargneAnnuelle.REER ?? 0) + (p.fondsTravailleursAnnuel ?? 0);
  return (p.droitsReerDisponibles ?? 0) + anneesDeSalaire * Math.max(0, gainAnnuel - consommeAnnuel);
}

/**
 * Un apport de capital est prévu, mais aucun droit REER ne sera là pour l'accueillir.
 *
 * Le produit d'une vente et un héritage sont placés en CELI → REER → non-enregistré ; la part versée
 * au REER est déductible et absorbe le gain en capital de l'année. Sans droits, ce levier n'existe
 * pas et le gain est imposé au maximum — en silence, puisque le défaut du champ est 0.
 *
 * Le travail à la retraite est délibérément exclu : ce revenu rouvre lui-même des droits REER
 * (jusqu'à 71 ans), donc son surplus ne se présente jamais devant une porte fermée.
 */
function validerDroitsReerApports(
  p: ChampsPersonne,
  apports: readonly Apport[],
  qui: (texte: string) => string,
): Alerte[] {
  const aVenir = apports.filter((x) => x.age >= p.ageActuel && x.age <= p.ageDeces);
  if (aVenir.length === 0) return [];
  const premier = aVenir.reduce((a, b) => (b.age < a.age ? b : a));
  if (droitsReerEstimesA(p, premier.age) >= SEUIL_DROITS_REER) return [];

  const autres = aVenir.length - 1;
  const suite = autres > 0 ? ` (et ${autres} autre${autres > 1 ? 's' : ''})` : '';
  return [
    {
      etape: 'vie-active',
      niveau: 'attention',
      message: qui(
        `${premier.libelle}${suite} arrive sans droits REER disponibles : le capital reçu ne pourra pas être abrité par une cotisation déductible, et le gain en capital sera imposé au maximum. Vérifiez « Maximum déductible au titre des REER » sur votre avis de cotisation.`,
      ),
    },
  ];
}

/**
 * Contrôles portant sur une personne (solo ou conjoint), hors étape d'identité.
 *
 * `biens` = les immeubles qui lui appartiennent (en couple, les siens et les biens communs) : ils
 * sont saisis au niveau du ménage, mais leur vente arrive dans SES comptes.
 */
function validerPersonne(
  p: ChampsPersonne,
  etapeAges: string,
  prefixe = '',
  biens: readonly Immeuble[] = [],
): Alerte[] {
  const a: Alerte[] = [];
  /** En couple, le message est préfixé du nom ; en solo, il commence par une majuscule. */
  const qui = (texte: string) =>
    prefixe ? `${prefixe} : ${texte}` : texte.charAt(0).toUpperCase() + texte.slice(1);

  if (p.ageRetraite <= p.ageActuel) {
    a.push({
      etape: etapeAges,
      niveau: 'erreur',
      message: qui(`l'âge de la retraite (${p.ageRetraite}) doit être postérieur à l'âge actuel (${p.ageActuel}).`),
    });
  }
  if (p.ageDeces <= p.ageRetraite) {
    a.push({
      etape: etapeAges,
      niveau: 'erreur',
      message: qui(`l'âge au décès (${p.ageDeces}) doit être postérieur à la retraite (${p.ageRetraite}).`),
    });
  }

  const epargne = epargneTotale(p);
  if (epargne > 0 && p.revenuEmploi <= 0) {
    a.push({
      etape: 'vie-active',
      niveau: 'attention',
      message: qui(`vous épargnez sans revenu d'emploi : l'épargne sera quand même versée chaque année jusqu'à la retraite.`),
    });
  }

  // Droits REER : les droits de l'année (18 % du salaire) s'ajoutent avant les cotisations, donc un
  // report à 0 ne bloque que si la cotisation dépasse ce que le salaire génère.
  const epargneReer = (p.epargneAnnuelle.REER ?? 0) + (p.fondsTravailleursAnnuel ?? 0);
  const droitsAnnuelsEstimes = p.revenuEmploi * REER_TAUX;
  if (epargneReer > droitsAnnuelsEstimes + (p.droitsReerDisponibles ?? 0)) {
    a.push({
      etape: 'vie-active',
      niveau: 'attention',
      message: qui(`la cotisation REER dépasse les droits estimés (18 % du salaire + report saisi) : l'excédent sera redirigé vers le CELI, puis le non-enregistré.`),
    });
  }

  a.push(
    ...validerDroitsReerApports(
      p,
      [
        ...biens
          .filter((b) => b.ageVente != null)
          .map((b) => ({ libelle: `la vente de « ${b.nom} » à ${b.ageVente} ans`, age: b.ageVente! })),
        ...(p.heritages ?? [])
          .filter((h) => h.montant > 0)
          .map((h) => ({ libelle: `l'héritage « ${h.nom} » à ${h.age} ans`, age: h.age })),
      ],
      qui,
    ),
  );

  if (p.regimeRetraitePD && p.rentesEmployeur.length === 0) {
    a.push({
      etape: 'rentes-employeur',
      niveau: 'attention',
      message: qui(`un régime à prestations déterminées est déclaré mais aucune rente d'employeur n'est saisie.`),
    });
  }

  for (const r of p.rentesEmployeur) {
    if (r.ageFin != null && r.ageFin <= r.ageDebut) {
      a.push({
        etape: 'rentes-employeur',
        niveau: 'erreur',
        message: qui(`la rente « ${r.nom} » se termine (${r.ageFin}) avant de commencer (${r.ageDebut}).`),
      });
    }
  }

  for (const h of p.heritages ?? []) {
    if (h.montant > 0 && (h.age < p.ageActuel || h.age > p.ageDeces)) {
      a.push({
        etape: 'heritage',
        niveau: 'erreur',
        message: qui(`l'héritage « ${h.nom} » est reçu à ${h.age} ans, hors de l'horizon (${p.ageActuel} à ${p.ageDeces} ans) : il sera ignoré.`),
      });
    }
    if (h.montant > 0 && h.age === p.ageDeces) {
      a.push({
        etape: 'heritage',
        niveau: 'attention',
        message: qui(`l'héritage « ${h.nom} » est reçu l'année du décès : il sera imposé aussitôt dans les dispositions présumées.`),
      });
    }
  }

  for (const t of p.periodesTravail ?? []) {
    if (t.ageFin <= t.ageDebut) {
      a.push({
        etape: 'travail-retraite',
        niveau: 'erreur',
        message: qui(`la période « ${t.nom} » se termine (${t.ageFin}) avant de commencer (${t.ageDebut}).`),
      });
    }
    if (t.ageDebut < p.ageRetraite) {
      a.push({
        etape: 'travail-retraite',
        niveau: 'attention',
        message: qui(`la période « ${t.nom} » débute avant la retraite (${p.ageRetraite}) : elle ne sera comptée qu'à partir de celle-ci.`),
      });
    }
  }

  return a;
}

/** Contrôles sur les biens immobiliers du ménage. */
function validerImmeubles(immeubles: HypothesesProjection['immeubles']): Alerte[] {
  const a: Alerte[] = [];
  for (const b of immeubles) {
    if (b.coutBase > b.valeur) {
      a.push({
        etape: 'immobilier',
        niveau: 'attention',
        message: `« ${b.nom} » : le coût de base dépasse la valeur actuelle — la vente produirait une perte en capital.`,
      });
    }
    if (b.hypotheque > b.valeur) {
      a.push({
        etape: 'immobilier',
        niveau: 'attention',
        message: `« ${b.nom} » : l'hypothèque dépasse la valeur du bien (équité négative).`,
      });
    }
    if (b.hypotheque > 0 && b.paiementAnnuel <= b.hypotheque * b.tauxHypotheque) {
      a.push({
        etape: 'immobilier',
        niveau: 'attention',
        message: `« ${b.nom} » : le paiement annuel ne couvre pas les intérêts — le solde ne diminuera jamais.`,
      });
    }
    if (b.ageVente != null && b.ageVenteMin != null && b.ageVente < b.ageVenteMin) {
      a.push({
        etape: 'immobilier',
        niveau: 'erreur',
        message: `« ${b.nom} » : l'âge de vente (${b.ageVente}) précède l'âge minimum autorisé (${b.ageVenteMin}).`,
      });
    }
  }
  return a;
}

/** Contrôles sur les hypothèses économiques et la cible de dépenses. */
function validerEconomie(
  depenses: number,
  inflation: number,
  fraisGestion: number,
  etape: string,
): Alerte[] {
  const a: Alerte[] = [];
  if (depenses <= 0) {
    a.push({
      etape,
      niveau: 'attention',
      message: "Sans cible de dépenses, la retraite ne décaisse rien : le capital ne fait que croître.",
    });
  }
  if (inflation < 0 || inflation > 0.1) {
    a.push({
      etape,
      niveau: 'attention',
      message: `Inflation inhabituelle (${(inflation * 100).toFixed(1)} %) ; la norme IQPF 2026 est de 2,1 %.`,
    });
  }
  if (fraisGestion > 0.03) {
    a.push({
      etape,
      niveau: 'attention',
      message: `Frais de gestion élevés (${(fraisGestion * 100).toFixed(1)} %) : ils sont soustraits du rendement chaque année.`,
    });
  }
  return a;
}

/** Toutes les alertes d'une projection solo. */
export function validerSolo(h: HypothesesProjection): Alerte[] {
  const a = [
    ...validerPersonne(h, 'horizon', '', h.immeubles),
    ...validerImmeubles(h.immeubles),
    ...validerEconomie(h.depensesRetraite, h.inflation, h.fraisGestion, 'decaissement'),
  ];

  const patrimoine = h.comptes.reduce((s, c) => s + c.solde, 0) + h.immeubles.length;
  if (patrimoine <= 0 && epargneTotale(h) <= 0) {
    a.push({
      etape: 'comptes',
      niveau: 'attention',
      message: "Aucun compte ni épargne : renseignez vos soldes actuels pour obtenir une projection.",
    });
  }
  return a;
}

/**
 * Alertes d'un conjoint : chaque groupe d'étapes n'affiche que ce qui le concerne.
 *
 * Les immeubles sont saisis au niveau du ménage : on ne transmet à ce conjoint que les siens, plus
 * les biens communs, dont le moteur lui attribue la moitié du gain et du capital.
 */
export function alertesPersonne(h: HypothesesCouple, cle: 'personne1' | 'personne2'): Alerte[] {
  const p = h[cle];
  const numero = cle === 'personne1' ? 1 : 2;
  const siens = h.immeubles.filter((b) => b.proprietaire === numero || b.proprietaire === 'commun');
  return validerPersonne(p, 'situation', p.nom, siens);
}

/** Alertes du ménage (immobilier commun et dépenses). */
export function alertesMenage(h: HypothesesCouple): Alerte[] {
  return [
    ...validerImmeubles(h.immeubles),
    ...validerEconomie(h.depensesRetraite, h.inflation, h.fraisGestion, 'depenses'),
  ];
}
