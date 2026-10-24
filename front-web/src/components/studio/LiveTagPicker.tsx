"use client";

import { useState } from "react";
import { Plus } from "lucide-react";

import Chip from "@/components/studio/Chip";
import { MAX_TAGS, TAG_GROUPS } from "@/components/studio/liveTags";
import { useI18n } from "@/i18n/LanguageContext";

/** Tag chooser: every category visible, plus a free field for a custom tag. */
export default function LiveTagPicker({
  tags,
  onChange,
}: Readonly<{ tags: readonly string[]; onChange: (tags: string[]) => void }>) {
  const { t } = useI18n();
  const [customTag, setCustomTag] = useState("");
  const full = tags.length >= MAX_TAGS;

  const toggle = (tag: string) => {
    if (tags.includes(tag)) {
      onChange(tags.filter((item) => item !== tag));
    } else if (!full) {
      onChange([...tags, tag]);
    }
  };

  const addCustom = () => {
    const cleaned = customTag.trim();
    if (!cleaned) return;
    const exists = tags.some((tag) => tag.toLowerCase() === cleaned.toLowerCase());
    if (!exists && !full) onChange([...tags, cleaned]);
    setCustomTag("");
  };

  return (
    <div className="rounded-2xl border border-black/8 bg-white/80 p-3 dark:border-white/10 dark:bg-white/[0.04]">
      <div className="mb-3 flex flex-wrap gap-2" aria-live="polite">
        {tags.length === 0 ? (
          <span className="text-xs text-gray-400 dark:text-white/35">
            {t("studio.info.tags")}
          </span>
        ) : (
          tags.map((tag) => (
            <span key={tag} className="fs-pop inline-flex">
              <Chip active onClick={() => toggle(tag)} label={tag} />
            </span>
          ))
        )}
      </div>

      <div className="space-y-2">
        {TAG_GROUPS.map((group) => (
          <div
            key={group.title}
            className="rounded-xl border border-black/5 bg-white/70 dark:border-white/10 dark:bg-white/[0.03]"
          >
            <h3 className="px-3 pt-3 text-xs font-semibold uppercase tracking-[0.16em] text-gray-500 dark:text-white/45">
              {group.title}
            </h3>

            <div className="flex flex-wrap gap-2 px-3 pb-3 pt-2.5">
              {group.tags.map((tag) => (
                <Chip
                  key={tag}
                  active={tags.includes(tag)}
                  onClick={() => toggle(tag)}
                  label={tag}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3 flex gap-2">
        <input
          aria-label={t("studio.info.addTag")}
          value={customTag}
          maxLength={100}
          onChange={(e) => setCustomTag(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addCustom();
            }
          }}
          placeholder={t("studio.info.addTag")}
          className="min-w-0 flex-1 rounded-xl border border-black/8 bg-white px-3 py-2 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-300/30 dark:border-white/10 dark:bg-[#1f1712]/80 dark:text-white"
        />

        <button
          type="button"
          onClick={addCustom}
          className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-3 py-2 text-sm font-semibold text-[#1a0f05] transition hover:bg-orange-400"
        >
          <Plus aria-hidden="true" className="h-4 w-4" />
          {t("studio.info.addTagBtn")}
        </button>
      </div>
    </div>
  );
}
