import { useRef, useState } from 'react';
import {
  ecrireDossiersLocaux,
  lireFichier,
  telechargerDossier,
} from '../fichierDossier';

/** Flèche vers le bas — exporter. */
function IconeExport() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3v12M7 11l5 5 5-5M4 20h16" />
    </svg>
  );
}

/** Flèche vers le haut — importer. */
function IconeImport() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 17V5M7 9l5-5 5 5M4 20h16" />
    </svg>
  );
}

/**
 * Sauvegarde et restauration du dossier dans un fichier.
 *
 * Sans cela, tout repose sur le `localStorage` : un nettoyage de cache, un autre appareil ou une
 * fenêtre privée, et le travail disparaît. Le fichier ne quitte pas l'appareil — il est écrit par
 * le navigateur, pas envoyé quelque part.
 */
export function BoutonsDossier() {
  const champFichier = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<{ texte: string; erreur: boolean } | null>(null);

  const importer = async (fichier: File) => {
    const lu = lireFichier(await fichier.text());
    if (!lu.ok) {
      setMessage({ texte: lu.erreur, erreur: true });
      return;
    }
    const quoi = `${lu.nombreDossiers} dossier${lu.nombreDossiers > 1 ? 's' : ''}`;
    if (!window.confirm(`Importer ${quoi} ? Vos chiffres actuels seront remplacés.`)) return;

    ecrireDossiersLocaux(lu.fichier);
    // Les vues lisent le stockage à leur montage : on recharge pour que tout reparte du fichier.
    window.location.reload();
  };

  return (
    <div className="relative flex items-center gap-2">
      <button
        type="button"
        onClick={telechargerDossier}
        className="bouton-fantome"
        title="Enregistrer vos chiffres dans un fichier, sur votre appareil"
      >
        <IconeExport />
        Enregistrer
      </button>

      <button
        type="button"
        onClick={() => champFichier.current?.click()}
        className="bouton-fantome"
        title="Recharger un dossier enregistré précédemment"
      >
        <IconeImport />
        Ouvrir
      </button>

      <input
        ref={champFichier}
        type="file"
        accept="application/json,.json"
        className="hidden"
        aria-label="Choisir un fichier de dossier"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = ''; // permet de rouvrir le même fichier après une erreur
          if (f) void importer(f);
        }}
      />

      {message && (
        <div
          role="alert"
          className={`absolute top-9 right-0 z-40 w-72 rounded-xl p-3 text-xs leading-relaxed shadow-lg ring-1 ${
            message.erreur ? 'bg-alerte-fond text-alerte ring-alerte/20' : 'bg-marque-fond text-marque ring-marque/20'
          }`}
        >
          <p>{message.texte}</p>
          <button
            type="button"
            onClick={() => setMessage(null)}
            className="mt-2 font-medium underline underline-offset-2"
          >
            Fermer
          </button>
        </div>
      )}
    </div>
  );
}
