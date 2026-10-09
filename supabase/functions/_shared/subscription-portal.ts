export interface PortalSubscription {
  id: string;
  customer_id: string;
  status: string;
  next_billed_at?: string | null;
  canceled_at?: string | null;
  current_billing_period?: { ends_at: string } | null;
  scheduled_change?: { action: string; effective_at: string } | null;
  custom_data?: { user_id?: string } | null;
}
export function billingSummary(sub: PortalSubscription) {
  return {
    ok: true,
    status: sub.status,
    subscription_id: sub.id,
    next_billed_at: sub.next_billed_at ?? null,
    current_period_ends_at: sub.current_billing_period?.ends_at ?? null,
    cancel_at: sub.scheduled_change?.action === "cancel" ? sub.scheduled_change.effective_at : null,
    canceled_at: sub.canceled_at ?? null,
    can_manage: true,
  };
}
export function assertSubscriptionOwner(
  sub: PortalSubscription,
  userId: string,
  customerId: string | null,
) {
  if (
    (customerId && sub.customer_id !== customerId) ||
    (sub.custom_data?.user_id && sub.custom_data.user_id !== userId)
  )
    throw new Error("La suscripción no corresponde a esta cuenta.");
}
export function portalLink(
  session: {
    urls: {
      general: { overview: string };
      subscriptions?: Array<{ id: string; cancel_subscription: string }>;
    };
  },
  intent: "overview" | "cancel",
  subscriptionId: string | null,
) {
  const value =
    intent === "cancel"
      ? session.urls.subscriptions?.find((s) => s.id === subscriptionId)?.cancel_subscription
      : session.urls.general.overview;
  if (!value) throw new Error("Paddle no devolvió el enlace solicitado.");
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.port ||
    !["customer-portal.paddle.com", "sandbox-customer-portal.paddle.com"].includes(url.hostname)
  )
    throw new Error("Paddle devolvió un enlace no permitido.");
  return url.href;
}
