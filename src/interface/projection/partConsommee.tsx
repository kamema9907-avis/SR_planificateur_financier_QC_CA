/**
 * Part du maximum soutenable qu'on accepte de consommer (85 % par défaut).
 *
 * **Pourquoi un contexte et non le dossier.** Ce n'est pas une donnée financière : le moteur ne s'en
 * sert jamais, elle ne change aucun calcul de projection. C'est une convention d'affichage, au même
 * titre que le thème ou le mode Avancé — d'où sa propre clé de stockage, en dehors des hypothèses.
 *
 * **Pourquoi un contexte et non un `useState` local.** Le champ de réglage et la suggestion vivent
 * dans deux composants différents. Deux `useState` séparés ne se verraient pas : bouger le curseur
 * ne changerait le montant recommandé qu'au prochain rechargement.
 *
 * Voir `PLAN_DEPENSE_RECOMMANDEE.md`, décision n° 4.
 */
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { FRACTION_CONSOMMEE_DEFAUT } from '../../moteur';
import { ChampPourcent } from '../Champ';

const CLE_STOCKAGE = 'pf2026:partConsommee';

/** Bornes de saisie : en dessous la suggestion n'a plus de sens, au-dessus ce n'est plus prudent. */
const MIN = 0.5;
const MAX = 1;

const Contexte = createContext<{ part: number; setPart: (v: number) => void }>({
  part: FRACTION_CONSOMMEE_DEFAUT,
  setPart: () => {},
});

function lire(): number {
  try {
    const brut = Number(localStorage.getItem(CLE_STOCKAGE));
    if (Number.isFinite(brut) && brut >= MIN && brut <= MAX) return brut;
  } catch {
    /* stockage indisponible : on retombe sur la convention */
  }
  return FRACTION_CONSOMMEE_DEFAUT;
}

export function PartConsommeeProvider({ children }: { children: ReactNode }) {
  const [part, setPartEtat] = useState(lire);

  useEffect(() => {
    try {
      localStorage.setItem(CLE_STOCKAGE, String(part));
    } catch {
      /* le réglage vaut alors pour la session seulement */
    }
  }, [part]);

  const setPart = (v: number) => setPartEtat(Math.min(MAX, Math.max(MIN, v)));

  return <Contexte.Provider value={{ part, setPart }}>{children}</Contexte.Provider>;
}

export const usePartConsommee = () => useContext(Contexte);

/** Le réglage lui-même, à placer dans un bloc `<Avance>` à côté de l'inflation et des frais. */
export function ChampPartConsommee() {
  const { part, setPart } = usePartConsommee();
  return (
    <ChampPourcent
      label="Part du maximum consommée"
      valeur={part}
      onChange={setPart}
      indice="Convention de prudence, 85 % par défaut"
      pas={1}
    />
  );
}
