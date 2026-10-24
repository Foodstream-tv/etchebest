import React from "react";
import AuthRouteTransition from "@/components/auth/AuthRouteTransition";
import AuthHero from "@/components/auth/AuthHero";
import AccessibilityButton from "@/components/accessibility/AccessibilityButton";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
    <AccessibilityButton variant="floating" />
    <main id="main-content" className="mx-auto flex min-h-screen w-full max-w-[92rem] items-center justify-center px-6 py-12 lg:px-12 [@media(min-height:800px)]:lg:pb-20">
      <div className="grid w-full items-start gap-10 lg:grid-cols-[1fr_600px] lg:gap-14">
        {/* Natural height, top of the grid. The form card is pushed to the bottom of the row,
            so the room preview and the card end on the same line; on the long sign-up
            form the hero is sticky and stays in view. */}
        <section className="hidden lg:sticky lg:top-12 lg:flex lg:flex-col lg:self-start">
          <AuthHero />
        </section>

        <section className="lg:self-end">
          <AuthRouteTransition>{children}</AuthRouteTransition>
        </section>
      </div>
    </main>
    </>
  );
}
