import { GoalList } from "@/components/goals/goal-list";
import { LogoutButton } from "@/components/layout/logout-button";
import { ApiToken } from "@/components/settings/api-token";
import { Separator } from "@/components/ui/separator";

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
