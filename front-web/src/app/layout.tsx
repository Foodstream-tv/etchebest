import type { Metadata } from "next";
import "./globals.css";
import { cookies } from "next/headers";
import { Inter } from "next/font/google";
import { ThemeProvider, type Theme } from "@/components/theme/ThemeProvider";
import AppBackground from "@/components/layout/AppBackground";
import { NotificationProvider } from "@/components/notifications/NotificationProvider";
import NotificationPoller from "@/components/notifications/NotificationPoller";
import ScheduledLiveToast from "@/components/notifications/ScheduledLiveToast";
import SessionGuard from "@/components/notifications/SessionGuard";
import { LanguageProvider, type Locale } from "@/i18n/LanguageContext";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "FoodStream",
  description: "Streaming de cuisine en direct",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const cookieTheme = cookieStore.get("theme")?.value as Theme | undefined;
  const initialTheme: Theme = cookieTheme === "dark" ? "dark" : "light";
  const cookieLocale = cookieStore.get("locale")?.value as Locale | undefined;
  const initialLocale: Locale = cookieLocale === "en" ? "en" : "fr";

  return (
    <html
      lang={initialLocale}
      className={`${inter.variable} ${initialTheme === "dark" ? "dark" : ""}`}
    >
      <body
        suppressHydrationWarning
        className="min-h-screen text-gray-900 dark:text-gray-50"
      >
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-9999 focus:rounded-xl focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-bold focus:text-gray-900 focus:shadow-lg dark:focus:bg-[#120b05] dark:focus:text-white"
        >
          Aller au contenu principal
        </a>

        <ThemeProvider initialTheme={initialTheme}>
          <LanguageProvider initialLocale={initialLocale}>
            <NotificationProvider>
              <SessionGuard />
              <NotificationPoller />
              <ScheduledLiveToast />
              <AppBackground>{children}</AppBackground>
            </NotificationProvider>
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}