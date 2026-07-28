/**
 * Découpage de la saisie en étapes courtes, consommées par l'`Atelier`.
 *
 * Trois fabriques : la personne seule (8 étapes), un conjoint (6 étapes) et le ménage (2 étapes).
 * Les cinq étapes communes (vie active → rentes d'employeur) partagent leurs identifiants entre le
 * solo et les deux conjoints, ce qui permet de rester sur la même étape en changeant de personne.
 *
 * Chaque étape porte UNE phrase de description ; le détail va derrière le bouton « ? » (`aide`).
 */
import type { ReactNode } from 'react';
import { projeter, type HypothesesCouple, type HypothesesProjection, type Immeuble, type PersonneProjection } from '../../moteur';
import { ChampMonetaire, ChampNombre, ChampPourcent, ChampSelect, Interrupteur } from '../Champ';
import { Avance } from '../ui/ModeDetail';
import type { Etape, Groupe } from '../atelier/types';
import type { ChampsPersonne, PatchPersonne } from './champsPersonne';
import { EditeurComptes } from './EditeurComptes';
import { SectionHeritage } from './SectionHeritage';
import { SuggestionDepense } from './SuggestionDepense';
import { SectionImmobilier } from './SectionImmobilier';
import { SectionRentesEmployeur } from './SectionRentesEmployeur';
import { SectionTravailRetraite } from './SectionTravailRetraite';
import { EPARGNES_CONJOINT, EPARGNES_SOLO, SectionVieActive, type LigneEpargne } from './SectionVieActive';
import { alertesMenage, alertesPersonne, validerSolo, type Alerte } from './validation';

const OPTIONS_SEXE = [
  { valeur: 'H', label: 'Homme' },
  { valeur: 'F', label: 'Femme' },
] as const;

/** Une personne a-t-elle déjà de l'épargne en cours ? */
const epargneNonNulle = (p: ChampsPersonne) => Object.values(p.epargneAnnuelle).some((v) => (v ?? 0) > 0);

/**
 * Y a-t-il de quoi calculer une dépense soutenable ? Sans capital, sans rente et sans revenu, la
 * suggestion vaudrait 0 $ et n'apprendrait rien : on préfère ne rien afficher.
 */
const aDesRessources = (p: ChampsPersonne) =>
  p.comptes.some((c) => c.solde > 0) ||
  p.rrqA65 > 0 ||
  p.svA65 > 0 ||
  p.rentesEmployeur.length > 0 ||
  p.revenuEmploi > 0 ||
  epargneNonNulle(p);

/** Pose une dépense de retraite dans des hypothèses, sans toucher au reste. */
const poserDepenseSolo = (h: HypothesesProjection, montant: number) => ({
  ...h,
  depensesRetraite: montant,
});

/** Rattache à chaque étape les alertes qui la concernent. */
function avecAlertes(etapes: Etape[], alertes: readonly Alerte[]): Etape[] {
  if (alertes.length === 0) return etapes;
  return etapes.map((e) => {
    const siennes = alertes.filter((a) => a.etape === e.id);
    return siennes.length > 0 ? { ...e, alertes: siennes } : e;
  });
}

