import { AppHeader } from "@/components/AppHeader";
import { PushOptIn } from "@/components/PushOptIn";

export default function AppGroupLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader />
      <main className="mx-auto w-full max-w-4xl flex-1 space-y-6 p-4">
        <PushOptIn />
        {children}
      </main>
    </div>
  );
}
