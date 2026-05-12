"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { Goal, GoalType, FoodLogWithValues } from "@/lib/validators";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type SubmitData = {
  food_name: string;
  logged_at: string;
  values: { goal_id: string; value: number }[];
};

type EditData = SubmitData & { id: string };

type LogDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  goals: Goal[];
  onSubmit: (data: SubmitData) => void;
  onEdit?: (id: string, data: SubmitData) => void;
  initialData?: SubmitData | null;
  editData?: EditData | null;
};

function getCurrentLocalISO() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}

// --- Food Form (inline) ---
function FoodFormContent({
  goals,
  onSubmit,
  onClose,
  initialData,
  editData,
  onEdit,
  open,
}: {
  goals: Goal[];
  onSubmit: LogDialogProps["onSubmit"];
  onEdit?: LogDialogProps["onEdit"];
  editData?: EditData | null;
  onClose: () => void;
  initialData: LogDialogProps["initialData"];
  open: boolean;
}) {
  const schema = z.object({
    food_name: z.string().min(1, "Food name is required"),
    logged_at: z.string().min(1, "Time is required"),
    ...Object.fromEntries(
      goals.map((g) => [
        `goal_${g.id}`,
        z.coerce.number().default(0),
      ])
    ),
  });

  type FormValues = z.infer<typeof schema>;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      food_name: "",
      logged_at: getCurrentLocalISO(),
      ...Object.fromEntries(goals.map((g) => [`goal_${g.id}`, 0])),
    },
  });

  const prefill = editData ?? initialData;

  useEffect(() => {
    if (open) {
      // For edit: keep original time. For copy/new: use current time.
      const loggedAt = editData
        ? new Date(new Date(editData.logged_at).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16)
        : getCurrentLocalISO();
      reset({
        food_name: prefill?.food_name ?? "",
        logged_at: loggedAt,
        ...Object.fromEntries(
          goals.map((g) => {
            const existing = prefill?.values.find((v) => v.goal_id === g.id);
            return [`goal_${g.id}`, existing?.value ?? 0];
          })
        ),
      });
    }
  }, [open, initialData, editData]);

  const isEditing = !!editData;

  const handleFormSubmit = (data: FormValues) => {
    const values = goals.map((g) => ({
      goal_id: g.id,
      value: Number(data[`goal_${g.id}` as keyof FormValues]) || 0,
    }));
    const submitData = {
      food_name: data.food_name,
      logged_at: new Date(data.logged_at).toISOString(),
      values,
    };
    if (isEditing && onEdit) {
      onEdit(editData.id, submitData);
    } else {
      onSubmit(submitData);
    }
    reset();
    onClose();
  };

  return (
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
          No food goals defined yet. Add goals in Settings first.
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit">{isEditing ? "Save" : "Log Food"}</Button>
      </div>
    </form>
  );
}

// --- Water Form (inline) ---
function WaterFormContent({
  waterGoal,
  onSubmit,
  onClose,
  onEdit,
  editData,
  open,
}: {
  waterGoal: Goal;
  onSubmit: LogDialogProps["onSubmit"];
  onEdit?: LogDialogProps["onEdit"];
  editData?: EditData | null;
  onClose: () => void;
  open: boolean;
}) {
  const schema = z.object({
    amount: z.coerce.number().min(0, "Must be 0 or greater"),
    logged_at: z.string().min(1, "Time is required"),
  });

  type FormValues = z.infer<typeof schema>;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } = useForm<FormValues>({
    resolver: zodResolver(schema) as any,
    defaultValues: { amount: 0, logged_at: getCurrentLocalISO() },
  });

  const isEditing = !!editData;

  useEffect(() => {
    if (open) {
      if (editData) {
        const waterValue = editData.values.find((v) => v.goal_id === waterGoal.id);
        const loggedAt = new Date(new Date(editData.logged_at).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);
        reset({ amount: waterValue?.value ?? 0, logged_at: loggedAt });
      } else {
        reset({ amount: 0, logged_at: getCurrentLocalISO() });
      }
    }
  }, [open, editData]);

  const handleFormSubmit = (data: FormValues) => {
    const submitData = {
      food_name: "Water",
      logged_at: new Date(data.logged_at).toISOString(),
      values: [{ goal_id: waterGoal.id, value: data.amount }],
    };
    if (isEditing && onEdit) {
      onEdit(editData.id, submitData);
    } else {
      onSubmit(submitData);
    }
    reset();
    onClose();
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="amount">Amount ({waterGoal.unit})</Label>
        <Input id="amount" type="number" step="any" placeholder="e.g., 0.5" {...register("amount")} />
        {errors.amount && <p className="text-sm text-destructive">{errors.amount.message}</p>}
      </div>
      <div className="space-y-2">
        <Label htmlFor="logged_at">Time</Label>
        <Input id="logged_at" type="datetime-local" {...register("logged_at")} />
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
        <Button type="submit">{isEditing ? "Save" : "Log Water"}</Button>
      </div>
    </form>
  );
}

