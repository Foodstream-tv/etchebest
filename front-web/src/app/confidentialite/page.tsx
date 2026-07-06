import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Confidentialité | FoodStream",
  description: "Politique de confidentialité et gestion des cookies pour FoodStream.",
};

const sections = [
  {
    title: "Responsable du traitement",
    content:
      "FoodStream est responsable des données traitées pour la création du compte, la gestion des sessions et le fonctionnement du service. Les prestataires techniques n'agissent que sur instruction.",
  },
  {
    title: "Données traitées",
    content:
      "FoodStream traite les données nécessaires au fonctionnement du compte, des sessions live, des interactions, des préférences utilisateur, de la modération et du support.",
  },
  {
    title: "Finalités",
    content:
      "Les données servent à créer et sécuriser votre compte, fournir les lives, mémoriser vos préférences, prévenir les abus, répondre aux demandes et améliorer le service.",
  },
  {
    title: "Base légale",
    content:
      "Les traitements reposent selon les cas sur l'exécution du contrat, l'intérêt légitime de sécurité et de bon fonctionnement, le consentement pour les cookies non essentiels, ou les obligations légales.",
  },
  {
    title: "Cookies",
    content:
      "Les cookies strictement nécessaires sont utilisés pour l&apos;authentification, la langue, le thème et certaines préférences. Aucun traceur non essentiel n&apos;est activé sans consentement explicite.",
  },
  {
    title: "Destinataires",
    content:
      "Les données peuvent être partagées avec les équipes techniques, les prestataires d'hébergement et les services indispensables au fonctionnement de la plateforme, uniquement dans le cadre prévu.",
  },
  {
    title: "Conservation",
    content:
      "Les données sont conservées pendant la durée nécessaire à la relation de service, puis supprimées ou anonymisées selon les obligations légales applicables et les besoins de preuve ou de sécurité.",
  },
  {
    title: "Transferts",
    content:
      "Si des transferts hors Union européenne deviennent nécessaires, FoodStream s'assure d'un cadre juridique approprié, par exemple des clauses contractuelles types ou un mécanisme reconnu.",
  },
  {
    title: "Vos droits",
    content:
      "Vous pouvez demander l'accès, la rectification, l'effacement, la portabilité, la limitation ou l'opposition au traitement de vos données. Vous pouvez aussi retirer votre consentement à tout moment pour les cookies non essentiels.",
  },
  {
    title: "Exercer vos droits",
    content:
      "Pour exercer vos droits, utilisez le support du produit ou l'adresse de contact fournie par l'équipe. Une réponse claire est apportée dans les délais légaux applicables.",
  },
];

export default function ConfidentialitePage() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl px-6 py-12 sm:py-16">
      <div className="mb-10 max-w-3xl space-y-5">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-orange-500 dark:text-orange-400">
          Légal
        </p>

        <h1 className="text-4xl font-semibold tracking-tight text-gray-900 dark:text-gray-50 sm:text-5xl">
          Politique de confidentialité
        </h1>

        <p className="text-base leading-7 text-gray-600 dark:text-gray-300">
          Cette page résume les traitements de données de FoodStream et la façon
          dont nous gérons les cookies et les préférences de confidentialité.
        </p>
      </div>

      <section className="grid gap-5 md:grid-cols-2">
        {sections.map((section) => (
          <article
            key={section.title}
            className="rounded-3xl border border-black/8 bg-white/80 p-6 shadow-[0_16px_50px_rgba(15,23,42,0.06)] backdrop-blur-sm dark:border-white/10 dark:bg-white/[0.04]"
          >
            <h2 className="text-lg font-semibold tracking-tight text-gray-900 dark:text-gray-50">
              {section.title}
            </h2>

            <p className="mt-3 text-sm leading-7 text-gray-600 dark:text-gray-300">
              {section.content}
            </p>
          </article>
        ))}
      </section>

      <section className="mt-8 rounded-3xl border border-black/8 bg-white/80 p-6 shadow-[0_16px_50px_rgba(15,23,42,0.06)] backdrop-blur-sm dark:border-white/10 dark:bg-white/[0.04]">
        <h2 className="text-lg font-semibold tracking-tight text-gray-900 dark:text-gray-50">
          Contact
        </h2>

        <p className="mt-3 text-sm leading-7 text-gray-600 dark:text-gray-300">
          Pour exercer vos droits ou poser une question sur la confidentialité,
          contactez l&apos;équipe FoodStream depuis le support du produit.
        </p>

        <p className="mt-3 text-sm leading-7 text-gray-600 dark:text-gray-300">
          Cette politique est conçue pour couvrir les usages actuels de la plateforme web et peut être mise à jour si de nouvelles fonctionnalités ajoutent des traitements supplémentaires.
        </p>

        <div className="mt-5">
          <Link
            href="/"
            className="inline-flex h-11 items-center justify-center rounded-2xl bg-orange-500 px-4 text-sm font-semibold text-white transition hover:bg-orange-400"
          >
            Retour à l&apos;accueil
          </Link>
        </div>
      </section>
    </main>
  );
}
