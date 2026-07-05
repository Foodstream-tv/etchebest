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

  switch (state) {
    case "creating":
      return "Création en cours…";

    case "connecting":
      return "Connexion en cours…";

    case "error":
      return "Impossible de démarrer le flux.";

    case "disconnected":
      return "Le flux est déconnecté.";

    case "idle":
      return "Le flux local n’est pas encore disponible.";

    case "live":
      return "Connexion au flux vidéo…";

    default: {
      const exhaustiveCheck: never = state;
      return exhaustiveCheck;
    }
  }
}