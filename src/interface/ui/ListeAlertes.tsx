/** Anomalie détectée dans les données saisies. */
export interface AlerteAffichable {
  message: string;
  /** `erreur` = résultat certainement faux ; `attention` = à vérifier. */
  niveau: 'erreur' | 'attention';
}

/** Liste d'anomalies, affichée en tête du formulaire concerné. Partagée par les deux onglets. */
export function ListeAlertes({ alertes }: { alertes?: readonly AlerteAffichable[] }) {
  if (!alertes || alertes.length === 0) return null;
  return (
    <ul className="mb-4 space-y-2">
      {alertes.map((a, i) => (
        <li
          key={i}
          className={`flex gap-2 rounded-xl px-3.5 py-2.5 text-xs leading-relaxed ring-1 ${
            a.niveau === 'erreur'
              ? 'bg-rose-50/70 text-rose-800 ring-rose-500/20'
              : 'bg-amber-50/70 text-amber-800 ring-amber-500/20'
          }`}
        >
          <span aria-hidden="true">{a.niveau === 'erreur' ? '⛔' : '⚠️'}</span>
          <span>{a.message}</span>
        </li>
      ))}
    </ul>
  );
}
