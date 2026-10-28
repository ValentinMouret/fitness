import { Dialog, VisuallyHidden } from "@radix-ui/themes";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import "./BottomSheet.css";

interface BottomSheetProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly title: string;
  readonly description?: string;
  /** Hides the title visually while keeping it for assistive technology. */
  readonly hideTitle?: boolean;
  /** Tall sheets scroll their body and keep the header in place. */
  readonly tall?: boolean;
  /** Shows a close button in the header. */
  readonly closable?: boolean;
  readonly onOpenAutoFocus?: (event: Event) => void;
  readonly onCloseAutoFocus?: (event: Event) => void;
  readonly children: ReactNode;
}

/** A modal sheet that slides up from the bottom of the screen. */
export function BottomSheet({
  open,
  onOpenChange,
  title,
  description,
  hideTitle = false,
  tall = false,
  closable = false,
  children,
  onOpenAutoFocus,
  onCloseAutoFocus,
}: BottomSheetProps) {
  const heading = (
    <Dialog.Title className="bottom-sheet__title">{title}</Dialog.Title>
  );
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Content
        onOpenAutoFocus={onOpenAutoFocus}
        onCloseAutoFocus={onCloseAutoFocus}
        className={tall ? "bottom-sheet bottom-sheet--tall" : "bottom-sheet"}
        {...(description ? {} : { "aria-describedby": undefined })}
      >
        <div className="bottom-sheet__header">
          <div className="bottom-sheet__heading">
            {hideTitle ? <VisuallyHidden>{heading}</VisuallyHidden> : heading}
            {description && (
              <Dialog.Description className="bottom-sheet__description">
                {description}
              </Dialog.Description>
            )}
          </div>
          {closable && (
            <Dialog.Close>
              <button
                type="button"
                className="bottom-sheet__close"
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </Dialog.Close>
          )}
        </div>
        <div className="bottom-sheet__body">{children}</div>
      </Dialog.Content>
    </Dialog.Root>
  );
}
