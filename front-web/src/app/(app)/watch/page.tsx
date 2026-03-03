"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { getRooms, RoomInfo } from "@/services/streaming";

export default function WatchListPage() {
  const [rooms, setRooms] = useState<RoomInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const didInit = useRef(false);

  const refresh = async () => {
    try {
      setError(null);
      setLoading(true);
      const data = await getRooms();
      setRooms(data ?? []);
    } catch (e: any) {
      setError(e?.message ?? "Impossible de charger les lives");
      setRooms([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;

    refresh();

    const t = setInterval(refresh, 10_000);
    return () => clearInterval(t);
  }, []);

  const hasRooms = useMemo(() => rooms.length > 0, [rooms]);

  return (
    <div style={{ padding: 24, display: "grid", gap: 12 }}>
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <h1 style={{ margin: 0 }}>Lives en cours</h1>
        <button onClick={refresh} style={{ marginLeft: "auto" }}>
          Refresh
        </button>
        <Link href="/studio">Créer un live</Link>
      </div>

      {loading && <div>Chargement…</div>}

      {!loading && error && (
        <div style={{ color: "tomato" }}>
          {error} <button onClick={refresh}>Réessayer</button>
        </div>
      )}

      {!loading && !error && !hasRooms && (
        <div style={{ opacity: 0.8 }}>Aucun live en cours. Sois le premier !</div>
      )}

      {!loading && !error && hasRooms && (
        <div style={{ display: "grid", gap: 12 }}>
          {rooms.map((room) => {
            const spotsLeft = room.maxParticipants - room.participants.length;
            const rid = encodeURIComponent(room.id);

            return (
              <div
                key={room.id}
                style={{
                  border: "1px solid #333",
                  borderRadius: 12,
                  padding: 16,
                  display: "grid",
                  gap: 10,
                }}
              >
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <span
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: 999,
                      background: "#ff3b30",
                      display: "inline-block",
                    }}
                  />
                  <div style={{ fontWeight: 800, overflow: "hidden", textOverflow: "ellipsis" }}>
                    {room.name}
                  </div>
                </div>

                <div style={{ opacity: 0.75, fontSize: 14 }}>
                  {room.participants.length}/{room.maxParticipants} streamers • {room.viewers} spectateurs
                </div>

                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <Link href={`/watch/${rid}`}>Regarder</Link>

                  {spotsLeft > 0 ? (
                    <Link href={`/broadcast/${rid}?mode=join`}>Rejoindre ({spotsLeft})</Link>
                  ) : (
                    <span style={{ opacity: 0.6 }}>Complet</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
