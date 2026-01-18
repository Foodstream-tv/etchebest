import AppTopNav from "@/components/app/AppTopNav";
import PageContainer from "@/components/app/PageContainer";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AppTopNav />

      {/* Zone contenu standard de l'app */}
      <PageContainer className="py-8">{children}</PageContainer>
    </>
  );
}
