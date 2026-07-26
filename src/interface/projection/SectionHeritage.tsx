import type { Heritage } from '../../moteur';
import { ChampMonetaire, ChampNombre } from '../Champ';
import { CarteListe, ListeVide } from '../ui/CarteListe';

interface Props {
  heritages: readonly Heritage[];
  /** Âge actuel : sert de valeur de départ raisonnable pour un nouvel héritage. */
  ageActuel: number;
  onChange: (heritages: Heritage[]) => void;
}

/**
 * Saisie des héritages attendus. Le titre et l'explication sont portés par l'étape qui l'accueille
 * (voir `etapes.tsx`).
 */
export function SectionHeritage({ heritages, ageActuel, onChange }: Props) {
  const modifier = (i: number, patch: Partial<Heritage>) =>
    onChange(heritages.map((h, j) => (j === i ? { ...h, ...patch } : h)));
  const supprimer = (i: number) => onChange(heritages.filter((_, j) => j !== i));

  return (
    <>
      <div className="mb-4 flex flex-wrap gap-2">
        <button
          type="button"
          className="bouton-ajout"
          onClick={() =>
            onChange([...heritages, { nom: 'Succession', montant: 0, age: Math.min(110, ageActuel + 10) }])
          }
        >
          + Ajouter un héritage
        </button>
      </div>

      <div className="space-y-4">
        {heritages.length === 0 && (
          <ListeVide>Aucun héritage prévu. Ajoutez-en un si vous en attendez.</ListeVide>
        )}
        {heritages.map((h, i) => (
          <CarteListe
            key={i}
            nom={h.nom}
            libelleNom="Nom de la succession"
            onNom={(nom) => modifier(i, { nom })}
            onSupprimer={() => supprimer(i)}
          >
            <div className="grid grid-cols-2 gap-3">
              <ChampMonetaire
                label="Montant net reçu"
                valeur={h.montant}
                onChange={(v) => modifier(i, { montant: v })}
                indice="En $ d'aujourd'hui"
              />
              <ChampNombre
                label="À l'âge de"
                valeur={h.age}
                min={0}
                max={110}
                onChange={(v) => modifier(i, { age: v })}
              />
            </div>
          </CarteListe>
        ))}
      </div>
    </>
  );
}
