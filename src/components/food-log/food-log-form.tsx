"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { Goal } from "@/lib/validators";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type FoodLogFormProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  goals: Goal[];
  onSubmit: (data: { food_name: string; logged_at: string; values: { goal_id: string; value: number }[] }) => void;
  initialData?: {
    food_name: string;
    logged_at: string;
    values: { goal_id: string; value: number }[];
  } | null;
};

export function FoodLogForm({ open, onOpenChange, goals, onSubmit, initialData }: FoodLogFormProps) {
  const schema = z.object({
    food_name: z.string().min(1, "Food name is required"),
    logged_at: z.string().min(1, "Time is required"),
    ...Object.fromEntries(
      goals.map((g) => [
        `goal_${g.id}`,
        z.coerce.number().min(0, "Must be 0 or greater").default(0),
      ])
    ),
  });

  type FormValues = z.infer<typeof schema>;

  const now = new Date();
  const localISO = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      food_name: "",
      logged_at: localISO,
      ...Object.fromEntries(goals.map((g) => [`goal_${g.id}`, 0])),
    },
  });

  useEffect(() => {
    if (open) {
      const now = new Date();
      const currentLocalISO = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16);
      reset({
        food_name: initialData?.food_name ?? "",
        logged_at: currentLocalISO,
        ...Object.fromEntries(
          goals.map((g) => {
            const existing = initialData?.values.find(v => v.goal_id === g.id);
            return [`goal_${g.id}`, existing?.value ?? 0];
          })
        ),
      });
    }
  }, [open, initialData]);

  const handleFormSubmit = async (data: FormValues) => {
    const values = goals.map((g) => ({
      goal_id: g.id,
      value: Number(data[`goal_${g.id}` as keyof FormValues]) || 0,
    }));

    await onSubmit({
      food_name: data.food_name,
      logged_at: new Date(data.logged_at).toISOString(),
      values,
    });
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Log Food</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="food_name">Food Name</Label>
            <Input id="food_name" placeholder="e.g., Chicken Breast" {...register("food_name")} />
            {errors.food_name && (
              <p className="text-sm text-destructive">{errors.food_name.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="logged_at">Time</Label>
            <Input id="logged_at" type="datetime-local" {...register("logged_at")} />
          </div>

          {goals.length > 0 && (
            <div className="space-y-3 rounded-lg border p-4">
              <p className="text-sm font-medium text-muted-foreground">Goal Values</p>
              {goals.map((goal) => (
                <div key={goal.id} className="flex items-center gap-3">
                  <Label htmlFor={`goal_${goal.id}`} className="flex-1 text-sm">
                    {goal.name} ({goal.unit})
                  </Label>
                  <Input
                    id={`goal_${goal.id}`}
                    type="number"
                    step="any"
                    className="w-24"
                    {...register(`goal_${goal.id}` as keyof FormValues)}
                  />
                </div>
              ))}
            </div>
          )}

          {goals.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-2">
              No goals defined yet. Add goals in Settings first.
            </p>
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              Log Food
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
