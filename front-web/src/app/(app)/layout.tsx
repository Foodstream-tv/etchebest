import AppTopNav from "@/components/app/AppTopNav";
import PageContainer from "@/components/app/PageContainer";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <AppTopNav />
      <PageContainer className="py-6 lg:py-8">
        {children}
      </PageContainer>
    </>
  );
}
