import { useRef, type KeyboardEvent } from 'react';
import type { Etape } from './types';
import { idOnglet, idPanneau, progression } from './types';

interface Props {
  etapes: readonly Etape[];
  actif: string;
  onChoisir: (id: string) => void;
}

/** Pastille d'état : numéro, ✓ si l'étape porte des données, contour pointillé si facultative. */
function Pastille({ numero, rempli, actif, optionnel }: { numero: number; rempli: boolean; actif: boolean; optionnel: boolean }) {
  const base = 'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold transition';
  // `marque-700` et non `500` : le numéro est en blanc, sur 11 px gras — il lui faut 4,5:1.
  if (actif) return <span className={`${base} bg-marque-700 text-white`}>{numero}</span>;
  if (rempli) return <span className={`${base} bg-marque-50 text-marque-700 ring-1 ring-marque-500/30`}>✓</span>;
  if (optionnel) return <span className={`${base} text-slate-500 ring-1 ring-dashed ring-slate-300`}>{numero}</span>;
  return <span className={`${base} text-slate-500 ring-1 ring-slate-200`}>{numero}</span>;
}

/** Point d'alerte : une étape dont les données sont incohérentes se repère sans l'ouvrir. */
function Signal({ alertes }: { alertes: Etape['alertes'] }) {
  if (!alertes || alertes.length === 0) return null;
  const erreur = alertes.some((a) => a.niveau === 'erreur');
  return (
    <span
      title={alertes.map((a) => a.message).join('\n')}
      aria-label={`${alertes.length} ${erreur ? 'erreur(s)' : 'point(s) à vérifier'}`}
      className={`ml-auto h-2 w-2 shrink-0 rounded-full ${erreur ? 'bg-rose-500' : 'bg-amber-400'}`}
    />
  );
}

/**
 * Navigation entre les étapes : colonne à gauche sur grand écran, bande défilable au-dessus du
 * formulaire sur petit écran.
 *
 * **Sémantique de jeu d'onglets** (`tablist` / `tab` / `tabpanel`) : choisir une étape échange le
 * panneau affiché, exactement comme des onglets. Cela apporte deux choses concrètes :
 * - les flèches parcourent les étapes, et **une seule** d'entre elles est dans l'ordre de
 *   tabulation (« tabindex mobile »). Sans cela, atteindre le formulaire au clavier demandait de
 *   passer par les neuf étapes une à une.
 * - un lecteur d'écran annonce « onglet 3 sur 9, sélectionné » plutôt qu'une liste de boutons.
 */
export function RailEtapes({ etapes, actif, onChoisir }: Props) {
  const { faites, total } = progression(etapes);
  const liste = useRef<HTMLDivElement>(null);

  /** Flèches, Début et Fin : on déplace la sélection ET le focus, comme le veut le modèle onglets. */
  const auClavier = (e: KeyboardEvent, index: number) => {
    const dernier = etapes.length - 1;
    // Les deux paires de flèches sont acceptées : le rail est vertical sur grand écran et
    // horizontal sur téléphone, et l'utilisateur ne devrait pas avoir à s'en soucier.
    const cible =
      e.key === 'ArrowDown' || e.key === 'ArrowRight' ? Math.min(dernier, index + 1)
      : e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? Math.max(0, index - 1)
      : e.key === 'Home' ? 0
      : e.key === 'End' ? dernier
      : null;
    if (cible === null || cible === index) return;

    e.preventDefault(); // sinon les flèches font aussi défiler la page
    onChoisir(etapes[cible].id);
    liste.current?.querySelectorAll('button')[cible]?.focus();
  };

  return (
    <nav aria-label="Étapes de la saisie" className="sansimpression lg:sticky lg:top-6 lg:self-start">
      <div
        ref={liste}
        role="tablist"
        aria-label="Étapes de la saisie"
        className="flex gap-1.5 overflow-x-auto pb-2 lg:flex-col lg:gap-0.5 lg:overflow-visible lg:pb-0"
      >
        {etapes.map((e, i) => {
          const estActif = e.id === actif;
          return (
            <button
              key={e.id}
              type="button"
              role="tab"
              id={idOnglet(e.id)}
              aria-selected={estActif}
              aria-controls={idPanneau(e.id)}
              // Une seule étape reste atteignable par Tab : les autres se rejoignent aux flèches.
              tabIndex={estActif ? 0 : -1}
              onClick={() => onChoisir(e.id)}
              onKeyDown={(ev) => auClavier(ev, i)}
              className={`flex w-full shrink-0 items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition
                focus-visible:ring-2 focus-visible:ring-marque-500 focus-visible:outline-none lg:shrink ${
                  estActif
                    ? 'bg-white font-semibold text-slate-900 ring-1 ring-slate-200 shadow-sm'
                    : 'text-slate-600 hover:bg-white/60 hover:text-slate-800'
                }`}
            >
              <Pastille numero={i + 1} rempli={e.rempli} actif={estActif} optionnel={e.optionnel ?? false} />
              <span className="whitespace-nowrap lg:whitespace-normal">{e.titre}</span>
              <Signal alertes={e.alertes} />
            </button>
          );
        })}
      </div>

      <div className="mt-3 hidden px-2.5 lg:block">
        <div className="h-1 overflow-hidden rounded-full bg-slate-200">
          <div
            className="h-full rounded-full bg-marque-600 transition-all duration-500"
            style={{ width: `${total === 0 ? 0 : (faites / total) * 100}%` }}
          />
        </div>
        <p className="mt-1.5 text-xs text-slate-500">
          <span className="chiffres">{faites}</span> / {total} essentielles
        </p>
      </div>
    </nav>
  );
}
