import { describe, expect, it } from 'vitest';
import type { HypothesesCouple, HypothesesProjection, Immeuble, PersonneProjection } from '../../moteur';
import { alertesMenage, alertesPersonne, validerSolo, type Alerte } from './validation';

/** Immeuble à revenu vendu à 60 ans : l'apport de capital qui déclenche l'alerte « droits REER ». */
function immeubleVendu(p: Partial<Immeuble> = {}): Immeuble {
  return {
    nom: 'Immeuble à revenu', type: 'revenu', valeur: 350_000, coutBase: 80_000,
    hypotheque: 0, paiementAnnuel: 0, revenuNetExploitation: 12_000,
    anneesDetenues: 20, appreciation: 0.025, tauxHypotheque: 0.05,
    ageVente: 60, fractionLiberee: 1, proprietaire: 1, ...p,
  };
}

/** Dossier solo cohérent : sert de base, chaque test n'introduit qu'un défaut. */
function soloValide(): HypothesesProjection {
  return {
    ageActuel: 45,
    ageRetraite: 62,
    ageDeces: 95,
    vitSeul: false,
    revenuEmploi: 85_000,
    croissanceSalaireReelle: 0,
    epargneAnnuelle: { REER: 8_000, CELI: 7_000 },
    comptes: [
      { type: 'REER', solde: 250_000, profil: 'equilibre' },
      { type: 'CELI', solde: 90_000, profil: 'dynamique' },
    ],
    immeubles: [],
    rrqA65: 15_000,
    svA65: 8_700,
    ageDebutRRQ: 65,
    ageDebutSV: 65,
    rentesEmployeur: [],
    depensesRetraite: 55_000,
    ordreDecaissement: ['NON_ENREGISTRE', 'CRI', 'FRV', 'REER', 'FERR', 'CELIAPP', 'CELI'],
    inflation: 0.021,
    fraisGestion: 0.01,
  };
}

const messages = (a: Alerte[]) => a.map((x) => x.message).join(' | ');
const surEtape = (a: Alerte[], etape: string) => a.filter((x) => x.etape === etape);