/** Les cinq étapes communes au solo et à chaque conjoint. */
function etapesCommunes(
  p: ChampsPersonne,
  onChange: (patch: PatchPersonne) => void,
  fraisGestion: number,
  epargnes: readonly LigneEpargne[],
  epargneSupplementaire?: ReactNode,
): Etape[] {
  return [
    {
      id: 'vie-active',
      titre: 'Vie active',
      description: "Ce que vous gagnez aujourd'hui et ce que vous mettez de côté chaque année.",
      aide: (
        <>
          Les encadrés de plafonds n'apparaissent que pour les comptes où vous cotisez : plafond à vie
          du CELIAPP, droits CELI, droits REER. Le cas échéant, l'excédent d'une cotisation est
          redirigé en chaîne CELIAPP → CELI → non-enregistré, comme le fait l'ARC dans les faits.
        </>
      ),
      rempli: p.revenuEmploi > 0 || epargneNonNulle(p),
      contenu: (
        <SectionVieActive
          p={p}
          onChange={onChange}
          epargnes={epargnes}
          epargneSupplementaire={epargneSupplementaire}
        />
      ),
    },
    {
      id: 'travail-retraite',
      titre: 'Travail à la retraite',
      description: "Revenu d'emploi poursuivi après la retraite : temps partiel, pige, consultation.",
      aide: (
        <>
          Ce revenu est imposé comme un salaire, subit les retenues (RRQ, AE, RQAP) et rouvre des
          droits REER jusqu'à 71 ans. Il réduit d'autant le décaissement de vos comptes ; tout surplus
          est réinvesti (CELI → REER → non-enregistré).
        </>
      ),
      rempli: (p.periodesTravail ?? []).length > 0,
      optionnel: true,
      contenu: (
        <SectionTravailRetraite
          periodes={p.periodesTravail ?? []}
          ageRetraite={p.ageRetraite}
          onChange={(periodesTravail) => onChange({ periodesTravail })}
        />
      ),
    },
    {
      id: 'comptes',
      titre: 'Comptes actuels',
      description: "Le solde d'aujourd'hui de chaque compte.",
      aide: (
        <>
          Le rendement affiché est <strong>net de frais</strong>, calibré sur les Normes IQPF 2026 ;
          choisissez « Autre » pour fixer votre propre taux. En mode Essentiel, les comptes moins
          courants (CELIAPP, CRI, REEE) restent masqués tant qu'ils sont vides.
        </>
      ),
      rempli: p.comptes.some((c) => c.solde > 0),
      contenu: (
        <EditeurComptes
          comptes={p.comptes}
          fraisGestion={fraisGestion}
          onChange={(comptes) => onChange({ comptes })}
        />
      ),
    },
    {
      id: 'rentes-publiques',
      titre: 'Rentes publiques',
      description: 'RRQ et Sécurité de la vieillesse, selon votre relevé Retraite Québec.',
      aide: (
        <>
          Saisissez les montants <strong>estimés à 65 ans</strong> : l'ajustement pour anticipation ou
          report est appliqué automatiquement selon l'âge de début. Les âges de début sont des
          réglages avancés — l'optimiseur sait les proposer lui-même.
        </>
      ),
      rempli: p.rrqA65 > 0 || p.svA65 > 0,
      contenu: (
        <div className="grid gap-4 sm:grid-cols-2">
          <ChampMonetaire
            label="RRQ estimée à 65 ans"
            valeur={p.rrqA65}
            onChange={(v) => onChange({ rrqA65: v })}
            indice="Montant annuel (relevé Retraite Québec)"
          />
          <ChampMonetaire
            label="SV estimée à 65 ans"
            valeur={p.svA65}
            onChange={(v) => onChange({ svA65: v })}
            indice="Montant annuel"
          />
          <Avance>
            <ChampNombre
              label="Âge de début RRQ"
              valeur={p.ageDebutRRQ}
              min={60}
              max={72}
              onChange={(v) => onChange({ ageDebutRRQ: v })}
            />
            <ChampNombre
              label="Âge de début SV"
              valeur={p.ageDebutSV}
              min={65}
              max={70}
              onChange={(v) => onChange({ ageDebutSV: v })}
            />
          </Avance>
        </div>
      ),
    },
    {
      id: 'rentes-employeur',
      titre: "Rentes d'employeur",
      description: "Rentes de retraite d'employeur et RREGOP (rente de base + ponts).",
      aide: (
        <>
          Ces rentes sont imposables et donnent droit au crédit pour revenu de pension. Le calculateur
          RREGOP applique la formule 2 % × service × salaire moyen, avec la réduction de coordination
          de 0,7 % à 65 ans et une indexation partielle (50 % de l'IPC).
        </>
      ),
      rempli: p.rentesEmployeur.length > 0,
      optionnel: true,
      contenu: (
        <SectionRentesEmployeur
          rentes={p.rentesEmployeur}
          ageRetraite={p.ageRetraite}
          onChange={(rentesEmployeur) => onChange({ rentesEmployeur })}
        />
      ),
    },
    {
      id: 'heritage',
      titre: 'Héritage',
      description: 'Sommes que vous attendez d’une succession, et l’âge auquel vous les recevriez.',
      aide: (
        <>
          Un héritage n'est <strong>pas imposable</strong> pour vous : la succession du défunt a déjà
          réglé l'impôt au décès. Le montant est donc placé net, dans l'ordre
          <strong> CELI → REER → non-enregistré</strong>, selon les droits qu'il vous reste — la part
          versée au REER vous donne une déduction. Reçu pendant la retraite, il finance d'abord les
          dépenses de l'année et seul le surplus est placé. Le CELIAPP est écarté (impossible de
          vérifier l'admissibilité à une première propriété) ; le CRI et le FRV sont immobilisés et
          n'acceptent aucun versement.
        </>
      ),
      rempli: (p.heritages ?? []).some((h) => h.montant > 0),
      optionnel: true,
      contenu: (
        <SectionHeritage
          heritages={p.heritages ?? []}
          ageActuel={p.ageActuel}
          onChange={(heritages) => onChange({ heritages })}
        />
      ),
    },
  ];
}

/** Étape « Immobilier », partagée par le solo et le ménage. */
function etapeImmobilier(
  immeubles: readonly Immeuble[],
  onChange: (immeubles: Immeuble[]) => void,
  couple: boolean,
): Etape {
  return {
    id: 'immobilier',
    titre: 'Immobilier',
    description: 'Résidence, chalet, immeuble à revenu, terrain.',
    aide: (
      <>
        Appréciation, hypothèque, loyers et vente sont intégrés au patrimoine. L'exemption pour
        résidence principale (maison ou chalet) est <strong>arbitrée automatiquement</strong> ; le
        terrain et l'immeuble à revenu restent toujours imposables. En mode avancé, l'« âge min. de
        vente » empêche l'optimiseur de vendre un bien trop tôt — utile pour garder la maison par
        confort — et la « fraction libérée » modélise un downsizing plutôt qu'une vente entière.
      </>
    ),
    rempli: immeubles.length > 0,
    optionnel: true,
    contenu: <SectionImmobilier immeubles={immeubles} onChange={onChange} couple={couple} />,
  };
}

/** Les 8 étapes de la projection d'une personne seule. */
export function groupeSolo(h: HypothesesProjection, onChange: (h: HypothesesProjection) => void): Groupe {
  const maj = <K extends keyof HypothesesProjection>(cle: K, valeur: HypothesesProjection[K]) =>
    onChange({ ...h, [cle]: valeur });
  const majPersonne = (patch: PatchPersonne) => onChange({ ...h, ...patch });

  const etapes: Etape[] = [
    {
      id: 'horizon',
      titre: 'Horizon',
      description: "De votre âge d'aujourd'hui jusqu'au décès, en passant par la retraite.",
      aide: (
        <>
          L'espérance de vie par défaut suit les Normes IQPF 2026 (table CPM 2014, médiane ~95 ans).
          « Vit seul(e) » ouvre droit au montant québécois pour personne vivant seule.
        </>
      ),
      rempli: true,
      contenu: (
        <>
          <div className="grid grid-cols-3 gap-3">
            <ChampNombre label="Âge actuel" valeur={h.ageActuel} onChange={(v) => maj('ageActuel', v)} />
            <ChampNombre label="Âge retraite" valeur={h.ageRetraite} onChange={(v) => maj('ageRetraite', v)} />
            <ChampNombre label="Âge décès" valeur={h.ageDeces} onChange={(v) => maj('ageDeces', v)} />
          </div>
          <div className="mt-4">
            <Interrupteur label="Vit seul(e)" valeur={h.vitSeul} onChange={(v) => maj('vitSeul', v)} />
          </div>
        </>
      ),
    },
    ...etapesCommunes(h, majPersonne, h.fraisGestion, EPARGNES_SOLO),
    etapeImmobilier(h.immeubles, (immeubles) => onChange({ ...h, immeubles }), false),
    {
      id: 'decaissement',
      titre: 'Décaissement',
      description: "Ce que vous voulez dépenser chaque année à la retraite, net d'impôt.",
      aide: (
        <>
          C'est la cible que le solveur doit financer : il retire des comptes, dans l'ordre choisi,
          juste assez pour qu'il vous reste ce montant <strong>après impôt</strong>. L'inflation et
          les frais de gestion sont des réglages avancés, préréglés sur les Normes IQPF 2026.
        </>
      ),
      rempli: h.depensesRetraite > 0,
      contenu: (
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <ChampMonetaire
              label="Dépenses de retraite (net d'impôt)"
              valeur={h.depensesRetraite}
              onChange={(v) => maj('depensesRetraite', v)}
              indice="Cible annuelle, en $ d'aujourd'hui"
            />
            <SuggestionDepense
              hypotheses={h}
              poserDepense={poserDepenseSolo}
              evaluer={projeter}
              aDesRessources={aDesRessources(h)}
              onUtiliser={(v) => maj('depensesRetraite', v)}
            />
          </div>
          <div />
          <Avance>
            <ChampPourcent
              label="Inflation"
              valeur={h.inflation}
              onChange={(v) => maj('inflation', v)}
              indice="Norme IQPF : 2,1 %"
            />
            <ChampPourcent
              label="Frais de gestion"
              valeur={h.fraisGestion}
              onChange={(v) => maj('fraisGestion', v)}
              indice="Réduisent le rendement"
            />
          </Avance>
        </div>
      ),
    },
  ];

  return { id: 'solo', label: 'Une personne', etapes: avecAlertes(etapes, validerSolo(h)) };
}

/** Les 6 étapes d'un conjoint. */
export function groupeConjoint(
  cle: 'personne1' | 'personne2',
  couple: HypothesesCouple,
  onChange: (p: PersonneProjection) => void,
): Groupe {
  const p = couple[cle];
  const maj = <K extends keyof PersonneProjection>(champ: K, valeur: PersonneProjection[K]) =>
    onChange({ ...p, [champ]: valeur });
  const majPersonne = (patch: PatchPersonne) => onChange({ ...p, ...patch });

  const etapes: Etape[] = [
    {
      id: 'situation',
      titre: 'Situation',
      description: 'Identité et horizon de ce conjoint.',
      aide: (
        <>
          Le nom sert d'étiquette dans les tableaux et le panneau d'optimisation. Chaque conjoint a
          ses propres comptes, rentes et droits de cotisation ; le fractionnement du revenu de pension
          entre les deux est optimisé automatiquement, année par année.
        </>
      ),
      rempli: true,
      contenu: (
        <>
          <input
            className="saisie mb-3 text-left"
            value={p.nom}
            aria-label="Nom du conjoint"
            onChange={(e) => maj('nom', e.target.value)}
          />
          <div className="grid grid-cols-2 gap-3">
            <ChampSelect label="Sexe" valeur={p.sexe} options={OPTIONS_SEXE} onChange={(v) => maj('sexe', v)} />
            <ChampNombre label="Âge actuel" valeur={p.ageActuel} onChange={(v) => maj('ageActuel', v)} />
            <ChampNombre label="Âge retraite" valeur={p.ageRetraite} onChange={(v) => maj('ageRetraite', v)} />
            <ChampNombre label="Âge décès" valeur={p.ageDeces} onChange={(v) => maj('ageDeces', v)} />
          </div>
        </>
      ),
    },
    ...etapesCommunes(
      p,
      majPersonne,
      couple.fraisGestion,
      EPARGNES_CONJOINT,
      <ChampMonetaire
        label="REER de conjoint"
        valeur={p.epargneReerConjoint}
        onChange={(v) => maj('epargneReerConjoint', v)}
        indice="Vous déduisez, versé au REER de l'autre"
      />,
    ),
  ];

  return { id: cle, label: p.nom, etapes: avecAlertes(etapes, alertesPersonne(couple, cle)) };
}

/** Les 2 étapes du ménage : immobilier commun et dépenses. */
export function groupeMenage(h: HypothesesCouple, onChange: (h: HypothesesCouple) => void): Groupe {
  const etapes: Etape[] = [
    etapeImmobilier(h.immeubles, (immeubles) => onChange({ ...h, immeubles }), true),
    {
      id: 'depenses',
      titre: 'Dépenses du ménage',
      description: "La cible annuelle du couple, nette d'impôt.",
      aide: (
        <>
          Après le premier décès, le survivant conserve une fraction de ces dépenses (environ deux
          tiers, la valeur usuelle en planification). L'inflation et les frais de gestion sont des
          réglages avancés, préréglés sur les Normes IQPF 2026.
        </>
      ),
      rempli: h.depensesRetraite > 0,
      contenu: (
        <div className="grid gap-4 sm:grid-cols-2">
          <ChampMonetaire
            label="Dépenses du ménage"
            valeur={h.depensesRetraite}
            onChange={(v) => onChange({ ...h, depensesRetraite: v })}
            indice="Net d'impôt, en $ d'aujourd'hui"
          />
          <ChampPourcent
            label="Dépenses du survivant"
            valeur={h.fractionSurvivant}
            onChange={(v) => onChange({ ...h, fractionSurvivant: v })}
            indice="% des dépenses du couple"
            pas={1}
          />
          <Avance>
            <ChampPourcent
              label="Inflation"
              valeur={h.inflation}
              onChange={(v) => onChange({ ...h, inflation: v })}
              indice="Norme IQPF : 2,1 %"
            />
            <ChampPourcent
              label="Frais de gestion"
              valeur={h.fraisGestion}
              onChange={(v) => onChange({ ...h, fraisGestion: v })}
              indice="Réduisent le rendement"
            />
          </Avance>
        </div>
      ),
    },
  ];

  return { id: 'menage', label: 'Ménage', etapes: avecAlertes(etapes, alertesMenage(h)) };
}
