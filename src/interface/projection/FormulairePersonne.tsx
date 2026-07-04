import { CELIAPP_PLAFOND_VIE, droitsCeliParDefaut, REER_PLAFOND_DOLLAR_2026 } from '../../moteur';
import type { PersonneProjection, TypeCompte } from '../../moteur';
import { ChampMonetaire, ChampNombre, ChampPourcent, ChampSelect, Interrupteur, TitreSection } from '../Champ';
import { formatDollars } from '../format';
import { avertissementCeliapp } from './FormulaireProjection';
import { EditeurComptes } from './EditeurComptes';
import { SectionRentesEmployeur } from './SectionRentesEmployeur';

interface Props {
  p: PersonneProjection;
  fraisGestion: number;
  onChange: (p: PersonneProjection) => void;
}

const EPARGNES: readonly { type: TypeCompte; label: string; indice?: string }[] = [
  { type: 'REER', label: 'REER', indice: 'Déductible' },
  { type: 'CELI', label: 'CELI' },
  { type: 'CELIAPP', label: 'CELIAPP', indice: 'Déductible' },
  { type: 'NON_ENREGISTRE', label: 'Non-enregistré' },
];

const OPTIONS_SEXE = [
  { valeur: 'H', label: 'Homme' },
  { valeur: 'F', label: 'Femme' },
] as const;

