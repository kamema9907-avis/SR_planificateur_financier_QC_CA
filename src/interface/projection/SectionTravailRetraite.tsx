import type { PeriodeTravail } from '../../moteur';
import { ChampMonetaire, ChampNombre, ChampPourcent, TitreSection } from '../Champ';

interface Props {
  periodes: readonly PeriodeTravail[];
  ageRetraite: number;
  onChange: (periodes: PeriodeTravail[]) => void;
  /** Numéro de section (défaut 3). */
  numero?: number;
}

const boutonAjout =
  'rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-200';

/** Saisie du travail rémunéré poursuivi à la retraite (« retraité-actif ») : liste de périodes. */
export function SectionTravailRetraite({ periodes, ageRetraite, onChange, numero = 3 }: Props) {
  const ajouter = (p: PeriodeTravail) => onChange([...periodes, p]);
  const modifier = (i: number, patch: Partial<PeriodeTravail>) =>
    onChange(periodes.map((p, j) => (j === i ? { ...p, ...patch } : p)));
  const supprimer = (i: number) => onChange(periodes.filter((_, j) => j !== i));

  return (
    <section className="carte p-6">
      <TitreSection numero={numero} titre="Travail à la retraite" />
      <p className="-mt-2 mb-4 text-xs text-slate-400">
        Revenu d'emploi poursuivi après la retraite (temps partiel, pige, consultation). Imposé comme
        un salaire, il réduit le décaissement de vos comptes ; tout surplus est réinvesti
        (CELI → REER → non-enregistré).
      </p>

      <div className="mb-4 flex flex-wrap gap-2">
        <button
          type="button"
          className={boutonAjout}
          onClick={() =>
            ajouter({ nom: 'Temps partiel', montant: 20_000, ageDebut: ageRetraite, ageFin: ageRetraite + 5, croissanceReelle: 0 })
          }
        >
          + Ajouter une période
        </button>
      </div>

      <div className="space-y-4">
        {periodes.length === 0 && (
          <p className="text-sm text-slate-400">
            Aucune période. Ajoutez-en une si vous prévoyez continuer à travailler à la retraite.
          </p>
        )}
        {periodes.map((p, i) => (
          <div key={i} className="relative rounded-xl p-4 ring-1 ring-slate-200">
            <button
              type="button"
              onClick={() => supprimer(i)}
              aria-label="Supprimer"
              className="absolute top-2.5 right-2.5 flex h-6 w-6 items-center justify-center rounded-full text-slate-400 transition hover:bg-rose-50 hover:text-rose-500"
            >
              ✕
            </button>
            <input
              className="saisie mb-3 text-left"
              value={p.nom}
              aria-label="Nom de la période"
              onChange={(e) => modifier(i, { nom: e.target.value })}
            />
            <div className="grid grid-cols-2 gap-3">
              <ChampMonetaire label="Revenu annuel" valeur={p.montant} onChange={(v) => modifier(i, { montant: v })} indice="En $ d'aujourd'hui" />
              <ChampPourcent label="Croissance réelle" valeur={p.croissanceReelle ?? 0} onChange={(v) => modifier(i, { croissanceReelle: v })} indice="Au-delà de l'inflation" />
              <ChampNombre label="Âge début" valeur={p.ageDebut} min={50} max={100} onChange={(v) => modifier(i, { ageDebut: v })} />
              <ChampNombre label="Âge fin (exclu)" valeur={p.ageFin} min={50} max={100} onChange={(v) => modifier(i, { ageFin: v })} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
