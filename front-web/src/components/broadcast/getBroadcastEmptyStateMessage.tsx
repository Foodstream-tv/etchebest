import type { BroadcastState } from "@/components/broadcast/getBroadcastStatusMeta";

export default function getBroadcastEmptyStateMessage(
  ready: boolean,
  token: string | null | undefined,
  state: BroadcastState,
  t?: (key: any) => string
): string {
  if (!ready) {
    return t ? t("broadcast.emptyStateLoading") : "Chargement…";
  }

  if (!token) {
    return t ? t("broadcast.emptyStateSignIn") : "Connecte-toi pour activer la caméra.";
  }

  switch (state) {
    case "creating":
      return t ? t("broadcast.emptyStateCreating") : "Création en cours…";

    case "connecting":
      return t ? t("broadcast.emptyStateConnecting") : "Connexion en cours…";

    case "error":
      return t ? t("broadcast.emptyStateError") : "Impossible de démarrer le flux.";

    case "disconnected":
      return t ? t("broadcast.emptyStateDisconnected") : "Le flux est déconnecté.";

    case "idle":
      return t ? t("broadcast.emptyStateIdle") : "Le flux local n’est pas encore disponible.";

    case "live":
      return t ? t("broadcast.emptyStateLive") : "Connexion au flux vidéo…";

    default: {
      const exhaustiveCheck: never = state;
      return exhaustiveCheck;
    }
  }
}