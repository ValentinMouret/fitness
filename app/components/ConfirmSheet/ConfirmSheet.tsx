import { BottomSheet } from "~/components/BottomSheet";
import "./ConfirmSheet.css";

interface ConfirmSheetProps {
  readonly open: boolean;
  readonly title: string;
  readonly description: string;
  readonly confirmLabel: string;
  readonly cancelLabel: string;
  readonly destructive?: boolean;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}

/** A bottom sheet asking to confirm one action. */
export function ConfirmSheet({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel,
  destructive = false,
  onConfirm,
  onCancel,
}: ConfirmSheetProps) {
  return (
    <BottomSheet
      open={open}
      onOpenChange={(next) => !next && onCancel()}
      title={title}
      description={description}
    >
      <div className="confirm-sheet__actions">
        <button
          type="button"
          className={
            destructive
              ? "confirm-sheet__confirm confirm-sheet__confirm--destructive"
              : "confirm-sheet__confirm"
          }
          onClick={onConfirm}
        >
          {confirmLabel}
        </button>
        <button
          type="button"
          className="confirm-sheet__cancel"
          onClick={onCancel}
        >
          {cancelLabel}
        </button>
      </div>
    </BottomSheet>
  );
}
