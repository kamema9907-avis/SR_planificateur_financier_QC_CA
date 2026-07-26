/**
 * Scénarios nommés : « retraite à 60 » contre « retraite à 65 », « vendre le chalet » contre « le
 * garder ».
 *
 * Jusqu'ici, comparer deux stratégies demandait de modifier un champ, noter le chiffre sur un
 * papier, remodifier — et espérer se souvenir des réglages exacts. Un scénario fige une copie
 * complète des hypothèses sous un nom ; la comparaison réévalue chacun avec le même moteur.
 *
 * Le dossier courant reste stocké tel quel (clé inchangée, export inchangé) : les scénarios vivent
 * à côté, dans leur propre clé.
 */
import { useCallback, useEffect, useState } from 'react';

export interface Scenario<H> {
  id: string;
  nom: string;
  hypotheses: H;
}

/** Ce qu'on compare d'un scénario à l'autre. */
export interface IndicateursScenario {
  /** Les dépenses sont-elles financées jusqu'au bout ? */
  suffisant: boolean;
  /** Âge où les dépenses cessent d'être financées (null si suffisant). */
  ageEpuisement: number | null;
  /** Valeur nette au décès, en dollars d'aujourd'hui. */
  valeurNette: number;
  /** Impôt total payé sur la vie, en dollars d'aujourd'hui. */
  impotVie: number;
}

/** Une ligne du tableau de comparaison. */
export interface LigneComparaison extends IndicateursScenario {
  id: string;
  nom: string;
  /** La simulation en cours d'édition, pas encore enregistrée. */
  courant: boolean;
}

/** Deux montants à moins d'un dollar l'un de l'autre sont considérés ex æquo. */
const TOLERANCE = 1;

/**
 * Repère la meilleure valeur de chaque colonne : patrimoine le plus élevé, impôt le plus faible,
 * autonomie la plus longue. Retourne **tous** les identifiants ex æquo — marquer un seul de deux
 * scénarios identiques laisserait croire à une différence qui n'existe pas.
 *
 * Si toutes les lignes se valent, personne n'est désigné : un « meilleur » universel n'informe pas.
 * De même, un scénario dont les dépenses ne sont pas financées ne peut pas gagner l'autonomie ; il
 * reste comparable sur le patrimoine et l'impôt (un patrimoine élevé mais illiquide, par exemple).
 */
export function meilleurs(lignes: readonly LigneComparaison[]): {
  patrimoine: string[];
  impot: string[];
  autonomie: string[];
} {
  if (lignes.length < 2) return { patrimoine: [], impot: [], autonomie: [] };

  const gagnants = (
    candidats: readonly LigneComparaison[],
    valeur: (l: LigneComparaison) => number,
    sens: 1 | -1, // 1 = le plus grand gagne, -1 = le plus petit
  ): string[] => {
    if (candidats.length === 0) return [];
    const scores = candidats.map((l) => valeur(l) * sens);
    const meilleur = Math.max(...scores);
    const pire = Math.min(...scores);
    if (meilleur - pire <= TOLERANCE) return []; // tout le monde à égalité : rien à désigner
    return candidats.filter((_, i) => meilleur - scores[i] <= TOLERANCE).map((l) => l.id);
  };

  const suffisants = lignes.filter((l) => l.suffisant);
  return {
    patrimoine: gagnants(lignes, (l) => l.valeurNette, 1),
    impot: gagnants(lignes, (l) => l.impotVie, -1),
    autonomie:
      suffisants.length > 0 && suffisants.length < lignes.length
        ? [] // certains tiennent, d'autres non : le drapeau vert suffit, pas de « meilleur »
        : gagnants(lignes.filter((l) => !l.suffisant), (l) => l.ageEpuisement ?? 0, 1),
  };
}

/** Identifiant court et unique, sans dépendance externe. */
function nouvelId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

/** Nom par défaut d'un nouveau scénario, en évitant les doublons. */
export function nomParDefaut(existants: readonly { nom: string }[]): string {
  let n = existants.length + 1;
  const pris = new Set(existants.map((s) => s.nom));
  while (pris.has(`Scénario ${n}`)) n += 1;
  return `Scénario ${n}`;
}

/** Liste de scénarios persistée, avec ses opérations. */
export function useScenarios<H>(cle: string) {
  const [scenarios, setScenarios] = useState<Scenario<H>[]>(() => {
    try {
      const brut = localStorage.getItem(cle);
      const lu: unknown = brut ? JSON.parse(brut) : null;
      return Array.isArray(lu) ? (lu as Scenario<H>[]) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(cle, JSON.stringify(scenarios));
    } catch {
      /* quota dépassé : la session reste utilisable */
    }
  }, [cle, scenarios]);

  const enregistrer = useCallback((hypotheses: H, nom?: string) => {
    setScenarios((s) => [...s, { id: nouvelId(), nom: nom?.trim() || nomParDefaut(s), hypotheses }]);
  }, []);

  const supprimer = useCallback((id: string) => {
    setScenarios((s) => s.filter((x) => x.id !== id));
  }, []);

  const renommer = useCallback((id: string, nom: string) => {
    setScenarios((s) => s.map((x) => (x.id === id ? { ...x, nom: nom.trim() || x.nom } : x)));
  }, []);

  return { scenarios, enregistrer, supprimer, renommer };
}
