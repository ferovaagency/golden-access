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

/** El enlace de administración de Whop: sólo https y sólo whop.com o sus subdominios. */
export function safePortalUrl(value: unknown): string {
  if (typeof value !== "string") throw new Error("No se recibió un enlace válido de Whop.");
  const url = new URL(value);
  const host = url.hostname.toLowerCase();
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.port ||
    (host !== "whop.com" && !host.endsWith(".whop.com"))
  )
    throw new Error("El enlace de administración no pertenece a Whop.");
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
        "Whop confirma que esta suscripción está cancelada. Tu cuenta sigue en el plan Gratis con todos tus datos.",
      cancelable: false,
    };
  if (state.cancel_at)
    return {
      title: "Renovación cancelada",
      description: `La cancelación está programada para el ${date(state.cancel_at)}. Hasta esa fecha se conserva el período pagado; después tu cuenta pasa al plan Gratis.`,
      cancelable: false,
    };
  if (state.status === "none")
    return {
      title: "Sin suscripción de pago",
      description:
        "Estás en el plan Gratis. Si acabas de pagar, actualiza el estado en unos momentos.",
      cancelable: false,
    };
  if (state.status === "trialing")
    return {
      title: "Suscripción en prueba",
      description:
        "Puedes cancelar desde Whop antes de que termine la prueba. Allí verás la fecha efectiva y las condiciones antes de confirmar.",
      cancelable: true,
    };
  if (state.status === "past_due")
    return {
      title: "Hay un pago pendiente",
      description:
        "Actualiza el método de pago en Whop o cancela la renovación. La cancelación no elimina importes ya pendientes.",
      cancelable: true,
    };
  if (state.status === "paused")
    return {
      title: "Suscripción pausada",
      description: "Administra tu suscripción o solicita su cancelación en Whop.",
      cancelable: true,
    };
  return {
    title: "Suscripción activa",
    description: state.next_billed_at
      ? `Próxima renovación: ${date(state.next_billed_at)}.`
      : "La fecha de renovación se puede consultar en Whop.",
    cancelable: true,
  };
}
