import type { Immeuble, Proprietaire, TypeImmeuble } from '../../moteur';
import { APPRECIATION_IMMO } from '../../moteur';
import { ChampMonetaire, ChampNombre, ChampPourcent, ChampSelect, TitreSection } from '../Champ';

interface Props {
  immeubles: readonly Immeuble[];
  onChange: (immeubles: Immeuble[]) => void;
  /** Afficher le sélecteur de propriétaire (mode couple). */
  couple?: boolean;
  numero?: number;
}

const OPTIONS_TYPE: readonly { valeur: TypeImmeuble; label: string }[] = [
  { valeur: 'residence', label: 'Résidence' },
  { valeur: 'chalet', label: 'Chalet' },
  { valeur: 'revenu', label: 'Immeuble à revenu' },
];

const OPTIONS_PROPRIO: readonly { valeur: string; label: string }[] = [
  { valeur: '1', label: 'Conjoint 1' },
  { valeur: '2', label: 'Conjoint 2' },
  { valeur: 'commun', label: 'Commun (50-50)' },
];

const bouton =
  'rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-200';

function neuf(type: TypeImmeuble, couple: boolean): Immeuble {
  const commun: Omit<Immeuble, 'nom' | 'type' | 'valeur' | 'coutBase' | 'hypotheque' | 'paiementAnnuel' | 'revenuNetExploitation'> = {
    anneesDetenues: 10, appreciation: APPRECIATION_IMMO, tauxHypotheque: 0.05, ageVente: null, fractionLiberee: 1,
    proprietaire: couple ? 'commun' : 1,
  };
  if (type === 'residence') return { nom: 'Résidence', type, valeur: 500_000, coutBase: 300_000, hypotheque: 150_000, paiementAnnuel: 18_000, revenuNetExploitation: 0, ...commun };
  if (type === 'chalet') return { nom: 'Chalet', type, valeur: 250_000, coutBase: 120_000, hypotheque: 0, paiementAnnuel: 0, revenuNetExploitation: 0, ...commun };
  return { nom: 'Immeuble à revenu', type, valeur: 600_000, coutBase: 400_000, hypotheque: 300_000, paiementAnnuel: 22_000, revenuNetExploitation: 24_000, ...commun, proprietaire: couple ? 1 : 1 };
}

export function SectionImmobilier({ immeubles, onChange, couple = false, numero = 4 }: Props) {
  const modifier = (i: number, patch: Partial<Immeuble>) =>
    onChange(immeubles.map((b, j) => (j === i ? { ...b, ...patch } : b)));
  const supprimer = (i: number) => onChange(immeubles.filter((_, j) => j !== i));

  return (
    <section className="carte p-6">
      <TitreSection numero={numero} titre="Immobilier" />
      <p className="-mt-2 mb-4 text-xs text-slate-400">
        Résidence, chalet, immeuble à revenu. Appréciation, hypothèque, loyers et vente intégrés au
        patrimoine. L'exemption pour résidence principale (maison vs chalet) est optimisée automatiquement.
      </p>

      <div className="mb-4 flex flex-wrap gap-2">
        {OPTIONS_TYPE.map((t) => (
          <button key={t.valeur} type="button" className={bouton} onClick={() => onChange([...immeubles, neuf(t.valeur, couple)])}>
            + {t.label}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {immeubles.length === 0 && <p className="text-sm text-slate-400">Aucun bien. Ajoutez-en un avec les boutons ci-dessus.</p>}
        {immeubles.map((b, i) => (
          <div key={i} className="relative rounded-xl p-4 ring-1 ring-slate-200">
            <button
              type="button"
              onClick={() => supprimer(i)}
              aria-label="Supprimer"
              className="absolute top-2.5 right-2.5 flex h-6 w-6 items-center justify-center rounded-full text-slate-400 transition hover:bg-rose-50 hover:text-rose-500"
            >
              ✕
            </button>
            <input className="saisie mb-3 text-left" value={b.nom} aria-label="Nom du bien" onChange={(e) => modifier(i, { nom: e.target.value })} />
            <div className="grid grid-cols-2 gap-3">
              <ChampSelect label="Type" valeur={b.type} options={OPTIONS_TYPE} onChange={(v) => modifier(i, { type: v })} />
              <ChampMonetaire label="Valeur actuelle" valeur={b.valeur} onChange={(v) => modifier(i, { valeur: v })} />
              <ChampMonetaire label="Coût de base" valeur={b.coutBase} onChange={(v) => modifier(i, { coutBase: v })} indice="Gain en capital à la vente" />
              <ChampNombre label="Années détenues" valeur={b.anneesDetenues} onChange={(v) => modifier(i, { anneesDetenues: v })} max={80} />
              <ChampMonetaire label="Solde hypothécaire" valeur={b.hypotheque} onChange={(v) => modifier(i, { hypotheque: v })} />
              <ChampMonetaire label="Paiement annuel" valeur={b.paiementAnnuel} onChange={(v) => modifier(i, { paiementAnnuel: v })} indice="Par-dessus les dépenses" />
              <ChampPourcent label="Taux hypothécaire" valeur={b.tauxHypotheque} onChange={(v) => modifier(i, { tauxHypotheque: v })} />
              <ChampPourcent label="Appréciation" valeur={b.appreciation} onChange={(v) => modifier(i, { appreciation: v })} indice="IQPF : 3,1 %" />
              {b.type === 'revenu' && (
                <div className="col-span-2">
                  <ChampMonetaire label="Revenu net d'exploitation" valeur={b.revenuNetExploitation} onChange={(v) => modifier(i, { revenuNetExploitation: v })} indice="Loyers − dépenses (avant intérêts)" />
                </div>
              )}
              <ChampNombre label="Âge de vente" valeur={b.ageVente ?? 0} onChange={(v) => modifier(i, { ageVente: v === 0 ? null : v })} max={110} />
              {b.type === 'residence' && (
                <ChampPourcent label="Fraction libérée" valeur={b.fractionLiberee} onChange={(v) => modifier(i, { fractionLiberee: v })} indice="100 % = vente ; moins = downsizing" pas={5} />
              )}
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
          </div>
        ))}
      </div>
    </section>
  );
}
