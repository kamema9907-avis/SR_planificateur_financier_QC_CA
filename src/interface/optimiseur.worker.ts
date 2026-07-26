/**
 * Optimiseur exécuté sur un fil séparé.
 *
 * `optimiserProjection` évalue des centaines de projections complètes ; sur le fil principal, cela
 * gèle l'interface pendant tout le calcul (mesuré à ~320 ms pour un couple, davantage avec plusieurs
 * immeubles). Ici, la page reste vivante — et le calcul devient annulable.
 *
 * Les hypothèses et les résultats sont des objets simples : le clonage structuré du navigateur les
 * transporte sans conversion particulière.
 */
import { optimiserCouple, optimiserProjection } from '../moteur';

/** Requête envoyée au worker. */
export interface DemandeOptimisation {
  /** Rattache la réponse à sa demande : une réponse tardive d'un calcul remplacé est ignorée. */
  id: number;
  mode: 'solo' | 'couple';
  hypotheses: unknown;
}

/** Réponse du worker. */
export type ReponseOptimisation =
  | { id: number; ok: true; resultat: unknown }
  | { id: number; ok: false; erreur: string };

self.onmessage = (e: MessageEvent<DemandeOptimisation>) => {
  const { id, mode, hypotheses } = e.data;
  try {
    const resultat =
      mode === 'couple'
        ? optimiserCouple(hypotheses as Parameters<typeof optimiserCouple>[0])
        : optimiserProjection(hypotheses as Parameters<typeof optimiserProjection>[0]);
    const reponse: ReponseOptimisation = { id, ok: true, resultat };
    self.postMessage(reponse);
  } catch (err) {
    const reponse: ReponseOptimisation = {
      id,
      ok: false,
      erreur: err instanceof Error ? err.message : String(err),
    };
    self.postMessage(reponse);
  }
};
