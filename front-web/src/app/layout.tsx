import type { Metadata } from "next";
import "./globals.css";
import { cookies } from "next/headers";
import { Inter } from "next/font/google";
import { ThemeProvider, type Theme } from "@/components/theme/ThemeProvider";
import AppBackground from "@/components/layout/AppBackground";
import { NotificationProvider } from "@/components/notifications/NotificationProvider";
import NotificationPoller from "@/components/notifications/NotificationPoller";

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

  return (
    <html
      lang="fr"
      className={`${inter.variable} ${initialTheme === "dark" ? "dark" : ""}`}
    >
      <body  suppressHydrationWarning className="min-h-screen text-gray-900 dark:text-gray-50">
        <ThemeProvider initialTheme={initialTheme}>
          <NotificationProvider>
            <NotificationPoller />
            <AppBackground>{children}</AppBackground>
          </NotificationProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}