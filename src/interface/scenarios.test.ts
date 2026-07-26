import { describe, expect, it } from 'vitest';
import { meilleurs, nomParDefaut, type LigneComparaison } from './scenarios';

function ligne(p: Partial<LigneComparaison> & { id: string }): LigneComparaison {
  return {
    nom: p.id,
    courant: false,
    suffisant: true,
    ageEpuisement: null,
    valeurNette: 1_000_000,
    impotVie: 500_000,
    ...p,
  };
}

describe('comparaison de scénarios', () => {
  it('ne désigne aucun gagnant avec un seul scénario', () => {
    expect(meilleurs([ligne({ id: 'a' })])).toEqual({ patrimoine: [], impot: [], autonomie: [] });
  });

  it('désigne le patrimoine le plus élevé et l’impôt le plus faible', () => {
    const r = meilleurs([
      ligne({ id: 'a', valeurNette: 1_000_000, impotVie: 500_000 }),
      ligne({ id: 'b', valeurNette: 1_300_000, impotVie: 520_000 }),
      ligne({ id: 'c', valeurNette: 900_000, impotVie: 470_000 }),
    ]);
    expect(r.patrimoine).toEqual(['b']);
    expect(r.impot).toEqual(['c']);
  });

  it('ne désigne pas de gagnant en cas d’égalité parfaite', () => {
    const r = meilleurs([ligne({ id: 'a' }), ligne({ id: 'b' })]);
    expect(r.patrimoine).toEqual([]);
    expect(r.impot).toEqual([]);
  });

  it('marque TOUS les ex æquo en tête', () => {
    // Deux scénarios identiques et meilleurs qu'un troisième : les deux doivent être marqués,
    // sinon l'utilisateur croit à une différence entre eux.
    const r = meilleurs([
      ligne({ id: 'a', valeurNette: 1_500_000 }),
      ligne({ id: 'b', valeurNette: 1_500_000 }),
      ligne({ id: 'c', valeurNette: 900_000 }),
    ]);
    expect(r.patrimoine.sort()).toEqual(['a', 'b']);
  });

  it('tolère un écart d’arrondi inférieur au dollar', () => {
    const r = meilleurs([
      ligne({ id: 'a', valeurNette: 1_500_000 }),
      ligne({ id: 'b', valeurNette: 1_500_000.4 }),
      ligne({ id: 'c', valeurNette: 900_000 }),
    ]);
    expect(r.patrimoine.sort()).toEqual(['a', 'b']);
  });

  it('ne compare pas l’autonomie quand certains tiennent et d’autres non', () => {
    const r = meilleurs([
      ligne({ id: 'a', suffisant: true }),
      ligne({ id: 'b', suffisant: false, ageEpuisement: 80 }),
    ]);
    // Le drapeau « financé » se voit déjà ; désigner un « meilleur » n'ajouterait rien.
    expect(r.autonomie).toEqual([]);
  });

  it('désigne l’épuisement le plus tardif quand aucun ne tient', () => {
    const r = meilleurs([
      ligne({ id: 'a', suffisant: false, ageEpuisement: 78 }),
      ligne({ id: 'b', suffisant: false, ageEpuisement: 85 }),
    ]);
    expect(r.autonomie).toEqual(['b']);
  });

  it('compare aussi la simulation courante, non enregistrée', () => {
    const r = meilleurs([
      ligne({ id: 'courant', courant: true, valeurNette: 2_000_000 }),
      ligne({ id: 'a', valeurNette: 1_000_000 }),
    ]);
    expect(r.patrimoine).toEqual(['courant']);
  });
});

describe('nommage par défaut', () => {
  it('numérote à la suite', () => {
    expect(nomParDefaut([])).toBe('Scénario 1');
    expect(nomParDefaut([{ nom: 'Scénario 1' }])).toBe('Scénario 2');
  });

  it('évite un nom déjà pris', () => {
    expect(nomParDefaut([{ nom: 'Retraite à 60' }, { nom: 'Scénario 2' }])).toBe('Scénario 3');
  });
});
