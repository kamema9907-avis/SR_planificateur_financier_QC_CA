import { useState } from 'react';
import { VueImpotAnnuel } from './interface/VueImpotAnnuel';
import { VueProjection } from './interface/projection/VueProjection';

type Onglet = 'impot' | 'projection';

const ONGLETS: { id: Onglet; label: string; sous: string }[] = [
  { id: 'impot', label: 'Impôt', sous: '1 année' },
  { id: 'projection', label: 'Projection', sous: 'cycle de vie' },
];

export function App() {
  const [onglet, setOnglet] = useState<Onglet>('impot');

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200/70 bg-white/60 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-marque-500 to-sky-500 shadow-sm">
              <svg viewBox="0 0 24 24" className="h-6 w-6 text-white" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 16 L10 10 L14 13 L20 6" />
                <circle cx="20" cy="6" r="1.4" fill="currentColor" stroke="none" />
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-slate-900">
                Planificateur Financier <span className="text-marque-600">2026</span>
              </h1>
              <p className="text-xs text-slate-500">Québec + fédéral</p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-marque-50 px-3 py-1.5 text-xs font-medium text-marque-700 ring-1 ring-marque-500/20">
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
              <rect x="5" y="11" width="14" height="10" rx="2" />
              <path d="M8 11V7a4 4 0 0 1 8 0v4" />
            </svg>
            100 % local — vos données restent sur votre appareil
          </span>
        </div>

        {/* Onglets */}
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <nav className="flex gap-1">
            {ONGLETS.map((o) => {
              const actif = o.id === onglet;
              return (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => setOnglet(o.id)}
                  className={`-mb-px flex items-baseline gap-1.5 border-b-2 px-4 py-2.5 text-sm font-medium transition ${
                    actif
                      ? 'border-marque-500 text-marque-700'
                      : 'border-transparent text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {o.label}
                  <span className="text-xs font-normal text-slate-400">{o.sous}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        {onglet === 'impot' ? <VueImpotAnnuel /> : <VueProjection />}

        <p className="mx-auto mt-10 max-w-3xl text-center text-xs leading-relaxed text-slate-400">
          Outil de calcul et de simulation à des fins de planification personnelle. Les montants sont
          des estimations (fidélité « planification ») calibrées sur les barèmes fédéraux et québécois
          2026 et les Normes d'hypothèses de projection IQPF ; certains crédits mineurs, cotisations
          (RRQ, AE, RQAP) et mécaniques (max FRV, CELIAPP, REEE) sont simplifiés. Ne constitue pas un
          avis fiscal ou financier personnalisé.
        </p>
      </main>
    </div>
  );
}
