import { describe, expect, it } from 'vitest';
import { ecrireRoute, lireRoute, ROUTE_DEFAUT, type Route } from './routage';

describe('lireRoute', () => {
  it('ouvre l’onglet Impôt quand il n’y a pas d’adresse', () => {
    expect(lireRoute('')).toEqual(ROUTE_DEFAUT);
    expect(lireRoute('#')).toEqual(ROUTE_DEFAUT);
    expect(lireRoute('#/')).toEqual(ROUTE_DEFAUT);
    expect(lireRoute('#/impot')).toEqual(ROUTE_DEFAUT);
  });

  it('lit l’onglet, le mode, le groupe et l’étape', () => {
    expect(lireRoute('#/projection')).toEqual({ onglet: 'projection', mode: 'solo' });
    expect(lireRoute('#/projection/solo')).toEqual({ onglet: 'projection', mode: 'solo' });
    expect(lireRoute('#/projection/couple')).toEqual({ onglet: 'projection', mode: 'couple' });
    expect(lireRoute('#/projection/solo/horizon')).toEqual({
      onglet: 'projection', mode: 'solo', etape: 'horizon',
    });
    expect(lireRoute('#/projection/couple/menage/depenses')).toEqual({
      onglet: 'projection', mode: 'couple', groupe: 'menage', etape: 'depenses',
    });
  });

  it('n’échoue jamais sur une adresse abîmée', () => {
    // Un lien recopié à la main, tronqué, ou venant d'une version précédente doit OUVRIR
    // l'application. Afficher une erreur pour un dièse mal placé serait indéfendable.
    expect(lireRoute('#/nimportequoi')).toEqual(ROUTE_DEFAUT);
    expect(lireRoute('#///')).toEqual(ROUTE_DEFAUT);
    expect(lireRoute('#/impot/couple/menage')).toEqual(ROUTE_DEFAUT);
    expect(lireRoute('#/projection/trio')).toEqual({ onglet: 'projection', mode: 'solo' });
    expect(lireRoute('#/projection/couple/menage')).toEqual({
      onglet: 'projection', mode: 'couple', groupe: 'menage',
    });
  });

  it('tolère la casse, les espaces et les segments encodés', () => {
    expect(lireRoute('#/PROJECTION/Couple')).toEqual({ onglet: 'projection', mode: 'couple' });
    expect(lireRoute('#/projection/couple/ menage /depenses')).toEqual({
      onglet: 'projection', mode: 'couple', groupe: 'menage', etape: 'depenses',
    });
    expect(lireRoute('#/projection/couple/menage/%64epenses')).toEqual({
      onglet: 'projection', mode: 'couple', groupe: 'menage', etape: 'depenses',
    });
  });

  it('ignore un groupe en solo — l’atelier n’en a qu’un', () => {
    // `#/projection/solo/comptes` : « comptes » est l'étape, jamais un groupe.
    expect(lireRoute('#/projection/solo/comptes')).toEqual({
      onglet: 'projection', mode: 'solo', etape: 'comptes',
    });
  });
});

describe('ecrireRoute', () => {
  it('écrit une adresse courte pour l’onglet Impôt', () => {
    expect(ecrireRoute({ onglet: 'impot', mode: 'solo' })).toBe('#/impot');
    // Le mode et l'étape n'ont pas de sens hors de la Projection : ils n'encombrent pas l'URL.
    expect(ecrireRoute({ onglet: 'impot', mode: 'couple', groupe: 'menage', etape: 'depenses' }))
      .toBe('#/impot');
  });

  it('écrit le mode, puis le groupe, puis l’étape', () => {
    expect(ecrireRoute({ onglet: 'projection', mode: 'solo' })).toBe('#/projection/solo');
    expect(ecrireRoute({ onglet: 'projection', mode: 'solo', etape: 'horizon' }))
      .toBe('#/projection/solo/horizon');
    expect(ecrireRoute({ onglet: 'projection', mode: 'couple', groupe: 'personne1', etape: 'situation' }))
      .toBe('#/projection/couple/personne1/situation');
  });

  it('n’écrit pas une étape de couple orpheline de son groupe', () => {
    // `#/projection/couple/depenses` se relirait comme un GROUPE nommé « depenses » : l'étape
    // serait perdue. Mieux vaut une adresse plus courte mais relisible.
    expect(ecrireRoute({ onglet: 'projection', mode: 'couple', etape: 'depenses' }))
      .toBe('#/projection/couple');
  });
});

describe('aller-retour', () => {
  const cas: Route[] = [
    { onglet: 'impot', mode: 'solo' },
    { onglet: 'projection', mode: 'solo' },
    { onglet: 'projection', mode: 'solo', etape: 'immobilier' },
    { onglet: 'projection', mode: 'couple' },
    { onglet: 'projection', mode: 'couple', groupe: 'personne2' },
    { onglet: 'projection', mode: 'couple', groupe: 'menage', etape: 'depenses' },
  ];

  it('relire ce qu’on vient d’écrire redonne la même adresse', () => {
    for (const route of cas) expect(lireRoute(ecrireRoute(route))).toEqual(route);
  });

  it('réécrire ce qu’on vient de lire donne une adresse stable', () => {
    for (const route of cas) {
      const url = ecrireRoute(route);
      expect(ecrireRoute(lireRoute(url))).toBe(url);
    }
  });
});
