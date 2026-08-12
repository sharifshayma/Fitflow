import { prisma } from "@/lib/prisma";

// Keeps the public demo account populated with recent data. Entirely inert
// unless DEMO_USER_ID is set to a real user id (self-hosters won't have one).
//
// When the demo account is accessed and its data has gone stale, it regenerates
// ~2 weeks of goals + food logs ending today, so the dashboard always looks
// current no matter when someone tries it.

const STALE_AFTER_DAYS = 2;

type Meal = { name: string; cal: number; p: number; c: number; f: number };
const BREAKFASTS: Meal[] = [
  { name: "Oatmeal with banana", cal: 350, p: 12, c: 60, f: 8 },
  { name: "Greek yogurt & berries", cal: 220, p: 20, c: 25, f: 5 },
  { name: "Scrambled eggs & toast", cal: 400, p: 24, c: 30, f: 20 },
  { name: "Avocado toast", cal: 380, p: 12, c: 40, f: 20 },
];
const LUNCHES: Meal[] = [
  { name: "Grilled chicken salad", cal: 450, p: 40, c: 20, f: 22 },
  { name: "Turkey sandwich", cal: 500, p: 30, c: 55, f: 18 },
  { name: "Quinoa & veggie bowl", cal: 520, p: 22, c: 65, f: 18 },
  { name: "Tuna wrap", cal: 430, p: 35, c: 40, f: 14 },
];
const DINNERS: Meal[] = [
  { name: "Salmon with rice", cal: 600, p: 42, c: 55, f: 24 },
  { name: "Beef & veggie stir-fry", cal: 650, p: 45, c: 50, f: 28 },
  { name: "Chicken pasta", cal: 700, p: 40, c: 80, f: 22 },
  { name: "Veggie curry & rice", cal: 550, p: 18, c: 85, f: 16 },
];
const SNACKS: Meal[] = [
  { name: "Protein shake", cal: 180, p: 30, c: 8, f: 3 },
  { name: "Apple & peanut butter", cal: 250, p: 8, c: 28, f: 14 },
  { name: "Handful of almonds", cal: 170, p: 6, c: 6, f: 15 },
  { name: "Protein bar", cal: 220, p: 20, c: 24, f: 8 },
];

const pick = <T>(a: T[]) => a[Math.floor(Math.random() * a.length)];

/** Wipe and regenerate the demo account's goals + ~2 weeks of logs, ending today. */
export async function seedDemo(userId: string): Promise<void> {
  await prisma.foodLog.deleteMany({ where: { userId } });
  await prisma.goal.deleteMany({ where: { userId } });

  const goal = (name: string, unit: string, target: number, goalType: string, direction: string, sortOrder: number) =>
    prisma.goal.create({ data: { userId, name, unit, targetValue: target, goalType, direction, sortOrder } });

  const calories = await goal("Calories", "kcal", 2000, "food", "max", 0);
  const protein = await goal("Protein", "g", 130, "food", "min", 1);
  const carbs = await goal("Carbs", "g", 220, "food", "max", 2);
  const fats = await goal("Fats", "g", 65, "food", "max", 3);
  const water = await goal("Water", "L", 3, "water", "min", 4);
  const weight = await goal("Weight", "kg", 72, "weight", "max", 5);

  const at = (daysAgo: number, hour: number, min = 0) => {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    d.setHours(hour, min, 0, 0);
    return d;
  };
  const foodLog = (name: string, when: Date, m: Meal) =>
    prisma.foodLog.create({
      data: {
        userId, foodName: name, loggedAt: when,
        values: { create: [
          { goalId: calories.id, value: m.cal }, { goalId: protein.id, value: m.p },
          { goalId: carbs.id, value: m.c }, { goalId: fats.id, value: m.f },
        ] },
      },
    });

  for (let day = 13; day >= 0; day--) {
    const b = pick(BREAKFASTS); await foodLog(b.name, at(day, 8, 15), b);
    const l = pick(LUNCHES); await foodLog(l.name, at(day, 13, 0), l);
    const dn = pick(DINNERS); await foodLog(dn.name, at(day, 19, 30), dn);
    if (Math.random() < 0.6) { const s = pick(SNACKS); await foodLog(s.name, at(day, 16, 0), s); }
    await prisma.foodLog.create({ data: { userId, foodName: "Water", loggedAt: at(day, 11, 0), values: { create: [{ goalId: water.id, value: 1.5 }] } } });
    await prisma.foodLog.create({ data: { userId, foodName: "Water", loggedAt: at(day, 18, 0), values: { create: [{ goalId: water.id, value: 1 + Math.round(Math.random()) * 0.5 }] } } });
    if (day % 3 === 0) { await prisma.foodLog.create({ data: { userId, foodName: "Weight", loggedAt: at(day, 7, 30), values: { create: [{ goalId: weight.id, value: 72.5 - (13 - day) * 0.1 }] } } }); }
  }
}

/**
 * If `userId` is the demo account and its data is stale, regenerate it.
 * No-op for every other user. Uses an atomic claim on the demo user's row so
 * concurrent requests don't reseed twice.
 */
export async function refreshDemoIfStale(userId: string): Promise<void> {
  const demoId = process.env.DEMO_USER_ID;
  if (!demoId || userId !== demoId) return;

  const staleBefore = new Date(Date.now() - STALE_AFTER_DAYS * 24 * 60 * 60 * 1000);

  // Atomic claim: only the request that flips updatedAt past the threshold reseeds.
  // updatedAt doubles as the "last refreshed" marker (nothing else touches the demo user row).
  const claim = await prisma.user.updateMany({
    where: { id: demoId, updatedAt: { lt: staleBefore } },
    data: { updatedAt: new Date() },
  });
  if (claim.count === 0) return; // fresh enough, or another request is already reseeding

  await seedDemo(demoId);
}
