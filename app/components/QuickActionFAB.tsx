import { PlusIcon } from "@radix-ui/react-icons";
import { IconButton } from "@radix-ui/themes";
import "./QuickActionFAB.css";

interface QuickActionFABProps {
  readonly onClick: () => void;
}

export function QuickActionFAB({ onClick }: QuickActionFABProps) {
  return (
    <IconButton
      className="quick-action-fab"
      size="4"
      onClick={onClick}
      aria-label="Quick actions"
    >
      <PlusIcon width="24" height="24" />
    </IconButton>
  );
}
