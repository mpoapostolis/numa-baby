import type { ReactNode } from "react";
import { SleepyMoon } from "./illustrations";

// Every empty state in the app is a friendly moment, never a bare dash or a
// blank chart: the sleeping moon by default, or a scene the caller picks.
export function EmptyState({ text, illustration }: { text: string; illustration?: ReactNode }) {
  return (
    <div className="empty-state">
      {illustration ?? <SleepyMoon size={72} />}
      <p>{text}</p>
    </div>
  );
}
