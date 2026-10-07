import { router } from "@inertiajs/react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";
import { buttonClasses } from "@/Components/ui/button";

interface State {
  error: Error | null;
}

/**
 * Last line of defence around every page: a page that fails to render shows a way out
 * instead of a blank screen, and the next visit (or the back button) clears it.
 */
export class AppErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  private stopListening: (() => void) | null = null;

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidMount(): void {
    this.stopListening = router.on("navigate", () => {
      if (this.state.error) this.setState({ error: null });
    });
  }

  componentWillUnmount(): void {
    this.stopListening?.();
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error(error, info.componentStack);
  }

  render(): ReactNode {
    if (!this.state.error) return this.props.children;

    return (
      <main className="flex min-h-screen items-center justify-center bg-canvas px-6 text-ink">
        <div className="max-w-md space-y-5 text-center">
          <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-danger-soft text-danger">
            <AlertTriangle className="size-6" />
          </span>
          <div className="space-y-2">
            <h1 className="font-display text-2xl font-semibold">No pudimos mostrar esta página</h1>
            <p className="text-sm text-muted">Ocurrió un error inesperado. Recarga la página; si se repite, vuelve al inicio.</p>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            <button type="button" onClick={() => window.location.reload()} className={buttonClasses("primary")}>
              <RotateCcw className="size-4" /> Recargar
            </button>
            <a href="/" className={buttonClasses("secondary")}>
              Ir al inicio
            </a>
          </div>
        </div>
      </main>
    );
  }
}
