import { IconButton } from "@radix-ui/themes";
import { PlusIcon } from "@radix-ui/react-icons";

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
      style={{
        position: "fixed",
        bottom: "calc(76px + env(safe-area-inset-bottom))",
        right: "16px",
        zIndex: 45,
        width: "56px",
        height: "56px",
        borderRadius: "50%",
        boxShadow: "0 4px 16px rgba(0, 0, 0, 0.2)",
      }}
    >
      <PlusIcon width="24" height="24" />
    </IconButton>
  );
}
