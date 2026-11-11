import { Component, ErrorInfo, ReactNode } from "react";
import { loadLanguage, TRANSLATIONS } from "../i18n";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error("Uncaught UI error:", error, errorInfo);
  }

  private handleReload = (): void => {
    window.location.reload();
  };

  public render(): ReactNode {
    if (this.state.hasError) {
      const lang = loadLanguage();
      const t = TRANSLATIONS[lang];
      return (
        <div className="app-container items-center justify-center p-6 text-center gap-3">
          <div className="text-sm font-medium">{t.errorTitle}</div>
          <button
            type="button"
            onClick={this.handleReload}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary)] cursor-pointer hover:opacity-90 transition-opacity"
          >
            {t.errorRetry}
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
