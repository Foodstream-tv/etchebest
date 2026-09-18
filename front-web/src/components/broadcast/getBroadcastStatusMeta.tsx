export type BroadcastState =
  | "idle"
  | "creating"
  | "connecting"
  | "live"
  | "error"
  | "disconnected";

type BroadcastStatusMeta = Readonly<{
  label: string;
  dotClassName: string;
}>;

export default function getBroadcastStatusMeta(
  state: BroadcastState,
  t?: (key: any) => string
): BroadcastStatusMeta {
  switch (state) {
    case "live":
      return {
        label: t ? t("broadcast.statusLive") : "En direct",
        dotClassName: "bg-red-500",
      };

    case "connecting":
      return {
        label: t ? t("broadcast.statusConnecting") : "Connexion…",
        dotClassName: "bg-amber-500",
      };

    case "creating":
      return {
        label: t ? t("broadcast.statusCreating") : "Création…",
        dotClassName: "bg-blue-500",
      };

    case "disconnected":
      return {
        label: t ? t("broadcast.statusDisconnected") : "Déconnecté",
        dotClassName: "bg-gray-500",
      };

    case "error":
      return {
        label: t ? t("broadcast.statusError") : "Erreur",
        dotClassName: "bg-red-600",
      };

    case "idle":
      return {
        label: t ? t("broadcast.statusIdle") : "Prêt",
        dotClassName: "bg-gray-400",
      };

    default: {
      const exhaustiveCheck: never = state;
      return exhaustiveCheck;
    }
  }
}