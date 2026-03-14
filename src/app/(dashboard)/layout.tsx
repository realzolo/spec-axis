import Sidebar from '@/components/layout/Sidebar';
import OnboardingCheck from '@/components/settings/OnboardingCheck';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-muted/40">
      <Sidebar />
      <main className="flex-1 overflow-hidden flex flex-col bg-muted/40">
        {children}
      </main>
      <OnboardingCheck />
    </div>
  );
}
