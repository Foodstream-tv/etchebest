import type { Metadata } from "next";
import "./globals.css";
import { cookies } from "next/headers";
import { ThemeProvider, type Theme } from "@/components/theme/ThemeProvider";

export const metadata: Metadata = {
  title: "FoodStream",
  description: "Streaming de cuisine en direct",
};

// ⛔️ surtout PAS de "use client" ici
export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // cookies() est async dans ta version de Next
  const cookieStore = await cookies();
  const cookieTheme = cookieStore.get("theme")?.value as Theme | undefined;
  const initialTheme: Theme = cookieTheme === "dark" ? "dark" : "light";

  return (
    <html lang="fr" className={initialTheme === "dark" ? "dark" : ""}>
      <body className="bg-neutral-50 text-gray-900 dark:bg-neutral-950 dark:text-gray-50">
        <ThemeProvider initialTheme={initialTheme}>{children}</ThemeProvider>
      </body>
    </html>
  );
}
