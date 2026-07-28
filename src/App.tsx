import { useRoute, type Onglet } from './interface/routage';
import { VueImpotAnnuel } from './interface/VueImpotAnnuel';
import { VueProjection } from './interface/projection/VueProjection';
import { BasculeTheme } from './interface/ui/BasculeTheme';
import { BoutonsDossier } from './interface/ui/BoutonsDossier';
import { IconeCadenas, IconeCourbe } from './interface/ui/icones';
import { BoutonImprimer, ImpressionProvider } from './interface/ui/Impression';
import { ModeDetailProvider } from './interface/ui/ModeDetail';
import { PartConsommeeProvider } from './interface/projection/partConsommee';

const ONGLETS: { id: Onglet; label: string; sous: string }[] = [
  { id: 'impot', label: 'Impôt', sous: '1 année' },
  { id: 'projection', label: 'Projection', sous: 'cycle de vie' },
];

export function App() {
  const { route, naviguer } = useRoute();
  const onglet = route.onglet;

  return (
    <ModeDetailProvider>
    <PartConsommeeProvider>
    <ImpressionProvider>
    <div className="min-h-screen">
      <header className="border-b border-bordure/70 bg-carte/60 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-marque-500 to-sky-500 text-white shadow-sm">
              <IconeCourbe />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-titre">
                Planificateur Financier <span className="text-marque">2026</span>
              </h1>
              <p className="text-xs text-doux">Québec + fédéral</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <BasculeTheme />
            <BoutonsDossier />
            <BoutonImprimer />
            <span className="inline-flex items-center gap-1.5 rounded-full bg-marque-fond px-3 py-1.5 text-xs font-medium text-marque ring-1 ring-marque/20">
              <IconeCadenas />
              100 % local — vos données restent sur votre appareil
            </span>
          </div>
        </div>

        {/* Onglets */}
        <div className="mx-auto max-w-7xl px-4 sm:px-6 sansimpression">
          <nav className="flex gap-1">
            {ONGLETS.map((o) => {
              const actif = o.id === onglet;
              return (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => naviguer({ onglet: o.id })}
                  aria-current={actif ? 'page' : undefined}
                  className={`-mb-px flex items-baseline gap-1.5 border-b-2 px-4 py-2.5 text-sm font-medium transition ${
                    actif
                      ? 'border-marque text-marque'
                      : 'border-transparent text-doux hover:text-corps'
                  }`}
                >
                  {o.label}
                  <span className="text-xs font-normal text-doux">{o.sous}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        {onglet === 'impot' ? <VueImpotAnnuel /> : <VueProjection />}

        <p className="mx-auto mt-10 max-w-3xl text-center text-xs leading-relaxed text-doux">
          Outil de calcul et de simulation à des fins de planification personnelle. Les montants sont
          des estimations (fidélité « planification ») calibrées sur les barèmes fédéraux et québécois
          2026 et les Normes d'hypothèses de projection IQPF ; certains crédits mineurs, cotisations
          (RRQ, AE, RQAP) et mécaniques (max FRV, CELIAPP, REEE) sont simplifiés. Ne constitue pas un
          avis fiscal ou financier personnalisé.
        </p>
      </main>
    </div>
    </ImpressionProvider>
    </PartConsommeeProvider>
    </ModeDetailProvider>
  );
}
