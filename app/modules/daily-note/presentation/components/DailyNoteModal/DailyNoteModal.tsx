import { ArrowLeftIcon, Pencil1Icon } from "@radix-ui/react-icons";
import { Button, IconButton, Text, Tooltip } from "@radix-ui/themes";
import { useCallback, useEffect, useId, useRef } from "react";
import { Link, useFetcher, useNavigate } from "react-router";
import type { DailyNote } from "~/modules/daily-note/domain/entity";
import "./DailyNoteModal.css";

type Props = {
  readonly note: DailyNote | undefined;
  readonly mode: string;
};

export function DailyNoteModal({ note, mode }: Props) {
  const fetcher = useFetcher();
  const navigate = useNavigate();
  const formId = useId();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isEditing = mode === "edit";

  // After successful save, go back to view mode
  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data?.saved) {
      navigate("?note=open");
    }
  }, [fetcher.state, fetcher.data, navigate]);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isEditing]);

  const handleClose = useCallback(() => {
    if (isEditing) {
      navigate("?note=open");
    } else {
      navigate("/dashboard");
    }
  }, [isEditing, navigate]);

  const handleEdit = useCallback(() => {
    if (!isEditing) {
      navigate("?note=edit");
    }
  }, [isEditing, navigate]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        handleClose();
      } else if (
        !isEditing &&
        e.key.toLowerCase() === "e" &&
        !(e.target instanceof HTMLInputElement) &&
        !(e.target instanceof HTMLTextAreaElement)
      ) {
        e.preventDefault();
        handleEdit();
      } else if (isEditing && e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        const form = document.getElementById(formId) as HTMLFormElement;
        if (form) form.requestSubmit();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleClose, handleEdit, isEditing, formId]);

  return (
    <div className="daily-note-modal">
      <div className="daily-note-modal__header">
        {isEditing ? (
          <Tooltip content="Cancel (Esc)">
            <Button
              asChild
              size="1"
              variant="ghost"
              aria-label="Cancel (Esc)"
              aria-keyshortcuts="Escape"
            >
              <Link to="?note=open">Cancel</Link>
            </Button>
          </Tooltip>
        ) : (
          <Tooltip content="Back to Dashboard (Esc)">
            <IconButton
              asChild
              variant="ghost"
              size="1"
              aria-label="Back to Dashboard (Esc)"
              aria-keyshortcuts="Escape"
            >
              <Link to="/dashboard">
                <ArrowLeftIcon />
              </Link>
            </IconButton>
          </Tooltip>
        )}
        <span className="daily-note-modal__title">Daily note</span>
        <div className="daily-note-modal__action">
          {isEditing ? (
            <Tooltip content="Update (Cmd+Enter)">
              <Button
                size="1"
                type="submit"
                form={formId}
                loading={fetcher.state !== "idle"}
                aria-label="Update (Cmd+Enter)"
                aria-keyshortcuts="Meta+Enter Control+Enter"
              >
                Update
              </Button>
            </Tooltip>
          ) : (
            <Tooltip content="Edit (E)">
              <IconButton
                asChild
                size="1"
                variant="ghost"
                aria-label="Edit (E)"
                aria-keyshortcuts="e"
              >
                <Link to="?note=edit">
                  <Pencil1Icon />
                </Link>
              </IconButton>
            </Tooltip>
          )}
        </div>
      </div>

      <div className="daily-note-modal__body">
        {isEditing ? (
          <fetcher.Form id={formId} method="post">
            <input type="hidden" name="intent" value="save-note" />
            <textarea
              ref={textareaRef}
              name="content"
              className="daily-note-modal__textarea"
              defaultValue={note?.content ?? ""}
              placeholder="Your values, daily dos and don'ts…"
            />
          </fetcher.Form>
        ) : note?.content ? (
          <Text as="p" className="daily-note-modal__content">
            {note.content}
          </Text>
        ) : (
          <Text as="p" className="daily-note-modal__empty">
            No note yet. Tap Edit to add one.
          </Text>
        )}
      </div>
    </div>
  );
}