describe('validation des hypothèses', () => {
  it('ne signale rien sur un dossier cohérent', () => {
    expect(validerSolo(soloValide())).toEqual([]);
  });

  it('refuse une retraite antérieure à l’âge actuel', () => {
    const a = validerSolo({ ...soloValide(), ageActuel: 65, ageRetraite: 60 });
    expect(surEtape(a, 'horizon').some((x) => x.niveau === 'erreur')).toBe(true);
    expect(messages(a)).toContain("postérieur à l'âge actuel");
  });

  it('refuse un décès antérieur à la retraite', () => {
    const a = validerSolo({ ...soloValide(), ageRetraite: 70, ageDeces: 68 });
    expect(surEtape(a, 'horizon').some((x) => x.niveau === 'erreur')).toBe(true);
  });

  it('signale une cotisation REER dépassant les droits estimés', () => {
    // 18 % de 60 000 $ = 10 800 $ de droits annuels ; 25 000 $ cotisés déborderont.
    const a = validerSolo({
      ...soloValide(),
      revenuEmploi: 60_000,
      epargneAnnuelle: { REER: 25_000 },
    });
    expect(messages(a)).toContain('redirigé vers le CELI');
  });

  it('accepte une cotisation REER couverte par le report saisi', () => {
    const a = validerSolo({
      ...soloValide(),
      revenuEmploi: 60_000,
      epargneAnnuelle: { REER: 25_000 },
      droitsReerDisponibles: 40_000,
    });
    expect(messages(a)).not.toContain('redirigé vers le CELI');
  });

  it('signale une rente qui se termine avant de commencer', () => {
    const a = validerSolo({
      ...soloValide(),
      rentesEmployeur: [{ nom: 'Pont RRQ', source: 'employeur', montant: 12_000, ageDebut: 65, ageFin: 62, indexation: 0 }],
    });
    expect(surEtape(a, 'rentes-employeur').some((x) => x.niveau === 'erreur')).toBe(true);
  });

  it('signale une période de travail antérieure à la retraite', () => {
    const a = validerSolo({
      ...soloValide(),
      periodesTravail: [{ nom: 'Pige', montant: 20_000, ageDebut: 55, ageFin: 70 }],
    });
    expect(surEtape(a, 'travail-retraite').some((x) => x.message.includes('avant la retraite'))).toBe(true);
  });

  it('signale un paiement hypothécaire qui ne couvre pas les intérêts', () => {
    const a = validerSolo({
      ...soloValide(),
      immeubles: [{
        nom: 'Résidence', type: 'residence', valeur: 500_000, coutBase: 300_000,
        hypotheque: 300_000, paiementAnnuel: 5_000, revenuNetExploitation: 0,
        anneesDetenues: 10, appreciation: 0.031, tauxHypotheque: 0.05, ageVente: null, fractionLiberee: 1,
        proprietaire: 1,
      }],
    });
    // 300 000 × 5 % = 15 000 $ d'intérêts pour 5 000 $ versés.
    expect(messages(a)).toContain('ne couvre pas les intérêts');
  });

  it('refuse un âge de vente antérieur à l’âge minimum autorisé', () => {
    const a = validerSolo({
      ...soloValide(),
      immeubles: [{
        nom: 'Chalet', type: 'chalet', valeur: 250_000, coutBase: 120_000,
        hypotheque: 0, paiementAnnuel: 0, revenuNetExploitation: 0,
        anneesDetenues: 10, appreciation: 0.031, tauxHypotheque: 0.05,
        ageVente: 65, ageVenteMin: 75, fractionLiberee: 1, proprietaire: 1,
      }],
    });
    expect(surEtape(a, 'immobilier').some((x) => x.niveau === 'erreur')).toBe(true);
  });

  it('signale une absence de cible de dépenses', () => {
    const a = validerSolo({ ...soloValide(), depensesRetraite: 0 });
    expect(surEtape(a, 'decaissement').length).toBeGreaterThan(0);
  });

  it('signale une inflation aberrante et des frais élevés', () => {
    const a = validerSolo({ ...soloValide(), inflation: 0.35, fraisGestion: 0.05 });
    expect(surEtape(a, 'decaissement').length).toBe(2);
  });
});

function conjoint(nom: string, patch: Partial<PersonneProjection> = {}): PersonneProjection {
  return {
    nom, sexe: 'H', ageActuel: 45, ageRetraite: 62, ageDeces: 90,
    revenuEmploi: 70_000, croissanceSalaireReelle: 0,
    epargneAnnuelle: {}, epargneReerConjoint: 0,
    comptes: [{ type: 'REER', solde: 100_000, profil: 'equilibre' }],
    rrqA65: 12_000, svA65: 8_700, ageDebutRRQ: 65, ageDebutSV: 65, rentesEmployeur: [],
    ...patch,
  };
}

function coupleValide(): HypothesesCouple {
  return {
    personne1: conjoint('Vigile'),
    personne2: conjoint('Conjointe', { sexe: 'F', ageActuel: 43, ageDeces: 92 }),
    depensesRetraite: 75_000,
    fractionSurvivant: 0.67,
    immeubles: [],
    ordreDecaissement: ['NON_ENREGISTRE', 'CRI', 'FRV', 'REER', 'FERR', 'CELIAPP', 'CELI'],
    inflation: 0.021,
    fraisGestion: 0.01,
  };
}

