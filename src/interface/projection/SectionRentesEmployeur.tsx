import { useState } from 'react';
import { calculerRREGOP, type RenteEmployeur, type SourceRente } from '../../moteur';
import { ChampMonetaire, ChampNombre, ChampSelect, TitreSection } from '../Champ';

interface Props {
  rentes: readonly RenteEmployeur[];
  ageRetraite: number;
  onChange: (rentes: RenteEmployeur[]) => void;
  /** Numéro de section (défaut 5). */
  numero?: number;
}

const OPTIONS_SOURCE: readonly { valeur: SourceRente; label: string }[] = [
  { valeur: 'employeur', label: 'Employeur' },
  { valeur: 'rregop', label: 'RREGOP' },
  { valeur: 'autre', label: 'Autre' },
];

const OPTIONS_INDEX: readonly { valeur: string; label: string }[] = [
  { valeur: '0', label: 'Non indexée' },
  { valeur: '0.5', label: 'Partielle (50 % IPC)' },
  { valeur: '1', label: 'Pleinement indexée' },
];

const boutonAjout =
  'rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-200';

export function SectionRentesEmployeur({ rentes, ageRetraite, onChange, numero = 5 }: Props) {
  const [service, setService] = useState(30);
  const [salaire, setSalaire] = useState(60_000);

  const ajouter = (r: RenteEmployeur) => onChange([...rentes, r]);
  const modifier = (i: number, patch: Partial<RenteEmployeur>) =>
    onChange(rentes.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const supprimer = (i: number) => onChange(rentes.filter((_, j) => j !== i));

  const ajouterRREGOP = () => {
    const { baseViagere, pontCoordination } = calculerRREGOP(service, salaire);
    onChange([
      ...rentes,
      { nom: 'RREGOP (base)', source: 'rregop', montant: Math.round(baseViagere), ageDebut: ageRetraite, ageFin: null, indexation: 0.5 },
      { nom: 'RREGOP (coordination)', source: 'rregop', montant: Math.round(pontCoordination), ageDebut: ageRetraite, ageFin: 65, indexation: 0.5 },
    ]);
  };

  return (
    <section className="carte p-6">
      <TitreSection numero={numero} titre="Rentes d'employeur" />
      <p className="-mt-2 mb-4 text-xs text-slate-400">
        Rentes de retraite d'employeur et RREGOP (rente de base + ponts). Imposables, admissibles au
        crédit pour revenu de pension.
      </p>

      <div className="mb-4 flex flex-wrap gap-2">
        <button
          type="button"
          className={boutonAjout}
          onClick={() => ajouter({ nom: 'Rente de base', source: 'employeur', montant: 0, ageDebut: ageRetraite, ageFin: null, indexation: 0.5 })}
        >
          + Rente de base
        </button>
        <button
          type="button"
          className={boutonAjout}
          onClick={() => ajouter({ nom: 'Pont RRQ', source: 'employeur', montant: 12_000, ageDebut: ageRetraite, ageFin: 65, indexation: 0 })}
        >
          + Pont RRQ
        </button>
        <button
          type="button"
          className={boutonAjout}
          onClick={() => ajouter({ nom: 'Pont SV', source: 'employeur', montant: 8_500, ageDebut: ageRetraite, ageFin: 65, indexation: 0 })}
        >
          + Pont SV
        </button>
      </div>

      <div className="space-y-4">
        {rentes.length === 0 && (
          <p className="text-sm text-slate-400">Aucune rente. Ajoutez-en une avec les boutons ci-dessus.</p>
        )}
        {rentes.map((r, i) => (
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
              value={r.nom}
              aria-label="Nom de la rente"
              onChange={(e) => modifier(i, { nom: e.target.value })}
            />
            <div className="grid grid-cols-2 gap-3">
              <ChampMonetaire label="Montant annuel" valeur={r.montant} onChange={(v) => modifier(i, { montant: v })} />
              <ChampSelect label="Source" valeur={r.source} options={OPTIONS_SOURCE} onChange={(v) => modifier(i, { source: v })} />
              <ChampNombre label="Âge début" valeur={r.ageDebut} onChange={(v) => modifier(i, { ageDebut: v })} />
              <ChampNombre label="Âge fin (0 = viagère)" valeur={r.ageFin ?? 0} onChange={(v) => modifier(i, { ageFin: v === 0 ? null : v })} />
              <div className="col-span-2">
                <ChampSelect
                  label="Indexation"
                  valeur={String(r.indexation)}
                  options={OPTIONS_INDEX}
                  onChange={(v) => modifier(i, { indexation: Number(v) })}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-5 rounded-xl bg-marque-50/60 p-4 ring-1 ring-marque-500/15">
        <p className="etiquette mb-2">Calculateur RREGOP (optionnel)</p>
        <div className="grid grid-cols-2 gap-3">
          <ChampNombre label="Années de service" valeur={service} onChange={setService} min={0} max={45} />
          <ChampMonetaire label="Salaire moyen (5 meilleures)" valeur={salaire} onChange={setSalaire} />
        </div>
        <button
          type="button"
          onClick={ajouterRREGOP}
          className="mt-3 rounded-lg bg-marque-500 px-3 py-2 text-sm font-medium text-white transition hover:bg-marque-600"
        >
          + Ajouter le RREGOP calculé
        </button>
        <p className="mt-2 text-xs text-slate-400">
          Ajoute une rente de base viagère + un pont de coordination jusqu'à 65 ans (indexation partielle
          50 %). Réduction de coordination : 0,7 % × service × min(salaire, MGA).
        </p>
      </div>
    </section>
  );
}
