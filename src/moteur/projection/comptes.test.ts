import { describe, it, expect } from 'vitest';
import { rendementBrut, composantesRendementBrut } from '../constantes/profilsRendement';
import {
  croissanceAnnuelle,
  rendementNet,
  estImposableAuRetrait,
  estLibreImpot,
  repartirCotisationCeliapp,
  CELIAPP_PLAFOND_ANNUEL,
  CELIAPP_PLAFOND_VIE,
  droitsCeliAnnuels,
  droitsCeliParDefaut,
  CELI_DROITS_MAX_2026,
  droitsReerAnnuels,
  feRegimePD,
  plafondReerNominal,
  REER_PLAFOND_DOLLAR_2026,
} from './comptes';

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

describe('répartition d’une cotisation CELIAPP (plafonds)', () => {
  it('laisse passer une cotisation sous les deux plafonds', () => {
    expect(repartirCotisationCeliapp(5_000, 0)).toEqual({ celiapp: 5_000, excedent: 0 });
  });

  it('plafonne à 8 000 $/an et renvoie l’excédent', () => {
    expect(repartirCotisationCeliapp(10_000, 0)).toEqual({ celiapp: CELIAPP_PLAFOND_ANNUEL, excedent: 2_000 });
  });

  it('respecte le plafond à vie restant (droits presque épuisés)', () => {
    // Déjà 36 000 $ cotisés → il ne reste que 4 000 $.
    expect(repartirCotisationCeliapp(8_000, 36_000)).toEqual({ celiapp: 4_000, excedent: 4_000 });
  });

  it('renvoie tout en excédent quand le plafond à vie est atteint', () => {
    expect(repartirCotisationCeliapp(8_000, CELIAPP_PLAFOND_VIE)).toEqual({ celiapp: 0, excedent: 8_000 });
  });
});

describe('droits de cotisation CELI', () => {
  it('accorde 7 000 $ pour l’année de base 2026', () => {
    expect(droitsCeliAnnuels(2026, 0.021)).toBe(7_000);
  });

  it('indexe le plafond annuel à l’inflation, arrondi au 500 $ le plus près', () => {
    // 7 000 × 1,021⁴ ≈ 7 607 → arrondi à 7 500.
    expect(droitsCeliAnnuels(2030, 0.021)).toBe(7_500);
    // Sans inflation : reste 7 000 pour toujours.
    expect(droitsCeliAnnuels(2040, 0)).toBe(7_000);
  });

  it('défaut heuristique : 109 000 $ moins le solde CELI actuel, plancher à 0', () => {
    expect(droitsCeliParDefaut([{ type: 'CELI', solde: 60_000, profil: 'equilibre' }])).toBe(49_000);
    expect(droitsCeliParDefaut([])).toBe(CELI_DROITS_MAX_2026);
    expect(droitsCeliParDefaut([{ type: 'CELI', solde: 200_000, profil: 'equilibre' }])).toBe(0);
  });
});

describe('droits de cotisation REER', () => {
  it('plafond 2026 = 33 810 $, indexé au rythme des salaires', () => {
    expect(plafondReerNominal(2026)).toBe(REER_PLAFOND_DOLLAR_2026);
    expect(plafondReerNominal(2028)).toBeCloseTo(33_810 * 1.031 ** 2, 2);
  });

  it('FE d’un régime à PD (RREGOP) ≈ 18 % × salaire − 600', () => {
    expect(feRegimePD(70_000)).toBeCloseTo(12_000, 2); // 12 600 − 600
  });

  it('sans régime : droits = 18 % du salaire (plafonné au maximum en dollars)', () => {
    expect(droitsReerAnnuels(50_000, plafondReerNominal(2026), 0)).toBeCloseTo(9_000, 2);
    expect(droitsReerAnnuels(500_000, plafondReerNominal(2026), 0)).toBeCloseTo(REER_PLAFOND_DOLLAR_2026, 2);
  });

  it('membre RREGOP : il ne reste que ~600 $/an de droits', () => {
    const fe = feRegimePD(70_000);
    expect(droitsReerAnnuels(70_000, plafondReerNominal(2026), fe)).toBeCloseTo(600, 2);
  });
});