describe('validation du couple', () => {
  it('ne signale rien sur un dossier cohérent', () => {
    const h = coupleValide();
    expect(alertesPersonne(h, 'personne1')).toEqual([]);
    expect(alertesPersonne(h, 'personne2')).toEqual([]);
    expect(alertesMenage(h)).toEqual([]);
  });

  it('rattache l’alerte au bon conjoint et la nomme', () => {
    const h = coupleValide();
    h.personne2 = conjoint('Conjointe', { ageActuel: 70, ageRetraite: 62 });

    expect(alertesPersonne(h, 'personne1')).toEqual([]);
    const a = alertesPersonne(h, 'personne2');
    expect(a.length).toBeGreaterThan(0);
    expect(a[0].message).toContain('Conjointe');
    expect(a[0].etape).toBe('situation');
  });

  it('rattache les alertes d’immobilier et de dépenses au ménage', () => {
    const h = { ...coupleValide(), depensesRetraite: 0 };
    expect(alertesMenage(h).some((x) => x.etape === 'depenses')).toBe(true);
  });
});

/**
 * L'apport de capital qui arrive devant une porte fermée.
 *
 * Le champ « droits REER » vaut 0 par défaut. Tant qu'il était masqué hors cotisation REER, un
 * retraité qui vendait un immeuble subissait ce 0 sans jamais le voir. Le champ est désormais
 * permanent ; ces alertes couvrent le cas où il reste malgré tout à zéro.
 */
describe('droits REER face à un apport de capital', () => {
  /** Retraité de 58 ans, sans salaire : plus aucun droit ne s'accumulera d'ici la vente. */
  const retraiteQuiVend = (p: Partial<HypothesesProjection> = {}): HypothesesProjection => ({
    ...soloValide(),
    ageActuel: 58, ageRetraite: 59, revenuEmploi: 0, epargneAnnuelle: {},
    immeubles: [immeubleVendu()], ...p,
  });

  const surDroitsReer = (a: Alerte[]) =>
    surEtape(a, 'vie-active').filter((x) => x.message.includes('Maximum déductible'));

  it('avertit le retraité qui vend un immeuble sans report saisi', () => {
    const a = validerSolo(retraiteQuiVend());
    expect(surDroitsReer(a).length).toBe(1);
    expect(surDroitsReer(a)[0].niveau).toBe('attention');
    expect(surDroitsReer(a)[0].message).toContain('Immeuble à revenu');
    expect(surDroitsReer(a)[0].message).toContain('60 ans');
  });

  it('se tait dès qu’un report est saisi', () => {
    expect(surDroitsReer(validerSolo(retraiteQuiVend({ droitsReerDisponibles: 60_000 })))).toEqual([]);
  });

  it('se tait pour un salarié qui accumulera des droits d’ici la vente', () => {
    // 45 ans, 85 000 $ de salaire, 8 000 $ cotisés : ~7 300 $ de droits neufs par an sur 15 ans.
    expect(surDroitsReer(validerSolo({ ...soloValide(), immeubles: [immeubleVendu()] }))).toEqual([]);
  });

  it('avertit malgré un salaire, sous régime à PD (le FE absorbe presque tout)', () => {
    // Même salarié, mais RREGOP : ~600 $ de droits neufs par an, soit 6 000 $ sur 10 ans.
    const a = validerSolo({
      ...soloValide(),
      epargneAnnuelle: {}, regimeRetraitePD: true,
      immeubles: [immeubleVendu({ ageVente: 55 })],
    });
    expect(surDroitsReer(a).length).toBe(1);
  });

  it('avertit aussi pour un héritage, et compte les apports suivants', () => {
    const a = validerSolo(
      retraiteQuiVend({ heritages: [{ nom: 'Succession', montant: 150_000, age: 65 }] }),
    );
    expect(surDroitsReer(a).length).toBe(1);
    // Le plus proche est nommé ; le second est compté, pas répété.
    expect(surDroitsReer(a)[0].message).toContain('Immeuble à revenu');
    expect(surDroitsReer(a)[0].message).toContain('et 1 autre');
  });

  it('ignore un apport hors de l’horizon', () => {
    const a = validerSolo(retraiteQuiVend({ immeubles: [immeubleVendu({ ageVente: 40 })] }));
    expect(surDroitsReer(a)).toEqual([]);
  });

  it('ne dit rien du travail à la retraite, qui rouvre lui-même des droits', () => {
    const a = validerSolo({
      ...soloValide(),
      ageActuel: 58, ageRetraite: 59, revenuEmploi: 0, epargneAnnuelle: {}, immeubles: [],
      periodesTravail: [{ nom: 'Pige', montant: 30_000, ageDebut: 60, ageFin: 68 }],
    });
    expect(surDroitsReer(a)).toEqual([]);
  });

  it('rattache l’alerte au propriétaire du bien, en couple', () => {
    const sansDroits = { revenuEmploi: 0, ageActuel: 58, ageRetraite: 59, epargneAnnuelle: {} };
    const h: HypothesesCouple = {
      ...coupleValide(),
      personne1: conjoint('Vigile', sansDroits),
      personne2: conjoint('Conjointe', { ...sansDroits, sexe: 'F' }),
      immeubles: [immeubleVendu({ proprietaire: 2 })],
    };
    expect(surDroitsReer(alertesPersonne(h, 'personne1'))).toEqual([]);
    const a = surDroitsReer(alertesPersonne(h, 'personne2'));
    expect(a.length).toBe(1);
    expect(a[0].message).toContain('Conjointe');
  });

  it('avertit les deux conjoints pour un bien commun (gain partagé 50-50)', () => {
    const sansDroits = { revenuEmploi: 0, ageActuel: 58, ageRetraite: 59, epargneAnnuelle: {} };
    const h: HypothesesCouple = {
      ...coupleValide(),
      personne1: conjoint('Vigile', sansDroits),
      personne2: conjoint('Conjointe', { ...sansDroits, sexe: 'F' }),
      immeubles: [immeubleVendu({ proprietaire: 'commun' })],
    };
    expect(surDroitsReer(alertesPersonne(h, 'personne1')).length).toBe(1);
    expect(surDroitsReer(alertesPersonne(h, 'personne2')).length).toBe(1);
  });
});

