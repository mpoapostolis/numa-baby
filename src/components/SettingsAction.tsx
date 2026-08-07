import { ChevronRight } from "lucide-react";
import { Button } from "./ui/button";

export function SettingsAction({
  title,
  description,
  icon,
  onClick,
  className = "",
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  onClick: () => void;
  className?: string;
}) {
  return (
    <Button variant="ghost" className={`settings-action ${className}`.trim()} onClick={onClick}>
      <span className="settings-action-icon" aria-hidden="true">{icon}</span>
      <span className="settings-action-copy"><strong>{title}</strong><small>{description}</small></span>
      <ChevronRight className="settings-action-chevron" aria-hidden="true" />
    </Button>
  );
}
