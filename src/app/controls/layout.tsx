import Sidebar from "@/components/layout/Sidebar";

export default function SectionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 dark:bg-gray-950">
      <Sidebar />
      <div className="grc-main flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}
