import { describe, it, expect } from 'vitest';
import { optimiserProjection, optimiserCouple } from './optimiseur';
import type { HypothesesProjection, TypeCompte } from './types';
import type { HypothesesCouple, PersonneProjection } from './typesCouple';

const ORDRE_PAUVRE: TypeCompte[] = ['CELI', 'CELIAPP', 'NON_ENREGISTRE', 'CRI', 'FRV', 'REER', 'FERR'];

function hSolo(partiel: Partial<HypothesesProjection>): HypothesesProjection {
  return {
    ageActuel: 60, ageRetraite: 60, ageDeces: 90, vitSeul: false,
    revenuEmploi: 0, croissanceSalaireReelle: 0, epargneAnnuelle: {}, comptes: [], immeubles: [],
    rrqA65: 14_000, svA65: 8_500, ageDebutRRQ: 65, ageDebutSV: 65, rentesEmployeur: [],
    depensesRetraite: 45_000, ordreDecaissement: ORDRE_PAUVRE, inflation: 0.021, fraisGestion: 0.01,
    ...partiel,
  };
}

function personne(partiel: Partial<PersonneProjection>): PersonneProjection {
  return {
    nom: 'C', sexe: 'H', ageActuel: 62, ageRetraite: 62, ageDeces: 90,
    revenuEmploi: 0, croissanceSalaireReelle: 0, epargneAnnuelle: {}, epargneReerConjoint: 0,
    comptes: [], rrqA65: 12_000, svA65: 8_500, ageDebutRRQ: 65, ageDebutSV: 65, rentesEmployeur: [], ...partiel,
  };
}

describe('optimiseur solo', () => {
  it('ne dégrade jamais la stratégie de base', () => {
    const opt = optimiserProjection(
      hSolo({ comptes: [{ type: 'REER', solde: 700_000, profil: 'equilibre' }, { type: 'CELI', solde: 150_000, profil: 'equilibre' }] }),
    );
    expect(opt.resultat.valeurNetteAuDecesReelle).toBeGreaterThanOrEqual(opt.base.valeurNetteAuDecesReelle - 0.01);
    expect(opt.gainPatrimoineReel).toBeGreaterThanOrEqual(-0.01);
  });

  it('améliore un scénario au mauvais ordre de décaissement (CELI vidé en premier)', () => {
    const opt = optimiserProjection(
      hSolo({
        depensesRetraite: 40_000,
        comptes: [{ type: 'REER', solde: 800_000, profil: 'equilibre' }, { type: 'CELI', solde: 200_000, profil: 'dynamique' }],
      }),
    );
    // Un meilleur ordre / une fonte doit augmenter le patrimoine au décès.
    expect(opt.gainPatrimoineReel).toBeGreaterThan(0);
    expect(opt.resultat.suffisant).toBe(true);
  });
});

describe('optimiseur couple', () => {
  it('ne dégrade jamais et reste cohérent', () => {
    const h: HypothesesCouple = {
      personne1: personne({ comptes: [{ type: 'REER', solde: 500_000, profil: 'equilibre' }] }),
      personne2: personne({ nom: 'D', sexe: 'F', ageActuel: 60, comptes: [{ type: 'CELI', solde: 200_000, profil: 'equilibre' }] }),
      depensesRetraite: 55_000, fractionSurvivant: 0.67, immeubles: [],
      ordreDecaissement: ORDRE_PAUVRE, inflation: 0.021, fraisGestion: 0.01,
    };
    const opt = optimiserCouple(h);
    expect(opt.resultat.valeurNetteAuDernierDecesReelle).toBeGreaterThanOrEqual(opt.base.valeurNetteAuDernierDecesReelle - 0.01);
    expect(opt.gainPatrimoineReel).toBeGreaterThanOrEqual(-0.01);
  });
});
