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
  weight: z.coerce.number().positive("Must be a positive number"),
  logged_at: z.string().min(1, "Time is required"),
});

type FormValues = z.infer<typeof schema>;

type WeightLogFormProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  weightGoal: Goal;
  onSubmit: (data: {
    food_name: string;
    logged_at: string;
    values: { goal_id: string; value: number }[];
  }) => void;
};

export function WeightLogForm({ open, onOpenChange, weightGoal, onSubmit }: WeightLogFormProps) {
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
    defaultValues: { weight: 0, logged_at: localISO },
  });

  useEffect(() => {
    if (open) {
      const now = new Date();
      const currentLocalISO = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16);
      reset({ weight: 0, logged_at: currentLocalISO });
    }
  }, [open, reset]);

  const handleFormSubmit = (data: FormValues) => {
    onSubmit({
      food_name: "Weight",
      logged_at: new Date(data.logged_at).toISOString(),
      values: [{ goal_id: weightGoal.id, value: data.weight }],
    });
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Log Weight</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="weight">Weight ({weightGoal.unit})</Label>
            <Input
              id="weight"
              type="number"
              step="any"
              placeholder={`e.g., 70`}
              {...register("weight")}
            />
            {errors.weight && (
              <p className="text-sm text-destructive">{errors.weight.message}</p>
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
            <Button type="submit">Log Weight</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
