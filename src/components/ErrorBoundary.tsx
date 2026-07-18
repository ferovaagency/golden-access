import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { logger } from '../lib/logger';

interface Props {
  children: React.ReactNode;
  fallback?: (error: Error, reset: () => void) => React.ReactNode;
  scope?: string;
}

interface State {
  error: Error | null;
}

// Application-wide error boundary. Catches render-time exceptions so the whole
// app never white-screens. Route-level boundaries can be added by wrapping
// individual <Route element={...}/> children with a scoped instance.
export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    logger.error(error, { scope: this.props.scope ?? 'ErrorBoundary', componentStack: info.componentStack });
  }

  reset = () => this.setState({ error: null });

  render() {
    if (!this.state.error) return this.props.children;
    if (this.props.fallback) return this.props.fallback(this.state.error, this.reset);
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-3xl border border-red-100 bg-white p-8 shadow-xl">
          <div className="flex items-center gap-3 mb-4">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-red-50 text-red-600">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <h1 className="font-display text-lg font-semibold text-slate-900">Algo salió mal</h1>
          </div>
          <p className="text-sm text-slate-600 mb-4">
            Ocurrió un error inesperado en esta pantalla. Tus datos están a salvo.
          </p>
          <pre className="mb-4 max-h-40 overflow-auto rounded-xl bg-slate-50 p-3 text-xs text-slate-700">
            {this.state.error.message}
          </pre>
          <div className="flex gap-2">
            <button
              onClick={this.reset}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              <RefreshCw className="h-4 w-4" /> Reintentar
            </button>
            <button
              onClick={() => (window.location.href = '/')}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Ir al inicio
            </button>
          </div>
        </div>
      </div>
    );
  }
}
