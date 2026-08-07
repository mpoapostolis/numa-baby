import { Plus } from "lucide-react";
import { Button } from "./ui/button";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "./ui/item";

export function QuickAction({
  title,
  description,
  icon,
  onClick,
  className = "",
  trailing = <Plus />,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  onClick: () => void;
  className?: string;
  trailing?: React.ReactNode;
}) {
  return (
    <Item asChild variant="outline" className={`quick-action ${className}`}>
      <Button variant="ghost" onClick={onClick}>
        <ItemMedia variant="icon" className="action-icon">{icon}</ItemMedia>
        <ItemContent>
          <ItemTitle>{title}</ItemTitle>
          <ItemDescription>{description}</ItemDescription>
        </ItemContent>
        <ItemActions>{trailing}</ItemActions>
      </Button>
    </Item>
  );
}
