"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { API } from "@/lib/api";

export default function Home() {
  const router = useRouter();
  useEffect(() => {
    // The session is an httpOnly cookie: ask the API whether it is still valid.
    fetch(`${API}/api/users/me`, { credentials: "include" })
      .then((res) => router.replace(res.ok ? "/dashboard" : "/login"))
      .catch(() => router.replace("/login"));
  }, [router]);

  return null;
}
