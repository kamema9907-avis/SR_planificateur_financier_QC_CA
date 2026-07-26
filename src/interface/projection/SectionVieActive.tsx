import type { ReactNode } from 'react';
import type { TypeCompte } from '../../moteur';
import { ChampMonetaire, ChampPourcent } from '../Champ';
import { Avance } from '../ui/ModeDetail';
import { BlocCeliapp, BlocDroitsCeli, BlocDroitsReer, BlocFondsTravailleurs } from './BlocsEpargne';
import type { ChampsPersonne, PatchPersonne } from './champsPersonne';

/** Un type de compte proposé à l'épargne annuelle. */
export interface LigneEpargne {
  type: TypeCompte;
  label: string;
  indice?: string;
}

/** Épargne annuelle d'une personne seule (le REEE se saisit au niveau du ménage en mode couple). */
export const EPARGNES_SOLO: readonly LigneEpargne[] = [
  { type: 'REER', label: 'REER', indice: 'Déductible' },
  { type: 'CELI', label: 'CELI' },
  { type: 'CELIAPP', label: 'CELIAPP', indice: 'Déductible' },
  { type: 'NON_ENREGISTRE', label: 'Non-enregistré' },
  { type: 'REEE', label: 'REEE', indice: 'Subvention 30 %' },
];

/** Épargne annuelle d'un conjoint. */
export const EPARGNES_CONJOINT: readonly LigneEpargne[] = [
  { type: 'REER', label: 'REER', indice: 'Déductible' },
  { type: 'CELI', label: 'CELI' },
  { type: 'CELIAPP', label: 'CELIAPP', indice: 'Déductible' },
  { type: 'NON_ENREGISTRE', label: 'Non-enregistré' },
];

interface Props {
  p: ChampsPersonne;
  onChange: (patch: PatchPersonne) => void;
  epargnes: readonly LigneEpargne[];
  /** Champ propre au couple glissé dans la grille d'épargne (le REER de conjoint). */
  epargneSupplementaire?: ReactNode;
}

/**
 * Revenu de travail et épargne annuelle, avec les encadrés de plafonds qui n'apparaissent que
 * lorsqu'ils sont pertinents. Commune à la personne seule et à chaque conjoint.
 */
export function SectionVieActive({ p, onChange, epargnes, epargneSupplementaire }: Props) {
  const majEpargne = (type: TypeCompte, montant: number) =>
    onChange({ epargneAnnuelle: { ...p.epargneAnnuelle, [type]: montant } });

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <ChampMonetaire
          label="Revenu d'emploi actuel"
          valeur={p.revenuEmploi}
          onChange={(v) => onChange({ revenuEmploi: v })}
        />
        <Avance>
          <ChampPourcent
            label="Croissance réelle du salaire"
            valeur={p.croissanceSalaireReelle}
            onChange={(v) => onChange({ croissanceSalaireReelle: v })}
            indice="Au-delà de l'inflation"
          />
        </Avance>
      </div>

      <p className="etiquette mt-5 mb-2">Épargne annuelle (en $ d'aujourd'hui)</p>
      <div className="grid gap-4 sm:grid-cols-2">
        {epargnes.map(({ type, label, indice }) => (
          <ChampMonetaire
            key={type}
            label={label}
            valeur={p.epargneAnnuelle[type] ?? 0}
            onChange={(v) => majEpargne(type, v)}
            indice={indice}
          />
        ))}
        {epargneSupplementaire}
      </div>

      <BlocFondsTravailleurs p={p} onChange={onChange} />
      <BlocCeliapp p={p} onChange={onChange} />
      <BlocDroitsCeli p={p} onChange={onChange} />
      <BlocDroitsReer p={p} onChange={onChange} />
    </>
  );
}
