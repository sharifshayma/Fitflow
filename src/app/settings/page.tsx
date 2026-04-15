import dynamic from "next/dynamic";
import { LogoutButton } from "@/components/layout/logout-button";
import { ApiToken } from "@/components/settings/api-token";
import { Separator } from "@/components/ui/separator";

const GoalList = dynamic(
  () => import("@/components/goals/goal-list").then((mod) => mod.GoalList),
  { loading: () => <p className="text-muted-foreground text-center py-8">Loading goals...</p> }
);

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">
          Manage your health goals. Drag to reorder.
        </p>
      </div>
      <GoalList />
      <Separator />
      <ApiToken />
      <Separator />
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Account</h2>
        <LogoutButton />
      </div>
    </div>
  );
}
