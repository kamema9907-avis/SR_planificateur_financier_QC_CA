/**
 * Encadrés de la section « Vie active » : plafonds et droits de cotisation.
 *
 * Les encadrés de PLAFOND n'apparaissent que lorsqu'ils sont pertinents (on ne parle du plafond
 * CELIAPP que si l'on cotise au CELIAPP), ce qui évite d'alourdir le formulaire pour rien.
 *
 * Les DROITS de cotisation, eux, sont toujours visibles : voir `BlocDroitsCotisation`.
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
      <p className="mt-2 text-xs text-doux">
        {avertissementCeliapp(p.celiappDejaCotise ?? 0, p.epargneAnnuelle.CELIAPP ?? 0)}
      </p>
    </div>
  );
}

/**
 * Droits de cotisation CELI et REER — **toujours visibles**.
 *
 * Ces deux chiffres ne décrivent pas l'épargne annuelle : ce sont des attributs permanents de la
 * personne, que le moteur consomme partout où un dollar entre. Il les lit à quatre endroits, dont
 * trois n'ont rien à voir avec la vie active : la cotisation annuelle, le placement du produit
 * d'une vente d'immeuble, le placement d'un héritage, et le surplus d'un retraité qui travaille.
 *
 * Ils étaient auparavant masqués tant qu'on ne cotisait pas au compte correspondant. Un retraité qui
 * vendait un immeuble se voyait donc appliquer en silence le défaut de `droitsReerDisponibles`,
 * c'est-à-dire ZÉRO : la cotisation REER qui absorbe le gain de l'année devenait impossible. Mesuré
 * sur un cas réaliste (immeuble de 350 000 $ vendu à 60 ans) : 20 769 $ d'impôt en trop et 12 % de
 * patrimoine en moins au décès, sur un champ que l'écran refusait d'afficher.
 *
 * Le défaut REER reste 0 (aucun report inutilisé) : il n'existe aucune heuristique défendable, les
 * droits dépendant de toute la carrière. Mais un défaut prudent VISIBLE vaut mieux qu'un défaut
 * caché — d'où le champ permanent et l'indice qui nomme la ligne exacte de l'avis de cotisation.
 */
export function BlocDroitsCotisation({ p, onChange }: Props) {
  // Le facteur d'équivalence ne joue que tant qu'un salaire génère de nouveaux droits ; inutile de
  // l'imposer à un retraité. On le garde visible s'il est déjà activé, pour pouvoir l'éteindre.
  const accumuleEncore = p.revenuEmploi > 0 || (p.regimeRetraitePD ?? false);
  return (
    <div className="encadre-ciel">
      <p className="etiquette">Droits de cotisation (ARC)</p>
      <p className="mt-1 mb-3 text-xs text-doux">
        Deux chiffres personnels, tirés de votre avis de cotisation et de « Mon dossier ». Ils
        décident où aboutit <strong>chaque dollar qui entre</strong> : épargne annuelle, produit
        d'une vente d'immeuble, héritage, surplus d'un retraité qui travaille.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <ChampMonetaire
            label="Droits CELI disponibles"
            valeur={Math.round(p.droitsCeliDisponibles ?? droitsCeliParDefaut(p.comptes))}
            onChange={(v) => onChange({ droitsCeliDisponibles: v })}
            indice="« Mon dossier » (ARC). Prérempli : 109 000 $ − votre solde CELI actuel."
          />
          <p className="mt-2 text-xs text-doux">
            Les droits croissent de ~7 000 $/an (indexé) et un retrait les redonne l'année suivante.
            Ce qui dépasse les droits ira au non-enregistré.
          </p>
        </div>
        <div>
          <ChampMonetaire
            label="Droits REER disponibles"
            valeur={p.droitsReerDisponibles ?? 0}
            onChange={(v) => onChange({ droitsReerDisponibles: v })}
            indice="Avis de cotisation ARC, ligne « Maximum déductible au titre des REER ». Laissé vide, le calcul suppose aucun report inutilisé."
          />
          <p className="mt-2 text-xs text-doux">
            Nouveaux droits ≈ 18 % du salaire − facteur d'équivalence (max{' '}
            {formatDollars(REER_PLAFOND_DOLLAR_2026)}). Ce qui dépasse ira au CELI, puis au
            non-enregistré.
          </p>
          {accumuleEncore && (
            <div className="mt-3">
              <Interrupteur
                label="Régime à PD (RREGOP / RPA)"
                valeur={p.regimeRetraitePD ?? false}
                onChange={(v) => onChange({ regimeRetraitePD: v })}
              />
              <p className="mt-1 text-xs text-doux">
                Un régime à PD réduit fortement les nouveaux droits (~600 $/an).
              </p>
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
          )}
        </div>
      </div>
    </div>
  );
}