/** Formulaire d'un conjoint (situation, vie active, comptes, rentes). */
export function FormulairePersonne({ p, fraisGestion, onChange }: Props) {
  const maj = <K extends keyof PersonneProjection>(cle: K, valeur: PersonneProjection[K]) =>
    onChange({ ...p, [cle]: valeur });
  const majEpargne = (type: TypeCompte, montant: number) =>
    onChange({ ...p, epargneAnnuelle: { ...p.epargneAnnuelle, [type]: montant } });

  return (
    <div className="space-y-6">
      <section className="carte p-6">
        <TitreSection numero={1} titre="Situation" />
        <input
          className="saisie mb-3 text-left"
          value={p.nom}
          aria-label="Nom du conjoint"
          onChange={(e) => maj('nom', e.target.value)}
        />
        <div className="grid grid-cols-2 gap-3">
          <ChampSelect label="Sexe" valeur={p.sexe} options={OPTIONS_SEXE} onChange={(v) => maj('sexe', v)} />
          <ChampNombre label="Âge actuel" valeur={p.ageActuel} onChange={(v) => maj('ageActuel', v)} />
          <ChampNombre label="Âge retraite" valeur={p.ageRetraite} onChange={(v) => maj('ageRetraite', v)} />
          <ChampNombre label="Âge décès" valeur={p.ageDeces} onChange={(v) => maj('ageDeces', v)} />
        </div>
      </section>

      <section className="carte p-6">
        <TitreSection numero={2} titre="Vie active" />
        <div className="grid gap-4 sm:grid-cols-2">
          <ChampMonetaire label="Revenu d'emploi" valeur={p.revenuEmploi} onChange={(v) => maj('revenuEmploi', v)} />
          <ChampPourcent label="Croissance réelle" valeur={p.croissanceSalaireReelle} onChange={(v) => maj('croissanceSalaireReelle', v)} indice="Au-delà de l'inflation" />
        </div>
        <p className="etiquette mt-5 mb-2">Épargne annuelle (en $ d'aujourd'hui)</p>
        <div className="grid gap-4 sm:grid-cols-2">
          {EPARGNES.map(({ type, label, indice }) => (
            <ChampMonetaire key={type} label={label} valeur={p.epargneAnnuelle[type] ?? 0} onChange={(v) => majEpargne(type, v)} indice={indice} />
          ))}
          <ChampMonetaire label="REER de conjoint" valeur={p.epargneReerConjoint} onChange={(v) => maj('epargneReerConjoint', v)} indice="Vous déduisez, versé au REER de l'autre" />
          <ChampMonetaire label="Fonds de travailleurs (FTQ/Fondaction)" valeur={p.fondsTravailleursAnnuel ?? 0} onChange={(v) => maj('fondsTravailleursAnnuel', v)} indice="REER additionnel + crédit 30 % (1er 5 000 $)" />
        </div>
        {(p.epargneAnnuelle.CELIAPP ?? 0) > 0 && (
          <div className="mt-4 rounded-xl bg-marque-50/60 p-4 ring-1 ring-marque-500/15">
            <ChampMonetaire
              label="CELIAPP — déjà cotisé (à vie)"
              valeur={p.celiappDejaCotise ?? 0}
              onChange={(v) => maj('celiappDejaCotise', Math.min(v, CELIAPP_PLAFOND_VIE))}
              indice="Total déjà versé, distinct du solde du compte."
            />
            <p className="mt-2 text-xs text-slate-500">
              {avertissementCeliapp(p.celiappDejaCotise ?? 0, p.epargneAnnuelle.CELIAPP ?? 0)}
            </p>
          </div>
        )}
        {((p.epargneAnnuelle.CELI ?? 0) > 0 || (p.epargneAnnuelle.CELIAPP ?? 0) > 0) && (
          <div className="mt-4 rounded-xl bg-sky-50/60 p-4 ring-1 ring-sky-500/15">
            <ChampMonetaire
              label="Droits CELI disponibles"
              valeur={Math.round(p.droitsCeliDisponibles ?? droitsCeliParDefaut(p.comptes))}
              onChange={(v) => maj('droitsCeliDisponibles', v)}
              indice="Selon « Mon dossier » (ARC). Pré-rempli : 109 000 $ − solde CELI."
            />
            <p className="mt-2 text-xs text-slate-500">
              +7 000 $/an (indexé) ; un retrait redonne les droits l'année suivante. L'excédent ira au non-enregistré.
            </p>
          </div>
        )}
        {(p.epargneAnnuelle.REER ?? 0) > 0 && (
          <div className="mt-4 rounded-xl bg-emerald-50/60 p-4 ring-1 ring-emerald-500/15">
            <div className="grid gap-4 sm:grid-cols-2">
              <ChampMonetaire
                label="Droits REER disponibles"
                valeur={p.droitsReerDisponibles ?? 0}
                onChange={(v) => maj('droitsReerDisponibles', v)}
                indice="Avis de cotisation ARC (report inclus)."
              />
              <div className="pt-1">
                <Interrupteur label="Régime à PD (RREGOP / RPA)" valeur={p.regimeRetraitePD ?? false} onChange={(v) => maj('regimeRetraitePD', v)} />
                {p.regimeRetraitePD && (
                  <div className="mt-3">
                    <ChampMonetaire
                      label="Facteur d'équivalence (si connu)"
                      valeur={p.facteurEquivalenceReer ?? 0}
                      onChange={(v) => maj('facteurEquivalenceReer', v)}
                      indice="T4 case 52. 0 = estimation auto."
                    />
                  </div>
                )}
              </div>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              ≈ 18 % du salaire − FE (max {formatDollars(REER_PLAFOND_DOLLAR_2026)}). Un régime à PD réduit fortement
              les droits (~600 $/an). Excédent → CELI → non-enregistré.
            </p>
          </div>
        )}
      </section>

      <section className="carte p-6">
        <TitreSection numero={3} titre="Comptes actuels" />
        <EditeurComptes comptes={p.comptes} fraisGestion={fraisGestion} onChange={(comptes) => onChange({ ...p, comptes })} />
      </section>

      <section className="carte p-6">
        <TitreSection numero={4} titre="Rentes publiques" />
        <div className="grid gap-4 sm:grid-cols-2">
          <ChampMonetaire label="RRQ à 65 ans" valeur={p.rrqA65} onChange={(v) => maj('rrqA65', v)} indice="Annuel (relevé)" />
          <ChampMonetaire label="SV à 65 ans" valeur={p.svA65} onChange={(v) => maj('svA65', v)} indice="Annuel" />
          <ChampNombre label="Début RRQ" valeur={p.ageDebutRRQ} min={60} max={72} onChange={(v) => maj('ageDebutRRQ', v)} />
          <ChampNombre label="Début SV" valeur={p.ageDebutSV} min={65} max={70} onChange={(v) => maj('ageDebutSV', v)} />
        </div>
      </section>

      <SectionRentesEmployeur
        rentes={p.rentesEmployeur}
        ageRetraite={p.ageRetraite}
        onChange={(rentes) => onChange({ ...p, rentesEmployeur: rentes })}
      />
    </div>
  );
}
