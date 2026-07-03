import { describe, it, expect } from 'vitest';
import { rendementBrut, composantesRendementBrut } from '../constantes/profilsRendement';
import { croissanceAnnuelle, rendementNet, estImposableAuRetrait, estLibreImpot } from './comptes';

describe('profils de rendement calibrés IQPF', () => {
  it('le profil équilibré (60/35/5) donne un rendement brut cohérent', () => {
    // 0,05×2,4% + 0,35×3,2% + 0,60×6,475% ≈ 5,125 %
    expect(rendementBrut('equilibre')).toBeCloseTo(0.05125, 5);
  });

  it('ordonne les rendements : prudent < équilibré < dynamique', () => {
    expect(rendementBrut('prudent')).toBeLessThan(rendementBrut('equilibre'));
    expect(rendementBrut('equilibre')).toBeLessThan(rendementBrut('dynamique'));
  });

  it('les composantes intérêt + dividendes + gain en capital somment au rendement brut', () => {
    const c = composantesRendementBrut('dynamique');
    expect(c.interet + c.dividendes + c.gainCapital).toBeCloseTo(rendementBrut('dynamique'), 10);
  });
});

describe('croissance d’un compte', () => {
  it('applique le rendement net (brut − frais) au solde', () => {
    const g = croissanceAnnuelle(100_000, 'equilibre', 0.01);
    expect(g.total).toBeCloseTo(100_000 * rendementNet('equilibre', 0.01), 6);
  });

  it('sépare intérêt, dividendes et gain en capital pour le non-enregistré', () => {
    const g = croissanceAnnuelle(100_000, 'equilibre', 0.01);
    expect(g.interet).toBeGreaterThan(0);
    expect(g.dividendes).toBeGreaterThan(0);
    expect(g.gainCapitalAccru).toBeGreaterThan(0);
    expect(g.interet + g.dividendes + g.gainCapitalAccru).toBeCloseTo(g.total, 6);
  });

  it('utilise le rendement personnalisé (net) quand il est fourni, sans frais additionnels', () => {
    const g = croissanceAnnuelle(100_000, 'prudent', 0.05, 0.06); // 6 % net imposé
    expect(g.total).toBeCloseTo(6_000, 6);
    expect(g.interet + g.dividendes + g.gainCapitalAccru).toBeCloseTo(g.total, 6);
  });
});

describe('classification fiscale des comptes', () => {
  it('REER, FERR, CRI, FRV sont imposables au retrait', () => {
    expect(estImposableAuRetrait('REER')).toBe(true);
    expect(estImposableAuRetrait('FRV')).toBe(true);
    expect(estImposableAuRetrait('CELI')).toBe(false);
  });

  it('CELI et CELIAPP sont libres d’impôt', () => {
    expect(estLibreImpot('CELI')).toBe(true);
    expect(estLibreImpot('NON_ENREGISTRE')).toBe(false);
  });
});
