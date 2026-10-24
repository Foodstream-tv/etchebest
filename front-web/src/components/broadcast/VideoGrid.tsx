"use client";

import { memo, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { MicOff, UserX, VideoOff } from "lucide-react";

import StreamView from "@/components/StreamView";
import { useI18n } from "@/i18n/LanguageContext";

export type VideoTile = {
  id: string;
  stream: MediaStream | null;
  label: string;
  /** The person's own tile: its audio is never played back. */
  local?: boolean;
  cameraOff?: boolean;
  micOff?: boolean;
  /** Shown instead of the video when there is no stream (waiting, error…). */
  placeholder?: ReactNode;
  onKick?: () => void;
};

const GAP = 12;
const RATIO = 16 / 9;

type Layout = { cols: number; rows: number; width: number; height: number };

/**
 * Picks the number of columns that gives the biggest 16:9 tiles for `count`
 * tiles in a `width` x `height` stage (what Teams / Meet do). Landscape
 * screens get 1-2-3 side by side, portrait screens stack them.
 */
export function computeGridLayout(count: number, width: number, height: number): Layout {
  let best: Layout = { cols: 1, rows: Math.max(count, 1), width: 0, height: 0 };

  for (let cols = 1; cols <= Math.max(count, 1); cols += 1) {
    const rows = Math.ceil(Math.max(count, 1) / cols);
    const byWidth = (width - GAP * (cols - 1)) / cols;
    const byHeight = ((height - GAP * (rows - 1)) / rows) * RATIO;
    const tileWidth = Math.floor(Math.min(byWidth, byHeight));

    if (tileWidth > best.width) {
      best = { cols, rows, width: tileWidth, height: Math.floor(tileWidth / RATIO) };
    }
  }

  return best;
}

function chunk<T>(items: T[], size: number): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += size) rows.push(items.slice(i, i + size));
  return rows;
}

function initialOf(label: string) {
  return (label.trim()[0] ?? "?").toUpperCase();
}

const Tile = memo(function Tile({ tile, width, height }: Readonly<{ tile: VideoTile; width: number; height: number }>) {
  const { t } = useI18n();

  return (
    <figure
      style={{ width, height }}
      aria-label={t("broadcast.participantStreamAria", { name: tile.label })}
      className="group relative m-0 shrink-0 overflow-hidden rounded-2xl bg-neutral-900 ring-1 ring-white/10"
    >
      {tile.stream ? (
        <StreamView stream={tile.stream} muted={tile.local} />
      ) : (
        <div className="h-full w-full">{tile.placeholder}</div>
      )}

      {tile.cameraOff && tile.stream ? (
        <div className="absolute inset-0 grid place-items-center bg-neutral-900">
          <div className="grid place-items-center gap-2 text-white/80">
            <span
              aria-hidden="true"
              className="grid h-16 w-16 place-items-center rounded-full bg-white/10 text-2xl font-semibold text-white"
            >
              {initialOf(tile.label)}
            </span>
            <VideoOff aria-hidden="true" className="h-5 w-5" />
          </div>
        </div>
      ) : null}

      {tile.stream ? (
        <figcaption className="absolute bottom-2 left-2 flex max-w-[calc(100%-1rem)] items-center gap-1.5 rounded-lg bg-black/60 px-2.5 py-1 text-xs font-semibold text-white">
          <span className="truncate">{tile.label}</span>
          {tile.micOff ? <MicOff aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-red-300" /> : null}
        </figcaption>
      ) : null}

      {tile.onKick ? (
        <button
          type="button"
          onClick={tile.onKick}
          aria-label={`${t("broadcast.kickParticipant")} ${tile.label}`}
          title={t("broadcast.kickParticipant")}
          className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-lg bg-black/60 text-white opacity-0 transition hover:bg-red-600 focus-visible:opacity-100 group-hover:opacity-100 pointer-coarse:opacity-100"
        >
          <UserX aria-hidden="true" className="h-4 w-4" />
        </button>
      ) : null}
    </figure>
  );
});

export default function VideoGrid({ tiles }: Readonly<{ tiles: VideoTile[] }>) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;

    const update = () => setSize({ width: el.clientWidth, height: el.clientHeight });
    update();

    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const layout = useMemo(
    () => computeGridLayout(tiles.length, size.width, size.height),
    [tiles.length, size.width, size.height]
  );
  const rows = useMemo(() => chunk(tiles, layout.cols), [tiles, layout.cols]);

  return (
    <div
      ref={stageRef}
      data-testid="video-grid"
      data-cols={layout.cols}
      className="flex h-full w-full flex-col items-center justify-center"
      style={{ gap: GAP }}
    >
      {size.width > 0
        ? rows.map((row, rowIndex) => (
            <div key={rowIndex} className="flex justify-center" style={{ gap: GAP }}>
              {row.map((tile) => (
                <Tile key={tile.id} tile={tile} width={layout.width} height={layout.height} />
              ))}
            </div>
          ))
        : null}
    </div>
  );
}
