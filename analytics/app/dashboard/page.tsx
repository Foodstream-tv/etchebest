"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { API, Room, User, adminAction, isBanActive } from "@/lib/api";
import UserActionsMenu, { UserAction } from "@/components/UserActionsMenu";
import BanModal from "@/components/BanModal";
import ConfirmModal from "@/components/ConfirmModal";
import NavBar from "@/components/NavBar";

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">{label}</p>
      <p className="text-3xl font-bold">{value}</p>
    </div>
  );
}

function Badge({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${color}`}>
      {children}
    </span>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [tab, setTab] = useState<"users" | "rooms">("users");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [banTarget, setBanTarget] = useState<{ user: User; permanent: boolean } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);

  const fetchData = useCallback(async () => {
    const token = localStorage.getItem("token");
    if (!token) { router.replace("/login"); return; }
    setLoading(true);
    setError("");
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

  useEffect(() => { fetchData(); }, [fetchData]);

  async function runAction(action: () => Promise<void>) {
    setError("");
    try {
      await action();
      await fetchData();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
    }
  }

  function handleUserAction(user: User, action: UserAction) {
    switch (action.type) {
      case "ban":
        setBanTarget({ user, permanent: action.permanent });
        break;
      case "unban":
        runAction(() => adminAction(`/api/admin/users/${user.id}/unban`, "POST"));
        break;
      case "delete":
        setDeleteTarget(user);
        break;
      case "toggleVerified":
        runAction(() =>
          adminAction(`/api/admin/users/${user.id}/status`, "PATCH", {
            isVerified: !user.isVerified,
          })
        );
        break;
      case "toggleChef":
        runAction(() =>
          adminAction(`/api/admin/users/${user.id}/status`, "PATCH", {
            isFeaturedChef: !user.isFeaturedChef,
          })
        );
        break;
      case "toggleRole":
        runAction(() =>
          adminAction(`/api/admin/users/${user.id}/status`, "PATCH", {
            role: user.role === "ADMIN" ? "USER" : "ADMIN",
          })
        );
        break;
    }
  }

  const admins = users.filter((u) => u.role === "ADMIN").length;
  const verified = users.filter((u) => u.isVerified).length;
  const chefs = users.filter((u) => u.isFeaturedChef).length;
  const banned = users.filter((u) => isBanActive(u)).length;
  const totalViewers = rooms.reduce((sum, r) => sum + (r.viewers ?? 0), 0);

  return (
    <div className="min-h-screen flex flex-col">
      <NavBar onRefresh={fetchData} />

      <main className="flex-1 px-6 py-6 max-w-7xl w-full mx-auto">
        {error && (
          <p className="text-red-400 text-sm bg-red-950/40 border border-red-800/50 rounded-lg px-4 py-3 mb-6">
            {error}
          </p>
        )}

        {/* Stat cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard label="Total users" value={loading ? "—" : users.length} />
          <StatCard label="Admins" value={loading ? "—" : admins} />
          <StatCard label="Verified" value={loading ? "—" : verified} />
          <StatCard label="Featured chefs" value={loading ? "—" : chefs} />
          <StatCard label="Banned" value={loading ? "—" : banned} />
          <StatCard label="Active rooms" value={loading ? "—" : rooms.length} />
          <StatCard label="Live viewers" value={loading ? "—" : totalViewers} />
          <StatCard
            label="Avg participants/room"
            value={
              loading || rooms.length === 0
                ? "—"
                : (
                    rooms.reduce((s, r) => s + (r.participants?.length ?? 0), 0) /
                    rooms.length
                  ).toFixed(1)
            }
          />
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-4 border-b border-gray-800 pb-0">
          {(["users", "rooms"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm capitalize border-b-2 -mb-px transition ${
                tab === t
                  ? "border-indigo-500 text-indigo-400"
                  : "border-transparent text-gray-500 hover:text-gray-300"
              }`}
            >
              {t} ({t === "users" ? users.length : rooms.length})
            </button>
          ))}
        </div>

        {loading ? (
          <p className="text-gray-500 text-sm py-8 text-center">Loading…</p>
        ) : tab === "users" ? (
          <UsersTable users={users} onAction={handleUserAction} />
        ) : (
          <RoomsTable rooms={rooms} />
        )}
      </main>

      {banTarget && (
        <BanModal
          user={banTarget.user}
          permanent={banTarget.permanent}
          onClose={() => setBanTarget(null)}
          onConfirm={async (reason, durationHours) => {
            await adminAction(`/api/admin/users/${banTarget.user.id}/ban`, "POST", {
              reason,
              durationHours,
            });
            setBanTarget(null);
            await fetchData();
          }}
        />
      )}

      {deleteTarget && (
        <ConfirmModal
          title="Delete user"
          body={
            <>
              <span className="font-medium text-gray-300">@{deleteTarget.username}</span> (
              {deleteTarget.email}) and their data will be permanently deleted. This cannot
              be undone.
            </>
          }
          confirmLabel="Delete user"
          onClose={() => setDeleteTarget(null)}
          onConfirm={async () => {
            await adminAction(`/api/admin/users/${deleteTarget.id}`, "DELETE");
            setDeleteTarget(null);
            await fetchData();
          }}
        />
      )}
    </div>
  );
}

