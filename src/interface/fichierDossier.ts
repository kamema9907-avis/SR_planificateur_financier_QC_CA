/**
 * Export et import du dossier complet, en JSON.
 *
 * Tout vit dans le `localStorage` du navigateur : un nettoyage de cache, un changement d'appareil
 * ou un mode privé et le travail est perdu. Un fichier rend le dossier durable, transmissible à un
 * proche, et versionnable — sans rien envoyer sur un serveur, la promesse « 100 % local » tient.
 *
 * Fonctions pures (hors accès au stockage) : testables comme le moteur.
 */

/** Signature du format, vérifiée à l'import pour ne pas avaler n'importe quel JSON. */
export const SIGNATURE = 'planificateur-financier-2026';

/** Version du format de fichier ; à incrémenter si la structure change de façon incompatible. */
export const VERSION_FORMAT = 1;

/** Les trois dossiers indépendants de l'application, tels que stockés. */
export const CLES = {
  impot: 'pf2026:entree',
  projection: 'pf2026:projection',
  couple: 'pf2026:couple',
} as const;

export interface FichierDossier {
  application: typeof SIGNATURE;
  version: number;
  exporteLe: string;
  /** Contenu de chaque dossier ; une clé absente signifie « jamais rempli ». */
  dossiers: Partial<Record<keyof typeof CLES, unknown>>;
}

/** Assemble le contenu du fichier à partir des dossiers lus. */
export function construireFichier(
  dossiers: Partial<Record<keyof typeof CLES, unknown>>,
  maintenant: Date = new Date(),
): FichierDossier {
  return {
    application: SIGNATURE,
    version: VERSION_FORMAT,
    exporteLe: maintenant.toISOString(),
    dossiers,
  };
}

/** Résultat d'une lecture de fichier : soit les dossiers, soit la raison du refus. */
export type Lecture =
  | { ok: true; fichier: FichierDossier; nombreDossiers: number }
  | { ok: false; erreur: string };

/**
 * Valide un contenu de fichier avant de l'appliquer. On refuse tôt et avec un message clair :
 * écraser le dossier de quelqu'un avec un JSON quelconque serait irréversible.
 */
export function lireFichier(texte: string): Lecture {
  let brut: unknown;
  try {
    brut = JSON.parse(texte);
  } catch {
    return { ok: false, erreur: "Ce fichier n'est pas du JSON valide." };
  }

  if (typeof brut !== 'object' || brut === null) {
    return { ok: false, erreur: 'Ce fichier ne contient pas un dossier.' };
  }

  const f = brut as Partial<FichierDossier>;
  if (f.application !== SIGNATURE) {
    return {
      ok: false,
      erreur: "Ce fichier ne provient pas du Planificateur Financier 2026.",
    };
  }
  if (typeof f.version !== 'number' || f.version > VERSION_FORMAT) {
    return {
      ok: false,
      erreur: `Ce fichier a été créé par une version plus récente de l'application (format ${String(f.version)}).`,
    };
  }
  if (typeof f.dossiers !== 'object' || f.dossiers === null) {
    return { ok: false, erreur: 'Ce fichier ne contient aucun dossier.' };
  }

  const nombreDossiers = (Object.keys(CLES) as (keyof typeof CLES)[]).filter(
    (c) => f.dossiers![c] != null,
  ).length;

  if (nombreDossiers === 0) {
    return { ok: false, erreur: 'Ce fichier ne contient aucun dossier à importer.' };
  }

  return { ok: true, fichier: f as FichierDossier, nombreDossiers };
}

/** Nom de fichier proposé au téléchargement, daté du jour. */
export function nomFichier(maintenant: Date = new Date()): string {
  return `planificateur-${maintenant.toISOString().slice(0, 10)}.json`;
}

// --- Accès au stockage du navigateur -------------------------------------------------

/** Lit les trois dossiers du navigateur (les clés jamais écrites sont omises). */
export function lireDossiersLocaux(): Partial<Record<keyof typeof CLES, unknown>> {
  const dossiers: Partial<Record<keyof typeof CLES, unknown>> = {};
  for (const [nom, cle] of Object.entries(CLES) as [keyof typeof CLES, string][]) {
    try {
      const brut = localStorage.getItem(cle);
      if (brut) dossiers[nom] = JSON.parse(brut);
    } catch {
      /* clé absente ou corrompue : on l'ignore plutôt que d'échouer tout l'export */
    }
  }
  return dossiers;
}

/** Écrit les dossiers d'un fichier validé dans le navigateur. Retourne le nombre écrit. */
export function ecrireDossiersLocaux(fichier: FichierDossier): number {
  let ecrits = 0;
  for (const [nom, cle] of Object.entries(CLES) as [keyof typeof CLES, string][]) {
    const contenu = fichier.dossiers[nom];
    if (contenu == null) continue;
    try {
      localStorage.setItem(cle, JSON.stringify(contenu));
      ecrits += 1;
    } catch {
      /* quota dépassé : les dossiers déjà écrits restent valides */
    }
  }
  return ecrits;
}

/** Déclenche le téléchargement du dossier courant. */
export function telechargerDossier(): void {
  const contenu = JSON.stringify(construireFichier(lireDossiersLocaux()), null, 2);
  const url = URL.createObjectURL(new Blob([contenu], { type: 'application/json' }));
  const lien = document.createElement('a');
  lien.href = url;
  lien.download = nomFichier();
  lien.click();
  URL.revokeObjectURL(url);
}
