import { useMemo, type ReactNode } from 'react';
import { useRoute } from '../routage';
import { Aide } from '../ui/Aide';
import { useImpression } from '../ui/Impression';
import { ListeAlertes } from '../ui/ListeAlertes';
import { RailEtapes } from './RailEtapes';
import { idOnglet, idPanneau } from './types';
import type { Groupe } from './types';

interface Props {
  /** Un seul groupe en solo (la barre de groupes est alors masquée) ; trois en couple. */
  groupes: readonly Groupe[];
  /** Colonne de droite : elle reste visible pendant toute la saisie. */
  resultat: ReactNode;
  /** Contenu pleine largeur sous l'atelier (graphique détaillé, tableaux année par année). */
  dessous?: ReactNode;
  /** Actions alignées à droite de la barre supérieure (« Réinitialiser »). */
  actions?: ReactNode;
}

/**
 * Coquille de saisie à trois zones : rail d'étapes, étape courante, résultat collant.
 *
 * Le principe : la saisie occupe une zone bornée et le résultat ne quitte jamais l'écran. La page
 * de projection atteignait ~3 200 px en solo et ~6 000 px en couple, les résultats se trouvant sous
 * les formulaires — modifier un champ et voir son effet demandait de défiler.
 *
 * Toutes les étapes du groupe actif sont montées, les inactives masquées par `hidden` : l'état
 * interne des sous-composants (le calculateur RREGOP, par exemple) survit à la navigation.
 */
export function Atelier({ groupes, resultat, dessous, actions }: Props) {
  /**
   * Le groupe et l'étape vivent dans l'URL, pas dans un état local : on peut recharger la page,
   * revenir en arrière, ou envoyer un lien qui ouvre l'étape exacte. Une valeur absente ou inconnue
   * retombe sur le premier élément, ce qui rend tout lien approximatif inoffensif.
   */
  const { route, naviguer } = useRoute();
  /** À l'impression, toutes les étapes sont dépliées : un PDF d'une étape sur huit ne sert à rien. */
  const impression = useImpression();

  const groupe = groupes.find((g) => g.id === route.groupe) ?? groupes[0];
  const etapes = groupe.etapes;
  const index = Math.max(0, etapes.findIndex((e) => e.id === route.etape));
  const etape = etapes[index];

  /**
   * On réécrit toujours le groupe, même s'il n'a pas changé : sur une adresse comme
   * `#/projection/couple` (groupe implicite), une étape seule serait refusée à l'écriture, car
   * `#/projection/couple/situation` se relirait comme un groupe nommé « situation ».
   */
  const allerA = (id: string) => naviguer({ groupe: groupe.id, etape: id });

  /** Changer de personne conserve l'étape courante si elle existe aussi chez l'autre. */
  const changerGroupe = (id: string) => {
    const cible = groupes.find((g) => g.id === id);
    if (!cible) return;
    const etapeCible = cible.etapes.some((e) => e.id === etape.id) ? etape.id : cible.etapes[0].id;
    naviguer({ groupe: id, etape: etapeCible });
  };

  const aller = (delta: number) => {
    const suivant = etapes[index + delta];
    if (suivant) allerA(suivant.id);
  };

  const ongletsGroupes = useMemo(() => groupes.length > 1, [groupes.length]);

  return (
    <div className="space-y-6">
      {(ongletsGroupes || actions) && (
        <div className="sansimpression flex flex-wrap items-center justify-between gap-3">
          {ongletsGroupes ? (
            <div className="inline-flex flex-wrap rounded-xl bg-slate-100 p-1 ring-1 ring-slate-200">
              {groupes.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => changerGroupe(g.id)}
                  className={`rounded-lg px-4 py-1.5 text-sm font-medium transition focus-visible:ring-2
                    focus-visible:ring-marque-500 focus-visible:outline-none ${
                      g.id === groupe.id ? 'bg-white text-marque-700 shadow-sm' : 'text-slate-600 hover:text-slate-800'
                    }`}
                >
                  {g.label}
                </button>
              ))}
            </div>
          ) : (
            <span />
          )}
          {actions}
        </div>
      )}

      {/*
        `min-w-0` sur chaque colonne n'est pas décoratif : un enfant de grille vaut `min-width:auto`,
        c'est-à-dire « au moins la largeur de mon contenu ». Sans lui, le rail (dont les titres sont
        en `whitespace-nowrap`) imposait sa largeur naturelle — 1 358 px — à toute la page, qui
        débordait alors de 968 px sur un téléphone. Avec `min-w-0`, la colonne accepte de rétrécir
        et l'`overflow-x-auto` du rail reprend son rôle.
      */}
      <div className="grid gap-6 lg:grid-cols-[12rem_minmax(0,1fr)_21rem]">
        {/* Rail — en tête sur petit écran, colonne à gauche sur grand écran */}
        <div className="order-1 min-w-0 lg:order-none">
          <RailEtapes etapes={etapes} actif={etape.id} onChoisir={allerA} />
        </div>

        {/* Résultat — juste sous le rail en mobile, colonne de droite collante en grand écran */}
        <div className="order-2 min-w-0 lg:order-last lg:sticky lg:top-6 lg:self-start">{resultat}</div>

        {/* Étape courante */}
        <div className="order-3 min-w-0 space-y-4 lg:order-none">
          {etapes.map((e, i) => (
            <section
              key={e.id}
              role="tabpanel"
              id={idPanneau(e.id)}
              aria-labelledby={idOnglet(e.id)}
              className="carte p-6"
              hidden={!impression && e.id !== etape.id}
            >
              <header className="mb-4">
                <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">
                  Étape {i + 1} sur {etapes.length}
                  {e.optionnel && ' · facultative'}
                </p>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-semibold text-slate-900">{e.titre}</h3>
                  {e.aide && <Aide titre={e.titre}>{e.aide}</Aide>}
                </div>
                {e.description && <p className="mt-1 text-xs leading-relaxed text-slate-500">{e.description}</p>}
              </header>
              <ListeAlertes alertes={e.alertes} />
              {e.contenu}
            </section>
          ))}

          <div className="mt-4 flex items-center justify-between gap-3 sansimpression">
            <button
              type="button"
              onClick={() => aller(-1)}
              disabled={index === 0}
              className="bouton-secondaire disabled:cursor-not-allowed disabled:opacity-40"
            >
              ‹ Précédent
            </button>
            <button
              type="button"
              onClick={() => aller(1)}
              disabled={index === etapes.length - 1}
              className="bouton-secondaire disabled:cursor-not-allowed disabled:opacity-40"
            >
              Suivant ›
            </button>
          </div>
        </div>
      </div>

      {dessous}
    </div>
  );
}
