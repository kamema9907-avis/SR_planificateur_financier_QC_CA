/** Briques d'affichage partagées par les drawers de drill-down (solo et couple). */
import type { DetailDisponible, DetailImpotAnnee, DetailValeurNette, Poste } from '../../moteur';
import { formatDollars, formatPourcent } from '../format';

/** Une ligne « poste » (montant signé) ; cliquable si le poste porte un lien de drill-down. */
export function LignePoste({ poste, facteur, onLien }: { poste: Poste; facteur: number; onLien?: () => void }) {
  const cliquable = poste.lien != null && onLien != null;
  return (
    <button
      type="button"
      disabled={!cliquable}
      onClick={onLien}
      className={`flex w-full items-center justify-between py-1.5 text-left ${
        cliquable ? '-mx-2 cursor-pointer rounded-md px-2 hover:bg-marque-fond' : 'cursor-default'
      }`}
    >
      <span className="text-sm text-corps">
        {poste.libelle}
        {cliquable && <span className="ml-1.5 text-xs font-medium text-marque">détailler ›</span>}
      </span>
      <span className={`chiffres text-sm tabular-nums ${poste.montant < 0 ? 'text-alerte' : 'text-titre'}`}>
        {formatDollars(poste.montant * facteur)}
      </span>
    </button>
  );
}

/** Une section titrée (liste de postes). */
export function Section({ titre, postes, facteur, onLienImpot }: { titre: string; postes: readonly Poste[]; facteur: number; onLienImpot?: () => void }) {
  if (postes.length === 0) return null;
  return (
    <div className="mb-4">
      <p className="mb-1 text-xs font-semibold tracking-wide text-doux uppercase">{titre}</p>
      <div className="divide-y divide-filet">
        {postes.map((p, i) => (
          <LignePoste key={i} poste={p} facteur={facteur} onLien={p.lien === 'impot' ? onLienImpot : undefined} />
        ))}
      </div>
    </div>
  );
}

/** Une ligne « total » mise en évidence. */
export function LigneTotal({ libelle, montant, facteur, accent }: { libelle: string; montant: number; facteur: number; accent?: boolean }) {
  return (
    <div className={`mb-3 flex items-center justify-between rounded-lg px-3 py-2 ${accent ? 'bg-marque-fond ring-1 ring-marque/15' : 'bg-champ'}`}>
      <span className={`text-sm font-semibold ${accent ? 'text-marque' : 'text-corps'}`}>{libelle}</span>
      <span className={`chiffres text-sm font-bold tabular-nums ${accent ? 'text-marque' : 'text-titre'}`}>
        {formatDollars(montant * facteur)}
      </span>
    </div>
  );
}

/**
 * D'où vient le montant de « Dépenses ».
 *
 * La colonne affichait un produit de facteurs invisibles : le nombre grossissait chaque année
 * (inflation), chutait d'un tiers au premier décès (part du survivant) et dépassait la cible saisie
 * (versement hypothécaire ajouté par-dessus). Ce dernier est désormais une ligne de sortie ; les
 * deux autres facteurs s'expliquent ici.
 *
 * **La chaîne part toujours de la cible telle qu'elle a été saisie**, en dollars d'aujourd'hui : on
 * commence par le chiffre que l'utilisateur reconnaît, et l'on voit ce que le temps en fait. En
 * mode nominal une étape supplémentaire applique l'inflation ; en dollars d'aujourd'hui elle
 * n'aurait aucun effet et n'apparaît donc pas.
 *
 * Les étapes somment **exactement** au total, qui est celui de la cellule cliquée.
 */
