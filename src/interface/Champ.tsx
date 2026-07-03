import { useId } from 'react';

interface ChampMonetaireProps {
  label: string;
  valeur: number;
  onChange: (valeur: number) => void;
  indice?: string;
}

/** Champ de saisie d'un montant en dollars, avec symbole « $ ». */
export function ChampMonetaire({ label, valeur, onChange, indice }: ChampMonetaireProps) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="etiquette mb-1.5">
        {label}
      </label>
      <div className="relative">
        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm font-medium text-slate-400">
          $
        </span>
        <input
          id={id}
          type="number"
          inputMode="decimal"
          min={0}
          step={100}
          className="saisie pl-7"
          value={valeur === 0 ? '' : valeur}
          placeholder="0"
          onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))}
        />
      </div>
      {indice && <p className="mt-1 text-xs text-slate-400">{indice}</p>}
    </div>
  );
}

interface ChampNombreProps {
  label: string;
  valeur: number;
  onChange: (valeur: number) => void;
  min?: number;
  max?: number;
}

/** Champ de saisie d'un nombre simple (ex. âge). */
export function ChampNombre({ label, valeur, onChange, min = 0, max = 120 }: ChampNombreProps) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="etiquette mb-1.5">
        {label}
      </label>
      <input
        id={id}
        type="number"
        min={min}
        max={max}
        className="saisie text-center"
        value={valeur}
        onChange={(e) => onChange(Math.min(max, Math.max(min, Number(e.target.value) || 0)))}
      />
    </div>
  );
}

interface InterrupteurProps {
  label: string;
  valeur: boolean;
  onChange: (valeur: boolean) => void;
}

/** Bascule oui/non (ex. « vit seul »). */
export function Interrupteur({ label, valeur, onChange }: InterrupteurProps) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3">
      <span className="etiquette">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={valeur}
        onClick={() => onChange(!valeur)}
        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
          valeur ? 'bg-marque-500' : 'bg-slate-300'
        }`}
      >
        <span
          className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
            valeur ? 'translate-x-5' : 'translate-x-0.5'
          }`}
        />
      </button>
    </label>
  );
}

interface ChampPourcentProps {
  label: string;
  /** Valeur stockée comme fraction (ex. 0,021 = 2,1 %). */
  valeur: number;
  onChange: (valeur: number) => void;
  indice?: string;
  pas?: number;
}

/** Champ de saisie d'un pourcentage (stocké comme fraction). */
export function ChampPourcent({ label, valeur, onChange, indice, pas = 0.1 }: ChampPourcentProps) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="etiquette mb-1.5">
        {label}
      </label>
      <div className="relative">
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm font-medium text-slate-400">
          %
        </span>
        <input
          id={id}
          type="number"
          inputMode="decimal"
          step={pas}
          className="saisie pr-7 text-right"
          value={Number((valeur * 100).toFixed(4))}
          onChange={(e) => onChange((Number(e.target.value) || 0) / 100)}
        />
      </div>
      {indice && <p className="mt-1 text-xs text-slate-400">{indice}</p>}
    </div>
  );
}

interface Option<T extends string> {
  valeur: T;
  label: string;
}

interface ChampSelectProps<T extends string> {
  label: string;
  valeur: T;
  options: readonly Option<T>[];
  onChange: (valeur: T) => void;
}

/** Liste déroulante générique. */
export function ChampSelect<T extends string>({ label, valeur, options, onChange }: ChampSelectProps<T>) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="etiquette mb-1.5">
        {label}
      </label>
      <select
        id={id}
        className="saisie text-left"
        value={valeur}
        onChange={(e) => onChange(e.target.value as T)}
      >
        {options.map((o) => (
          <option key={o.valeur} value={o.valeur}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

/** Titre de section du formulaire. */
export function TitreSection({ numero, titre }: { numero: number; titre: string }) {
  return (
    <div className="mb-4 flex items-center gap-2.5">
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-marque-50 text-xs font-bold text-marque-700 ring-1 ring-marque-500/20">
        {numero}
      </span>
      <h3 className="text-sm font-semibold tracking-wide text-slate-700 uppercase">{titre}</h3>
    </div>
  );
}
