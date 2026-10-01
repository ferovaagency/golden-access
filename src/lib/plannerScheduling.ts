/**
 * Entradas mínimas del Priority Score (Pareto 80/20). Es la ÚNICA fórmula del
 * planner: la usan la lista de prioridades, la agenda automática y el valor
 * que se publica en Notion. Antes la lista y la agenda calculaban distinto y la
 * agenda ni siquiera miraba el score — ordenaba sólo por prioridad manual.
 */
export interface PlannerScoreInput {
  deadline?: string | null;
  financial_impact?: number | null;
  client_impact?: number | null;
  risk_score?: number | null;
  execution_ease?: number | null;
  postponed_count?: number | null;
}

const clamp15 = (value: number | null | undefined) => {
  if (value === null || value === undefined) return 3;
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(1, Math.min(5, number)) : 3;
};

/** Días calendario entre hoy y la fecha de entrega (negativo = vencida). */
export function plannerDaysToDeadline(deadline: string | null | undefined, today: string): number | null {
  const key = plannerDateKey(deadline);
  if (!key) return null;
  return Math.round((Date.parse(`${key}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) / 86_400_000);
}

/**
 * Urgencia 1..5 por fecha de entrega. Vencida o para hoy/mañana = 5. Sin fecha
 * = 1: una tarea sin entrega compite sólo por impacto, nunca por urgencia.
 */
export function plannerUrgency(deadline: string | null | undefined, today: string): number {
  const days = plannerDaysToDeadline(deadline, today);
  if (days === null) return 1;
  if (days <= 1) return 5;
  if (days <= 3) return 4;
  if (days <= 7) return 3;
  return 2;
}

/**
 * Priority Score 1..6 (Manual 4.13 + anti-procrastinación):
 *   30 % urgencia · 25 % impacto financiero · 20 % impacto cliente ·
 *   15 % riesgo al aplazar · 10 % facilidad.
 * Más una escalada por cada vez que la tarea se pospuso (+0.2 por vez, tope
 * +1.0): lo que llevas evitando sube hasta que ya no se puede ignorar. Sin
 * esto, posponer no costaba nada y la tarea incómoda vivía al fondo para
 * siempre.
 */
export function plannerPriorityScore(task: PlannerScoreInput, today: string): number {
  const base = (0.30 * plannerUrgency(task.deadline, today))
    + (0.25 * clamp15(task.financial_impact))
    + (0.20 * clamp15(task.client_impact))
    + (0.15 * clamp15(task.risk_score))
    + (0.10 * clamp15(task.execution_ease));
  const postponed = Math.max(0, Number(task.postponed_count) || 0);
  return Math.round((base + Math.min(1, postponed * 0.2)) * 100) / 100;
}

/**
 * Orden de ataque: mayor score primero; a igual score, la entrega más cercana;
 * después la más veces pospuesta. Determinista para que la lista y la agenda
 * muestren exactamente el mismo orden.
 */
export function comparePlannerTasks<T extends PlannerScoreInput>(a: T, b: T, today: string): number {
  const score = plannerPriorityScore(b, today) - plannerPriorityScore(a, today);
  if (score) return score;
  const dueA = plannerDaysToDeadline(a.deadline, today) ?? Number.MAX_SAFE_INTEGER;
  const dueB = plannerDaysToDeadline(b.deadline, today) ?? Number.MAX_SAFE_INTEGER;
  if (dueA !== dueB) return dueA - dueB;
  return (Number(b.postponed_count) || 0) - (Number(a.postponed_count) || 0);
}

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
