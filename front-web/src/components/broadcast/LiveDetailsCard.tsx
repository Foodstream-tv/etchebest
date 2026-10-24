"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Check, Sparkles, X } from "lucide-react";

import LiveTagPicker from "@/components/studio/LiveTagPicker";
import { TAG_TARGET } from "@/components/studio/liveTags";
import { useI18n } from "@/i18n/LanguageContext";

type Props = Readonly<{
  /** Tags already saved on the live. */
  tags: readonly string[];
  /** Saves the new list; rejects when it could not be saved. */
  onSave: (tags: string[]) => Promise<void>;
  /** Identifies the live, so that closing the banner is remembered for it. */
  dismissKey?: string;
}>;

const DISMISS_PREFIX = "fs:live-details-dismissed:";

function readDismissed(key?: string): boolean {
  if (!key || typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(DISMISS_PREFIX + key) === "1";
  } catch {
    return false;
  }
}

function writeDismissed(key: string | undefined, value: boolean) {
  if (!key) return;
  try {
    if (value) window.localStorage.setItem(DISMISS_PREFIX + key, "1");
    else window.localStorage.removeItem(DISMISS_PREFIX + key);
  } catch {
    /* storage unavailable: the banner just comes back next time */
  }
}

/**
 * Optional nudge shown to the host while the live is being prepared: a gauge that fills as the live gets
 * described (tags), and a dialog to do it. Nothing here blocks launching the live.
 */
