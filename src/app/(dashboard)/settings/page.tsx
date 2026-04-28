import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { SettingsForm } from "@/components/settings-form";

export default async function SettingsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/sign-in");

  return (
    <div className="flex flex-col gap-8 max-w-2xl animate-fade-in-up">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage your account</p>
      </div>

      <SettingsForm
        userName={session.user.name ?? ""}
        userEmail={session.user.email ?? ""}
      />
    </div>
  );
}
