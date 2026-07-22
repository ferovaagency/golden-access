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
