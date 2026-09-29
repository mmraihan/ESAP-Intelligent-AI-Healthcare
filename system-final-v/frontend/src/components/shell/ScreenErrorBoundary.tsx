/**
 * Contains a crash to the one screen that caused it.
 *
 * Without this, an error while rendering any page unmounts the whole app and
 * leaves a blank window — the shell, the navigation and the way out all go with
 * it. Here the shell stays, the content area says what happened, and moving to
 * another screen (or retrying) starts clean.
 */
import { Component, type ReactNode } from "react";
import { Banner, Button } from "@/components/ui/primitives";
import { AlertIcon } from "@/components/ui/icons";

type Props = { children: ReactNode };
type State = { error: Error | null };

export class ScreenErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    // Still reported, so it is not silently swallowed during development.
    console.error("[esap] screen failed to render:", error);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <Banner tone="critical" icon={<AlertIcon size={16} />} title="This screen could not be shown">
        Something on this page failed to load. Nothing you saved has been lost. Try again, or use
        the menu to go somewhere else.
        <div style={{ marginTop: 10 }}>
          <Button size="sm" onClick={() => this.setState({ error: null })}>Try again</Button>
        </div>
      </Banner>
    );
  }
}
