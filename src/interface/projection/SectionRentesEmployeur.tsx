import { useState } from 'react';
import { calculerRREGOP, type RenteEmployeur, type SourceRente } from '../../moteur';
import { ChampMonetaire, ChampNombre, ChampSelect } from '../Champ';
import { CarteListe, ListeVide } from '../ui/CarteListe';
import { Avance } from '../ui/ModeDetail';

interface Props {
  rentes: readonly RenteEmployeur[];
  ageRetraite: number;
  onChange: (rentes: RenteEmployeur[]) => void;
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

/**
 * Rentes d'employeur et RREGOP (rente de base + ponts). Le titre et l'explication sont portés par
 * l'étape qui l'accueille (voir `etapes.tsx`).
 */
export function SectionRentesEmployeur({ rentes, ageRetraite, onChange }: Props) {
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
    <>
      <div className="mb-4 flex flex-wrap gap-2">
        <button
          type="button"
          className="bouton-ajout"
          onClick={() => ajouter({ nom: 'Rente de base', source: 'employeur', montant: 0, ageDebut: ageRetraite, ageFin: null, indexation: 0.5 })}
        >
          + Rente de base
        </button>
        <button
          type="button"
          className="bouton-ajout"
          onClick={() => ajouter({ nom: 'Pont RRQ', source: 'employeur', montant: 12_000, ageDebut: ageRetraite, ageFin: 65, indexation: 0 })}
        >
          + Pont RRQ
        </button>
        <button
          type="button"
          className="bouton-ajout"
          onClick={() => ajouter({ nom: 'Pont SV', source: 'employeur', montant: 8_500, ageDebut: ageRetraite, ageFin: 65, indexation: 0 })}
        >
          + Pont SV
        </button>
      </div>

      <div className="space-y-4">
        {rentes.length === 0 && <ListeVide>Aucune rente. Ajoutez-en une avec les boutons ci-dessus.</ListeVide>}
        {rentes.map((r, i) => (
          <CarteListe
            key={i}
            nom={r.nom}
            libelleNom="Nom de la rente"
            onNom={(nom) => modifier(i, { nom })}
            onSupprimer={() => supprimer(i)}
          >
            <div className="grid grid-cols-2 gap-3">
              <ChampMonetaire label="Montant annuel" valeur={r.montant} onChange={(v) => modifier(i, { montant: v })} />
              <ChampNombre label="Âge début" valeur={r.ageDebut} onChange={(v) => modifier(i, { ageDebut: v })} />
              <ChampNombre label="Âge fin (0 = viagère)" valeur={r.ageFin ?? 0} onChange={(v) => modifier(i, { ageFin: v === 0 ? null : v })} />
              <Avance>
                <ChampSelect label="Source" valeur={r.source} options={OPTIONS_SOURCE} onChange={(v) => modifier(i, { source: v })} />
                <div className="col-span-2">
                  <ChampSelect
                    label="Indexation"
                    valeur={String(r.indexation)}
                    options={OPTIONS_INDEX}
                    onChange={(v) => modifier(i, { indexation: Number(v) })}
                  />
                </div>
              </Avance>
            </div>
          </CarteListe>
        ))}
      </div>

      <div className="encadre-marque mt-5">
        <p className="etiquette mb-2">Calculateur RREGOP (optionnel)</p>
        <div className="grid grid-cols-2 gap-3">
          <ChampNombre label="Années de service" valeur={service} onChange={setService} min={0} max={45} />
          <ChampMonetaire label="Salaire moyen (5 meilleures)" valeur={salaire} onChange={setSalaire} />
        </div>
        <button type="button" onClick={ajouterRREGOP} className="bouton-marque mt-3">
          + Ajouter le RREGOP calculé
        </button>
        <p className="mt-2 text-xs text-doux">
          Ajoute une rente de base viagère + un pont de coordination jusqu'à 65 ans (indexation partielle
          50 %). Réduction de coordination : 0,7 % × service × min(salaire, MGA).
        </p>
      </div>
    </>
  );
}
