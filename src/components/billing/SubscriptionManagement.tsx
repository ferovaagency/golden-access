import { useCallback, useEffect, useRef, useState } from "react";
import { CreditCard, ExternalLink, Loader2, RefreshCw, X } from "lucide-react";
import { getBillingStatus, openBillingPortal } from "../../lib/billingActions";
import { billingMessage, type BillingStatus, type PortalIntent } from "../../lib/billingModel";
export interface BillingServices {
  status: () => Promise<BillingStatus>;
  open: (intent: PortalIntent) => Promise<void>;
}
const services: BillingServices = { status: getBillingStatus, open: openBillingPortal };
/** Self-service is available even when access to paid modules has expired. */
export function SubscriptionManagement({
  onChanged,
  api = services,
}: {
  onChanged?: () => void;
  api?: BillingServices;
}) {
  const [state, setState] = useState<BillingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<PortalIntent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [opened, setOpened] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const request = useRef(0);
  const changed = useRef(onChanged);
  changed.current = onChanged;
  const refresh = useCallback(async () => {
    const id = ++request.current;
    setLoading(true);
    setError(null);
    try {
      const next = await api.status();
      if (id === request.current) setState(next);
    } catch (e) {
      if (id === request.current)
        setError(e instanceof Error ? e.message : "No se pudo consultar la suscripción.");
    } finally {
      if (id === request.current) setLoading(false);
    }
  }, [api]);
  useEffect(() => {
    void refresh();
    const focus = () => {
      void refresh();
      changed.current?.();
    };
    window.addEventListener("focus", focus);
    return () => {
      request.current++;
      window.removeEventListener("focus", focus);
    };
  }, [refresh]);
  const open = async (intent: PortalIntent) => {
    setBusy(intent);
    setError(null);
    try {
      await api.open(intent);
      dialog.current?.close();
      setOpened(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo abrir Paddle.");
    } finally {
      setBusy(null);
    }
  };
  const summary = state ? billingMessage(state) : null;
  return (
    <section className="billing-card" aria-labelledby="billing-title">
      <div className="billing-heading">
        <div>
          <span className="billing-eyebrow">TU CUENTA</span>
          <h2 id="billing-title">Administrar suscripción</h2>
        </div>
        <CreditCard size={22} aria-hidden="true" />
      </div>
      <p>
        Consulta tus pagos, descarga facturas, actualiza el método de pago o cancela tu suscripción
        sin contactar a soporte.
      </p>
      <div className="billing-state" aria-live="polite" aria-busy={loading}>
        {loading ? (
          <p className="billing-loading">
            <Loader2 size={17} className="animate-spin" aria-hidden="true" /> Consultando el estado
            en Paddle…
          </p>
        ) : summary ? (
          <>
            <h3>{summary.title}</h3>
            <p>{summary.description}</p>
          </>
        ) : (
          <p>No pudimos confirmar el estado actual.</p>
        )}
      </div>
      {error && (
        <p role="alert" className="billing-error">
          {error}
        </p>
      )}
      {opened && (
        <p role="status" className="billing-notice">
          Paddle se abrió para completar tu solicitud. No se ha confirmado ningún cambio aquí. Al
          volver, actualiza el estado para comprobar el resultado.
        </p>
      )}
      <div className="billing-actions">
        <button
          type="button"
          className="billing-primary"
          onClick={() => void open("overview")}
          disabled={!!busy || (state?.can_manage === false && !error)}
        >
          {busy === "overview" ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <ExternalLink size={16} />
          )}{" "}
          Abrir administración en Paddle
        </button>
        <button
          type="button"
          className="billing-secondary"
          onClick={() => {
            void refresh();
            changed.current?.();
          }}
          disabled={loading || !!busy}
        >
          <RefreshCw size={16} /> Actualizar estado
        </button>
      </div>
      {(summary?.cancelable || (!state && !loading)) && (
        <div className="billing-cancel">
          <div>
            <h3>Cancelar suscripción</h3>
            <p>
              Paddle mostrará la fecha efectiva antes de la confirmación final. No necesitas
              explicar el motivo a Ferova.
            </p>
          </div>
          <button
            type="button"
            className="billing-secondary"
            disabled={!!busy}
            onClick={() => dialog.current?.showModal()}
          >
            Cancelar suscripción
          </button>
        </div>
      )}
      <p className="billing-footnote">
        Cancelar la suscripción no solicita la eliminación de tu cuenta. La gestión se abre en una
        página segura de Paddle.
      </p>
      <dialog
        ref={dialog}
        className="billing-dialog"
        aria-labelledby="cancel-title"
        onCancel={(e) => {
          if (busy) e.preventDefault();
        }}
      >
        <header>
          <h2 id="cancel-title">Cancelar tu suscripción</h2>
          <button
            type="button"
            aria-label="Cerrar confirmación"
            disabled={!!busy}
            onClick={() => dialog.current?.close()}
          >
            <X size={22} />
          </button>
        </header>
        <p>
          Vas a abrir la cancelación en Paddle. Allí verás cuándo termina la suscripción y
          confirmarás tu decisión.
        </p>
        {state?.status === "active" && state.current_period_ends_at && (
          <p>
            El período de facturación actual termina el{" "}
            <strong>{new Date(state.current_period_ends_at).toLocaleDateString("es-CO")}</strong>.
            Consulta la fecha definitiva en Paddle antes de confirmar.
          </p>
        )}
        {state?.status === "trialing" && (
          <p>
            La cancelación de una prueba puede ser inmediata. Revisa la fecha que indique Paddle.
          </p>
        )}
        {state?.status === "past_due" && (
          <p>Cancelar no elimina los importes que ya estén pendientes de pago.</p>
        )}
        {error && (
          <p role="alert" className="billing-error">
            {error}
          </p>
        )}
        <div className="billing-actions">
          <button
            type="button"
            className="billing-primary"
            disabled={!!busy}
            onClick={() => void open("cancel")}
          >
            {busy === "cancel" ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <ExternalLink size={16} />
            )}{" "}
            Continuar a la cancelación
          </button>
          <button
            type="button"
            className="billing-secondary"
            disabled={!!busy}
            onClick={() => dialog.current?.close()}
          >
            Volver
          </button>
        </div>
      </dialog>
    </section>
  );
}
