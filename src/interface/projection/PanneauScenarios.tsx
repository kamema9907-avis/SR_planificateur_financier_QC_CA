import { useState } from 'react';
import { formatDollars } from '../format';
import { meilleurs, type LigneComparaison } from '../scenarios';

interface Props {
  lignes: readonly LigneComparaison[];
  /** Fige la simulation en cours sous un nom. */
  onEnregistrer: (nom: string) => void;
  /** Remplace la simulation en cours par le scénario choisi. */
  onCharger: (id: string) => void;
  onSupprimer: (id: string) => void;
  onRenommer: (id: string, nom: string) => void;
}

/** Pastille « meilleur de la colonne ». */
function Mieux({ actif }: { actif: boolean }) {
  if (!actif) return null;
  return (
    <span className="ml-1.5 rounded-full bg-marque-fond px-1.5 py-0.5 text-[10px] font-semibold text-marque ring-1 ring-marque/25">
      meilleur
    </span>
  );
}

/**
 * Tableau comparatif des scénarios enregistrés, la simulation en cours incluse.
 *
 * Chaque ligne est réévaluée avec le même moteur, donc les chiffres sont directement comparables :
 * c'est la différence entre « je crois que reporter la RRQ aide » et « reporter la RRQ vaut
 * 84 000 $ de patrimoine et 12 000 $ d'impôt en moins ».
 */
export function PanneauScenarios({ lignes, onEnregistrer, onCharger, onSupprimer, onRenommer }: Props) {
  const [nom, setNom] = useState('');
  const gagnants = meilleurs(lignes);
  const enregistres = lignes.filter((l) => !l.courant);

  return (
    <div className="carte p-5">
      <h3 className="font-semibold text-titre">Comparer des scénarios</h3>
      <p className="mt-1 mb-4 text-xs leading-relaxed text-doux">
        Enregistrez la simulation en cours sous un nom, modifiez vos hypothèses, enregistrez-en une
        autre : les chiffres se comparent ligne à ligne. Charger un scénario remplace la simulation
        en cours.
      </p>

      <form
        className="sansimpression mb-4 flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          onEnregistrer(nom);
          setNom('');
        }}
      >
        <input
          className="saisie w-56 text-left"
          value={nom}
          placeholder="Nom du scénario (ex. Retraite à 65)"
          aria-label="Nom du scénario à enregistrer"
          onChange={(e) => setNom(e.target.value)}
        />
        <button type="submit" className="bouton-marque">
          Enregistrer la simulation actuelle
        </button>
      </form>

      {enregistres.length === 0 ? (
        <p className="text-sm text-doux">
          Aucun scénario enregistré. Le premier servira de point de comparaison.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl ring-1 ring-bordure">
          <table className="w-full text-sm">
            <thead className="text-xs text-doux">
              <tr className="bg-champ">
                <th className="px-3 py-2 text-left font-medium">Scénario</th>
                <th className="px-3 py-2 text-left font-medium whitespace-nowrap">Dépenses financées</th>
                <th className="px-3 py-2 text-right font-medium whitespace-nowrap">Valeur nette au décès</th>
                <th className="px-3 py-2 text-right font-medium whitespace-nowrap">Impôt sur la vie</th>
                <th className="px-3 py-2 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-filet">
              {lignes.map((l) => (
                <tr key={l.id} className={l.courant ? 'bg-marque-fond/30' : ''}>
                  <td className="px-3 py-2">
                    {l.courant ? (
                      <span className="font-medium text-titre">
                        Simulation en cours
                        <span className="ml-1.5 text-xs font-normal text-doux">non enregistrée</span>
                      </span>
                    ) : (
                      <input
                        className="w-full rounded-md bg-transparent px-1 py-0.5 text-corps hover:bg-carte focus:bg-carte focus:ring-2 focus:ring-marque focus:outline-none"
                        value={l.nom}
                        aria-label={`Nom du scénario ${l.nom}`}
                        onChange={(e) => onRenommer(l.id, e.target.value)}
                      />
                    )}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {l.suffisant ? (
                      <span className="text-marque">jusqu'au bout</span>
                    ) : (
                      <span className="text-alerte">
                        jusqu'à <span className="chiffres">{l.ageEpuisement}</span> ans
                      </span>
                    )}
                    <Mieux actif={gagnants.autonomie.includes(l.id)} />
                  </td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    <span className="chiffres text-corps">{formatDollars(l.valeurNette)}</span>
                    <Mieux actif={gagnants.patrimoine.includes(l.id)} />
                  </td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    <span className="chiffres text-corps">{formatDollars(l.impotVie)}</span>
                    <Mieux actif={gagnants.impot.includes(l.id)} />
                  </td>
                  <td className="sansimpression px-3 py-2 text-right whitespace-nowrap">
                    {!l.courant && (
                      <span className="inline-flex gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm(`Charger « ${l.nom} » ? La simulation en cours sera remplacée.`))
                              onCharger(l.id);
                          }}
                          className="rounded-md px-2 py-1 text-xs font-medium text-corps ring-1 ring-bordure transition hover:bg-champ"
                        >
                          Charger
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm(`Supprimer « ${l.nom} » ?`)) onSupprimer(l.id);
                          }}
                          aria-label={`Supprimer ${l.nom}`}
                          className="rounded-md px-2 py-1 text-xs text-doux transition hover:bg-alerte-fond hover:text-alerte"
                        >
                          ✕
                        </button>
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
