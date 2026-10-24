"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Download, Loader2, ShieldCheck, Trash2, TriangleAlert } from "lucide-react";

import ProfileCard from "@/components/profile/ProfileCard";
import { useAuth } from "@/lib/useAuth";
import { deleteMyAccount, exportMyData } from "@/lib/users";
import { useI18n } from "@/i18n/LanguageContext";

const EXPORT_FILENAME = "foodstream-my-data.json";

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Revoke on the next tick so the browser has started the download.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export default function PrivacyDataCard() {
  const { token, signOut } = useAuth();
  const { t } = useI18n();

  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const [exportDone, setExportDone] = useState(false);
  const exportingRef = useRef(false);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const deletingRef = useRef(false);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descId = useId();

  const handleExport = async () => {
    if (!token || exportingRef.current) return;
    exportingRef.current = true;
    setExporting(true);
    setExportError("");
    setExportDone(false);

    try {
      const blob = await exportMyData(token);
      downloadBlob(blob, EXPORT_FILENAME);
      setExportDone(true);
    } catch {
      setExportError(t("profile.privacy.export.error"));
    } finally {
      exportingRef.current = false;
      setExporting(false);
    }
  };

  const openConfirm = () => {
    setDeleteError("");
    setConfirmOpen(true);
  };

  const closeConfirm = useCallback(() => {
    if (deletingRef.current) return;
    setConfirmOpen(false);
    setDeleteError("");
    triggerRef.current?.focus();
  }, []);

  const handleDelete = async () => {
    if (!token || deletingRef.current) return;
    deletingRef.current = true;
    setDeleting(true);
    setDeleteError("");

    try {
      await deleteMyAccount(token);
    } catch {
      deletingRef.current = false;
      setDeleting(false);
      setDeleteError(t("profile.privacy.delete.error"));
      return;
    }

    // Account is gone: clear the session exactly like a logout (storage,
    // cookies and the /api/auth/logout route), then leave the app. The dialog
    // stays in its "deleting" state until the navigation happens.
    await signOut();
    window.location.href = "/signin?logout=true";
  };

  // Dialog behaviour: focus the safe action on open, Escape closes, Tab is
  // trapped inside, background scroll is locked.
  useEffect(() => {
    if (!confirmOpen) return;

    cancelRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeConfirm();
        return;
      }

      if (event.key !== "Tab" || !dialogRef.current) return;

      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          "button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex='-1'])"
        )
      );

      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (!dialogRef.current.contains(active)) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [confirmOpen, closeConfirm]);

  const consequences = [
    t("profile.privacy.delete.item.profile"),
    t("profile.privacy.delete.item.lives"),
    t("profile.privacy.delete.item.chat"),
    t("profile.privacy.delete.item.follows"),
  ];

  return (
    <>
      <ProfileCard>
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-orange-500/10 text-orange-500">
            <ShieldCheck aria-hidden="true" className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-gray-950 dark:text-white">
              {t("profile.privacy.title")}
            </h2>
            <p className="mt-1 text-sm leading-6 text-gray-500 dark:text-gray-400">
              {t("profile.privacy.desc")}
            </p>
          </div>
        </div>

        <div className="mt-5 space-y-3">
          <div className="flex flex-col gap-4 rounded-2xl bg-black/[0.03] p-5 sm:flex-row sm:items-center sm:justify-between dark:bg-white/[0.04]">
            <div className="min-w-0">
              <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                {t("profile.privacy.export.title")}
              </h3>
              <p className="mt-1 text-sm leading-6 text-gray-500 dark:text-gray-400">
                {t("profile.privacy.export.desc")}
              </p>
            </div>

            <button
              type="button"
              onClick={handleExport}
              disabled={exporting || !token}
              aria-busy={exporting}
              className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-2xl bg-orange-500 px-5 py-2.5 text-sm font-semibold text-[#1a0f05] shadow-sm transition hover:bg-orange-400 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-orange-500/30 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {exporting ? (
                <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
              ) : (
                <Download aria-hidden="true" className="h-4 w-4" />
              )}
              {exporting
                ? t("profile.privacy.export.loading")
                : t("profile.privacy.export.button")}
            </button>
          </div>

          {exportError ? (
            <div
              role="alert"
              className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300"
            >
              {exportError}
            </div>
          ) : null}

          {exportDone ? (
            <div
              role="status"
              aria-live="polite"
              className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700 dark:border-green-900/40 dark:bg-green-950/30 dark:text-green-300"
            >
              {t("profile.privacy.export.success")}
            </div>
          ) : null}

          <div className="flex flex-col gap-4 rounded-2xl border border-red-200 bg-red-50/60 p-5 sm:flex-row sm:items-center sm:justify-between dark:border-red-900/40 dark:bg-red-950/20">
            <div className="min-w-0">
              <h3 className="text-base font-semibold text-red-700 dark:text-red-300">
                {t("profile.privacy.delete.title")}
              </h3>
              <p className="mt-1 text-sm leading-6 text-red-700/80 dark:text-red-300/80">
                {t("profile.privacy.delete.desc")}
              </p>
            </div>

            <button
              ref={triggerRef}
              type="button"
              onClick={openConfirm}
              disabled={!token}
              aria-haspopup="dialog"
              className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-2xl border border-red-300 bg-white px-5 py-2.5 text-sm font-semibold text-red-600 transition hover:bg-red-600 hover:text-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-red-500/30 disabled:cursor-not-allowed disabled:opacity-60 dark:border-red-900/60 dark:bg-transparent dark:text-red-300 dark:hover:bg-red-600 dark:hover:text-white"
            >
              <Trash2 aria-hidden="true" className="h-4 w-4" />
              {t("profile.privacy.delete.button")}
            </button>
          </div>
        </div>
      </ProfileCard>

      {confirmOpen ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-black/50 px-4 py-6 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeConfirm();
          }}
        >
          <div
            ref={dialogRef}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={descId}
            className="w-full max-w-md overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#1f1712]"
          >
            <div className="px-6 pt-6">
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-950/50 dark:text-red-300">
                <TriangleAlert aria-hidden="true" className="h-5 w-5" />
              </div>

              <h2
                id={titleId}
                className="text-lg font-bold text-gray-900 dark:text-white"
              >
                {t("profile.privacy.delete.dialogTitle")}
              </h2>

              <div id={descId} className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                <p>{t("profile.privacy.delete.dialogIntro")}</p>
                <ul className="mt-3 list-disc space-y-1 pl-5">
                  {consequences.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
                <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                  {t("profile.privacy.delete.dialogHint")}
                </p>
              </div>

              {deleteError ? (
                <div
                  role="alert"
                  className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300"
                >
                  {deleteError}
                </div>
              ) : null}
            </div>

            <div className="mt-6 flex flex-col-reverse gap-3 border-t border-gray-200 px-6 py-4 sm:flex-row sm:justify-end dark:border-white/10">
              <button
                ref={cancelRef}
                type="button"
                onClick={closeConfirm}
                disabled={deleting}
                className="inline-flex items-center justify-center rounded-2xl border border-black/15 bg-white shadow-sm px-4 py-3 text-sm font-semibold text-gray-800 transition hover:bg-[#fffaf2] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-orange-500/30 disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/15 dark:text-gray-200 dark:hover:bg-white/10"
              >
                {t("profile.privacy.delete.cancel")}
              </button>

              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                aria-busy={deleting}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-red-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-red-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-red-500/30 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {deleting ? (
                  <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 aria-hidden="true" className="h-4 w-4" />
                )}
                {deleting
                  ? t("profile.privacy.delete.deleting")
                  : t("profile.privacy.delete.confirm")}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
