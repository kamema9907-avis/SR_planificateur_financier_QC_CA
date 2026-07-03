import type { ResultatFiscal } from '../moteur';
import { formatDollars, formatDollarsCents, formatPourcent } from './format';

/** Une ligne de détail (libellé + montant). */
function Ligne({
  libelle,
  montant,
  sourdine = false,
  gras = false,
}: {
  libelle: string;
  montant: string;
  sourdine?: boolean;
  gras?: boolean;
}) {
  return (
    <div
      className={`flex items-baseline justify-between gap-4 py-1.5 ${
        gras ? 'font-semibold text-slate-900' : sourdine ? 'text-slate-500' : 'text-slate-700'
      }`}
    >
      <span className="text-sm">{libelle}</span>
      <span className="chiffres text-sm whitespace-nowrap">{montant}</span>
    </div>
  );
}

/** Barre de répartition empilée : revenu net / impôt fédéral / impôt Québec. */
function BarreRepartition({ r }: { r: ResultatFiscal }) {
  const total = Math.max(r.revenuTotalReel, 1);
  const net = Math.max(0, r.revenuApresImpot);
  const fed = Math.max(0, r.federal.impotNet);
  const qc = Math.max(0, r.quebec.impotNet);

  const segments = [
    { valeur: net, couleur: 'bg-marque-500', libelle: 'Revenu net' },
    { valeur: fed, couleur: 'bg-rose-400', libelle: 'Impôt fédéral' },
    { valeur: qc, couleur: 'bg-amber-400', libelle: 'Impôt Québec' },
  ];

  return (
    <div>
      <div className="flex h-4 w-full overflow-hidden rounded-full ring-1 ring-slate-200">
        {segments.map(
          (s) =>
            s.valeur > 0 && (
              <div
                key={s.libelle}
                className={`${s.couleur} transition-all duration-500`}
                style={{ width: `${(s.valeur / total) * 100}%` }}
                title={`${s.libelle} : ${formatDollars(s.valeur)}`}
              />
            ),
        )}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5">
        {segments.map((s) => (
          <div key={s.libelle} className="flex items-center gap-1.5">
            <span className={`h-2.5 w-2.5 rounded-full ${s.couleur}`} />
            <span className="text-xs text-slate-600">
              {s.libelle}{' '}
              <span className="chiffres font-medium text-slate-800">
                {formatPourcent(s.valeur / total)}
              </span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Tuile de statistique (taux). */
function TuileTaux({ label, valeur, aide }: { label: string; valeur: string; aide: string }) {
  return (
    <div className="carte p-4">
      <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">{label}</p>
      <p className="chiffres mt-1 text-2xl font-bold text-slate-900">{valeur}</p>
      <p className="mt-0.5 text-xs text-slate-400">{aide}</p>
    </div>
  );
}

export function Resultats({ r }: { r: ResultatFiscal }) {
  return (
    <div className="space-y-5">
      {/* Carte héro : revenu après impôt */}
      <div className="carte overflow-hidden">
        <div className="bg-gradient-to-br from-marque-600 to-marque-500 p-6 text-white">
          <p className="text-sm font-medium text-marque-50/90">Revenu net après impôt</p>
          <p className="chiffres mt-1 text-4xl font-bold tracking-tight sm:text-5xl">
            {formatDollars(r.revenuApresImpot)}
          </p>
          <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-sm text-marque-50/90">
            <span>
              Revenu total{' '}
              <span className="chiffres font-semibold text-white">
                {formatDollars(r.revenuTotalReel)}
              </span>
            </span>
            <span>
              Impôt total{' '}
              <span className="chiffres font-semibold text-white">
                {formatDollars(r.impotTotal)}
              </span>
            </span>
          </div>
        </div>
        <div className="p-6">
          <BarreRepartition r={r} />
        </div>
      </div>

      {/* Taux */}
      <div className="grid grid-cols-2 gap-4">
        <TuileTaux
          label="Taux moyen"
          valeur={formatPourcent(r.tauxMoyen)}
          aide="Part du revenu total payée en impôt"
        />
        <TuileTaux
          label="Taux marginal"
          valeur={formatPourcent(r.tauxMarginal)}
          aide="Impôt sur le prochain dollar gagné"
        />
      </div>

      {/* Détails fédéral + Québec */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="carte p-5">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="font-semibold text-slate-800">Fédéral</h3>
            <span className="h-2.5 w-2.5 rounded-full bg-rose-400" />
          </div>
          <div className="divide-y divide-slate-100">
            <Ligne libelle="Revenu imposable" montant={formatDollars(r.federal.revenuImposable)} sourdine />
            <Ligne libelle="Impôt selon les tranches" montant={formatDollarsCents(r.federal.impotParTranches)} sourdine />
            <Ligne libelle="Crédits non remboursables" montant={`− ${formatDollarsCents(r.federal.creditsNonRemboursables)}`} sourdine />
            {r.federal.creditDividendes > 0 && (
              <Ligne libelle="Crédit pour dividendes" montant={`− ${formatDollarsCents(r.federal.creditDividendes)}`} sourdine />
            )}
            <Ligne libelle="Abattement du Québec (16,5 %)" montant={`− ${formatDollarsCents(r.federal.abattementQuebec)}`} sourdine />
            {r.federal.creditFondsTravailleurs > 0 && (
              <Ligne libelle="Crédit fonds de travailleurs (15 %)" montant={`− ${formatDollarsCents(r.federal.creditFondsTravailleurs)}`} sourdine />
            )}
            {r.federal.recuperationPSV > 0 && (
              <Ligne libelle="Récupération de la PSV" montant={`+ ${formatDollarsCents(r.federal.recuperationPSV)}`} sourdine />
            )}
            <Ligne libelle="Impôt fédéral net" montant={formatDollars(r.federal.impotNet)} gras />
          </div>
        </div>

        <div className="carte p-5">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="font-semibold text-slate-800">Québec</h3>
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
          </div>
          <div className="divide-y divide-slate-100">
            <Ligne libelle="Revenu imposable" montant={formatDollars(r.quebec.revenuImposable)} sourdine />
            <Ligne libelle="Impôt selon les tranches" montant={formatDollarsCents(r.quebec.impotParTranches)} sourdine />
            <Ligne libelle="Crédits non remboursables" montant={`− ${formatDollarsCents(r.quebec.creditsNonRemboursables)}`} sourdine />
            {r.quebec.creditDividendes > 0 && (
              <Ligne libelle="Crédit pour dividendes" montant={`− ${formatDollarsCents(r.quebec.creditDividendes)}`} sourdine />
            )}
            {r.quebec.creditFondsTravailleurs > 0 && (
              <Ligne libelle="Crédit fonds de travailleurs (15 %)" montant={`− ${formatDollarsCents(r.quebec.creditFondsTravailleurs)}`} sourdine />
            )}
            <Ligne libelle="Impôt du Québec net" montant={formatDollars(r.quebec.impotNet)} gras />
          </div>
        </div>
      </div>
    </div>
  );
}
