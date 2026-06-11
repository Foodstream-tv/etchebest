  export type BroadcastState =
    | "idle"
    | "creating"
    | "connecting"
    | "live"
    | "error"
    | "disconnected";

  export default function getBroadcastStatusMeta(state: BroadcastState): {
    label: string;
    dotClassName: string;
  } {
    switch (state) {
      case "live":
        return {
          label: "En direct",
          dotClassName: "bg-red-500",
        };

      case "connecting":
        return {
          label: "Connexion…",
          dotClassName: "bg-amber-500",
        };

      case "creating":
        return {
          label: "Création…",
          dotClassName: "bg-blue-500",
        };

      case "disconnected":
        return {
          label: "Déconnecté",
          dotClassName: "bg-gray-500",
        };

      case "error":
        return {
          label: "Erreur",
          dotClassName: "bg-red-600",
        };

      default:
        return {
          label: "Prêt",
          dotClassName: "bg-gray-400",
        };
    }
  }