export function BlocDepenses({
  d, facteur, reel, onRevenusNets,
}: {
  d: DetailDisponible;
  facteur: number;
  reel: boolean;
  onRevenusNets?: () => void;
}) {
  const c = d.detailDepenses;
  const trainDeVieReel = c.cibleSaisie * c.fractionSurvivant;

  const etapes: Poste[] = [{ libelle: 'Cible annuelle saisie', montant: c.cibleSaisie }];
  if (c.fractionSurvivant < 1) {
    etapes.push({
      libelle: `Part conservée par le survivant (${Math.round(c.fractionSurvivant * 100)} %)`,
      montant: -(c.cibleSaisie * (1 - c.fractionSurvivant)),
    });
  }
  if (!reel && c.facteurInflation > 1.0001) {
    etapes.push({
      // `toFixed` donne un point décimal : en fr-CA c'est une virgule.
      libelle: `Inflation cumulée (× ${c.facteurInflation.toLocaleString('fr-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})`,
      montant: trainDeVieReel * (c.facteurInflation - 1),
    });
  }

  const hypotheque = -(d.sorties.find((p) => p.libelle === 'Paiement hypothécaire')?.montant ?? 0);

  return (
    <>
      {/* facteur = 1 : les étapes sont déjà exprimées dans l'unité du total. */}
      <Section titre="Comment ce montant se construit" postes={etapes} facteur={1} />
      <LigneTotal libelle="= Dépenses de l'année" montant={d.depenses} facteur={facteur} accent />

      {hypotheque > 0.5 && (
        <p className="mb-3 rounded-lg bg-champ p-3 text-xs leading-relaxed text-doux">
          Le versement hypothécaire de{' '}
          <span className="chiffres font-medium text-corps">{formatDollars(hypotheque * facteur)}</span>{' '}
          n'est <strong>pas</strong> compris ici : il figure parmi les sorties du{' '}
          {onRevenusNets ? (
            <button type="button" onClick={onRevenusNets} className="font-medium text-marque underline decoration-dotted">
              revenu disponible
            </button>
          ) : (
            'revenu disponible'
          )}
          , au même titre que l'impôt.
        </p>
      )}

      <p className="text-xs leading-relaxed text-doux">
        {reel
          ? "Montants en dollars d'aujourd'hui : la cible saisie garde donc son pouvoir d'achat d'une année à l'autre."
          : "Montants en dollars de l'année : la cible saisie est indexée à l'inflation pour conserver le même pouvoir d'achat."}
      </p>
    </>
  );
}

/** Cascade du revenu disponible : entrées − sorties = nets, puis dépenses / surplus / destination. */
export function BlocDisponible({ d, facteur, onImpot }: { d: DetailDisponible; facteur: number; onImpot: () => void }) {
  return (
    <>
      <Section titre="Entrées de liquidités" postes={d.entrees} facteur={facteur} />
      <Section titre="Sorties" postes={d.sorties} facteur={facteur} onLienImpot={onImpot} />
      <LigneTotal libelle="Revenus nets" montant={d.revenusNets} facteur={facteur} />
      {d.depenses > 0.5 && (
        <>
          <LigneTotal libelle="− Dépenses visées" montant={-d.depenses} facteur={facteur} />
          <LigneTotal libelle="= Surplus épargné" montant={d.surplus} facteur={facteur} accent />
          <Section titre="Réinvesti dans" postes={d.destinationSurplus} facteur={facteur} />
        </>
      )}
    </>
  );
}

/** Détail fiscal d'une personne : revenu imposable, impôt fédéral/QC, décès, taux. */
export function BlocImpotFiscal({ t, facteur, titre }: { t: DetailImpotAnnee; facteur: number; titre?: string }) {
  return (
    <>
      {titre && <p className="mb-2 text-sm font-semibold text-corps">{titre}</p>}
      <Section titre="Revenu imposable (par source)" postes={t.revenuImposable} facteur={facteur} />
      <Section titre="Impôt fédéral" postes={t.federal} facteur={facteur} />
      <Section titre="Impôt du Québec" postes={t.quebec} facteur={facteur} />
      <LigneTotal libelle="Impôt de l'année" montant={t.impotCourant} facteur={facteur} />
      {t.impotDeces > 0.5 && (
        <>
          <Section titre="Impôt au décès — dispositions présumées" postes={t.detailDeces} facteur={facteur} />
          <LigneTotal libelle="Impôt au décès" montant={t.impotDeces} facteur={facteur} accent />
        </>
      )}
      <div className="mt-2 mb-4 flex gap-4 border-t border-filet pt-3 text-xs text-doux">
        <span>Taux moyen : <strong className="text-corps">{formatPourcent(t.tauxMoyen)}</strong></span>
        <span>Taux marginal : <strong className="text-corps">{formatPourcent(t.tauxMarginal)}</strong></span>
      </div>
    </>
  );
}

/** Valeur nette : comptes + immobilier + total. */
export function BlocValeurNette({ v, total, facteur }: { v: DetailValeurNette; total: number; facteur: number }) {
  return (
    <>
      <Section titre="Comptes de placement" postes={v.comptes} facteur={facteur} />
      <Section titre="Immobilier (équité : valeur − hypothèque)" postes={v.immobilier} facteur={facteur} />
      <LigneTotal libelle="Valeur nette" montant={total} facteur={facteur} accent />
    </>
  );
}
