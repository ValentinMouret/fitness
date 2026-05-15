import { ArrowLeftIcon } from "@radix-ui/react-icons";
import { Button, IconButton, Text } from "@radix-ui/themes";
import { useEffect, useId } from "react";
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
  const isEditing = mode === "edit";

  // After successful save, go back to view mode
  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data?.saved) {
      navigate("?note=open");
    }
  }, [fetcher.state, fetcher.data, navigate]);

  return (
    <div className="daily-note-modal">
      <div className="daily-note-modal__header">
        {isEditing ? (
          <Button asChild size="1" variant="ghost">
            <Link to="?note=open">Cancel</Link>
          </Button>
        ) : (
          <IconButton asChild variant="ghost" size="1" aria-label="Back">
            <Link to="/dashboard">
              <ArrowLeftIcon />
            </Link>
          </IconButton>
        )}
        <span className="daily-note-modal__title">Daily note</span>
        <div className="daily-note-modal__action">
          {isEditing ? (
            <Button
              size="1"
              type="submit"
              form={formId}
              loading={fetcher.state !== "idle"}
            >
              Update
            </Button>
          ) : (
            <Button asChild size="1" variant="ghost">
              <Link to="?note=edit">Edit</Link>
            </Button>
          )}
        </div>
      </div>

      <div className="daily-note-modal__body">
        {isEditing ? (
          <fetcher.Form id={formId} method="post">
            <input type="hidden" name="intent" value="save-note" />
            <textarea
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
