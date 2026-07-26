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
import type { HypothesesCouple, HypothesesProjection, TypeCompte } from '../../moteur';
import { REER_TAUX } from '../../moteur';
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

/** Contrôles portant sur une personne (solo ou conjoint), hors étape d'identité. */
function validerPersonne(p: ChampsPersonne, etapeAges: string, prefixe = ''): Alerte[] {
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
    ...validerPersonne(h, 'horizon'),
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

/** Alertes d'un conjoint : chaque groupe d'étapes n'affiche que ce qui le concerne. */
export function alertesPersonne(h: HypothesesCouple, cle: 'personne1' | 'personne2'): Alerte[] {
  const p = h[cle];
  return validerPersonne(p, 'situation', p.nom);
}

/** Alertes du ménage (immobilier commun et dépenses). */
export function alertesMenage(h: HypothesesCouple): Alerte[] {
  return [
    ...validerImmeubles(h.immeubles),
    ...validerEconomie(h.depensesRetraite, h.inflation, h.fraisGestion, 'depenses'),
  ];
}
