import { Box } from "@radix-ui/themes";
import { Link } from "react-router";
import type { DailyNote } from "~/modules/daily-note/domain/entity";
import "./DailyNoteCard.css";

type Props = {
  readonly note: DailyNote | undefined;
};

export function DailyNoteCard({ note }: Props) {
  return (
    <Link
      to="?note=open"
      className="dashboard__card dashboard__card--note daily-note-card"
    >
      <Box className="daily-note-card__header">
        <p className="section-label">Daily note</p>
      </Box>
      {note?.content ? (
        <Box className="daily-note-card__content">{note.content}</Box>
      ) : (
        <Box className="daily-note-card__placeholder">Add your daily note…</Box>
      )}
    </Link>
  );
}
