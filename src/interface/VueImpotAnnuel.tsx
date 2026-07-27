import { useMemo } from 'react';
import { calculerImpot, entreeVide, type EntreeFiscale } from '../moteur';
import { BoutonReinitialiser, ChampMonetaire, ChampNombre, Interrupteur, TitreSection } from './Champ';
import { Resultats } from './Resultats';
import { ListeAlertes } from './ui/ListeAlertes';
import { Avance, BasculeAvance } from './ui/ModeDetail';
import { useDossier } from './useDossier';
import { validerEntreeFiscale } from './validationImpot';

const CLE_STOCKAGE = 'pf2026:entree';

/**
 * Vue « Impôt (1 année) » — le calculateur d'impôt de la Phase 1.
 *
 * Contrairement à la Projection, cette vue garde ses trois sections dépliées : le formulaire tient
 * déjà à l'écran et les résultats sont collants. Elle partage en revanche les mêmes conventions —
 * bascule Essentiel / Avancé, aide en infobulle, alertes de cohérence.
 */
export function VueImpotAnnuel() {
  const { donnees: entree, setDonnees: setEntree, reinitialiser } = useDossier(CLE_STOCKAGE, entreeVide);

  const resultat = useMemo(() => calculerImpot(entree), [entree]);
  const alertes = useMemo(() => validerEntreeFiscale(entree), [entree]);

  const maj = <K extends keyof EntreeFiscale>(cle: K, valeur: EntreeFiscale[K]) =>
    setEntree((e) => ({ ...e, [cle]: valeur }));

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex shrink-0 items-center gap-2">
            <BasculeAvance />
            <BoutonReinitialiser onReset={reinitialiser} />
          </div>
          <p className="min-w-0 flex-1 text-right text-xs text-doux">
            Vos données restent sur votre appareil.
          </p>
        </div>

        <ListeAlertes alertes={alertes} />

        <section className="carte p-6">
          <TitreSection
            numero={1}
            titre="Votre situation"
            aide={
              <>
                L'âge au 31 décembre détermine le montant en raison de l'âge (65 ans et plus) et le
                crédit pour revenu de pension. « Vit seul(e) » ouvre droit au montant québécois pour
                personne vivant seule, réduit au-delà d'un certain revenu.
              </>
            }
          />
          <div className="grid grid-cols-2 items-start gap-4">
            <ChampNombre label="Âge au 31 déc." valeur={entree.age} onChange={(v) => maj('age', v)} />
            <div className="pt-7">
              <Interrupteur label="Vit seul(e)" valeur={entree.vitSeul} onChange={(v) => maj('vitSeul', v)} />
            </div>
          </div>
        </section>

        <section className="carte p-6">
          <TitreSection
            numero={2}
            titre="Revenus"
            aide={
              <>
                Chaque type de revenu suit un traitement distinct : les dividendes sont majorés puis
                donnent droit à un crédit, les gains en capital ne sont imposables qu'à <strong>50 %</strong>,
                et seul le « revenu de pension » (FERR, rente viagère, RPA) ouvre droit au crédit pour
                revenu de pension — pas la RRQ ni la Sécurité de la vieillesse.
              </>
            }
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <ChampMonetaire label="Revenu d'emploi (salaire)" valeur={entree.revenuEmploi} onChange={(v) => maj('revenuEmploi', v)} />
            <ChampMonetaire label="Autres revenus" valeur={entree.autresRevenus} onChange={(v) => maj('autresRevenus', v)} indice="Intérêts, loyers nets, entreprise" />
            <ChampMonetaire label="Rente RRQ / RPC" valeur={entree.revenuRRQ} onChange={(v) => maj('revenuRRQ', v)} indice="Imposable (sans crédit de pension)" />
            <ChampMonetaire label="Pension Sécurité vieillesse" valeur={entree.revenuPensionSV} onChange={(v) => maj('revenuPensionSV', v)} indice="Assujettie à la récupération" />
            <ChampMonetaire label="Revenu de pension (FERR, rente)" valeur={entree.revenuPensionPrivee} onChange={(v) => maj('revenuPensionPrivee', v)} indice="FERR, rente viagère, RPA — donne droit au crédit" />
            <ChampMonetaire label="Dividendes déterminés" valeur={entree.dividendesDetermines} onChange={(v) => maj('dividendesDetermines', v)} indice="Grandes sociétés cotées" />
            <ChampMonetaire label="Gains en capital" valeur={entree.gainsCapital} onChange={(v) => maj('gainsCapital', v)} indice="Actions, crypto, immeuble (50 % imposable)" />
            <Avance>
              <ChampMonetaire label="Dividendes ordinaires" valeur={entree.dividendesOrdinaires} onChange={(v) => maj('dividendesOrdinaires', v)} indice="Petites entreprises (SPCC)" />
              <ChampMonetaire label="Rente de survivant RRQ (avant 65 ans)" valeur={entree.renteSurvivantRRQ} onChange={(v) => maj('renteSurvivantRRQ', v)} indice="Imposable comme la RRQ (sans crédit de pension)" />
            </Avance>
          </div>
        </section>

        <section className="carte p-6">
          <TitreSection
            numero={3}
            titre="Déductions et crédits"
            aide={
              <>
                Une <strong>déduction</strong> retranche du revenu imposable : elle vaut votre taux
                marginal, jusqu'à ~53 %. Un <strong>crédit</strong> réduit l'impôt calculé à un taux
                fixe (~14-15 %). C'est pourquoi la cotisation syndicale, déductible au fédéral mais
                convertie en crédit de 10 % au Québec, n'a pas le même rendement des deux côtés.
              </>
            }
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <ChampMonetaire label="Cotisation REER" valeur={entree.deductionReer} onChange={(v) => maj('deductionReer', v)} />
            <ChampMonetaire label="Autres déductions" valeur={entree.autresDeductions} onChange={(v) => maj('autresDeductions', v)} indice="RPA, pension alimentaire…" />
            <Avance>
              <ChampMonetaire label="Cotisation syndicale / professionnelle" valeur={entree.cotisationSyndicale} onChange={(v) => maj('cotisationSyndicale', v)} indice="Déduction au fédéral, crédit de 10 % au Québec" />
              <ChampMonetaire label="Prime d'assurance-salaire" valeur={entree.primeAssuranceSalaire} onChange={(v) => maj('primeAssuranceSalaire', v)} indice={entree.assuranceSalaireDeductible ? 'Déduite du revenu' : 'Non déductible : réduit le net en poche'} />
            </Avance>
          </div>
          <Avance>
            {entree.primeAssuranceSalaire > 0 && (
              <div className="mt-3">
                <Interrupteur
                  label="Prime d'assurance-salaire déductible du revenu"
                  valeur={entree.assuranceSalaireDeductible}
                  onChange={(v) => maj('assuranceSalaireDeductible', v)}
                />
              </div>
            )}
          </Avance>
          <p className="mt-4 text-xs text-doux">
            Les cotisations <span className="font-medium text-doux">RRQ, assurance-emploi et RQAP</span> sont
            calculées automatiquement à partir de votre salaire et détaillées dans les résultats (crédits + déduction
            de la portion bonifiée du RRQ).
          </p>
          <div className="encadre-marque mt-5">
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
