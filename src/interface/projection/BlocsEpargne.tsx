/**
 * Encadrés conditionnels de la section « Vie active » : plafonds et droits de cotisation.
 *
 * Ils n'apparaissent que lorsqu'ils sont pertinents (on ne parle du plafond CELIAPP que si l'on
 * cotise au CELIAPP), ce qui évite d'alourdir le formulaire pour rien.
 */
import {
  CELIAPP_PLAFOND_ANNUEL,
  CELIAPP_PLAFOND_VIE,
  droitsCeliParDefaut,
  REER_PLAFOND_DOLLAR_2026,
} from '../../moteur';
import { ChampMonetaire, Interrupteur } from '../Champ';
import { formatDollars } from '../format';
import { Avance } from '../ui/ModeDetail';
import type { ChampsPersonne, PatchPersonne } from './champsPersonne';

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

interface Props {
  p: ChampsPersonne;
  onChange: (patch: PatchPersonne) => void;
}

/** Cotisation à un fonds de travailleurs (FTQ / Fondaction) — crédit de 30 % sur le 1er 5 000 $. */
export function BlocFondsTravailleurs({ p, onChange }: Props) {
  const actif = (p.fondsTravailleursAnnuel ?? 0) > 0;
  return (
    <div className="encadre-marque">
      <Interrupteur
        label="Fonds de travailleurs (FTQ / Fondaction)"
        valeur={actif}
        onChange={(v) => onChange({ fondsTravailleursAnnuel: v ? 5_000 : 0 })}
      />
      {actif && (
        <div className="mt-3">
          <ChampMonetaire
            label="Cotisation annuelle"
            valeur={p.fondsTravailleursAnnuel ?? 0}
            onChange={(v) => onChange({ fondsTravailleursAnnuel: v })}
            indice="Part de votre REER (ci-dessus) placée en fonds de travailleurs → crédit de 30 % sur le 1er 5 000 $. À inclure dans le champ REER, pas en plus."
          />
        </div>
      )}
    </div>
  );
}

/** Plafond à vie du CELIAPP — visible seulement si l'on y cotise. */
export function BlocCeliapp({ p, onChange }: Props) {
  if ((p.epargneAnnuelle.CELIAPP ?? 0) <= 0) return null;
  return (
    <div className="encadre-marque">
      <ChampMonetaire
        label="CELIAPP — déjà cotisé (à vie)"
        valeur={p.celiappDejaCotise ?? 0}
        onChange={(v) => onChange({ celiappDejaCotise: Math.min(v, CELIAPP_PLAFOND_VIE) })}
        indice="Total déjà versé à votre CELIAPP, distinct du solde (qui inclut la croissance)."
      />
      <p className="mt-2 text-xs text-slate-500">
        {avertissementCeliapp(p.celiappDejaCotise ?? 0, p.epargneAnnuelle.CELIAPP ?? 0)}
      </p>
    </div>
  );
}

/**
 * Droits de cotisation CELI.
 *
 * Visible dès que quelque chose peut aboutir au CELI — et pas seulement en cas d'épargne CELI
 * planifiée : un héritage, un produit de vente ou un simple surplus de retraite y sont versés en
 * priorité. Masquer le champ dans ces cas laissait croire que les droits n'étaient pas pris en
 * compte, alors qu'une valeur par défaut (109 000 $ − solde actuel) s'appliquait en silence.
 */
export function BlocDroitsCeli({ p, onChange }: Props) {
  const peutRecevoir =
    (p.epargneAnnuelle.CELI ?? 0) > 0 ||
    (p.epargneAnnuelle.CELIAPP ?? 0) > 0 ||
    (p.heritages ?? []).some((h) => h.montant > 0) ||
    p.comptes.some((c) => c.type === 'CELI' && c.solde > 0);
  if (!peutRecevoir) return null;
  return (
    <div className="encadre-ciel">
      <ChampMonetaire
        label="Droits CELI disponibles"
        valeur={Math.round(p.droitsCeliDisponibles ?? droitsCeliParDefaut(p.comptes))}
        onChange={(v) => onChange({ droitsCeliDisponibles: v })}
        indice="Chiffre exact dans « Mon dossier » (ARC). Pré-rempli : 109 000 $ − votre solde CELI actuel."
      />
      <p className="mt-2 text-xs text-slate-500">
        Les droits croissent de ~7 000 $/an (indexé) et un retrait les redonne l'année suivante.
        L'épargne au-delà des droits ira au non-enregistré.
      </p>
    </div>
  );
}

/** Droits de cotisation REER et facteur d'équivalence — visible seulement si l'on cotise au REER. */
export function BlocDroitsReer({ p, onChange }: Props) {
  if ((p.epargneAnnuelle.REER ?? 0) <= 0) return null;
  return (
    <div className="encadre-marque">
      <div className="grid gap-4 sm:grid-cols-2">
        <ChampMonetaire
          label="Droits REER disponibles"
          valeur={p.droitsReerDisponibles ?? 0}
          onChange={(v) => onChange({ droitsReerDisponibles: v })}
          indice="Chiffre de votre avis de cotisation ARC (inclut le report inutilisé)."
        />
        <div className="pt-1">
          <Interrupteur
            label="Régime à PD (RREGOP / RPA)"
            valeur={p.regimeRetraitePD ?? false}
            onChange={(v) => onChange({ regimeRetraitePD: v })}
          />
          {p.regimeRetraitePD && (
            <Avance>
              <div className="mt-3">
                <ChampMonetaire
                  label="Facteur d'équivalence (si connu)"
                  valeur={p.facteurEquivalenceReer ?? 0}
                  onChange={(v) => onChange({ facteurEquivalenceReer: v })}
                  indice="T4 case 52. Laissez 0 pour l'estimation automatique."
                />
              </div>
            </Avance>
          )}
        </div>
      </div>
      <p className="mt-2 text-xs text-slate-500">
        Nouveaux droits ≈ 18 % du salaire − facteur d'équivalence (max {formatDollars(REER_PLAFOND_DOLLAR_2026)}).
        Un régime à PD (RREGOP) réduit fortement les droits (~600 $/an). L'excédent ira au CELI, puis au
        non-enregistré.
      </p>
    </div>
  );
}
