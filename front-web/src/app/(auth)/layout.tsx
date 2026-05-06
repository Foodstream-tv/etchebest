import React from "react";
import AuthRouteTransition from "@/components/auth/AuthRouteTransition";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl items-center justify-center px-6 py-12">
      <div className="grid w-full items-center gap-10 lg:grid-cols-[1.05fr_480px]">
        <section className="hidden lg:block">
          <p className="text-sm font-semibold uppercase tracking-[0.28em] text-orange-500 dark:text-orange-400">
            FOODSTREAM
          </p>

          <h1 className="mt-5 max-w-3xl text-5xl font-semibold leading-[1.03] tracking-[-0.03em] text-gray-900 dark:text-gray-50 xl:text-6xl">
            Cuisinez, diffusez et partagez vos lives avec les{" "}
            <span className="text-orange-500 dark:text-orange-400">
              meilleurs chefs
            </span>.
          </h1>

          <p className="mt-6 max-w-xl text-base leading-8 text-gray-600 dark:text-gray-400">
            Lives culinaires, masterclass privées et une communauté qui cuisine ensemble.
          </p>
        </section>

        <section>
          <AuthRouteTransition>{children}</AuthRouteTransition>
        </section>
      </div>
    </main>
  );
}