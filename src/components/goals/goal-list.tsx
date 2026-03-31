"use client";

import { useState, useEffect, useCallback } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import type { Goal, GoalInput } from "@/lib/validators";
import { GoalItem } from "./goal-item";
import { GoalForm } from "./goal-form";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function GoalList() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | undefined>();

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const fetchGoals = useCallback(async () => {
    const res = await fetch("/api/goals");
    const data = await res.json();
    setGoals(Array.isArray(data) ? data : []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchGoals();
  }, [fetchGoals]);

  const handleAdd = async (data: GoalInput) => {
    const res = await fetch("/api/goals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      toast.success("Goal added");
      fetchGoals();
    } else {
      toast.error("Failed to add goal");
    }
  };

  const handleEdit = async (data: GoalInput) => {
    if (!editingGoal) return;
    const res = await fetch(`/api/goals/${editingGoal.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      toast.success("Goal updated");
      setEditingGoal(undefined);
      fetchGoals();
    } else {
      toast.error("Failed to update goal");
    }
  };

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/goals/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Goal deleted");
      fetchGoals();
    } else {
      toast.error("Failed to delete goal");
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = goals.findIndex((g) => g.id === active.id);
    const newIndex = goals.findIndex((g) => g.id === over.id);
    const reordered = arrayMove(goals, oldIndex, newIndex);
    setGoals(reordered);

    await fetch("/api/goals/reorder", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderedIds: reordered.map((g) => g.id) }),
    });
  };

  const openEdit = (goal: Goal) => {
    setEditingGoal(goal);
    setFormOpen(true);
  };

  const openAdd = () => {
    setEditingGoal(undefined);
    setFormOpen(true);
  };

  if (loading) {
    return <p className="text-muted-foreground text-center py-8">Loading goals...</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Your Goals</h2>
        <Button onClick={openAdd}>+ Add Goal</Button>
      </div>

      {goals.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
          <p className="text-lg font-medium">No goals yet</p>
          <p className="text-sm mt-1">Add your first health goal to get started.</p>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={goals.map((g) => g.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {goals.map((goal) => (
                <GoalItem
                  key={goal.id}
                  goal={goal}
                  onEdit={openEdit}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <GoalForm
        key={editingGoal?.id ?? "new"}
        open={formOpen}
        onOpenChange={setFormOpen}
        onSubmit={editingGoal ? handleEdit : handleAdd}
        defaultValues={editingGoal}
      />
    </div>
  );
}
