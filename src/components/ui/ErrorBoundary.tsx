import { Component, type ReactNode, type ErrorInfo } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Shown in the message so the user knows which part failed. */
  area?: string;
  /** Remount the subtree instead of reloading, where that's meaningful. */
  onReset?: () => void;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Without this, a single component throwing renders a blank white page — React
 * unmounts the whole tree — and every unsaved edit goes with it, with nothing on
 * screen to explain what happened.
 *
 * Wrapping the editor pane separately from the shell means a crash in one editor
 * leaves the sidebar and the Library reachable, so a user can still get to their
 * saved work.
 */
export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Keep the detail in the console for a bug report; the UI stays calm.
    console.error("[CharacterBinder] component crashed:", error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ error: null });
    this.props.onReset?.();
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="h-full flex items-center justify-center p-8">
        <div className="max-w-md w-full card-panel p-6 space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-status-danger-soft flex items-center justify-center shrink-0">
              <AlertTriangle size={18} className="text-status-danger" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-text-primary">
                {this.props.area ? `The ${this.props.area} hit a problem` : "Something went wrong"}
              </h2>
              <p className="text-sm text-text-secondary mt-1 leading-relaxed">
                The rest of the app is still running, and anything you've saved to the Library is
                safe. Unsaved changes in this panel may be lost.
              </p>
            </div>
          </div>

          <pre className="text-xs text-text-muted bg-bg-tertiary rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-words">
            {error.message || String(error)}
          </pre>

          <div className="flex gap-2">
            <button onClick={this.handleReset} className="btn-primary py-2">
              <RotateCcw size={14} /> Try again
            </button>
            <button onClick={() => window.location.reload()} className="btn-secondary py-2">
              Reload the app
            </button>
          </div>
        </div>
      </div>
    );
  }
}
