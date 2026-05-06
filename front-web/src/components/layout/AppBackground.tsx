"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";

type OrbItem = {
  id: string;
  word: string;
  wrapperClassName: string;
  motionClassName: string;
};

const ORBS: OrbItem[] = [
  {
    id: "passion",
    word: "Passion",
    wrapperClassName:
      "right-[-140px] top-[-140px] h-[520px] w-[520px] md:h-[620px] md:w-[620px]",
    motionClassName: "fs-orb-a",
  },
  {
    id: "partage",
    word: "Partage",
    wrapperClassName:
      "left-[16%] top-[90px] h-[170px] w-[170px] md:h-[210px] md:w-[210px]",
    motionClassName: "fs-orb-b",
  },
  {
    id: "gourmandise",
    word: "Gourmandise",
    wrapperClassName:
      "left-[-120px] bottom-[-120px] h-[420px] w-[420px] md:h-[520px] md:w-[520px]",
    motionClassName: "fs-orb-c",
  },
];

const AUTH_PATHS = ["/signin", "/signup", "/forgot-password"];

export default function AppBackground({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [isDark, setIsDark] = useState(true);

  const showOrbWords = useMemo(() => {
    return AUTH_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
  }, [pathname]);

  useEffect(() => {
    const updateTheme = () => {
      setIsDark(document.documentElement.classList.contains("dark"));
    };

    updateTheme();

    const observer = new MutationObserver(updateTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => observer.disconnect();
  }, []);

  const getOrbBackground = (id: string) => {
    if (id === "passion") {
      return isDark
        ? "radial-gradient(circle at 45% 45%, rgba(255,120,0,0.88) 0%, rgba(255,90,0,0.55) 38%, rgba(255,120,0,0.18) 58%, transparent 76%)"
        : "radial-gradient(circle at 45% 45%, rgba(255,145,40,0.55) 0%, rgba(255,120,0,0.32) 38%, rgba(255,160,80,0.12) 58%, transparent 76%)";
    }

    if (id === "partage") {
      return isDark
        ? "radial-gradient(circle at 50% 50%, rgba(255,145,20,0.72) 0%, rgba(255,100,0,0.34) 42%, transparent 74%)"
        : "radial-gradient(circle at 50% 50%, rgba(255,150,30,0.45) 0%, rgba(255,120,0,0.22) 42%, transparent 74%)";
    }

    return isDark
      ? `
        radial-gradient(circle at 48% 55%, rgba(255,115,0,0.72) 0%, rgba(255,80,0,0.38) 34%, rgba(255,60,0,0.16) 50%, transparent 72%),
        linear-gradient(155deg, transparent 0%, transparent 42%, rgba(255,140,40,0.10) 50%, rgba(255,90,0,0.14) 58%, transparent 68%, transparent 100%)
      `
      : `
        radial-gradient(circle at 48% 55%, rgba(255,135,20,0.42) 0%, rgba(255,110,0,0.20) 34%, rgba(255,90,0,0.08) 50%, transparent 72%),
        linear-gradient(155deg, transparent 0%, transparent 42%, rgba(255,185,120,0.10) 50%, rgba(255,145,50,0.12) 58%, transparent 68%, transparent 100%)
      `;
  };

  return (
    <div
      className={`relative min-h-screen overflow-hidden ${
        isDark ? "text-gray-50" : "text-gray-900"
      }`}
    >
      <style jsx global>{`
        @keyframes fsOrbFloatA {
          0% { transform: translate3d(0, 0, 0) scale(1); }
          25% { transform: translate3d(30px, -18px, 0) scale(1.05); }
          50% { transform: translate3d(8px, -34px, 0) scale(1.08); }
          75% { transform: translate3d(-20px, -10px, 0) scale(1.03); }
          100% { transform: translate3d(0, 0, 0) scale(1); }
        }

        @keyframes fsOrbFloatB {
          0% { transform: translate3d(0, 0, 0) scale(1); }
          25% { transform: translate3d(-18px, 14px, 0) scale(1.03); }
          50% { transform: translate3d(-6px, 26px, 0) scale(1.06); }
          75% { transform: translate3d(14px, 8px, 0) scale(1.02); }
          100% { transform: translate3d(0, 0, 0) scale(1); }
        }

        @keyframes fsOrbFloatC {
          0% { transform: translate3d(0, 0, 0) scale(1); }
          25% { transform: translate3d(18px, -10px, 0) scale(1.04); }
          50% { transform: translate3d(6px, -24px, 0) scale(1.07); }
          75% { transform: translate3d(-14px, -8px, 0) scale(1.03); }
          100% { transform: translate3d(0, 0, 0) scale(1); }
        }

        @keyframes fsOrbGlow {
          0% { opacity: 0.82; filter: blur(0px); }
          50% { opacity: 1; filter: blur(10px); }
          100% { opacity: 0.82; filter: blur(0px); }
        }

        .fs-orb-a { animation: fsOrbFloatA 14s ease-in-out infinite; }
        .fs-orb-b { animation: fsOrbFloatB 18s ease-in-out infinite; }
        .fs-orb-c { animation: fsOrbFloatC 16s ease-in-out infinite; }
        .fs-orb-glow { animation: fsOrbGlow 7s ease-in-out infinite; }

        @media (prefers-reduced-motion: reduce) {
          .fs-orb-a,
          .fs-orb-b,
          .fs-orb-c,
          .fs-orb-glow {
            animation: none !important;
          }
        }
      `}</style>

      <div className={`absolute inset-0 ${isDark ? "bg-[#050505]" : "bg-[#f6f2ed]"}`} />

      <div
        className="absolute inset-0"
        style={{
          background: isDark
            ? "radial-gradient(circle at center, rgba(20,20,20,1) 0%, rgba(5,5,5,1) 70%)"
            : "radial-gradient(circle at center, rgba(255,255,255,1) 0%, rgba(246,242,237,1) 72%)",
        }}
      />

      <div className="pointer-events-none absolute inset-0 z-[2]">
        {ORBS.map((orb) => (
          <div
            key={orb.id}
            className={`absolute overflow-hidden rounded-full select-none ${orb.wrapperClassName} ${orb.motionClassName}`}
          >
            <div
              className="fs-orb-glow absolute inset-0 rounded-full"
              style={{
                background: getOrbBackground(orb.id),
              }}
            />

            {showOrbWords ? (
              <div className="absolute inset-0 flex items-center justify-center px-6 text-center">
                <span
                  className={`font-semibold tracking-[0.08em] ${
                    orb.id === "passion"
                      ? "text-2xl md:text-3xl"
                      : orb.id === "partage"
                      ? "text-sm md:text-base"
                      : "text-xl md:text-2xl"
                  } ${isDark ? "text-white/90" : "text-black/70"}`}
                >
                  {orb.word}
                </span>
              </div>
            ) : null}
          </div>
        ))}
      </div>

      <div className={`absolute inset-0 z-[3] ${isDark ? "bg-black/10" : "bg-white/20"}`} />

      <div className="relative z-[10] min-h-screen">{children}</div>
    </div>
  );
}