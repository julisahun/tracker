import { Component, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Catches render/commit crashes so a single failure doesn't white-screen the
 * whole app. The common trigger is a DOM-mutating browser extension (Google
 * Translate, Grammarly, …) rewriting the contenteditable body out from under
 * React, which makes the reconciler throw on its next commit
 * ("NotFoundError: Failed to execute 'insertBefore' … not a child of this
 * node"). Unsaved drafts live in the zustand store, which survives a remount,
 * so "Try again" re-renders against a clean React tree without losing edits.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    // Surface it for debugging; the UI handles recovery.
    console.error("Tracker crashed and was caught by the error boundary:", error);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="flex h-full flex-col items-center justify-center gap-5 bg-bg px-6 text-center text-fg">
        <span className="grid h-16 w-16 place-items-center rounded-2xl border border-line bg-surface text-danger">
          <AlertTriangle size={28} />
        </span>
        <div className="space-y-1">
          <p className="text-sm font-medium">Something went wrong.</p>
          <p className="max-w-sm text-sm text-muted">
            The view crashed, often because a browser extension (e.g. a
            translator) altered the page. Your unsaved edits are kept — try
            again.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => this.setState({ error: null })}
            className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-fg transition-colors hover:bg-accent-hover"
          >
            Try again
          </button>
          <button
            onClick={() => window.location.reload()}
            className="inline-flex items-center gap-2 rounded-lg border border-line px-4 py-2 text-sm font-medium text-fg transition-colors hover:bg-raised"
          >
            Reload
          </button>
        </div>
      </div>
    );
  }
}