function banTooltip(u: User): string {
  const until = u.bannedUntil
    ? `until ${new Date(u.bannedUntil).toLocaleString()}`
    : "permanently";
  return u.banReason ? `Banned ${until} — ${u.banReason}` : `Banned ${until}`;
}

function UsersTable({
  users,
  onAction,
}: {
  users: User[];
  onAction: (user: User, action: UserAction) => void;
}) {
  if (users.length === 0)
    return <p className="text-gray-500 text-sm py-8 text-center">No users found.</p>;

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-800">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-800 text-gray-400 text-xs uppercase tracking-wide">
            <th className="px-4 py-3 text-left">User</th>
            <th className="px-4 py-3 text-left">Email</th>
            <th className="px-4 py-3 text-left">Role</th>
            <th className="px-4 py-3 text-right">Followers</th>
            <th className="px-4 py-3 text-right">Lives</th>
            <th className="px-4 py-3 text-right">Views</th>
            <th className="px-4 py-3 text-left">Status</th>
            <th className="px-4 py-3 text-left">Joined</th>
            <th className="px-4 py-3 text-right">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => {
            const bannedNow = isBanActive(u);
            return (
              <tr
                key={u.id}
                className={`border-b border-gray-800/60 hover:bg-gray-900/60 transition ${
                  bannedNow ? "opacity-60" : ""
                }`}
              >
                <td className="px-4 py-3">
                  <p className="font-medium">
                    {u.firstName} {u.lastName}
                  </p>
                  <p className="text-gray-500 text-xs">@{u.username}</p>
                </td>
                <td className="px-4 py-3 text-gray-400">{u.email}</td>
                <td className="px-4 py-3">
                  {u.role === "ADMIN" ? (
                    <Badge color="bg-indigo-900/60 text-indigo-300">Admin</Badge>
                  ) : (
                    <Badge color="bg-gray-800 text-gray-400">User</Badge>
                  )}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">{u.followerCount}</td>
                <td className="px-4 py-3 text-right tabular-nums">{u.totalLives}</td>
                <td className="px-4 py-3 text-right tabular-nums">{u.totalViews}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-1 flex-wrap">
                    {bannedNow && (
                      <span title={banTooltip(u)}>
                        <Badge color="bg-red-900/60 text-red-400">
                          {u.bannedUntil ? "Banned (temp)" : "Banned"}
                        </Badge>
                      </span>
                    )}
                    {u.isVerified && (
                      <Badge color="bg-emerald-900/60 text-emerald-400">Verified</Badge>
                    )}
                    {u.isFeaturedChef && (
                      <Badge color="bg-amber-900/60 text-amber-400">Chef</Badge>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs">
                  {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "—"}
                </td>
                <td className="px-4 py-3 text-right">
                  <UserActionsMenu user={u} onAction={(a) => onAction(u, a)} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function RoomsTable({ rooms }: { rooms: Room[] }) {
  if (rooms.length === 0)
    return <p className="text-gray-500 text-sm py-8 text-center">No active rooms.</p>;

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-800">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-800 text-gray-400 text-xs uppercase tracking-wide">
            <th className="px-4 py-3 text-left">Room</th>
            <th className="px-4 py-3 text-left">ID</th>
            <th className="px-4 py-3 text-right">Participants</th>
            <th className="px-4 py-3 text-right">Viewers</th>
          </tr>
        </thead>
        <tbody>
          {rooms.map((r) => (
            <tr
              key={r.id}
              className="border-b border-gray-800/60 hover:bg-gray-900/60 transition"
            >
              <td className="px-4 py-3 font-medium">{r.name}</td>
              <td className="px-4 py-3 text-gray-500 font-mono text-xs">{r.id}</td>
              <td className="px-4 py-3 text-right tabular-nums">
                {r.participants?.length ?? 0} / {r.maxParticipants}
              </td>
              <td className="px-4 py-3 text-right tabular-nums">{r.viewers ?? 0}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
