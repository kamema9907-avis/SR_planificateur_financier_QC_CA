/** Briques d'affichage partagées par les drawers de drill-down (solo et couple). */
import type { DetailDisponible, DetailDroits, DetailImpotAnnee, DetailValeurNette, DetailVente, LienDetail, Poste } from '../../moteur';
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

/**
 * Une section titrée (liste de postes).
 *
 * `onLien` reçoit le TYPE de lien du poste, au lieu du seul cas « impôt » codé en dur : c'est ce qui
 * permet au produit de vente d'ouvrir sa propre décomposition.
 */
export function Section({ titre, postes, facteur, onLien }: {
  titre: string;
  postes: readonly Poste[];
  facteur: number;
  onLien?: (lien: LienDetail) => void;
}) {
  if (postes.length === 0) return null;
  return (
    <div className="mb-4">
      <p className="mb-1 text-xs font-semibold tracking-wide text-doux uppercase">{titre}</p>
      <div className="divide-y divide-filet">
        {postes.map((p, i) => (
          <LignePoste
            key={i}
            poste={p}
            facteur={facteur}
            onLien={p.lien && onLien ? () => onLien(p.lien!) : undefined}
          />
        ))}
      </div>
    </div>
  );
}

/** Somme de postes, pour un total dérivé de la liste affichée (donc toujours d'accord avec elle). */
const sommePostesLocaux = (postes: readonly Poste[]) => postes.reduce((s, p) => s + p.montant, 0);

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

/**
 * Anatomie d'une vente immobilière.
 *
 * Le produit était un nombre sans origine, et le remboursement de l'hypothèque restait **implicite**
 * : soustrait à l'intérieur du calcul, il n'apparaissait jamais. On ne pouvait que le déduire de la
 * disparition du versement et de la chute de l'équité à zéro.
 *
 * La chaîne somme exactement, et sa dernière ligne correspond au capital réellement investi.
 * L'impôt affiché est celui **réellement supporté** : la provision retenue à la vente, moins ce
 * qu'une déduction REER a pu absorber. C'est une convention d'attribution — l'impôt porte sur le
 * revenu total de l'année, il n'existe pas d'impôt « par bien » — et la phrase finale le dit.
 */
export function BlocVentes({
  d, facteur, accumulation, onImpot,
}: {
  d: DetailDisponible;
  facteur: number;
  /** En accumulation le net est intégralement placé ; en décaissement il finance d'abord les dépenses. */
  accumulation: boolean;
  onImpot?: () => void;
}) {
  if (d.ventes.length === 0) return null;

  const pourcent = (f: number) => `${Math.round(f * 100)} %`;
  const impotTotal = d.ventes.reduce((s, v) => s + v.impotSupporte, 0);

  return (
    <>
      {d.ventes.map((v: DetailVente, i) => {
        const etapes: Poste[] = [{ libelle: 'Valeur au moment de la vente', montant: v.valeurVente }];
        // Un bien sans hypothèque n'a rien à rembourser : afficher « − 0 $ » serait du bruit.
        if (v.soldeRembourse > 0.5) {
          etapes.push({ libelle: 'Solde hypothécaire remboursé', montant: -v.soldeRembourse });
        }
        return (
          <div key={i} className={i > 0 ? 'mt-6 border-t border-filet pt-4' : ''}>
            <p className="mb-2 text-sm font-semibold text-corps">{v.nom}</p>

            <Section titre="Ce que la vente libère" postes={etapes} facteur={facteur} />
            {v.fractionVendue < 1 ? (
              <>
                <LigneTotal libelle="= Équité libérée" montant={v.valeurVente - v.soldeRembourse} facteur={facteur} />
                <p className="mb-3 text-xs leading-relaxed text-doux">
                  Vente partielle de <strong>{pourcent(v.fractionVendue)}</strong> : le reste du bien est
                  conservé, sans hypothèque.
                </p>
              </>
            ) : null}
            <LigneTotal libelle="= Produit de la vente" montant={v.produitBrut} facteur={facteur} />

            {v.exempte ? (
              <p className="mb-3 rounded-lg bg-champ p-3 text-xs leading-relaxed text-doux">
                Résidence principale <strong>exemptée</strong> : le gain de{' '}
                <span className="chiffres font-medium text-corps">
                  {formatDollars(v.gainBrutAvantExemption * facteur)}
                </span>{' '}
                n'est pas imposable, et rien n'est retenu sur le produit.
              </p>
            ) : (
              <>
                <Section
                  titre="Impôt du gain"
                  postes={[
                    { libelle: 'Gain en capital réalisé', montant: v.gainImposable, lien: onImpot ? 'impot' : undefined },
                    { libelle: 'Impôt supporté à cause du gain', montant: -v.impotSupporte },
                  ]}
                  facteur={facteur}
                  onLien={onImpot ? () => onImpot() : undefined}
                />
                <LigneTotal
                  libelle={accumulation ? '= Produit net placé' : "= Produit net d'impôt"}
                  montant={v.netApresImpot}
                  facteur={facteur}
                  accent
                />
              </>
            )}
          </div>
        );
      })}

      {/* La ventilation ne vaut que si la vente est le seul capital placé de l'année. */}
      {accumulation &&
        (d.ventesSeuleSourceDeCapital ? (
          <Section titre="Placé dans" postes={d.destinationSurplus} facteur={facteur} />
        ) : (
          <p className="mb-3 text-xs leading-relaxed text-doux">
            Un héritage a été reçu la même année : le produit de la vente et cet héritage sont placés
            d'un seul bloc, la répartition entre comptes ne peut donc pas être attribuée à la vente
            seule.
          </p>
        ))}

      {impotTotal > 0.5 && (
        <p className="text-xs leading-relaxed text-doux">
          L'impôt indiqué est celui que le gain a <strong>réellement</strong> coûté : l'impôt de
          l'année, moins ce qu'il aurait été sans ce gain. C'est une attribution du modèle, pas une
          ligne de déclaration — l'impôt porte sur le revenu total de l'année.
        </p>
      )}
    </>
  );
}

