/**
 * Le patrimoine transmis est NET de l'impôt des dispositions présumées.
 *
 * L'écran annonce « valeur nette au décès — après impôt au décès », et l'optimiseur maximise ce même
 * chiffre. En mode solo, l'impôt au décès était calculé, compté dans l'impôt de la vie, et **jamais
 * retranché du patrimoine** ; le mode couple le retranchait déjà. Les deux modes mesuraient donc avec
 * des règles différentes, et l'indicateur principal était surévalué en solo.
 *
 * Aucun test existant ne l'avait vu, parce qu'aucun dossier de test ne meurt avec un gros solde
 * enregistré : l'impôt au décès y valait zéro, et brut = net par accident. C'est ce trou que le
 * premier cas ci-dessous bouche.
 */
import { describe, expect, it } from 'vitest';
import { projeter } from './projection';
import { projeterCouple } from './couple';
import type { HypothesesProjection, TypeCompte } from './types';
import type { HypothesesCouple, PersonneProjection } from './typesCouple';

const ORDRE: TypeCompte[] = ['NON_ENREGISTRE', 'CRI', 'FRV', 'REER', 'FERR', 'CELIAPP', 'CELI'];

/** Meurt à 75 ans avec un gros REER intact : dépenses faibles, horizon court. */
function meurtRiche(p: Partial<HypothesesProjection> = {}): HypothesesProjection {
  return {
    ageActuel: 60, ageRetraite: 61, ageDeces: 75, vitSeul: false, revenuEmploi: 0,
    croissanceSalaireReelle: 0, epargneAnnuelle: {},
    comptes: [{ type: 'REER', solde: 600_000, profil: 'equilibre' }],
    immeubles: [], rrqA65: 14_000, svA65: 8_800, ageDebutRRQ: 65, ageDebutSV: 65,
    rentesEmployeur: [], depensesRetraite: 30_000, ordreDecaissement: ORDRE,
    inflation: 0.021, fraisGestion: 0.01, ...p,
  };
}

/** Le brut : la somme des soldes de la dernière année, ramenée en dollars d'aujourd'hui. */
const brutFinal = (r: { annees: readonly { valeurNette: number; deflateurReel: number }[] }) => {
  const d = r.annees[r.annees.length - 1];
  return d.valeurNette * d.deflateurReel;
};

describe('le chiffre annoncé « après impôt au décès » l’est vraiment', () => {
  it('avec un gros REER au décès, le net est STRICTEMENT sous le brut', () => {
    // LE test qui aurait attrapé le bogue : avant correction, c'était une égalité.
    const r = projeter(meurtRiche(), { trace: true });
    const impot = r.annees[r.annees.length - 1].detail!.valeurNette.impotDeces;
    expect(impot).toBeGreaterThan(50_000); // sinon le dossier ne prouve rien
    expect(r.valeurNetteAuDecesReelle).toBeLessThan(brutFinal(r));
  });

  it('l’écart vaut exactement l’impôt au décès affiché dans le tiroir', () => {
    const r = projeter(meurtRiche(), { trace: true });
    const d = r.annees[r.annees.length - 1];
    const impot = d.detail!.valeurNette.impotDeces;
    expect(r.valeurNetteAuDecesReelle).toBeCloseTo((d.valeurNette - impot) * d.deflateurReel, 6);
  });

  it('sans rien d’imposable au décès, brut = net', () => {
    // Tout en CELI : aucun compte enregistré à liquider, aucun gain latent, aucun immeuble.
    const r = projeter(
      meurtRiche({
        comptes: [{ type: 'CELI', solde: 600_000, profil: 'equilibre' }],
        rrqA65: 0, svA65: 0, depensesRetraite: 20_000,
      }),
      { trace: true },
    );
    expect(r.annees[r.annees.length - 1].detail!.valeurNette.impotDeces).toBeCloseTo(0, 6);
    expect(r.valeurNetteAuDecesReelle).toBeCloseTo(brutFinal(r), 6);
  });

  it('l’impôt au décès frappe aussi les gains latents du non-enregistré', () => {
    const r = projeter(
      meurtRiche({
        comptes: [{ type: 'NON_ENREGISTRE', solde: 500_000, profil: 'dynamique', coutBase: 150_000 }],
      }),
      { trace: true },
    );
    expect(r.annees[r.annees.length - 1].detail!.valeurNette.impotDeces).toBeGreaterThan(1_000);
    expect(r.valeurNetteAuDecesReelle).toBeLessThan(brutFinal(r));
  });

  it('le patrimoine transmis n’est jamais négatif', () => {
    // Pas de clamp dans le moteur : si ce test tombe, c'est une erreur de modèle à voir, pas à cacher.
    for (const solde of [50_000, 300_000, 1_500_000]) {
      for (const deces of [72, 80, 95]) {
        const r = projeter(meurtRiche({ comptes: [{ type: 'REER', solde, profil: 'equilibre' }], ageDeces: deces }));
        expect(r.valeurNetteAuDecesReelle, `REER ${solde} $, décès à ${deces} ans`).toBeGreaterThanOrEqual(0);
      }
    }
  });
});

describe('les deux modes mesurent avec la même règle', () => {
  function conjoint(nom: string, p: Partial<PersonneProjection> = {}): PersonneProjection {
    return {
      nom, sexe: 'H', ageActuel: 60, ageRetraite: 61, ageDeces: 75, revenuEmploi: 0,
      croissanceSalaireReelle: 0, epargneAnnuelle: {}, epargneReerConjoint: 0,
      comptes: [{ type: 'REER', solde: 300_000, profil: 'equilibre' }],
      rrqA65: 14_000, svA65: 8_800, ageDebutRRQ: 65, ageDebutSV: 65, rentesEmployeur: [], ...p,
    };
  }

  it('le couple aussi transmet net : son chiffre est sous le brut', () => {
    const h: HypothesesCouple = {
      personne1: conjoint('A'),
      personne2: conjoint('B', { sexe: 'F', ageDeces: 78 }),
      depensesRetraite: 40_000, fractionSurvivant: 0.67, immeubles: [],
      ordreDecaissement: ORDRE, inflation: 0.021, fraisGestion: 0.01,
    };
    const r = projeterCouple(h, { trace: true });
    expect(r.valeurNetteAuDernierDecesReelle).toBeGreaterThan(0);
    expect(r.valeurNetteAuDernierDecesReelle).toBeLessThan(brutFinal(r));
  });
});
