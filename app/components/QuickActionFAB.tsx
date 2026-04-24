import { PlusIcon } from "@radix-ui/react-icons";
import { Box, IconButton, Kbd } from "@radix-ui/themes";
import "./QuickActionFAB.css";

interface QuickActionFABProps {
  readonly onClick: () => void;
}

export function QuickActionFAB({ onClick }: QuickActionFABProps) {
  return (
    <Box className="quick-action-fab__container">
      <IconButton
        className="quick-action-fab"
        size="4"
        onClick={onClick}
        aria-label="Quick actions (Q)"
        aria-keyshortcuts="q"
      >
        <PlusIcon width="24" height="24" />
      </IconButton>
      <Box className="quick-action-fab__hint">
        <Kbd size="1">Q</Kbd>
      </Box>
    </Box>
  );
}
