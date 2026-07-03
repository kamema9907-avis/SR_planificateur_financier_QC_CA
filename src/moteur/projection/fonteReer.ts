/**
 * Fonte anticipée du REER (RRSP meltdown).
 *
 * Après avoir financé les dépenses d'une année de retraite, on retire VOLONTAIREMENT davantage des
 * comptes enregistrés (REER/FERR/CRI/FRV) pour porter le revenu imposable jusqu'à une cible, puis on
 * réinvestit le montant après impôt au CELI (libre d'impôt). Objectif : « remplir » les tranches
 * basses tôt en retraite, avant que la RRQ, la SV et les minimums FERR ne fassent grimper le revenu —
 * ce qui réduit l'impôt total sur la vie.
 */
import { construireBase, impotTotalPour } from '../moteurFiscal';
import type { ProfilRendement } from '../constantes/profilsRendement';
import type { EntreeFiscale } from '../types';
import type { Compte, TypeCompte } from './types';

const REGISTRES: readonly TypeCompte[] = ['REER', 'FERR', 'CRI', 'FRV'];

function trouverOuCreerType(comptes: Compte[], type: TypeCompte, profil: ProfilRendement): Compte {
  let c = comptes.find((x) => x.type === type);
  if (!c) {
    c = { type, solde: 0, profil, coutBase: type === 'NON_ENREGISTRE' ? 0 : undefined };
    comptes.push(c);
  }
  return c;
}

export interface ResultatFonte {
  entree: EntreeFiscale;
  impot: number;
  retraitSupplementaire: number;
  /** Droits CELI consommés par le réinvestissement (≤ droitsCeli passés en argument). */
  celiUtilise: number;
}

/**
 * Applique la fonte du REER pour une année. MUTE les comptes (retire de l'enregistré, réinvestit
 * l'après-impôt au CELI dans la limite des droits disponibles, le reste au non-enregistré).
 *
 * @param cibleNominale  Revenu imposable cible (nominal) à atteindre par la fonte.
 * @param droitsCeli     Droits de cotisation CELI disponibles (plafonnent le réinvestissement au CELI).
 * @returns L'entrée fiscale mise à jour, l'impôt recalculé, le retrait supplémentaire et les droits CELI consommés.
 */
export function fondreReer(
  comptes: Compte[],
  entree: EntreeFiscale,
  cibleNominale: number,
  annee: number,
  age: number,
  profilDefaut: ProfilRendement,
  droitsCeli: number = Infinity,
): ResultatFonte {
  const impotAvant = impotTotalPour(entree, annee);
  const revenuImposableActuel = construireBase(entree).revenuTotalImpose - (entree.deductionReer + entree.autresDeductions);

  let marge = cibleNominale - revenuImposableActuel;
  if (marge <= 0) return { entree, impot: impotAvant, retraitSupplementaire: 0, celiUtilise: 0 };

  let retire = 0;
  for (const c of comptes.filter((x) => REGISTRES.includes(x.type) && x.solde > 0)) {
    if (marge <= 0) break;
    const w = Math.min(marge, c.solde);
    c.solde -= w;
    retire += w;
    marge -= w;
  }
  if (retire <= 0) return { entree, impot: impotAvant, retraitSupplementaire: 0, celiUtilise: 0 };

  const nouvelleEntree: EntreeFiscale =
    age >= 65
      ? { ...entree, revenuPensionPrivee: entree.revenuPensionPrivee + retire }
      : { ...entree, autresRevenus: entree.autresRevenus + retire };

  const impotApres = impotTotalPour(nouvelleEntree, annee);
  const apresImpot = Math.max(0, retire - (impotApres - impotAvant));

  // Réinvestir : au CELI jusqu'aux droits disponibles, l'excédent au non-enregistré.
  const auCeli = Math.min(apresImpot, Math.max(0, droitsCeli));
  if (auCeli > 0) trouverOuCreerType(comptes, 'CELI', profilDefaut).solde += auCeli;
  const auNonEnr = apresImpot - auCeli;
  if (auNonEnr > 0) {
    const ne = trouverOuCreerType(comptes, 'NON_ENREGISTRE', profilDefaut);
    ne.solde += auNonEnr;
    ne.coutBase = (ne.coutBase ?? 0) + auNonEnr;
  }

  return { entree: nouvelleEntree, impot: impotApres, retraitSupplementaire: retire, celiUtilise: auCeli };
}
