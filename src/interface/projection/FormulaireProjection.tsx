import { CELIAPP_PLAFOND_ANNUEL, CELIAPP_PLAFOND_VIE, droitsCeliParDefaut, REER_PLAFOND_DOLLAR_2026 } from '../../moteur';
import type { HypothesesProjection, TypeCompte } from '../../moteur';
import { ChampMonetaire, ChampNombre, ChampPourcent, Interrupteur, TitreSection } from '../Champ';
import { formatDollars } from '../format';
import { EditeurComptes } from './EditeurComptes';
import { SectionRentesEmployeur } from './SectionRentesEmployeur';
import { SectionImmobilier } from './SectionImmobilier';

/** Message d'aide sur les plafonds CELIAPP (droits restants, plafond annuel, redirection au CELI). */
export function avertissementCeliapp(dejaCotise: number, epargneAnnuelle: number): string {
  const reste = Math.max(0, CELIAPP_PLAFOND_VIE - dejaCotise);
  if (reste <= 0) {
    return `Plafond à vie de ${formatDollars(CELIAPP_PLAFOND_VIE)} atteint : les cotisations CELIAPP seront redirigées vers le CELI.`;
  }
  let msg = `Il reste ${formatDollars(reste)} de droits à vie (plafond ${formatDollars(CELIAPP_PLAFOND_VIE)}).`;
  if (epargneAnnuelle > CELIAPP_PLAFOND_ANNUEL) {
    msg += ` Plafond annuel de ${formatDollars(CELIAPP_PLAFOND_ANNUEL)} : l'excédent ira au CELI.`;
  }
  return msg;
}

interface FormulaireProps {
  h: HypothesesProjection;
  onChange: (h: HypothesesProjection) => void;
}

/** Épargne annuelle éditable (types déductibles ou abrités pertinents). */
const EPARGNES: readonly { type: TypeCompte; label: string; indice?: string }[] = [
  { type: 'REER', label: 'REER', indice: 'Déductible' },
  { type: 'CELI', label: 'CELI' },
  { type: 'CELIAPP', label: 'CELIAPP', indice: 'Déductible' },
  { type: 'NON_ENREGISTRE', label: 'Non-enregistré' },
  { type: 'REEE', label: 'REEE', indice: 'Subvention 30 %' },
];

