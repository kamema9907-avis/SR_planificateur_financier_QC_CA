/**
 * Immobilier (Phase 3.5) : résidence principale, chalet, immeuble à revenu, terrain vacant.
 *
 * Modèle intégré à la projection : appréciation de la valeur, amortissement de l'hypothèque,
 * revenu locatif imposable (immeuble à revenu), vente planifiée avec exemption pour résidence
 * principale (arbitrage automatique), et roulement/disposition au décès.
 *
 * Terrain vacant : capital property comme le chalet, MAIS jamais admissible à l'exemption pour
 * résidence principale (gain toujours imposable) et sans revenu. Par la règle du par. 18(2) LIR, les
 * frais de possession d'un terrain sans revenu (intérêts, impôts fonciers) ne sont ni déductibles ni
 * ajoutés au coût de base — l'outil ne modélise donc aucun effet fiscal en cours de détention.
 *
 * Réutilise les primitives du moteur fiscal : les loyers passent par « autres revenus », les gains
 * par « gains en capital » (inclusion 50 % appliquée par le moteur).
 */

/** Appréciation annuelle par défaut (norme IQPF « immobilier résidentiel » = inflation + 1 %). */
export const APPRECIATION_IMMO = 0.031;

export type TypeImmeuble = 'residence' | 'chalet' | 'revenu' | 'terrain';

/**
 * Un bien peut-il être « abrité » par l'exemption pour résidence principale ? Seulement une résidence
 * ou un chalet (unités d'habitation). L'immeuble à revenu et le terrain vacant en sont exclus : leur
 * gain en capital est toujours imposable.
 */
export function estExemptable(type: TypeImmeuble): boolean {
  return type === 'residence' || type === 'chalet';
}

/** Propriétaire d'un bien (couple). En mode solo, toujours 1. */
export type Proprietaire = 1 | 2 | 'commun';

export interface Immeuble {
  nom: string;
  type: TypeImmeuble;
  /** Valeur marchande actuelle (aujourd'hui $). */
  valeur: number;
  /** Prix de base rajusté (nominal, fixe). */
  coutBase: number;
  /** Années déjà détenues au début de la projection. */
  anneesDetenues: number;
  /** Taux d'appréciation annuel. */
  appreciation: number;
  /** Solde hypothécaire actuel. */
  hypotheque: number;
  tauxHypotheque: number;
  /** Paiement hypothécaire annuel (capital + intérêt). */
  paiementAnnuel: number;
  /** Revenu net d'exploitation annuel (loyers − dépenses, avant intérêts), pour type « revenu ». */
  revenuNetExploitation: number;
  /** Âge du propriétaire à la vente (null = conservé jusqu'au décès). */
  ageVente: number | null;
  /**
   * Âge minimum avant lequel l'OPTIMISEUR n'a pas le droit de vendre ce bien (confort : garder la
   * maison plus longtemps). N'affecte pas une vente saisie manuellement via `ageVente` ; borne
   * seulement l'espace de recherche de l'optimiseur. undefined = aucune contrainte.
   */
  ageVenteMin?: number;
  /** Fraction de l'équité libérée à la vente (1 = vente complète ; < 1 = downsizing de la résidence). */
  fractionLiberee: number;
  proprietaire: Proprietaire;
}

/** État mutable d'un bien pendant la projection. */
export interface EtatImmeuble {
  bien: Immeuble;
  valeur: number;
  hypotheque: number;
  coutBase: number;
  vendu: boolean;
  /** Propriétaire courant (peut changer au roulement du décès). */
  proprietaire: Proprietaire;
}

export function clonerImmeubles(biens: readonly Immeuble[]): EtatImmeuble[] {
  return biens.map((b) => ({ bien: b, valeur: b.valeur, hypotheque: b.hypotheque, coutBase: b.coutBase, vendu: false, proprietaire: b.proprietaire }));
}

/** Roulement au décès : transfère au survivant les biens du défunt (et les biens communs). Sans impôt. */
export function roulementImmeubles(etats: EtatImmeuble[], defunt: 1 | 2, survivant: 1 | 2): void {
  for (const e of etats) {
    if (e.vendu) continue;
    if (e.proprietaire === defunt || e.proprietaire === 'commun') e.proprietaire = survivant;
  }
}

/** Amortissement d'une année : intérêt, capital remboursé, paiement réel, nouveau solde. */
export function amortir(solde: number, taux: number, paiement: number): {
  interet: number;
  paiementReel: number;
  nouveauSolde: number;
} {
  if (solde <= 0) return { interet: 0, paiementReel: 0, nouveauSolde: 0 };
  const interet = solde * taux;
  const paiementReel = Math.min(paiement, solde + interet); // dernier paiement possiblement plus petit
  const capital = paiementReel - interet;
  return { interet, paiementReel, nouveauSolde: Math.max(0, solde - capital) };
}

/**
 * Détermine le bien « abrité » par l'exemption pour résidence principale : parmi les résidences et
 * chalets, celui dont le gain par année de détention est le plus élevé (heuristique d'arbitrage).
 * Retourne la référence du bien, ou null si aucun bien éligible.
 */
export function determinerBienAbrite(biens: readonly Immeuble[]): Immeuble | null {
  let meilleur: Immeuble | null = null;
  let meilleurRatio = -Infinity;
  for (const b of biens) {
    if (!estExemptable(b.type)) continue; // revenu et terrain : jamais abrités
    const annees = Math.max(1, b.anneesDetenues);
    const ratio = (b.valeur - b.coutBase) / annees;
    if (ratio > meilleurRatio) {
      meilleurRatio = ratio;
      meilleur = b;
    }
  }
  return meilleur;
}

