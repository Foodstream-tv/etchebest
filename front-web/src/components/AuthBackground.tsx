"use client";

import Image from "next/image";
import { ReactNode } from "react";


export default function AuthBackground({ children }: { children: ReactNode }) {
    return (
        <main className="relative min-h-screen w-full overflow-hidden">
        <div className="absolute inset-0 -z-10">
        <Image src="https://images.unsplash.com/photo-1504674900247-0877df9cc836" alt="food background" fill priority className="object-cover"/>
        <div className="absolute inset-0 bg-black/20" style={{ backdropFilter: `blur(var(--bg-blur))` }} />
        </div>
        <div className="h-6" />
        {children}
        </main>
    );
}
