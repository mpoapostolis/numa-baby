import { Baby } from "lucide-react";

export function EmptyState({ text }: { text: string }) {
  return <div className="empty-state"><Baby size={24} /><p>{text}</p></div>;
}
