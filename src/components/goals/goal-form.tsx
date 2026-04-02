"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { goalSchema, type GoalInput, type Goal, goalTypeOptions, goalDirectionOptions } from "@/lib/validators";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type GoalFormProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: GoalInput) => void;
  defaultValues?: Goal;
};

export function GoalForm({ open, onOpenChange, onSubmit, defaultValues }: GoalFormProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } = useForm<GoalInput>({
    resolver: zodResolver(goalSchema) as any,
    defaultValues: defaultValues
      ? { name: defaultValues.name, unit: defaultValues.unit, target_value: defaultValues.target_value, goal_type: defaultValues.goal_type ?? "food", direction: defaultValues.direction ?? "max" }
      : { name: "", unit: "", target_value: 0, goal_type: "food" as const, direction: "max" as const },
  });

  const handleFormSubmit = async (data: GoalInput) => {
    await onSubmit(data);
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{defaultValues ? "Edit Goal" : "Add Goal"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Goal Name</Label>
            <Input id="name" placeholder="e.g., Calories" {...register("name")} />
            {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="unit">Unit</Label>
            <Input id="unit" placeholder="e.g., kcal" {...register("unit")} />
            {errors.unit && <p className="text-sm text-destructive">{errors.unit.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="target_value">Daily Target</Label>
            <div className="flex gap-2">
              <select
                id="direction"
                className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring shrink-0"
                {...register("direction")}
              >
                {goalDirectionOptions.map((d) => (
                  <option key={d} value={d}>
                    {d === "max" ? "Max" : "Min"}
                  </option>
                ))}
              </select>
              <Input
                id="target_value"
                type="number"
                step="any"
                placeholder="e.g., 2000"
                {...register("target_value")}
              />
            </div>
            {errors.target_value && (
              <p className="text-sm text-destructive">{errors.target_value.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="goal_type">Type</Label>
            <select
              id="goal_type"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              {...register("goal_type")}
            >
              {goalTypeOptions.map((t) => (
                <option key={t} value={t}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {defaultValues ? "Save Changes" : "Add Goal"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