describe('validation des héritages', () => {
  it('accepte un héritage dans l’horizon', () => {
    const a = validerSolo({ ...soloValide(), heritages: [{ nom: 'Succession', montant: 200_000, age: 58 }] });
    expect(surEtape(a, 'heritage')).toEqual([]);
  });

  it('refuse un héritage reçu avant l’âge actuel', () => {
    const a = validerSolo({ ...soloValide(), heritages: [{ nom: 'S', montant: 100_000, age: 30 }] });
    expect(surEtape(a, 'heritage').some((x) => x.niveau === 'erreur')).toBe(true);
    expect(messages(a)).toContain('hors de l');
  });

  it('refuse un héritage reçu après le décès', () => {
    const a = validerSolo({ ...soloValide(), heritages: [{ nom: 'S', montant: 100_000, age: 99 }] });
    expect(surEtape(a, 'heritage').some((x) => x.niveau === 'erreur')).toBe(true);
  });

  it('signale un héritage reçu l’année du décès', () => {
    const a = validerSolo({ ...soloValide(), heritages: [{ nom: 'S', montant: 100_000, age: 95 }] });
    expect(surEtape(a, 'heritage').some((x) => x.message.includes('dispositions présumées'))).toBe(true);
  });

  it('ignore un héritage à montant nul, même hors horizon', () => {
    const a = validerSolo({ ...soloValide(), heritages: [{ nom: 'S', montant: 0, age: 200 }] });
    expect(surEtape(a, 'heritage')).toEqual([]);
  });

  it('nomme le conjoint concerné en mode couple', () => {
    const h = coupleValide();
    h.personne2 = conjoint('Conjointe', { heritages: [{ nom: 'S', montant: 50_000, age: 20 }] });
    expect(alertesPersonne(h, 'personne1')).toEqual([]);
    const a = alertesPersonne(h, 'personne2');
    expect(a.some((x) => x.etape === 'heritage' && x.message.includes('Conjointe'))).toBe(true);
  });
});
