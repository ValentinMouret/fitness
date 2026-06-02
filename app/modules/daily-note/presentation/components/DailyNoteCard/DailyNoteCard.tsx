import { Box, Kbd, Tooltip } from "@radix-ui/themes";
import { Link } from "react-router";
import type { DailyNote } from "~/modules/daily-note/domain/entity";
import "./DailyNoteCard.css";

type Props = {
  readonly note: DailyNote | undefined;
};

export function DailyNoteCard({ note }: Props) {
  return (
    <Tooltip content="Daily note (N)">
      <Link
        to="?note=open"
        className="dashboard__card dashboard__card--note daily-note-card"
        aria-keyshortcuts="n"
      >
        <Box className="daily-note-card__header">
          <p className="section-label">Daily note</p>
          <Box display={{ initial: "none", md: "inline-block" }}>
            <Kbd size="1">N</Kbd>
          </Box>
        </Box>
        {note?.content ? (
          <Box className="daily-note-card__content">{note.content}</Box>
        ) : (
          <Box className="daily-note-card__placeholder">
            Add your daily note…
          </Box>
        )}
      </Link>
    </Tooltip>
  );
}
