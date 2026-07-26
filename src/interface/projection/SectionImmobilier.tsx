import type { Immeuble, Proprietaire, TypeImmeuble } from '../../moteur';
import { APPRECIATION_IMMO } from '../../moteur';
import { ChampMonetaire, ChampNombre, ChampPourcent, ChampSelect } from '../Champ';
import { CarteListe, ListeVide } from '../ui/CarteListe';
import { Avance } from '../ui/ModeDetail';

interface Props {
  immeubles: readonly Immeuble[];
  onChange: (immeubles: Immeuble[]) => void;
  /** Afficher le sélecteur de propriétaire (mode couple). */
  couple?: boolean;
}

const OPTIONS_TYPE: readonly { valeur: TypeImmeuble; label: string }[] = [
  { valeur: 'residence', label: 'Résidence' },
  { valeur: 'chalet', label: 'Chalet' },
  { valeur: 'revenu', label: 'Immeuble à revenu' },
  { valeur: 'terrain', label: 'Terrain' },
];

const OPTIONS_PROPRIO: readonly { valeur: string; label: string }[] = [
  { valeur: '1', label: 'Conjoint 1' },
  { valeur: '2', label: 'Conjoint 2' },
  { valeur: 'commun', label: 'Commun (50-50)' },
];

function neuf(type: TypeImmeuble, couple: boolean): Immeuble {
  const commun: Omit<Immeuble, 'nom' | 'type' | 'valeur' | 'coutBase' | 'hypotheque' | 'paiementAnnuel' | 'revenuNetExploitation'> = {
    anneesDetenues: 10, appreciation: APPRECIATION_IMMO, tauxHypotheque: 0.05, ageVente: null, fractionLiberee: 1,
    proprietaire: couple ? 'commun' : 1,
  };
  if (type === 'residence') return { nom: 'Résidence', type, valeur: 500_000, coutBase: 300_000, hypotheque: 150_000, paiementAnnuel: 18_000, revenuNetExploitation: 0, ...commun };
  if (type === 'chalet') return { nom: 'Chalet', type, valeur: 250_000, coutBase: 120_000, hypotheque: 0, paiementAnnuel: 0, revenuNetExploitation: 0, ...commun };
  if (type === 'terrain') return { nom: 'Terrain', type, valeur: 150_000, coutBase: 100_000, hypotheque: 0, paiementAnnuel: 0, revenuNetExploitation: 0, ...commun };
  return { nom: 'Immeuble à revenu', type, valeur: 600_000, coutBase: 400_000, hypotheque: 300_000, paiementAnnuel: 22_000, revenuNetExploitation: 24_000, ...commun, proprietaire: couple ? 1 : 1 };
}

/**
 * Biens immobiliers du ménage. Le titre et l'explication sont portés par l'étape qui l'accueille
 * (voir `etapes.tsx`).
 */
export function SectionImmobilier({ immeubles, onChange, couple = false }: Props) {
  const modifier = (i: number, patch: Partial<Immeuble>) =>
    onChange(immeubles.map((b, j) => (j === i ? { ...b, ...patch } : b)));
  const supprimer = (i: number) => onChange(immeubles.filter((_, j) => j !== i));

  return (
    <>
      <div className="mb-4 flex flex-wrap gap-2">
        {OPTIONS_TYPE.map((t) => (
          <button key={t.valeur} type="button" className="bouton-ajout" onClick={() => onChange([...immeubles, neuf(t.valeur, couple)])}>
            + {t.label}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {immeubles.length === 0 && <ListeVide>Aucun bien. Ajoutez-en un avec les boutons ci-dessus.</ListeVide>}
        {immeubles.map((b, i) => (
          <CarteListe
            key={i}
            nom={b.nom}
            libelleNom="Nom du bien"
            onNom={(nom) => modifier(i, { nom })}
            onSupprimer={() => supprimer(i)}
          >
            <div className="grid grid-cols-2 gap-3">
              <ChampSelect label="Type" valeur={b.type} options={OPTIONS_TYPE} onChange={(v) => modifier(i, { type: v })} />
              <ChampMonetaire label="Valeur actuelle" valeur={b.valeur} onChange={(v) => modifier(i, { valeur: v })} />
              <ChampMonetaire label="Coût de base" valeur={b.coutBase} onChange={(v) => modifier(i, { coutBase: v })} indice="Gain en capital à la vente" />
              <ChampMonetaire label="Solde hypothécaire" valeur={b.hypotheque} onChange={(v) => modifier(i, { hypotheque: v })} />
              <ChampMonetaire label="Paiement annuel" valeur={b.paiementAnnuel} onChange={(v) => modifier(i, { paiementAnnuel: v })} indice="Par-dessus les dépenses" />
              <Avance>
                <ChampNombre label="Années détenues" valeur={b.anneesDetenues} onChange={(v) => modifier(i, { anneesDetenues: v })} max={80} />
                <ChampPourcent label="Taux hypothécaire" valeur={b.tauxHypotheque} onChange={(v) => modifier(i, { tauxHypotheque: v })} />
                <ChampPourcent label="Appréciation" valeur={b.appreciation} onChange={(v) => modifier(i, { appreciation: v })} indice="IQPF : 3,1 %" />
              </Avance>
              {b.type === 'revenu' && (
                <div className="col-span-2">
                  <ChampMonetaire label="Revenu net d'exploitation" valeur={b.revenuNetExploitation} onChange={(v) => modifier(i, { revenuNetExploitation: v })} indice="Loyers − dépenses (avant intérêts)" />
                </div>
              )}
              {b.type === 'terrain' && (
                <div className="col-span-2">
                  <p className="rounded-lg bg-amber-50/70 px-3 py-2 text-xs text-amber-800 ring-1 ring-amber-500/20">
                    <strong>Terrain vacant</strong> : gain en capital <strong>toujours imposable</strong> (aucune
                    exemption pour résidence principale). Les frais de possession (taxes foncières, intérêts) ne
                    sont ni déductibles ni ajoutés au coût de base — un coût sans avantage fiscal.
                  </p>
                </div>
              )}
              <ChampNombre label="Âge de vente" valeur={b.ageVente ?? 0} onChange={(v) => modifier(i, { ageVente: v === 0 ? null : v })} max={110} />
              <Avance>
                <ChampNombre label="Âge min. de vente (optim.)" valeur={b.ageVenteMin ?? 0} onChange={(v) => modifier(i, { ageVenteMin: v === 0 ? undefined : v })} max={110} />
                {b.type === 'residence' && (
                  <ChampPourcent label="Fraction libérée" valeur={b.fractionLiberee} onChange={(v) => modifier(i, { fractionLiberee: v })} indice="100 % = vente ; moins = downsizing" pas={5} />
                )}
              </Avance>
              {couple && (
                <div className="col-span-2">
                  <ChampSelect
                    label="Propriétaire"
                    valeur={String(b.proprietaire)}
                    options={OPTIONS_PROPRIO}
                    onChange={(v) => modifier(i, { proprietaire: (v === 'commun' ? 'commun' : (Number(v) as 1 | 2)) as Proprietaire })}
                  />
                </div>
              )}
            </div>
          </CarteListe>
        ))}
      </div>
    </>
  );
}
