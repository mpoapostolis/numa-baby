import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "./components/ui/button";
import { t } from "./i18n";
// English if the crash beat the dictionary here — which is the point of
// the fallback: an untranslated sentence still tells someone what to do.

type Props = { children: ReactNode };
type State = { failed: boolean };

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (import.meta.env.DEV) console.error(error, info);
  }

  render() {
    if (!this.state.failed) return this.props.children;

    return (
      <main className="fatal-screen">
        <div className="brand-mark" aria-hidden="true">N</div>
        <h1>{t("Something didn’t load.")}</h1>
        <p>{t("The app stopped before continuing. Reload to try again; if this repeats, restore your latest backup.")}</p>
        <Button onClick={() => window.location.reload()}>{t("Try again")}</Button>
      </main>
    );
  }
}
