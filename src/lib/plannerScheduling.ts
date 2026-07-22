export function plannerDateKey(value: string | null | undefined): string | null {
  const match = value?.match(/^(\d{4}-\d{2}-\d{2})/);
  return match?.[1] ?? null;
}

export function isPlannerTaskEligible(
  taskId: string,
  scheduledFor: string | null | undefined,
  planningDate: string,
  automaticallyScheduledTaskIds: ReadonlySet<string>,
): boolean {
  // An automatic placement is disposable: reorganizing must be allowed to
  // pull it back into today's next free slot. Only a user-selected date acts
  // as a real "not before" constraint.
  if (automaticallyScheduledTaskIds.has(taskId)) return true;
  const availableFrom = plannerDateKey(scheduledFor);
  return !availableFrom || availableFrom <= planningDate;
}

function shiftPlannerDate(date: string, days: number): string {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

function plannerDaysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86_400_000);
}

export function plannerTaskAvailableDate(input: {
  today: string;
  scheduledFor?: string | null;
  deadline?: string | null;
  automaticallyScheduled: boolean;
}): string {
  const scheduledFor = plannerDateKey(input.scheduledFor);
  // A date explicitly chosen by the user is a real "not before" promise.
  // Dates written by the automatic planner are recalculated on every roll.
  if (!input.automaticallyScheduled && scheduledFor) {
    return scheduledFor > input.today ? scheduledFor : input.today;
  }

  const deadline = plannerDateKey(input.deadline);
  if (!deadline || deadline <= input.today) return input.today;

  const daysUntilDeadline = plannerDaysBetween(input.today, deadline);
  // Do not consume all future work tomorrow. Start short-horizon work roughly
  // halfway to delivery, and reserve up to two weeks of lead time for work due
  // farther out. The forward scheduler still advances off weekends and around
  // protected/Google Calendar events.
  const leadDays = Math.min(14, Math.max(1, Math.ceil(daysUntilDeadline / 2)));
  const availableFrom = shiftPlannerDate(deadline, -leadDays);
  return availableFrom > input.today ? availableFrom : input.today;
}
