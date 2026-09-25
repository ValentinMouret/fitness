# Habits

Habits help the owner repeat behaviours and see patterns over time. The product
principles are to make the behaviour obvious, attractive, easy, and satisfying.
The [research notes](research.md) explain the Atomic Habits inspiration; they are
not a checklist of shipped or committed features.

## Implemented model and entry points

The [habit model](../../../app/modules/habits/domain/entity.ts) includes a start
and optional end date, frequency configuration, target count, and active state.
It also records an identity phrase, time, location, keystone flag, minimum version,
and colour. These fields express intent; their presence does not mean every
frequency combination has the same UI support.

A completion belongs to a habit and date, records whether it was completed, and
can include notes. Keep the behaviour being scheduled distinct from its dated
completion history.

The [daily page](../../../app/routes/habits/index.tsx) supports completion toggles,
streak and total-completion feedback, and logging a minimum version. The
[weekly page](../../../app/routes/habits/week.tsx) provides a calendar-oriented
view. Creation and editing have separate routes.

The [MCP API](../../mcp.md#read-habits) exposes active habit definitions and
dated completion history as read-only views for connected agents.

## Product direction

Reduce the effort of logging and recovering after a missed day. Minimum versions
should encourage showing up rather than treating an imperfect day as a failure.
Identity and keystone information should help explain why a habit matters.

Research directions such as explicit habit stacking, photo evidence, and
progressive challenges remain exploratory unless specified separately. Original
priority labels in the research notes are not the current delivery backlog.
