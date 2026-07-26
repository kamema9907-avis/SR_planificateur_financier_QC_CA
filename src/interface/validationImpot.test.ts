import { describe, expect, it } from 'vitest';
import { entreeVide, type EntreeFiscale } from '../moteur';
import { validerEntreeFiscale } from './validationImpot';

/** Salarié de 45 ans, situation banale : sert de base, chaque test n'introduit qu'un défaut. */
function salarie(patch: Partial<EntreeFiscale> = {}): EntreeFiscale {
  return { ...entreeVide(), age: 45, revenuEmploi: 85_000, ...patch };
}

const messages = (a: { message: string }[]) => a.map((x) => x.message).join(' | ');

describe('validation de l’entrée fiscale', () => {
  it('ne signale rien sur une situation cohérente', () => {
    expect(validerEntreeFiscale(salarie())).toEqual([]);
  });

  it('ne signale rien pour un retraité de 70 ans avec RRQ et SV', () => {
    const e = salarie({ age: 70, revenuEmploi: 0, revenuRRQ: 15_000, revenuPensionSV: 8_700 });
    expect(validerEntreeFiscale(e)).toEqual([]);
  });

  it('signale une pension de la SV avant 65 ans', () => {
    const a = validerEntreeFiscale(salarie({ age: 60, revenuPensionSV: 8_700 }));
    expect(messages(a)).toContain('Sécurité de la vieillesse');
  });

  it('accepte la SV à exactement 65 ans', () => {
    const a = validerEntreeFiscale(salarie({ age: 65, revenuEmploi: 0, revenuPensionSV: 8_700 }));
    expect(messages(a)).not.toContain('Sécurité de la vieillesse');
  });

  it('signale une rente de retraite du RRQ avant 60 ans', () => {
    const a = validerEntreeFiscale(salarie({ age: 55, revenuRRQ: 9_000 }));
    expect(messages(a)).toContain('RRQ');
  });

  it('signale le cumul survivant + retraite à 65 ans et plus', () => {
    const a = validerEntreeFiscale(salarie({ age: 68, revenuEmploi: 0, revenuRRQ: 12_000, renteSurvivantRRQ: 6_000 }));
    expect(messages(a)).toContain('plafonnée');
  });

  it('ne signale pas le survivant seul avant 65 ans', () => {
    const a = validerEntreeFiscale(salarie({ age: 58, renteSurvivantRRQ: 6_000 }));
    expect(a).toEqual([]);
  });

  it('signale des retenues de paie sans revenu d’emploi', () => {
    const a = validerEntreeFiscale(salarie({ revenuEmploi: 0, cotisationSyndicale: 800 }));
    expect(messages(a)).toContain('sans revenu d');
  });

  it('signale une déduction REER sans revenu gagné', () => {
    const a = validerEntreeFiscale(salarie({ revenuEmploi: 0, deductionReer: 10_000 }));
    expect(messages(a)).toContain('déduction REER');
  });

  it('accepte une déduction REER portée par un revenu de location', () => {
    const a = validerEntreeFiscale(salarie({ revenuEmploi: 0, autresRevenus: 30_000, deductionReer: 5_000 }));
    expect(messages(a)).not.toContain('déduction REER');
  });
});
