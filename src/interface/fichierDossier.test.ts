import { describe, expect, it } from 'vitest';
import { construireFichier, lireFichier, nomFichier, SIGNATURE, VERSION_FORMAT } from './fichierDossier';

const dossiersExemple = {
  projection: { ageActuel: 45, depensesRetraite: 55_000 },
  impot: { age: 45, revenuEmploi: 85_000 },
};

describe('fichier de dossier', () => {
  it('construit un fichier signé et daté', () => {
    const f = construireFichier(dossiersExemple, new Date('2026-07-26T12:00:00Z'));
    expect(f.application).toBe(SIGNATURE);
    expect(f.version).toBe(VERSION_FORMAT);
    expect(f.exporteLe).toBe('2026-07-26T12:00:00.000Z');
    expect(f.dossiers.projection).toEqual(dossiersExemple.projection);
  });

  it('fait un aller-retour sans perte', () => {
    const texte = JSON.stringify(construireFichier(dossiersExemple));
    const lu = lireFichier(texte);
    expect(lu.ok).toBe(true);
    if (lu.ok) {
      expect(lu.fichier.dossiers).toEqual(dossiersExemple);
      expect(lu.nombreDossiers).toBe(2);
    }
  });

  it('nomme le fichier avec la date du jour', () => {
    expect(nomFichier(new Date('2026-07-26T12:00:00Z'))).toBe('planificateur-2026-07-26.json');
  });

  it('refuse un JSON invalide', () => {
    const lu = lireFichier('{ ceci n est pas du json');
    expect(lu.ok).toBe(false);
    if (!lu.ok) expect(lu.erreur).toContain('JSON valide');
  });

  it('refuse un JSON étranger à l’application', () => {
    const lu = lireFichier(JSON.stringify({ application: 'autre-chose', dossiers: {} }));
    expect(lu.ok).toBe(false);
    if (!lu.ok) expect(lu.erreur).toContain('ne provient pas');
  });

  it('refuse un format plus récent que celui que l’on sait lire', () => {
    const lu = lireFichier(
      JSON.stringify({ application: SIGNATURE, version: VERSION_FORMAT + 1, dossiers: dossiersExemple }),
    );
    expect(lu.ok).toBe(false);
    if (!lu.ok) expect(lu.erreur).toContain('plus récente');
  });

  it('accepte un format plus ancien', () => {
    const lu = lireFichier(
      JSON.stringify({ application: SIGNATURE, version: 1, dossiers: dossiersExemple }),
    );
    expect(lu.ok).toBe(true);
  });

  it('refuse un fichier sans aucun dossier', () => {
    const lu = lireFichier(JSON.stringify(construireFichier({})));
    expect(lu.ok).toBe(false);
    if (!lu.ok) expect(lu.erreur).toContain('aucun dossier');
  });

  it('ignore les clés inconnues sans planter', () => {
    const lu = lireFichier(
      JSON.stringify({ application: SIGNATURE, version: 1, dossiers: { couple: {}, inventé: 42 } }),
    );
    expect(lu.ok).toBe(true);
    if (lu.ok) expect(lu.nombreDossiers).toBe(1);
  });

  it('emporte les scénarios enregistrés', () => {
    const avec = {
      projection: { ageActuel: 45 },
      scenariosProjection: [{ id: 'a', nom: 'Retraite à 65', hypotheses: { ageRetraite: 65 } }],
    };
    const lu = lireFichier(JSON.stringify(construireFichier(avec)));
    expect(lu.ok).toBe(true);
    if (lu.ok) {
      expect(lu.nombreDossiers).toBe(2);
      expect(lu.fichier.dossiers.scenariosProjection).toEqual(avec.scenariosProjection);
    }
  });

  it('reste capable de lire un fichier antérieur aux scénarios', () => {
    const ancien = JSON.stringify({
      application: SIGNATURE,
      version: 1,
      exporteLe: '2026-07-25T00:00:00.000Z',
      dossiers: { projection: { ageActuel: 40 } },
    });
    const lu = lireFichier(ancien);
    expect(lu.ok).toBe(true);
    if (lu.ok) expect(lu.nombreDossiers).toBe(1);
  });

  it('refuse une valeur nulle', () => {
    expect(lireFichier('null').ok).toBe(false);
  });
});
