import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Conditions Générales d'Utilisation (CGU) | FoodStream",
  description:
    "Conditions Générales d'Utilisation, statut d'hébergeur (LCEN / DSA), propriété intellectuelle et droit de citation sur FoodStream.",
};

const sections = [
  {
    title: "1. Objet et Présentation de la Plateforme",
    content:
      "FoodStream est une plateforme communautaire interactive dédiée à la cuisine, permettant la diffusion de flux vidéo en direct (lives), le visionnage de rediffusions, l'échange au sein d'espaces de discussion et la consultation de fiches de recettes. L'accès et l'utilisation de la plateforme impliquent l'acceptation sans réserve des présentes Conditions Générales d'Utilisation (CGU).",
  },
  {
    title: "2. Statut d'Hébergeur et Régime de Responsabilité (LCEN & DSA)",
    content:
      "Conformément à l'article 6 de la Loi n° 2004-575 du 21 juin 2004 pour la Confiance dans l'Économie Numérique (LCEN) et au Règlement (UE) 2022/2065 relatif aux Services Numériques (Digital Services Act - DSA), FoodStream intervient en qualité d'intermédiaire technique et d'hébergeur pour l'ensemble des contenus (vidéos, tchats, fiches recettes, photographies, commentaires) mis en ligne ou diffusés par ses utilisateurs. À ce titre, FoodStream n'est soumise à aucune obligation générale de surveiller les informations stockées, ni de rechercher des faits ou circonstances révélant des activités illicites.",
  },
  {
    title: "3. Responsabilité de l'Utilisateur et Propriété Intellectuelle",
    content:
      "Chaque utilisateur est personnellement et exclusivement responsable des contenus, photographies, textes et flux qu'il téléverse, génère ou diffuse sur la plateforme. L'utilisateur garantit détenir l'intégralité des droits d'auteur, droits voisins et autorisations nécessaires sur les contenus qu'il publie, ou que ceux-ci relèvent des exceptions légales prévues par le Code de la Propriété Intellectuelle. Il est strictement interdit de publier des photographies protégées sans autorisation, de se livrer au plagiat ou à la contrefaçon de créations protégées.",
  },
  {
    title: "4. Outil d'Import de Recettes et Droit de Citation (Art. L122-5 CPI)",
    content:
      "FoodStream met à disposition des créateurs un outil technique d'aide à la saisie permettant de pré-remplir les données techniques d'une recette (liste brute d'ingrédients, minutages de cuisson, ustensiles) à partir d'une URL tierce. Les données factuelles et techniques n'étant pas protégeables par le droit d'auteur, l'utilisateur demeure néanmoins tenu de personnaliser ses étapes de préparation et de fournir ses propres visuels de réalisation. Lorsqu'une recette est inspirée d'une œuvre tierce, la mention de la source originale est requise au titre de la courte citation (article L122-5 du Code de la Propriété Intellectuelle). FoodStream est un service indépendant et n'est ni affilié, ni sponsorisé, ni partenaire des éditeurs de sites tiers (dont Marmiton / Reworld Media).",
  },
  {
    title: "5. Procédure de Signalement et Retrait de Contenus (Notice & Take Down)",
    content:
      "En application des dispositions du Digital Services Act (DSA) et de l'article 6-I-5 de la LCEN, toute personne ou titulaire de droits constatant une atteinte à ses droits de propriété intellectuelle ou la présence d'un contenu manifestement illicite peut le notifier immédiatement à FoodStream. La notification doit préciser l'URL exacte du contenu incriminé, la description de l'infraction alléguée et la preuve de titularité des droits. FoodStream s'engage à traiter avec diligence tout signalement conforme et à retirer promptement tout contenu illicite ou en rendre l'accès impossible.",
  },
  {
    title: "6. Modération, Sanctions et Suspension de Compte",
    content:
      "FoodStream se réserve le droit de modérer, masquer ou supprimer tout contenu ne respectant pas les présentes CGU, la législation en vigueur ou les droits de tiers. En cas de violations répétées (notamment en matière de contrefaçon, de harcèlement ou de diffusion de contenus préjudiciables), FoodStream peut suspendre temporairement ou résilier définitivement le compte de l'utilisateur concerné, sans préjudice de poursuites civiles ou pénales éventuelles.",
  },
  {
    title: "7. Données Personnelles et Liens Hypertextes",
    content:
      "La collecte et le traitement des données à caractère personnel sont détaillés dans notre Politique de Confidentialité accessible sur le site. Les liens hypertextes pointant vers des sites externes (notamment vers les sources de recettes citées) sont fournis à titre de référence et d'attribution loyale de source ; FoodStream n'exerce aucun contrôle sur le contenu ou les pratiques de ces sites tiers.",
  },
  {
    title: "8. Droit Applicable et Juridiction Compétente",
    content:
      "Les présentes Conditions Générales d'Utilisation sont régies et interprétées selon le droit français. À défaut de résolution amiable, tout litige relatif à leur validité, leur interprétation ou leur exécution sera soumis à la compétence exclusive des tribunaux français compétents.",
  },
];

export default function CGUPage() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl px-6 py-12 sm:py-16">
      <div className="mb-10 max-w-3xl space-y-5">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-orange-500 dark:text-orange-400">
          Légal & Réglementation
        </p>

        <h1 className="text-4xl font-semibold tracking-tight text-gray-900 dark:text-gray-50 sm:text-5xl">
          Conditions Générales d&apos;Utilisation
        </h1>

        <p className="text-base leading-7 text-gray-600 dark:text-gray-300">
          Statut d&apos;hébergeur (LCEN / DSA européen), respect de la propriété
          intellectuelle, droit de citation et règles d&apos;utilisation de FoodStream.
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
          Signalement d&apos;un contenu ou contact légal
        </h2>

        <p className="mt-3 text-sm leading-7 text-gray-600 dark:text-gray-300">
          Pour toute demande de retrait au titre des droits d&apos;auteur (Notice and Take Down)
          ou pour signaler un abus conformément au Digital Services Act (DSA), contactez l&apos;équipe
          FoodStream via le support produit ou par courriel à l&apos;adresse de modération.
        </p>

        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            href="/"
            className="inline-flex h-11 items-center justify-center rounded-2xl bg-orange-500 px-5 text-sm font-semibold text-white transition hover:bg-orange-400"
          >
            Retour à l&apos;accueil
          </Link>
          <Link
            href="/confidentialite"
            className="inline-flex h-11 items-center justify-center rounded-2xl border border-black/10 bg-white px-5 text-sm font-semibold text-gray-700 transition hover:bg-black/[0.02] dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10"
          >
            Politique de confidentialité
          </Link>
        </div>
      </section>
    </main>
  );
}
