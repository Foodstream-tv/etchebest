export type BroadcastState = "idle" | "creating" | "connecting" | "live";

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
    default:
      return {
        label: "Prêt",
        dotClassName: "bg-gray-400",
      };
  }
}