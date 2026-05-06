import type { BroadcastState } from "@/components/broadcast/getBroadcastStatusMeta";

export default function getBroadcastEmptyStateMessage(
  ready: boolean,
  token: string | null | undefined,
  state: BroadcastState
): string {
  if (!ready) {
    return "Chargement…";
  }

  if (!token) {
    return "Connecte-toi pour activer la caméra.";
  }

  if (state === "creating") {
    return "Création en cours…";
  }

  if (state === "connecting") {
    return "Connexion en cours…";
  }

  return "Le flux local n’est pas encore disponible.";
}