import { AuthGate } from "./auth-client";

export default function AdminHomePage() {
  return (
    <AuthGate>
      <main className="p-8">
        <h1 className="text-2xl font-bold">Admin</h1>
        <p className="mt-2 text-sm opacity-80">
          Logged in. (Dashboard coming next.)
        </p>
      </main>
    </AuthGate>
  );
}
