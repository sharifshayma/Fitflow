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

const schema = z.object({
  amount: z.coerce.number().min(0, "Must be 0 or greater"),
  logged_at: z.string().min(1, "Time is required"),
});

type FormValues = z.infer<typeof schema>;

type WaterLogFormProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  waterGoal: Goal;
  onSubmit: (data: {
    food_name: string;
    logged_at: string;
    values: { goal_id: string; value: number }[];
  }) => void;
};

export function WaterLogForm({ open, onOpenChange, waterGoal, onSubmit }: WaterLogFormProps) {
  const now = new Date();
  const localISO = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } = useForm<FormValues>({
    resolver: zodResolver(schema) as any,
    defaultValues: { amount: 0, logged_at: localISO },
  });

  useEffect(() => {
    if (open) {
      const now = new Date();
      const currentLocalISO = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16);
      reset({ amount: 0, logged_at: currentLocalISO });
    }
  }, [open, reset]);

  const handleFormSubmit = (data: FormValues) => {
    onSubmit({
      food_name: "Water",
      logged_at: new Date(data.logged_at).toISOString(),
      values: [{ goal_id: waterGoal.id, value: data.amount }],
    });
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Log Water</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="amount">Amount ({waterGoal.unit})</Label>
            <Input
              id="amount"
              type="number"
              step="any"
              placeholder={`e.g., 0.5`}
              {...register("amount")}
            />
            {errors.amount && (
              <p className="text-sm text-destructive">{errors.amount.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="logged_at">Time</Label>
            <Input id="logged_at" type="datetime-local" {...register("logged_at")} />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">Log Water</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
