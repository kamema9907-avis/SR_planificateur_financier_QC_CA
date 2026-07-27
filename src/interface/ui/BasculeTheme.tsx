/** Choix du thème : Système, Clair, Sombre. Même forme que la bascule Essentiel / Avancé. */
import { useTheme, type Theme } from '../theme';
import { IconeEcran, IconeLune, IconeSoleil } from './icones';

const CHOIX: { v: Theme; label: string; titre: string; Icone: (p: { classe?: string }) => React.ReactElement }[] = [
  { v: 'systeme', label: 'Système', titre: 'Suit le réglage de votre appareil', Icone: IconeEcran },
  { v: 'clair', label: 'Clair', titre: 'Toujours en clair', Icone: IconeSoleil },
  { v: 'sombre', label: 'Sombre', titre: 'Toujours en sombre', Icone: IconeLune },
];

export function BasculeTheme() {
  const { choix, choisir } = useTheme();

  return (
    <div
      role="radiogroup"
      aria-label="Thème de l'affichage"
      className="sansimpression inline-flex rounded-lg bg-panneau p-0.5 ring-1 ring-bordure"
    >
      {CHOIX.map(({ v, label, titre, Icone }) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={choix === v}
          title={titre}
          onClick={() => choisir(v)}
          className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition
            focus-visible:ring-2 focus-visible:ring-marque focus-visible:outline-none ${
              choix === v ? 'bg-carte text-marque shadow-sm' : 'text-corps hover:text-titre'
            }`}
        >
          <Icone classe="h-3.5 w-3.5" />
          {/* Le libellé disparaît sur téléphone : trois mots de plus dans un en-tête déjà chargé. */}
          <span className="hidden sm:inline">{label}</span>
        </button>
      ))}
    </div>
  );
}
