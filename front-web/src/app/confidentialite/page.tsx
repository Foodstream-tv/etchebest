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
      "FoodStream, service porté par l'équipe FoodStream, est responsable des données traitées pour la création du compte, la gestion des sessions et le fonctionnement du service. Les prestataires techniques n'agissent que sur instruction.",
  },
  {
    title: "Données traitées",
    content:
      "FoodStream traite : les données de votre compte (adresse e-mail, nom, prénom, pseudo, numéro de téléphone, description, photo de profil, mot de passe chiffré, identifiant Google si vous vous connectez avec Google) ; les contenus que vous publiez (lives, replays, messages de chat) ; vos interactions (abonnements, notifications) ; vos préférences (langue, thème) ; les données de modération ; et les données techniques de connexion (adresse IP, journaux de sécurité).",
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
    title: "Lives, replays et chat",
    content:
      "Les lives sont enregistrés et peuvent être rediffusés en replay public : votre image et votre voix apparaissent dans l'enregistrement, ainsi que celles des co-streamers qui participent à votre live. Les messages du chat sont visibles par les personnes présentes dans le live. Vous pouvez supprimer vos replays depuis la page Replays ; la suppression du compte supprime aussi vos lives, replays et messages.",
  },
  {
    title: "Âge minimum",
    content:
      "FoodStream est réservé aux personnes âgées d'au moins 15 ans. Vous le confirmez en créant votre compte. Si vous pensez qu'une personne plus jeune a créé un compte, signalez-le à l'équipe : le compte et ses données seront supprimés.",
  },
  {
    title: "Cookies",
    content:
      "Les cookies strictement nécessaires sont utilisés pour l&apos;authentification, la langue, le thème et certaines préférences. Aucun traceur non essentiel n&apos;est activé sans consentement explicite.",
  },
  {
    title: "Destinataires",
    content:
      "Les données peuvent être partagées avec les équipes techniques, le prestataire d'hébergement, le prestataire d'envoi d'e-mails (codes de vérification, réinitialisation de mot de passe, confirmations de live) et Google : connexion avec Google, serveur STUN utilisé pour établir les connexions vidéo en direct (il reçoit votre adresse IP) et liens d'ajout au calendrier. Les contenus publics (profil, lives, replays) sont visibles par tous les visiteurs.",
  },
  {
    title: "Conservation",
    content:
      "Les données de votre compte et vos lives sont conservés tant que votre compte existe, puis supprimés lorsque vous le supprimez. Les replays restent disponibles tant que vous ne les supprimez pas. Les messages du chat sont supprimés 12 mois après le live, les notifications au bout de 90 jours et les journaux techniques (adresse IP) au bout de 30 jours. Un compte inactif pendant 3 ans est supprimé après vous en avoir prévenu par e-mail. Les codes de vérification et liens de réinitialisation sont supprimés au plus tard 24 heures après leur expiration. Certaines données peuvent être conservées plus longtemps si une obligation légale ou la défense de droits l'exige.",
  },
  {
    title: "Transferts",
    content:
      "Certains prestataires, notamment Google, peuvent traiter des données hors de l'Union européenne. FoodStream s'assure alors d'un cadre juridique approprié, par exemple des clauses contractuelles types ou un mécanisme reconnu.",
  },
  {
    title: "Vos droits",
    content:
      "Vous pouvez demander l'accès, la rectification, l'effacement, la portabilité, la limitation ou l'opposition au traitement de vos données. Vous pouvez aussi retirer votre consentement à tout moment pour les cookies non essentiels.",
  },
  {
    title: "Exercer vos droits",
    content:
      "Vous pouvez télécharger vos données et supprimer votre compte vous-même : depuis votre profil sur le site (« Mes données et confidentialité ») ou dans les réglages de l'application mobile. Pour toute autre demande, utilisez le support du produit ou l'adresse de contact fournie par l'équipe ; une réponse est apportée dans les délais légaux. Vous pouvez aussi introduire une réclamation auprès de la CNIL (www.cnil.fr).",
  },
];

// Read at request time: the contact address is configuration (PRIVACY_CONTACT_EMAIL), not code.
export const dynamic = "force-dynamic";

export default function ConfidentialitePage() {
  const contactEmail = process.env.PRIVACY_CONTACT_EMAIL?.trim();

  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl px-6 py-12 sm:py-16">
      <div className="mb-10 max-w-3xl space-y-5">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-orange-500 dark:text-orange-400">
          Légal
        </p>

        <h1 className="font-display text-4xl font-semibold tracking-tight text-gray-900 dark:text-gray-50 sm:text-5xl">
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
          contactez l&apos;équipe FoodStream
          {contactEmail ? (
            <>
              {" "}à l&apos;adresse{" "}
              <a
                href={`mailto:${contactEmail}`}
                className="font-medium underline hover:text-orange-500"
              >
                {contactEmail}
              </a>
              .
            </>
          ) : (
            " depuis le support du produit."
          )}
        </p>

        <p className="mt-3 text-sm leading-7 text-gray-600 dark:text-gray-300">
          Cette politique est conçue pour couvrir les usages actuels de la plateforme web et peut être mise à jour si de nouvelles fonctionnalités ajoutent des traitements supplémentaires.
        </p>

        <div className="mt-5">
          <Link
            href="/"
            className="inline-flex h-11 items-center justify-center rounded-2xl bg-orange-500 px-4 text-sm font-semibold text-[#1a0f05] transition hover:bg-orange-400"
          >
            Retour à l&apos;accueil
          </Link>
        </div>
      </section>
    </main>
  );
}
