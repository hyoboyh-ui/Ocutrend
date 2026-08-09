import { AppHeader } from "@/components/AppHeader";
import { BottomNav } from "@/components/BottomNav";
import { PushOptIn } from "@/components/PushOptIn";

export default function AppGroupLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader />
      {/* Bottom padding clears the fixed BottomNav (h-14) plus the home indicator. */}
      <main className="mx-auto w-full max-w-4xl flex-1 space-y-6 p-4 pb-[calc(4.5rem+env(safe-area-inset-bottom))] sm:pb-4">
        <PushOptIn />
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