/** Cascade du revenu disponible : entrées − sorties = nets, puis dépenses / surplus / destination. */
export function BlocDisponible({ d, facteur, onLien }: {
  d: DetailDisponible;
  facteur: number;
  onLien: (lien: LienDetail) => void;
}) {
  return (
    <>
      <Section titre="Entrées de liquidités" postes={d.entrees} facteur={facteur} onLien={onLien} />
      <Section titre="Sorties" postes={d.sorties} facteur={facteur} onLien={onLien} />
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

/**
 * Évolution d'un compteur de droits de cotisation sur l'année.
 *
 * `facteur` vaut toujours 1 : ce bloc ignore délibérément la bascule « dollars d'aujourd'hui ». Un
 * droit de cotisation est une quantité légale **nominale** — celle de votre avis de l'ARC — et
 * l'ajout annuel du CELI, arrondi au 500 $ avant indexation, se mettrait à osciller une fois
 * déflaté (7 000 $, puis 6 856 $, puis 7 194 $…) alors qu'il progresse par paliers nets.
 *
 * La chaîne somme **exactement** au restant, qui est le compteur du moteur lui-même et non une
 * reconstitution : c'est ce qui rend le calcul vérifiable ligne à ligne.
 */
export function BlocDroits({ d, age, celi }: { d: DetailDroits; age: number; celi: boolean }) {
  const rien = d.ajouts.length === 0 && d.consommations.length === 0;
  return (
    <>
      <LigneTotal libelle="Report au 1er janvier" montant={d.report} facteur={1} />
      <Section titre="Ajouts de l’année" postes={d.ajouts} facteur={1} />
      <Section titre="Consommation des droits" postes={d.consommations} facteur={1} />
      <LigneTotal libelle="= Droits restants au 31 décembre" montant={d.restant} facteur={1} accent />

      {d.salaireRetenu > 0.5 && (
        <p className="mb-3 rounded-lg bg-champ p-3 text-xs leading-relaxed text-doux">
          Le 18 % porte sur un salaire de{' '}
          <span className="chiffres font-medium text-corps">{formatDollars(d.salaireRetenu)}</span>,
          en dollars de l’année — c’est le salaire d’aujourd’hui indexé, pas celui que vous avez saisi.
        </p>
      )}

      {d.aRestaurerLAnProchain > 0.5 && (
        <p className="mb-3 rounded-lg bg-champ p-3 text-xs leading-relaxed text-doux">
          <span className="chiffres font-medium text-corps">{formatDollars(d.aRestaurerLAnProchain)}</span>{' '}
          ont été retirés du CELI cette année. Ces droits ne reviennent <strong>pas</strong> tout de
          suite : ils seront restaurés le 1<sup>er</sup> janvier de vos {age + 1} ans, et figureront
          dans les ajouts de cette année-là.
        </p>
      )}

      {rien && !celi && d.salaireRetenu === 0 && (
        <p className="mb-3 rounded-lg bg-champ p-3 text-xs leading-relaxed text-doux">
          Aucun salaire cette année, donc aucun droit REER neuf. Les droits inutilisés se reportent{' '}
          <strong>indéfiniment</strong> : ce montant ne se perd pas, il attend.
        </p>
      )}

      <p className="text-xs leading-relaxed text-doux">
        Montants <strong>nominaux</strong>, quelle que soit la bascule d’affichage : un droit de
        cotisation est le chiffre de votre avis de l’ARC pour cette année-là.
        {celi
          ? ' Les droits CELI croissent d’environ 7 000 $ par an (indexé, arrondi au 500 $) et un retrait les redonne l’année suivante.'
          : ' Les droits REER neufs valent 18 % du salaire, plafonnés, moins le facteur d’équivalence d’un régime d’employeur.'}
      </p>
    </>
  );
}

/**
 * Valeur nette : comptes + immobilier + total, puis les deux événements qui déplacent l'argent au
 * décès — le **roulement** au conjoint survivant, et l'**impôt des dispositions présumées**.
 *
 * Le total du tableau est **brut** : c'est la somme des soldes, et elle doit le rester pour que la
 * liste ci-dessus s'additionne. Le panneau de synthèse, lui, annonce la valeur nette « après impôt au
 * décès ». Sans les lignes finales, ces deux chiffres différeraient sans explication — ce qui est
 * précisément ce qui a permis à l'écart de passer inaperçu si longtemps en mode solo.
 */
export function BlocValeurNette({ v, total, facteur, onImpot }: {
  v: DetailValeurNette;
  total: number;
  facteur: number;
  onImpot?: () => void;
}) {
  const impot = v.impotDeces;
  const roule = sommePostesLocaux(v.roulement);
  return (
    <>
      <Section titre="Comptes de placement" postes={v.comptes} facteur={facteur} />
      <Section titre="Immobilier (équité : valeur − hypothèque)" postes={v.immobilier} facteur={facteur} />
      <LigneTotal libelle="Valeur nette" montant={total} facteur={facteur} accent={impot <= 0.5} />

      {v.roulement.length > 0 && v.roulementVers && (
        <>
          <Section titre="Roulement au conjoint survivant" postes={v.roulement} facteur={facteur} />
          <LigneTotal libelle={`= Transmis à ${v.roulementVers}`} montant={roule} facteur={facteur} />
          <p className="mb-3 rounded-lg bg-champ p-3 text-xs leading-relaxed text-doux">
            <strong>Aucun impôt</strong> sur ce transfert : le roulement au conjoint est à
            <strong> imposition différée</strong>, pas exonéré. Ces comptes changent simplement de
            titulaire ; l'impôt viendra au second décès, sur le patrimoine réuni. C'est pourquoi les
            soldes de <strong>{v.roulementVers}</strong> bondissent l'année suivante.
          </p>
        </>
      )}

      {impot > 0.5 && (
        <>
          <Section
            titre="Dispositions présumées au décès"
            postes={[{ libelle: 'Impôt au décès', montant: -impot, lien: onImpot ? 'impot' : undefined }]}
            facteur={facteur}
            onLien={onImpot ? () => onImpot() : undefined}
          />
          <LigneTotal libelle="= Patrimoine transmis" montant={total - impot} facteur={facteur} accent />
          <p className="text-xs leading-relaxed text-doux">
            C'est ce montant, et non le total brut, que le panneau annonce comme{' '}
            <strong>valeur nette au décès</strong> : au décès, les comptes enregistrés sont réputés
            liquidés et les gains latents réalisés.
          </p>
        </>
      )}
    </>
  );
}
