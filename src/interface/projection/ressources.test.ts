/**
 * La garde qui décide si la dépense recommandée s'affiche.
 *
 * **Signalé par l'utilisateur** : « l'encadré avec le bouton Utiliser apparaît seulement si j'ai
 * entré du revenu de travail ; si les revenus viennent seulement d'un héritage, cela ne fonctionne
 * pas. » La garde ne regardait ni les héritages, ni les périodes de travail à la retraite, ni
 * l'immobilier — et `SuggestionDepense` ne rend RIEN quand elle est fausse, bouton compris.
 *
 * Les trois premiers cas ci-dessous échouaient avant correction.
 */
import { describe, expect, it } from 'vitest';
import { aDesRessources, equiteImmobiliere } from './ressources';
import type { ChampsPersonne } from './champsPersonne';
import type { Immeuble } from '../../moteur';

/** Personne entièrement vide : aucune ressource d'aucune sorte. */
function vide(p: Partial<ChampsPersonne> = {}): ChampsPersonne {
  return {
    ageActuel: 60, ageRetraite: 65, ageDeces: 90,
    revenuEmploi: 0, croissanceSalaireReelle: 0,
    epargneAnnuelle: {},
    comptes: [
      { type: 'REER', solde: 0, profil: 'equilibre' },
      { type: 'CELI', solde: 0, profil: 'dynamique' },
    ],
    rrqA65: 0, svA65: 0, ageDebutRRQ: 65, ageDebutSV: 65, rentesEmployeur: [],
    ...p,
  };
}

const bien = (p: Partial<Immeuble> = {}): Immeuble => ({
  nom: 'Immeuble à revenu', type: 'revenu', valeur: 350_000, coutBase: 80_000, anneesDetenues: 20,
  appreciation: 0.025, hypotheque: 100_000, tauxHypotheque: 0.05, paiementAnnuel: 12_000,
  revenuNetExploitation: 12_000, ageVente: 70, fractionLiberee: 1, proprietaire: 1, ...p,
});

describe('le trou signalé : la richesse ne vient pas d’un salaire', () => {
  it('un héritage à venir SUFFIT', () => {
    // Le cas exact du rapport. Échouait avant correction.
    expect(aDesRessources(vide({ heritages: [{ nom: 'Succession', montant: 120_000, age: 70 }] }))).toBe(true);
  });

  it('une période de travail à la retraite SUFFIT', () => {
    expect(aDesRessources(vide({
      periodesTravail: [{ nom: 'Consultation', montant: 30_000, ageDebut: 66, ageFin: 72 }],
    }))).toBe(true);
  });

  it('un immeuble SUFFIT, y compris avec une vente planifiée', () => {
    // Un bien dont la vente est planifiée est même le premier à financer des dépenses.
    expect(aDesRessources(vide(), equiteImmobiliere([bien()]))).toBe(true);
    expect(aDesRessources(vide(), equiteImmobiliere([bien({ ageVente: null })]))).toBe(true);
  });
});

describe('la garde garde sa raison d’être', () => {
  it('un dossier entièrement vide reste sans ressources', () => {
    // Sinon un dossier neuf afficherait « le capital ne couvre pas les charges » : alarmant et faux.
    expect(aDesRessources(vide())).toBe(false);
    expect(aDesRessources(vide(), 0)).toBe(false);
  });

  it('un héritage à montant nul ne compte pas', () => {
    // Cohérent avec `validation.ts`, qui ignore déjà les héritages à 0 $.
    expect(aDesRessources(vide({ heritages: [{ nom: 'S', montant: 0, age: 70 }] }))).toBe(false);
  });

  it('une période de travail à montant nul ne compte pas', () => {
    expect(aDesRessources(vide({
      periodesTravail: [{ nom: 'Pige', montant: 0, ageDebut: 66, ageFin: 72 }],
    }))).toBe(false);
  });

  it('un immeuble entièrement hypothéqué n’apporte aucune équité', () => {
    expect(equiteImmobiliere([bien({ valeur: 200_000, hypotheque: 250_000 })])).toBe(0);
    expect(aDesRessources(vide(), equiteImmobiliere([bien({ valeur: 200_000, hypotheque: 250_000 })]))).toBe(false);
  });
});

describe('les conditions historiques suffisent toujours, chacune seule', () => {
  const cas: [string, Partial<ChampsPersonne>][] = [
    ['un solde de compte', { comptes: [{ type: 'REER', solde: 150_000, profil: 'equilibre' }] }],
    ['une RRQ estimée', { rrqA65: 14_000 }],
    ['une SV estimée', { svA65: 8_800 }],
    ['une rente d’employeur', {
      rentesEmployeur: [{ nom: 'RREGOP', source: 'employeur', montant: 20_000, ageDebut: 60, ageFin: null, indexation: 0.5 }],
    }],
    ['un revenu d’emploi', { revenuEmploi: 70_000 }],
    ['une épargne annuelle', { epargneAnnuelle: { CELI: 5_000 } }],
  ];
  for (const [nom, patch] of cas) {
    it(nom, () => expect(aDesRessources(vide(patch))).toBe(true));
  }
});

describe('equiteImmobiliere', () => {
  it('somme la valeur moins l’hypothèque de chaque bien', () => {
    expect(equiteImmobiliere([bien(), bien({ valeur: 500_000, hypotheque: 200_000 })]))
      .toBe(350_000 - 100_000 + 500_000 - 200_000);
  });

  it('ne descend jamais sous zéro pour un bien en équité négative', () => {
    // Un bien noyé ne doit pas effacer l'équité d'un autre.
    expect(equiteImmobiliere([bien({ valeur: 100_000, hypotheque: 400_000 }), bien()]))
      .toBe(350_000 - 100_000);
  });

  it('sans immeuble, zéro', () => {
    expect(equiteImmobiliere([])).toBe(0);
  });
});