export function FormulaireProjection({ h, onChange }: FormulaireProps) {
  const maj = <K extends keyof HypothesesProjection>(cle: K, valeur: HypothesesProjection[K]) =>
    onChange({ ...h, [cle]: valeur });

  const majEpargne = (type: TypeCompte, montant: number) =>
    onChange({ ...h, epargneAnnuelle: { ...h.epargneAnnuelle, [type]: montant } });

  return (
    <div className="space-y-6">
      <section className="carte p-6">
        <TitreSection numero={1} titre="Horizon" />
        <div className="grid grid-cols-3 gap-3">
          <ChampNombre label="Âge actuel" valeur={h.ageActuel} onChange={(v) => maj('ageActuel', v)} />
          <ChampNombre label="Âge retraite" valeur={h.ageRetraite} onChange={(v) => maj('ageRetraite', v)} />
          <ChampNombre label="Âge décès" valeur={h.ageDeces} onChange={(v) => maj('ageDeces', v)} />
        </div>
        <div className="mt-4">
          <Interrupteur label="Vit seul(e)" valeur={h.vitSeul} onChange={(v) => maj('vitSeul', v)} />
        </div>
      </section>

      <section className="carte p-6">
        <TitreSection numero={2} titre="Vie active" />
        <div className="grid gap-4 sm:grid-cols-2">
          <ChampMonetaire label="Revenu d'emploi actuel" valeur={h.revenuEmploi} onChange={(v) => maj('revenuEmploi', v)} />
          <ChampPourcent label="Croissance réelle du salaire" valeur={h.croissanceSalaireReelle} onChange={(v) => maj('croissanceSalaireReelle', v)} indice="Au-delà de l'inflation" />
        </div>
        <p className="etiquette mt-5 mb-2">Épargne annuelle (en $ d'aujourd'hui)</p>
        <div className="grid gap-4 sm:grid-cols-2">
          {EPARGNES.map(({ type, label, indice }) => (
            <ChampMonetaire key={type} label={label} valeur={h.epargneAnnuelle[type] ?? 0} onChange={(v) => majEpargne(type, v)} indice={indice} />
          ))}
        </div>
        {(h.epargneAnnuelle.CELIAPP ?? 0) > 0 && (
          <div className="mt-4 rounded-xl bg-marque-50/60 p-4 ring-1 ring-marque-500/15">
            <ChampMonetaire
              label="CELIAPP — déjà cotisé (à vie)"
              valeur={h.celiappDejaCotise ?? 0}
              onChange={(v) => maj('celiappDejaCotise', Math.min(v, CELIAPP_PLAFOND_VIE))}
              indice="Total déjà versé à ton CELIAPP, distinct du solde (qui inclut la croissance)."
            />
            <p className="mt-2 text-xs text-slate-500">
              {avertissementCeliapp(h.celiappDejaCotise ?? 0, h.epargneAnnuelle.CELIAPP ?? 0)}
            </p>
          </div>
        )}
        {((h.epargneAnnuelle.CELI ?? 0) > 0 || (h.epargneAnnuelle.CELIAPP ?? 0) > 0) && (
          <div className="mt-4 rounded-xl bg-sky-50/60 p-4 ring-1 ring-sky-500/15">
            <ChampMonetaire
              label="Droits CELI disponibles"
              valeur={Math.round(h.droitsCeliDisponibles ?? droitsCeliParDefaut(h.comptes))}
              onChange={(v) => maj('droitsCeliDisponibles', v)}
              indice="Chiffre exact dans « Mon dossier » (ARC). Pré-rempli : 109 000 $ − ton solde CELI actuel."
            />
            <p className="mt-2 text-xs text-slate-500">
              Les droits croissent de ~7 000 $/an (indexé) et un retrait les redonne l'année suivante.
              L'épargne au-delà des droits ira au non-enregistré.
            </p>
          </div>
        )}
        {(h.epargneAnnuelle.REER ?? 0) > 0 && (
          <div className="mt-4 rounded-xl bg-emerald-50/60 p-4 ring-1 ring-emerald-500/15">
            <div className="grid gap-4 sm:grid-cols-2">
              <ChampMonetaire
                label="Droits REER disponibles"
                valeur={h.droitsReerDisponibles ?? 0}
                onChange={(v) => maj('droitsReerDisponibles', v)}
                indice="Chiffre de ton avis de cotisation ARC (inclut le report inutilisé)."
              />
              <div className="pt-1">
                <Interrupteur label="Régime à PD (RREGOP / RPA)" valeur={h.regimeRetraitePD ?? false} onChange={(v) => maj('regimeRetraitePD', v)} />
                {h.regimeRetraitePD && (
                  <div className="mt-3">
                    <ChampMonetaire
                      label="Facteur d'équivalence (si connu)"
                      valeur={h.facteurEquivalenceReer ?? 0}
                      onChange={(v) => maj('facteurEquivalenceReer', v)}
                      indice="T4 case 52. Laisse 0 pour l'estimation automatique."
                    />
                  </div>
                )}
              </div>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Nouveaux droits ≈ 18 % du salaire − facteur d'équivalence (max {formatDollars(REER_PLAFOND_DOLLAR_2026)}).
              Un régime à PD (RREGOP) réduit fortement les droits (~600 $/an). L'excédent ira au CELI, puis au non-enregistré.
            </p>
          </div>
        )}
      </section>

      <section className="carte p-6">
        <TitreSection numero={3} titre="Comptes actuels" />
        <p className="-mt-2 mb-4 text-xs text-slate-400">
          Le rendement affiché est net de frais, calibré sur les Normes IQPF. Choisissez « Autre » pour
          fixer votre propre taux.
        </p>
        <EditeurComptes comptes={h.comptes} fraisGestion={h.fraisGestion} onChange={(comptes) => onChange({ ...h, comptes })} />
      </section>

      <section className="carte p-6">
        <TitreSection numero={4} titre="Rentes publiques" />
        <div className="grid gap-4 sm:grid-cols-2">
          <ChampMonetaire label="RRQ estimée à 65 ans" valeur={h.rrqA65} onChange={(v) => maj('rrqA65', v)} indice="Montant annuel (relevé Retraite Québec)" />
          <ChampMonetaire label="SV estimée à 65 ans" valeur={h.svA65} onChange={(v) => maj('svA65', v)} indice="Montant annuel" />
          <ChampNombre label="Âge de début RRQ" valeur={h.ageDebutRRQ} min={60} max={72} onChange={(v) => maj('ageDebutRRQ', v)} />
          <ChampNombre label="Âge de début SV" valeur={h.ageDebutSV} min={65} max={70} onChange={(v) => maj('ageDebutSV', v)} />
        </div>
      </section>

      <SectionRentesEmployeur
        rentes={h.rentesEmployeur}
        ageRetraite={h.ageRetraite}
        onChange={(rentes) => onChange({ ...h, rentesEmployeur: rentes })}
      />

      <SectionImmobilier immeubles={h.immeubles} onChange={(immeubles) => onChange({ ...h, immeubles })} numero={6} />

      <section className="carte p-6">
        <TitreSection numero={7} titre="Décaissement & hypothèses" />
        <div className="grid gap-4 sm:grid-cols-2">
          <ChampMonetaire label="Dépenses de retraite (net d'impôt)" valeur={h.depensesRetraite} onChange={(v) => maj('depensesRetraite', v)} indice="Cible annuelle, en $ d'aujourd'hui" />
          <div />
          <ChampPourcent label="Inflation" valeur={h.inflation} onChange={(v) => maj('inflation', v)} indice="Norme IQPF : 2,1 %" />
          <ChampPourcent label="Frais de gestion" valeur={h.fraisGestion} onChange={(v) => maj('fraisGestion', v)} indice="Réduisent le rendement" />
        </div>
      </section>
    </div>
  );
}
