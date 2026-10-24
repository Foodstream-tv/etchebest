"use client";

import { useEffect, useState, type ReactNode } from "react";

type AppBackgroundProps = Readonly<{
  children: ReactNode;
}>;

// A calm warm backdrop for the whole app: warm charcoal in dark mode, cream in light mode.
// No floating glows: the food photography and the live pictures carry the colour.
export default function AppBackground({ children }: AppBackgroundProps) {
  const [isDark, setIsDark] = useState(true);

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

    return () => {
      observer.disconnect();
    };
  }, []);

  return (
    <div
      className={`relative min-h-screen overflow-hidden ${
        isDark ? "text-[#f5ede0]" : "text-[#1f1711]"
      }`}
    >
      <div
        className={`absolute inset-0 ${isDark ? "bg-[#14100d]" : "bg-[#f6f1e9]"}`}
        aria-hidden="true"
      />

      <div
        className="absolute inset-0"
        aria-hidden="true"
        style={{
          background: isDark
            ? "radial-gradient(ellipse at 25% 0%, #261910 0%, #14100d 62%)"
            : "radial-gradient(ellipse at 25% 0%, #fffaf2 0%, #f6f1e9 68%)",
        }}
      />

      <div className="relative z-[10] min-h-screen">{children}</div>
    </div>
  );
}
