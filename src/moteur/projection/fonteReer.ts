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

function trouverOuCreerCELI(comptes: Compte[], profil: ProfilRendement): Compte {
  let c = comptes.find((x) => x.type === 'CELI');
  if (!c) {
    c = { type: 'CELI', solde: 0, profil };
    comptes.push(c);
  }
  return c;
}

export interface ResultatFonte {
  entree: EntreeFiscale;
  impot: number;
  retraitSupplementaire: number;
}

/**
 * Applique la fonte du REER pour une année. MUTE les comptes (retire de l'enregistré, ajoute au CELI).
 *
 * @param cibleNominale  Revenu imposable cible (nominal) à atteindre par la fonte.
 * @returns L'entrée fiscale mise à jour, l'impôt recalculé et le retrait supplémentaire effectué.
 */
export function fondreReer(
  comptes: Compte[],
  entree: EntreeFiscale,
  cibleNominale: number,
  annee: number,
  age: number,
  profilDefaut: ProfilRendement,
): ResultatFonte {
  const impotAvant = impotTotalPour(entree, annee);
  const revenuImposableActuel = construireBase(entree).revenuTotalImpose - (entree.deductionReer + entree.autresDeductions);

  let marge = cibleNominale - revenuImposableActuel;
  if (marge <= 0) return { entree, impot: impotAvant, retraitSupplementaire: 0 };

  let retire = 0;
  for (const c of comptes.filter((x) => REGISTRES.includes(x.type) && x.solde > 0)) {
    if (marge <= 0) break;
    const w = Math.min(marge, c.solde);
    c.solde -= w;
    retire += w;
    marge -= w;
  }
  if (retire <= 0) return { entree, impot: impotAvant, retraitSupplementaire: 0 };

  const nouvelleEntree: EntreeFiscale =
    age >= 65
      ? { ...entree, revenuPensionPrivee: entree.revenuPensionPrivee + retire }
      : { ...entree, autresRevenus: entree.autresRevenus + retire };

  const impotApres = impotTotalPour(nouvelleEntree, annee);
  const apresImpot = retire - (impotApres - impotAvant);
  trouverOuCreerCELI(comptes, profilDefaut).solde += Math.max(0, apresImpot);

  return { entree: nouvelleEntree, impot: impotApres, retraitSupplementaire: retire };
}
