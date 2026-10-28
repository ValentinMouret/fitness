import { useRef } from "react";
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
  readonly onCloseAutoFocus?: (event: Event) => void;
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
  onCloseAutoFocus,
}: ConfirmSheetProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  return (
    <BottomSheet
      open={open}
      onOpenChange={(next) => !next && onCancel()}
      title={title}
      description={description}
      onOpenAutoFocus={
        destructive
          ? (event) => {
              event.preventDefault();
              cancelRef.current?.focus();
            }
          : undefined
      }
      onCloseAutoFocus={onCloseAutoFocus}
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
          ref={cancelRef}
          className="confirm-sheet__cancel"
          onClick={onCancel}
        >
          {cancelLabel}
        </button>
      </div>
    </BottomSheet>
  );
}
