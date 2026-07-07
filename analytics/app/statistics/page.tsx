"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { API, Room, User, isBanActive } from "@/lib/api";
import NavBar from "@/components/NavBar";
import {
  ChartCard,
  Donut,
  HBars,
  LineArea,
  Pt,
  Segment,
  VBars,
  VIZ,
  formatNum,
} from "@/components/charts";

const DAY = 86_400_000;

function KpiCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">{label}</p>
      <p className="text-3xl font-bold">{value}</p>
      {hint && <p className="text-xs text-gray-600 mt-1">{hint}</p>}
    </div>
  );
}

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function StatisticsPage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  // Captured at fetch time so the derived memo stays a pure function of state.
  const [now, setNow] = useState(0);

  const fetchData = useCallback(async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.replace("/login");
      return;
    }
    setLoading(true);
    setError("");
    setNow(Date.now());
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [usersRes, roomsRes] = await Promise.all([
        fetch(`${API}/api/admin/users`, { headers }),
        fetch(`${API}/api/rooms`, { headers }),
      ]);
      if (usersRes.status === 401 || usersRes.status === 403) {
        localStorage.removeItem("token");
        router.replace("/login");
        return;
      }
      setUsers(usersRes.ok ? await usersRes.json() : []);
      setRooms(roomsRes.ok ? await roomsRes.json() : []);
    } catch {
      setError("Failed to load data from the server.");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const stats = useMemo(() => {
    const totalStreams = users.reduce((s, u) => s + (u.totalLives ?? 0), 0);
    const totalViews = users.reduce((s, u) => s + (u.totalViews ?? 0), 0);
    const liveViewers = rooms.reduce((s, r) => s + (r.viewers ?? 0), 0);

    // --- Signups per month + cumulative growth (last 12 months) ---
    const dates = users
      .map((u) => (u.createdAt ? new Date(u.createdAt) : null))
      .filter((d): d is Date => d !== null && !Number.isNaN(d.getTime()));

    const perMonth = new Map<string, number>();
    for (const d of dates) {
      const k = monthKey(d);
      perMonth.set(k, (perMonth.get(k) ?? 0) + 1);
    }

    const nowDate = new Date(now);
    const months: { key: string; label: string; date: Date }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(nowDate.getFullYear(), nowDate.getMonth() - i, 1);
      months.push({
        key: monthKey(d),
        label: d.toLocaleString("en", { month: "short" }),
        date: d,
      });
    }

    const windowStart = months[0].date;
    let cumulative = dates.filter((d) => d < windowStart).length;
    const growth: Pt[] = [];
    const signups: Pt[] = [];
    for (const m of months) {
      const cnt = perMonth.get(m.key) ?? 0;
      cumulative += cnt;
      growth.push({ label: m.label, value: cumulative });
      signups.push({ label: m.label, value: cnt });
    }

    // --- Leaderboards ---
    const topViews: Pt[] = [...users]
      .filter((u) => (u.totalViews ?? 0) > 0)
      .sort((a, b) => b.totalViews - a.totalViews)
      .slice(0, 8)
      .map((u) => ({ label: `@${u.username}`, value: u.totalViews }));

    const topFollowers: Pt[] = [...users]
      .filter((u) => (u.followerCount ?? 0) > 0)
      .sort((a, b) => b.followerCount - a.followerCount)
      .slice(0, 8)
      .map((u) => ({ label: `@${u.username}`, value: u.followerCount }));

    // --- Streamer activity recency (from lastLiveAt) ---
    const buckets = { b7: 0, b30: 0, b90: 0, old: 0, never: 0 };
    for (const u of users) {
      if (!u.lastLiveAt) {
        buckets.never++;
        continue;
      }
      const diff = now - new Date(u.lastLiveAt).getTime();
      if (diff <= 7 * DAY) buckets.b7++;
      else if (diff <= 30 * DAY) buckets.b30++;
      else if (diff <= 90 * DAY) buckets.b90++;
      else buckets.old++;
    }
    const activity: Pt[] = [
      { label: "0–7d", value: buckets.b7 },
      { label: "8–30d", value: buckets.b30 },
      { label: "31–90d", value: buckets.b90 },
      { label: "90d+", value: buckets.old },
      { label: "Never", value: buckets.never },
    ];
    const activeStreamers = buckets.b7 + buckets.b30;

    // --- Account composition (mutually exclusive, by priority) ---
    let banned = 0;
    let chef = 0;
    let verified = 0;
    let standard = 0;
    for (const u of users) {
      if (isBanActive(u)) banned++;
      else if (u.isFeaturedChef) chef++;
      else if (u.isVerified) verified++;
      else standard++;
    }
    const composition: Segment[] = [
      { label: "Standard", value: standard, color: VIZ.blue },
      { label: "Verified", value: verified, color: VIZ.aqua },
      { label: "Featured chefs", value: chef, color: VIZ.yellow },
      { label: "Banned", value: banned, color: VIZ.red },
    ];

    // --- Live now: viewers by room ---
    const liveByRoom: Pt[] = [...rooms]
      .sort((a, b) => (b.viewers ?? 0) - (a.viewers ?? 0))
      .slice(0, 8)
      .map((r) => ({ label: r.name, value: r.viewers ?? 0 }));

    return {
      totalStreams,
      totalViews,
      liveViewers,
      activeStreamers,
      growth,
      signups,
      topViews,
      topFollowers,
      activity,
      composition,
      liveByRoom,
    };
  }, [users, rooms, now]);

  const avgViews =
    stats.totalStreams > 0 ? Math.round(stats.totalViews / stats.totalStreams) : 0;

  return (
    <div className="min-h-screen flex flex-col">
      <NavBar onRefresh={fetchData} />

      <main className="flex-1 px-6 py-6 max-w-7xl w-full mx-auto">
        {error && (
          <p className="text-red-400 text-sm bg-red-950/40 border border-red-800/50 rounded-lg px-4 py-3 mb-6">
            {error}
          </p>
        )}

        {loading ? (
          <p className="text-gray-500 text-sm py-16 text-center">Loading insights…</p>
        ) : (
          <>
            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
              <KpiCard label="Total users" value={users.length} />
              <KpiCard label="Total streams" value={formatNum(stats.totalStreams)} />
              <KpiCard label="Total views" value={formatNum(stats.totalViews)} />
              <KpiCard label="Live viewers" value={formatNum(stats.liveViewers)} hint="right now" />
              <KpiCard
                label="Active streamers"
                value={stats.activeStreamers}
                hint="live in last 30d"
              />
              <KpiCard label="Avg views / stream" value={formatNum(avgViews)} />
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="lg:col-span-2">
                <ChartCard
                  title="User growth"
                  subtitle="Cumulative registered accounts over the last 12 months"
                >
                  <LineArea data={stats.growth} />
                </ChartCard>
              </div>

              <ChartCard title="Top creators by views" subtitle="Lifetime views">
                <HBars data={stats.topViews} />
              </ChartCard>

              <ChartCard title="Top creators by followers" subtitle="Current follower count">
                <HBars data={stats.topFollowers} />
              </ChartCard>

              <div className="lg:col-span-2">
                <ChartCard title="New sign-ups" subtitle="Accounts created per month">
                  <VBars data={stats.signups} />
                </ChartCard>
              </div>

              <ChartCard
                title="Streamer activity"
                subtitle="Time since each creator last went live"
              >
                <VBars data={stats.activity} />
              </ChartCard>

              <ChartCard
                title="Account composition"
                subtitle="Every account, by highest-priority status"
              >
                <Donut segments={stats.composition} />
              </ChartCard>

              <div className="lg:col-span-2">
                <ChartCard
                  title="Live now — viewers by room"
                  subtitle="Real-time snapshot of active broadcasts"
                >
                  <HBars data={stats.liveByRoom} color={VIZ.aqua} />
                </ChartCard>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