export default function LiveDetailsCard({ tags, onSave, dismissKey }: Props) {
  const { t } = useI18n();
  const titleId = useId();

  const [open, setOpen] = useState(false);
  // The card only mounts once the live has loaded on the client, so reading storage here is safe.
  const [dismissed, setDismissed] = useState(() => readDismissed(dismissKey));
  const [draft, setDraft] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const openerRef = useRef<HTMLButtonElement | null>(null);

  const count = Math.min(tags.length, TAG_TARGET);
  const percent = Math.round((count / TAG_TARGET) * 100);
  const complete = tags.length >= TAG_TARGET;
  const draftComplete = draft.length >= TAG_TARGET;

  const openDialog = () => {
    setDraft([...tags]);
    setFailed(false);
    setOpen(true);
  };

  const closeDialog = () => {
    if (saving) return;
    setOpen(false);
    openerRef.current?.focus();
  };

  useEffect(() => {
    if (!open) return;
    dialogRef.current?.focus();

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !saving) {
        setOpen(false);
        openerRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, saving]);

  const save = async () => {
    setSaving(true);
    setFailed(false);
    try {
      await onSave(draft);
      setOpen(false);
      openerRef.current?.focus();
    } catch {
      setFailed(true);
    } finally {
      setSaving(false);
    }
  };

  const dismiss = () => {
    setDismissed(true);
    writeDismissed(dismissKey, true);
  };

  const restore = () => {
    setDismissed(false);
    writeDismissed(dismissKey, false);
  };

  return (
    <>
      {dismissed ? (
        <div className="flex shrink-0 items-center gap-2">
          <button
            ref={openerRef}
            type="button"
            onClick={openDialog}
            className="inline-flex h-8 items-center gap-1.5 rounded-full border border-black/15 bg-white px-3 text-xs font-semibold text-gray-800 shadow-sm transition hover:bg-[#fffaf2] dark:border-[#f5ede0]/25 dark:bg-[#f5ede0]/[0.10] dark:text-[#f5ede0] dark:shadow-none dark:hover:bg-[#f5ede0]/[0.18]"
          >
            <Sparkles className="h-3.5 w-3.5 text-orange-500" aria-hidden="true" />
            {t("liveRoom.details.chip", { count, total: TAG_TARGET })}
          </button>
          <button
            type="button"
            onClick={restore}
            className="text-xs font-medium text-gray-600 underline-offset-2 hover:underline dark:text-[#f5ede0]/70"
          >
            {t("liveRoom.details.restore")}
          </button>
        </div>
      ) : (
      <section
        aria-labelledby={`${titleId}-card`}
        className="relative shrink-0 rounded-2xl border border-orange-500/25 bg-orange-500/[0.06] p-3 sm:px-4 dark:border-orange-400/25 dark:bg-orange-500/10"
      >
        <button
          type="button"
          onClick={dismiss}
          aria-label={t("liveRoom.details.dismiss")}
          title={t("liveRoom.details.dismiss")}
          className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full text-gray-500 transition hover:bg-black/[0.06] hover:text-gray-900 dark:text-[#f5ede0]/60 dark:hover:bg-white/10 dark:hover:text-[#f5ede0]"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3 pr-8">
          <span
            aria-hidden="true"
            className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl text-[#1a0f05] ${
              complete ? "bg-emerald-500" : "bg-orange-500"
            }`}
          >
            {complete ? <Check className="fs-pop h-5 w-5" /> : <Sparkles className="h-5 w-5" />}
          </span>

          <div className="min-w-0 flex-1 basis-56">
            <div className="flex flex-wrap items-center gap-2">
              <h2 id={`${titleId}-card`} className="text-sm font-bold text-gray-950 dark:text-white">
                {complete ? t("liveRoom.details.complete") : t("liveRoom.details.title")}
              </h2>
              {complete ? null : (
                <span className="rounded-full bg-black/[0.06] px-2 py-0.5 text-[11px] font-semibold text-gray-600 dark:bg-white/10 dark:text-gray-300">
                  {t("liveRoom.details.optional")}
                </span>
              )}
            </div>

            {complete ? null : (
              <p className="mt-0.5 text-xs text-gray-600 dark:text-gray-400">
                {t("liveRoom.details.hint")}
              </p>
            )}

            <div className="mt-2 flex items-center gap-3">
              <div
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={percent}
                aria-label={t("liveRoom.details.progress", { count, total: TAG_TARGET })}
                className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-black/[0.08] dark:bg-white/10"
              >
                <div
                  className="fs-progress-fill h-full rounded-full transition-[width] duration-700 ease-out motion-reduce:transition-none"
                  style={{ width: `${percent}%` }}
                />
              </div>
              <span className="shrink-0 text-xs font-semibold tabular-nums text-gray-700 dark:text-gray-300">
                {t("liveRoom.details.progress", { count, total: TAG_TARGET })}
              </span>
            </div>
          </div>

          <button
            ref={openerRef}
            type="button"
            onClick={openDialog}
            className={
              complete
                ? "inline-flex h-10 items-center rounded-xl border border-black/10 bg-white px-4 text-sm font-semibold text-gray-800 transition hover:bg-gray-50 dark:border-white/10 dark:bg-white/[0.06] dark:text-gray-100 dark:hover:bg-white/10"
                : "inline-flex h-10 items-center rounded-xl bg-orange-500 px-4 text-sm font-semibold text-[#1a0f05] shadow-sm transition hover:bg-orange-400"
            }
          >
            {complete || tags.length > 0 ? t("liveRoom.details.edit") : t("liveRoom.details.add")}
          </button>
        </div>
      </section>
      )}

      {open ? (
        <div
          className="fixed inset-0 z-[60] grid place-items-center bg-black/55 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeDialog();
          }}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={`${titleId}-dialog`}
            tabIndex={-1}
            className="flex max-h-[88dvh] w-full max-w-2xl flex-col overflow-hidden rounded-[28px] border border-black/8 bg-white shadow-[0_24px_80px_rgba(0,0,0,0.35)] outline-none dark:border-white/10 dark:bg-[#1f1712]"
          >
            <header className="flex shrink-0 items-start justify-between gap-3 border-b border-black/8 px-5 py-4 dark:border-white/10">
              <div>
                <h2 id={`${titleId}-dialog`} className="text-base font-bold text-gray-950 dark:text-white">
                  {t("liveRoom.details.dialogTitle")}
                </h2>
                <p className="mt-0.5 text-xs text-gray-600 dark:text-gray-400">
                  {t("liveRoom.details.dialogHint", { total: TAG_TARGET })}
                </p>
              </div>
              <button
                type="button"
                onClick={closeDialog}
                aria-label={t("common.close")}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-gray-600 transition hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/10"
              >
                <X aria-hidden="true" className="h-4 w-4" />
              </button>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              <LiveTagPicker tags={draft} onChange={setDraft} />
            </div>

            <footer className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-black/8 px-5 py-4 dark:border-white/10">
              <div className="min-w-0 text-xs">
                {failed ? (
                  <p role="alert" className="font-semibold text-red-600 dark:text-red-300">
                    {t("liveRoom.details.saveError")}
                  </p>
                ) : (
                  <p
                    className={`font-semibold ${
                      draftComplete
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-gray-500 dark:text-gray-400"
                    }`}
                  >
                    {t("liveRoom.details.progress", {
                      count: Math.min(draft.length, TAG_TARGET),
                      total: TAG_TARGET,
                    })}
                  </p>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={closeDialog}
                  disabled={saving}
                  className="inline-flex h-10 items-center rounded-xl border border-black/10 bg-white px-4 text-sm font-semibold text-gray-800 transition hover:bg-gray-50 disabled:opacity-50 dark:border-white/10 dark:bg-white/[0.06] dark:text-gray-100 dark:hover:bg-white/10"
                >
                  {t("liveRoom.details.cancel")}
                </button>
                <button
                  type="button"
                  onClick={() => void save()}
                  disabled={saving}
                  className="inline-flex h-10 items-center rounded-xl bg-orange-500 px-5 text-sm font-semibold text-[#1a0f05] transition hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? t("liveRoom.details.saving") : t("liveRoom.details.save")}
                </button>
              </div>
            </footer>
          </div>
        </div>
      ) : null}
    </>
  );
}
