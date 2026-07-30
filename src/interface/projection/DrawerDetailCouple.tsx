import { useEffect, useState } from 'react';
import type { AnneeCouple, DetailFractionnement } from '../../moteur';
import { BlocDepenses, BlocDisponible, BlocDroits, BlocImpotFiscal, BlocValeurNette, BlocVentes, LigneTotal } from './detailBriques';
import { formatDollars } from '../format';

/**
 * Agrégat décomposable au clic (couple).
 *
 * Les droits sont **par conjoint** : quatre vues, parce qu'un droit de cotisation n'existe pas au
 * niveau du ménage. Il appartient à une personne, se calcule sur SON salaire et s'éteint avec elle.
 */
export type AgregatCouple =
  | 'disponible' | 'impot' | 'fractionnement' | 'valeurNette' | 'depenses' | 'vente'
  | 'droitsCeli1' | 'droitsReer1' | 'droitsCeli2' | 'droitsReer2';

export interface VueDrawerCouple {
  agregat: AgregatCouple;
  annee: AnneeCouple;
}

const TITRES: Record<AgregatCouple, string> = {
  disponible: 'Revenu disponible',
  impot: 'Impôt du ménage',
  fractionnement: 'Fractionnement',
  valeurNette: 'Valeur nette',
  depenses: 'Dépenses du ménage',
  vente: 'Vente immobilière',
  droitsCeli1: 'Droits CELI',
  droitsReer1: 'Droits REER',
  droitsCeli2: 'Droits CELI',
  droitsReer2: 'Droits REER',
};

/** Les droits de cotisation sont toujours nominaux : la bascule d'affichage ne les concerne pas. */
const TOUJOURS_NOMINAL: readonly AgregatCouple[] = ['droitsCeli1', 'droitsReer1', 'droitsCeli2', 'droitsReer2'];

/** Détail du fractionnement du revenu de pension : transfert, impôt avec/sans, économie. */
function BlocFractionnement({ fr, facteur }: { fr: DetailFractionnement; facteur: number }) {
  const montant = Math.abs(fr.transfert);
  const de = fr.transfert >= 0 ? fr.nom1 : fr.nom2;
  const vers = fr.transfert >= 0 ? fr.nom2 : fr.nom1;
  return (
    <>
      <p className="mb-4 text-sm text-corps">
        {montant > 0.5 ? (
          <>
            Transfert de <strong className="chiffres">{formatDollars(montant * facteur)}</strong> de revenu de pension
            admissible, de <strong>{de}</strong> vers <strong>{vers}</strong>, pour équilibrer les revenus imposables.
          </>
        ) : (
          <>Aucun transfert n'était avantageux cette année (revenus déjà équilibrés, ou aucun revenu de pension admissible).</>
        )}
      </p>
      <LigneTotal libelle="Impôt du ménage SANS fractionnement" montant={fr.impotSans} facteur={facteur} />
      <LigneTotal libelle="Impôt du ménage AVEC fractionnement" montant={fr.impotAvec} facteur={facteur} />
      <LigneTotal libelle="Économie d'impôt" montant={fr.economie} facteur={facteur} accent />
    </>
  );
}

