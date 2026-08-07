import { Baby } from "lucide-react";
import type { ReactNode } from "react";

export function EmptyState({ text, illustration }: { text: string; illustration?: ReactNode }) {
  return (
    <div className="empty-state">
      {illustration ?? <Baby size={24} />}
      <p>{text}</p>
    </div>
  );
}
