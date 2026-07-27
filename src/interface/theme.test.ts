import { describe, expect, it } from 'vitest';
import { themeEffectif } from './theme';

describe('themeEffectif', () => {
  it('suit le système quand aucun choix explicite n’est fait', () => {
    expect(themeEffectif('systeme', true)).toBe('sombre');
    expect(themeEffectif('systeme', false)).toBe('clair');
  });

  it('respecte un choix explicite, même s’il contredit le système', () => {
    // C'est tout l'intérêt d'avoir trois états plutôt que deux : quelqu'un dont l'OS est en mode
    // nuit peut vouloir cet outil-ci en clair, pour lire des tableaux de chiffres.
    expect(themeEffectif('clair', true)).toBe('clair');
    expect(themeEffectif('sombre', false)).toBe('sombre');
  });
});
