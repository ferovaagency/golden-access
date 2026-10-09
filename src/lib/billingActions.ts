import { invokeFn } from "./subscriptionActions";
import { safePortalUrl, type BillingStatus, type PortalIntent } from "./billingModel";
export async function getBillingStatus(): Promise<BillingStatus> {
  const data = await invokeFn("paddle-manage-subscription", { action: "status" });
  if (!data.ok) throw new Error(data.message || "No se pudo consultar la suscripción.");
  if (
    !["active", "trialing", "past_due", "paused", "canceled", "none"].includes(String(data.status))
  )
    throw new Error("Paddle devolvió un estado de suscripción desconocido.");
  return {
    status: data.status as BillingStatus["status"],
    next_billed_at: typeof data.next_billed_at === "string" ? data.next_billed_at : null,
    current_period_ends_at:
      typeof data.current_period_ends_at === "string" ? data.current_period_ends_at : null,
    cancel_at: typeof data.cancel_at === "string" ? data.cancel_at : null,
    canceled_at: typeof data.canceled_at === "string" ? data.canceled_at : null,
    can_manage: data.can_manage === true,
  };
}
export async function openBillingPortal(intent: PortalIntent): Promise<void> {
  // Reserve the window during the click, before awaiting a network response.
  const popup = window.open("about:blank", "_blank");
  if (popup) popup.opener = null;
  try {
    const data = await invokeFn("paddle-manage-subscription", { action: "portal", intent });
    if (!data.ok) throw new Error(data.message || "No se pudo abrir el portal de Paddle.");
    const url = safePortalUrl(data.url);
    if (popup && !popup.closed) popup.location.replace(url);
    else window.location.assign(url);
  } catch (error) {
    popup?.close();
    throw error;
  }
}
