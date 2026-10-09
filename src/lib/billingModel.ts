/** Public billing state; never contains portal tokens or payment details. */
export interface BillingStatus {
  status: "active" | "trialing" | "past_due" | "paused" | "canceled" | "none";
  next_billed_at: string | null;
  current_period_ends_at: string | null;
  cancel_at: string | null;
  canceled_at: string | null;
  can_manage: boolean;
}
export type PortalIntent = "overview" | "cancel";
export function safePortalUrl(value: unknown): string {
  if (typeof value !== "string") throw new Error("No se recibió un enlace válido de Paddle.");
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.port ||
    !["customer-portal.paddle.com", "sandbox-customer-portal.paddle.com"].includes(url.hostname)
  )
    throw new Error("El enlace de administración no pertenece a Paddle.");
  return url.href;
}
export function billingMessage(state: BillingStatus): {
  title: string;
  description: string;
  cancelable: boolean;
} {
  const date = (value: string) =>
    new Date(value).toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric" });
  if (state.status === "canceled")
    return {
      title: "Suscripción cancelada",
      description:
        "Paddle confirma que esta suscripción está cancelada. Puedes consultar sus facturas en el portal.",
      cancelable: false,
    };
  if (state.cancel_at)
    return {
      title: "Renovación cancelada",
      description: `La cancelación está programada para el ${date(state.cancel_at)}. Hasta esa fecha se conserva el período vigente.`,
      cancelable: false,
    };
  if (state.status === "none")
    return {
      title: "Sin suscripción recurrente registrada",
      description:
        "No encontramos una suscripción en Paddle. Si acabas de completar el pago, actualiza el estado en unos momentos.",
      cancelable: false,
    };
  if (state.status === "trialing")
    return {
      title: "Suscripción en prueba",
      description:
        "Puedes cancelar la suscripción desde Paddle. Antes de confirmar, verás allí la fecha efectiva y las condiciones de la prueba.",
      cancelable: true,
    };
  if (state.status === "past_due")
    return {
      title: "Hay un pago pendiente",
      description:
        "Revisa el pago o cancela la renovación desde Paddle. La cancelación no elimina importes ya pendientes.",
      cancelable: true,
    };
  if (state.status === "paused")
    return {
      title: "Suscripción pausada",
      description: "Administra tu suscripción o solicita su cancelación en Paddle.",
      cancelable: true,
    };
  return {
    title: "Suscripción activa",
    description: state.next_billed_at
      ? `Próxima renovación: ${date(state.next_billed_at)}.`
      : "La fecha de renovación se puede consultar en Paddle.",
    cancelable: true,
  };
}
