import { useEffect, useMemo, useState } from 'react';
import { calculerImpot, entreeVide, type EntreeFiscale } from '../moteur';
import { BoutonReinitialiser, ChampMonetaire, ChampNombre, Interrupteur, TitreSection } from './Champ';
import { Resultats } from './Resultats';

const CLE_STOCKAGE = 'pf2026:entree';

/** Charge l'entrée sauvegardée localement, sinon une entrée vierge (champs à zéro). */
function chargerEntree(): EntreeFiscale {
  try {
    const brut = localStorage.getItem(CLE_STOCKAGE);
    if (brut) return { ...entreeVide(), ...JSON.parse(brut) };
  } catch {
    /* ignore */
  }
  return entreeVide();
}

/** Vue « Impôt (1 année) » — le calculateur d'impôt de la Phase 1. */
export function VueImpotAnnuel() {
  const [entree, setEntree] = useState<EntreeFiscale>(chargerEntree);

  useEffect(() => {
    try {
      localStorage.setItem(CLE_STOCKAGE, JSON.stringify(entree));
    } catch {
      /* ignore */
    }
  }, [entree]);

  const resultat = useMemo(() => calculerImpot(entree), [entree]);

  const maj = <K extends keyof EntreeFiscale>(cle: K, valeur: EntreeFiscale[K]) =>
    setEntree((e) => ({ ...e, [cle]: valeur }));

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-slate-400">Tes données restent sur ton appareil — rien n'est envoyé en ligne.</p>
          <BoutonReinitialiser onReset={() => setEntree(entreeVide())} />
        </div>
        <section className="carte p-6">
          <TitreSection numero={1} titre="Votre situation" />
          <div className="grid grid-cols-2 items-start gap-4">
            <ChampNombre label="Âge au 31 déc." valeur={entree.age} onChange={(v) => maj('age', v)} />
            <div className="pt-7">
              <Interrupteur label="Vit seul(e)" valeur={entree.vitSeul} onChange={(v) => maj('vitSeul', v)} />
            </div>
          </div>
        </section>

        <section className="carte p-6">
          <TitreSection numero={2} titre="Revenus" />
          <div className="grid gap-4 sm:grid-cols-2">
            <ChampMonetaire label="Revenu d'emploi (salaire)" valeur={entree.revenuEmploi} onChange={(v) => maj('revenuEmploi', v)} />
            <ChampMonetaire label="Autres revenus" valeur={entree.autresRevenus} onChange={(v) => maj('autresRevenus', v)} indice="Intérêts, loyers nets, entreprise" />
            <ChampMonetaire label="Rente RRQ / RPC" valeur={entree.revenuRRQ} onChange={(v) => maj('revenuRRQ', v)} indice="Imposable (sans crédit de pension)" />
            <ChampMonetaire label="Rente de survivant RRQ (avant 65 ans)" valeur={entree.renteSurvivantRRQ} onChange={(v) => maj('renteSurvivantRRQ', v)} indice="Imposable comme la RRQ (sans crédit de pension)" />
            <ChampMonetaire label="Pension Sécurité vieillesse" valeur={entree.revenuPensionSV} onChange={(v) => maj('revenuPensionSV', v)} indice="Assujettie à la récupération" />
            <ChampMonetaire label="Revenu de pension (FERR, rente)" valeur={entree.revenuPensionPrivee} onChange={(v) => maj('revenuPensionPrivee', v)} indice="FERR, rente viagère, RPA — donne droit au crédit" />
            <ChampMonetaire label="Dividendes déterminés" valeur={entree.dividendesDetermines} onChange={(v) => maj('dividendesDetermines', v)} indice="Grandes sociétés cotées" />
            <ChampMonetaire label="Dividendes ordinaires" valeur={entree.dividendesOrdinaires} onChange={(v) => maj('dividendesOrdinaires', v)} indice="Petites entreprises (SPCC)" />
            <ChampMonetaire label="Gains en capital" valeur={entree.gainsCapital} onChange={(v) => maj('gainsCapital', v)} indice="Actions, crypto, immeuble (50 % imposable)" />
          </div>
        </section>

        <section className="carte p-6">
          <TitreSection numero={3} titre="Déductions et crédits" />
          <div className="grid gap-4 sm:grid-cols-2">
            <ChampMonetaire label="Cotisation REER" valeur={entree.deductionReer} onChange={(v) => maj('deductionReer', v)} />
            <ChampMonetaire label="Autres déductions" valeur={entree.autresDeductions} onChange={(v) => maj('autresDeductions', v)} indice="RPA, pension alimentaire…" />
            <ChampMonetaire label="Cotisation syndicale / professionnelle" valeur={entree.cotisationSyndicale} onChange={(v) => maj('cotisationSyndicale', v)} indice="Déduction au fédéral, crédit de 10 % au Québec" />
            <ChampMonetaire label="Prime d'assurance-salaire" valeur={entree.primeAssuranceSalaire} onChange={(v) => maj('primeAssuranceSalaire', v)} indice={entree.assuranceSalaireDeductible ? 'Déduite du revenu' : 'Non déductible : réduit le net en poche'} />
          </div>
          {entree.primeAssuranceSalaire > 0 && (
            <div className="mt-3">
              <Interrupteur
                label="Prime d'assurance-salaire déductible du revenu"
                valeur={entree.assuranceSalaireDeductible}
                onChange={(v) => maj('assuranceSalaireDeductible', v)}
              />
            </div>
          )}
          <p className="mt-4 text-xs text-slate-400">
            Les cotisations <span className="font-medium text-slate-500">RRQ, assurance-emploi et RQAP</span> sont
            calculées automatiquement à partir de ton salaire et détaillées dans les résultats (crédits + déduction
            de la portion bonifiée du RRQ).
          </p>
          <div className="mt-5 rounded-xl bg-marque-50/60 p-4 ring-1 ring-marque-500/15">
            <Interrupteur
              label="Fonds de travailleurs (FTQ / Fondaction CSN)"
              valeur={entree.cotisationFondsTravailleurs > 0}
              onChange={(v) => maj('cotisationFondsTravailleurs', v ? 5_000 : 0)}
            />
            {entree.cotisationFondsTravailleurs > 0 && (
              <div className="mt-3">
                <ChampMonetaire
                  label="Montant investi"
                  valeur={entree.cotisationFondsTravailleurs}
                  onChange={(v) => maj('cotisationFondsTravailleurs', v)}
                  indice="Crédit de 30 % (15 % féd. + 15 % QC) sur le 1er 5 000 $. Si détenu dans un REER, inclure aussi ce montant dans la cotisation REER ci-dessus."
                />
              </div>
            )}
          </div>
        </section>
      </div>

      <div className="lg:sticky lg:top-6 lg:self-start">
        <Resultats r={resultat} />
      </div>
    </div>
  );
}