// --- Weight Form (inline) ---
function WeightFormContent({
  weightGoal,
  onSubmit,
  onClose,
  onEdit,
  editData,
  open,
}: {
  weightGoal: Goal;
  onSubmit: LogDialogProps["onSubmit"];
  onEdit?: LogDialogProps["onEdit"];
  editData?: EditData | null;
  onClose: () => void;
  open: boolean;
}) {
  const schema = z.object({
    weight: z.coerce.number().positive("Must be a positive number"),
    logged_at: z.string().min(1, "Time is required"),
  });

  type FormValues = z.infer<typeof schema>;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } = useForm<FormValues>({
    resolver: zodResolver(schema) as any,
    defaultValues: { weight: 0, logged_at: getCurrentLocalISO() },
  });

  const isEditing = !!editData;

  useEffect(() => {
    if (open) {
      if (editData) {
        const weightValue = editData.values.find((v) => v.goal_id === weightGoal.id);
        const loggedAt = new Date(new Date(editData.logged_at).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);
        reset({ weight: weightValue?.value ?? 0, logged_at: loggedAt });
      } else {
        reset({ weight: 0, logged_at: getCurrentLocalISO() });
      }
    }
  }, [open, editData]);

  const handleFormSubmit = (data: FormValues) => {
    const submitData = {
      food_name: "Weight",
      logged_at: new Date(data.logged_at).toISOString(),
      values: [{ goal_id: weightGoal.id, value: data.weight }],
    };
    if (isEditing && onEdit) {
      onEdit(editData.id, submitData);
    } else {
      onSubmit(submitData);
    }
    reset();
    onClose();
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="weight">Weight ({weightGoal.unit})</Label>
        <Input id="weight" type="number" step="any" placeholder="e.g., 70" {...register("weight")} />
        {errors.weight && <p className="text-sm text-destructive">{errors.weight.message}</p>}
      </div>
      <div className="space-y-2">
        <Label htmlFor="logged_at">Time</Label>
        <Input id="logged_at" type="datetime-local" {...register("logged_at")} />
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
        <Button type="submit">{isEditing ? "Save" : "Log Weight"}</Button>
      </div>
    </form>
  );
}

// --- Main Dialog ---
export function LogDialog({ open, onOpenChange, goals, onSubmit, onEdit, initialData, editData }: LogDialogProps) {
  const [activeTab, setActiveTab] = useState<GoalType>("food");

  const foodGoals = goals.filter((g) => g.goal_type === "food");
  const waterGoal = goals.find((g) => g.goal_type === "water");
  const weightGoal = goals.find((g) => g.goal_type === "weight");

  // Set correct tab when dialog opens
  useEffect(() => {
    if (open) {
      if (editData) {
        // Determine tab from edit data's food_name
        const name = editData.food_name.toLowerCase();
        if (name === "water") setActiveTab("water");
        else if (name === "weight") setActiveTab("weight");
        else setActiveTab("food");
      } else {
        setActiveTab("food");
      }
    }
  }, [open, editData]);

  const isEditing = !!editData;
  const titles: Record<GoalType, string> = {
    food: isEditing ? "Edit Food" : "Log Food",
    water: isEditing ? "Edit Water" : "Log Water",
    weight: isEditing ? "Edit Weight" : "Log Weight",
  };

  const handleClose = () => onOpenChange(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{titles[activeTab]}</DialogTitle>
        </DialogHeader>

        {/* Category tabs inside the dialog */}
        <div className="flex gap-2">
          <Button
            type="button"
            variant={activeTab === "food" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveTab("food")}
          >
            Food
          </Button>
          <Button
            type="button"
            variant={activeTab === "water" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveTab("water")}
            disabled={!waterGoal}
            className={!waterGoal ? "opacity-50" : ""}
          >
            Water
          </Button>
          <Button
            type="button"
            variant={activeTab === "weight" ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveTab("weight")}
            disabled={!weightGoal}
            className={!weightGoal ? "opacity-50" : ""}
          >
            Weight
          </Button>
        </div>

        {activeTab === "food" && (
          <FoodFormContent
            goals={foodGoals}
            onSubmit={onSubmit}
            onEdit={onEdit}
            editData={editData}
            onClose={handleClose}
            initialData={initialData}
            open={open}
          />
        )}
        {activeTab === "water" && waterGoal && (
          <WaterFormContent
            waterGoal={waterGoal}
            onSubmit={onSubmit}
            onEdit={onEdit}
            editData={editData}
            onClose={handleClose}
            open={open}
          />
        )}
        {activeTab === "weight" && weightGoal && (
          <WeightFormContent
            weightGoal={weightGoal}
            onSubmit={onSubmit}
            onEdit={onEdit}
            editData={editData}
            onClose={handleClose}
            open={open}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
