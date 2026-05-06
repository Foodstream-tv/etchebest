type ProfileConnectedRowProps = {
  label: string;
  connected: boolean;
  onToggle?: () => void;
};

export default function ProfileConnectedRow({
  label,
  connected,
  onToggle,
}: ProfileConnectedRowProps) {
  return (
    <div className="flex items-center justify-between rounded-2xl bg-black/[0.03] px-3 py-3 text-sm ring-1 ring-black/5 dark:bg-white/[0.04] dark:ring-white/10">
      <span className="text-gray-800 dark:text-gray-200">{label}</span>

      <button
        type="button"
        onClick={onToggle}
        className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
          connected
            ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-200 dark:ring-emerald-500/30"
            : "bg-orange-50 text-orange-700 ring-1 ring-orange-200 hover:bg-orange-100 dark:bg-orange-500/10 dark:text-orange-200 dark:ring-orange-500/30 dark:hover:bg-orange-500/15"
        }`}
      >
        {connected ? "Connecté" : "Lier"}
      </button>
    </div>
  );
}