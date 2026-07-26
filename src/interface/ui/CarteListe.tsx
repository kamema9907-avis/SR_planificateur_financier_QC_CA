import type { ReactNode } from 'react';

interface Props {
  /** Nom éditable de l'élément (immeuble, rente, période de travail). */
  nom: string;
  onNom: (nom: string) => void;
  onSupprimer: () => void;
  /** Libellé d'accessibilité du champ nom (ex. « Nom du bien »). */
  libelleNom: string;
  children: ReactNode;
}

/**
 * Carte d'un élément de liste éditable : nom en tête, croix de suppression en coin, contenu libre.
 * Partagée par l'immobilier, les rentes d'employeur et les périodes de travail.
 */
export function CarteListe({ nom, onNom, onSupprimer, libelleNom, children }: Props) {
  return (
    <div className="carte-liste">
      <button type="button" onClick={onSupprimer} aria-label={`Supprimer « ${nom} »`} className="bouton-suppr">
        ✕
      </button>
      <input
        className="saisie mb-3 text-left"
        value={nom}
        aria-label={libelleNom}
        onChange={(e) => onNom(e.target.value)}
      />
      {children}
    </div>
  );
}

/** Message affiché à la place d'une liste vide. */
export function ListeVide({ children }: { children: ReactNode }) {
  return <p className="text-sm text-slate-400">{children}</p>;
}