/** Panneau latéral de drill-down du couple (récursif). `vue` = null → fermé. */
export function DrawerDetailCouple({ vue, reel, onClose }: { vue: VueDrawerCouple | null; reel: boolean; onClose: () => void }) {
  const [pile, setPile] = useState<VueDrawerCouple[]>([]);
  useEffect(() => {
    setPile(vue ? [vue] : []);
  }, [vue]);

  const courante = pile[pile.length - 1];
  if (!courante) return null;

  const nominal = TOUJOURS_NOMINAL.includes(courante.agregat);
  const facteur = reel && !nominal ? courante.annee.deflateurReel : 1;
  const d = courante.annee.detail!;
  const pousser = (agregat: AgregatCouple) => setPile((p) => [...p, { agregat, annee: courante.annee }]);
  /** L'âge du conjoint concerné : il date la restauration des retraits CELI (« restaurés à N+1 ans »). */
  const agePersonne = (n: 1 | 2) => (n === 1 ? courante.annee.age1 : courante.annee.age2) ?? 0;

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-voile backdrop-blur-[1px]" onClick={onClose} />
      <div className="relative flex h-full w-full max-w-md flex-col bg-carte shadow-2xl">
        <div className="flex items-center justify-between border-b border-filet p-4">
          <div className="flex flex-wrap items-center gap-1.5">
            {pile.map((v, i) => (
              <span key={i} className="flex items-center gap-1.5">
                {i > 0 && <span className="text-doux">›</span>}
                <button
                  type="button"
                  onClick={() => setPile((p) => p.slice(0, i + 1))}
                  className={`text-sm ${i === pile.length - 1 ? 'font-semibold text-titre' : 'text-doux hover:text-corps'}`}
                >
                  {TITRES[v.agregat]}
                </button>
              </span>
            ))}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="flex h-7 w-7 items-center justify-center rounded-full text-doux transition hover:bg-panneau hover:text-corps"
          >
            ✕
          </button>
        </div>

        <div className="border-b border-filet px-4 py-2 text-xs text-doux">
          {courante.annee.age1 ?? '—'} / {courante.annee.age2 ?? '—'} ans · {courante.annee.annee} ·{' '}
          {nominal ? 'dollars nominaux (toujours)' : reel ? "dollars d'aujourd'hui" : 'dollars nominaux'}
        </div>

        <div className="flex-1 overflow-auto p-4">
          {courante.agregat === 'disponible' && <BlocDisponible d={d.disponible} facteur={facteur} onLien={pousser} />}
          {courante.agregat === 'impot' && (
            <>
              {d.impot1 && <BlocImpotFiscal t={d.impot1} facteur={facteur} titre={d.nom1} />}
              {d.impot2 && <BlocImpotFiscal t={d.impot2} facteur={facteur} titre={d.nom2} />}
              <LigneTotal libelle="Impôt du ménage" montant={d.impotMenage} facteur={facteur} accent />
              <button
                type="button"
                onClick={() => pousser('fractionnement')}
                className="mt-2 w-full rounded-md px-2 py-1.5 text-left text-sm font-medium text-marque hover:bg-marque-fond"
              >
                Voir le fractionnement du revenu de pension ›
              </button>
            </>
          )}
          {courante.agregat === 'fractionnement' && <BlocFractionnement fr={d.fractionnement} facteur={facteur} />}
          {courante.agregat === 'valeurNette' && <BlocValeurNette v={d.valeurNette} total={courante.annee.valeurNette} facteur={facteur} />}
          {courante.agregat === 'vente' && (
            <BlocVentes
              d={d.disponible}
              facteur={facteur}
              accumulation={courante.annee.phase === 'accumulation'}
              onImpot={() => pousser('impot')}
            />
          )}
          {courante.agregat === 'depenses' && (
            <BlocDepenses d={d.disponible} facteur={facteur} reel={reel} onRevenusNets={() => pousser('disponible')} />
          )}
          {nominal && (
            <>
              <p className="mb-3 text-sm font-semibold text-corps">
                {courante.agregat.endsWith('1') ? d.nom1 : d.nom2}
              </p>
              {courante.agregat === 'droitsCeli1' && d.droits1 && <BlocDroits d={d.droits1.celi} age={agePersonne(1)} celi />}
              {courante.agregat === 'droitsReer1' && d.droits1 && <BlocDroits d={d.droits1.reer} age={agePersonne(1)} celi={false} />}
              {courante.agregat === 'droitsCeli2' && d.droits2 && <BlocDroits d={d.droits2.celi} age={agePersonne(2)} celi />}
              {courante.agregat === 'droitsReer2' && d.droits2 && <BlocDroits d={d.droits2.reer} age={agePersonne(2)} celi={false} />}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