/** Résultat d'une vente. */
export interface Vente {
  /** Gain en capital BRUT imposable (le moteur appliquera l'inclusion de 50 %). 0 si exempté. */
  gainBrutImposable: number;
  /** Produit net (liquide) libéré par la vente. */
  cashLibere: number;
}

/**
 * Vend (ou réduit) un bien. Mute l'état : `vendu` pour une vente complète, ou valeur/hypothèque
 * réduites pour un downsizing de résidence.
 */
export function vendre(etat: EtatImmeuble, abrite: boolean): Vente {
  const gainBrut = Math.max(0, etat.valeur - etat.coutBase);
  const exempte = estExemptable(etat.bien.type) && abrite;
  const gainBrutImposable = exempte ? 0 : gainBrut;

  const equite = Math.max(0, etat.valeur - etat.hypotheque);
  const cashLibere = equite * etat.bien.fractionLiberee;

  if (etat.bien.fractionLiberee >= 1) {
    etat.vendu = true;
  } else {
    // Downsizing d'une résidence : on conserve la portion résiduelle (exemptée), sans hypothèque.
    etat.valeur = etat.valeur * (1 - etat.bien.fractionLiberee);
    etat.coutBase = etat.valeur;
    etat.hypotheque = 0;
  }
  return { gainBrutImposable, cashLibere };
}

/** Agrégat annuel de l'immobilier, par propriétaire. */
export interface AgregatImmo {
  /** Paiements hypothécaires (sortie de fonds, par-dessus les dépenses). */
  paiement: number;
  /** Loyers encaissés (entrée de fonds). */
  loyerCash: number;
  /** Revenu locatif imposable (loyers − intérêts) → « autres revenus ». */
  revenuImposable: number;
  /** Gain en capital brut réalisé à la vente → « gains en capital ». */
  gainBrut: number;
  /** Liquide libéré par une vente. */
  cashVente: number;
  /** Équité (valeur − hypothèque) de fin d'année, pour le patrimoine. */
  equite: number;
}

function agregatVide(): AgregatImmo {
  return { paiement: 0, loyerCash: 0, revenuImposable: 0, gainBrut: 0, cashVente: 0, equite: 0 };
}

/**
 * Traite tous les biens pour une année : amortissement, loyers, ventes planifiées, appréciation.
 * MUTE les états. Retourne les agrégats répartis par propriétaire (1 et 2 ; « commun » = 50-50).
 *
 * @param ageProprietaire  Fonction donnant l'âge du propriétaire d'un bien (null si décédé).
 * @param bienAbrite       Bien désigné comme résidence principale exemptée (arbitrage).
 */
export function traiterImmeublesAnnee(
  etats: EtatImmeuble[],
  i: number,
  inflation: number,
  ageProprietaire: (p: Proprietaire) => number | null,
  bienAbrite: Immeuble | null,
): Record<1 | 2, AgregatImmo> {
  const agg: Record<1 | 2, AgregatImmo> = { 1: agregatVide(), 2: agregatVide() };
  const facteurInflation = Math.pow(1 + inflation, i);

  for (const e of etats) {
    if (e.vendu) continue;
    const b = e.bien;

    const am = amortir(e.hypotheque, b.tauxHypotheque, b.paiementAnnuel);
    e.hypotheque = am.nouveauSolde;

    let loyerCash = 0;
    let revenuImposable = 0;
    if (b.type === 'revenu') {
      const noi = b.revenuNetExploitation * facteurInflation;
      loyerCash = noi;
      revenuImposable = noi - am.interet; // intérêts hypothécaires déductibles
    }

    let gainBrut = 0;
    let cashVente = 0;
    const age = ageProprietaire(e.proprietaire);
    if (b.ageVente != null && age != null && age >= b.ageVente) {
      const v = vendre(e, b === bienAbrite);
      gainBrut = v.gainBrutImposable;
      cashVente = v.cashLibere;
    }

    if (!e.vendu) e.valeur *= 1 + b.appreciation;
    const equite = e.vendu ? 0 : Math.max(0, e.valeur - e.hypotheque);

    const parts: [1 | 2, number][] = e.proprietaire === 'commun' ? [[1, 0.5], [2, 0.5]] : [[e.proprietaire, 1]];
    for (const [o, part] of parts) {
      agg[o].paiement += am.paiementReel * part;
      agg[o].loyerCash += loyerCash * part;
      agg[o].revenuImposable += revenuImposable * part;
      agg[o].gainBrut += gainBrut * part;
      agg[o].cashVente += cashVente * part;
      agg[o].equite += equite * part;
    }
  }
  return agg;
}

/** Disposition présumée au décès (résidence exemptée) : gain brut imposable des biens d'un propriétaire. */
export function gainAuDeces(etats: readonly EtatImmeuble[], bienAbrite: Immeuble | null, proprietaire: Proprietaire): number {
  let gain = 0;
  for (const e of etats) {
    if (e.vendu) continue;
    const b = e.bien;
    if (e.proprietaire !== proprietaire && e.proprietaire !== 'commun') continue;
    if (estExemptable(b.type) && b === bienAbrite) continue; // résidence/chalet abrité : exempté
    const part = e.proprietaire === 'commun' ? 0.5 : 1;
    gain += Math.max(0, e.valeur - e.coutBase) * part;
  }
  return gain;
}
