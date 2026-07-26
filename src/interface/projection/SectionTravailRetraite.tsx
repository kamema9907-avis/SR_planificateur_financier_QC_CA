import type { PeriodeTravail } from '../../moteur';
import { ChampMonetaire, ChampNombre, ChampPourcent } from '../Champ';
import { CarteListe, ListeVide } from '../ui/CarteListe';
import { Avance } from '../ui/ModeDetail';

interface Props {
  periodes: readonly PeriodeTravail[];
  ageRetraite: number;
  onChange: (periodes: PeriodeTravail[]) => void;
}

/**
 * Saisie du travail rémunéré poursuivi à la retraite (« retraité-actif ») : liste de périodes.
 * Le titre et l'explication sont portés par l'étape qui l'accueille (voir `etapes.tsx`).
 */
export function SectionTravailRetraite({ periodes, ageRetraite, onChange }: Props) {
  const ajouter = (p: PeriodeTravail) => onChange([...periodes, p]);
  const modifier = (i: number, patch: Partial<PeriodeTravail>) =>
    onChange(periodes.map((p, j) => (j === i ? { ...p, ...patch } : p)));
  const supprimer = (i: number) => onChange(periodes.filter((_, j) => j !== i));

  return (
    <>
      <div className="mb-4 flex flex-wrap gap-2">
        <button
          type="button"
          className="bouton-ajout"
          onClick={() =>
            ajouter({ nom: 'Temps partiel', montant: 20_000, ageDebut: ageRetraite, ageFin: ageRetraite + 5, croissanceReelle: 0 })
          }
        >
          + Ajouter une période
        </button>
      </div>

      <div className="space-y-4">
        {periodes.length === 0 && (
          <ListeVide>Aucune période. Ajoutez-en une si vous prévoyez continuer à travailler à la retraite.</ListeVide>
        )}
        {periodes.map((p, i) => (
          <CarteListe
            key={i}
            nom={p.nom}
            libelleNom="Nom de la période"
            onNom={(nom) => modifier(i, { nom })}
            onSupprimer={() => supprimer(i)}
          >
            <div className="grid grid-cols-2 gap-3">
              <ChampMonetaire label="Revenu annuel" valeur={p.montant} onChange={(v) => modifier(i, { montant: v })} indice="En $ d'aujourd'hui" />
              <ChampNombre label="Âge début" valeur={p.ageDebut} min={50} max={100} onChange={(v) => modifier(i, { ageDebut: v })} />
              <ChampNombre label="Âge fin (exclu)" valeur={p.ageFin} min={50} max={100} onChange={(v) => modifier(i, { ageFin: v })} />
              <Avance>
                <ChampPourcent label="Croissance réelle" valeur={p.croissanceReelle ?? 0} onChange={(v) => modifier(i, { croissanceReelle: v })} indice="Au-delà de l'inflation" />
              </Avance>
            </div>
          </CarteListe>
        ))}
      </div>
    </>
  );
}
