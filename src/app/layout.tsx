import "@/app/globals.css";
import type { Metadata } from "next";
import { ReactNode } from "react";


export const metadata: Metadata = {
  title: "FoodStream – Auth",
  description: "Connexion / Inscription",
};


export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="fr" className="h-full">
    <body className="min-h-screen antialiased">
    {children}
    </body>
    </html>
  );
}
