# Design review and delivery

Accepted by Valentin on 2026-10-02. Design proposals use the working application
so the reviewed interaction and the eventual implementation share foundations.

## Build the proposal

The designer creates a dedicated Git branch and worktree from current main,
checks for a suitable local server, and manages a separate server when needed.
Read the frontend, routing, testing and design-system guides before changing UI.
Use existing components, layouts and tokens; avoid rebuilding the application in
standalone HTML. Standalone sketches remain useful for early exploration, but
the reviewable proposal should run in the app.

The designer owns presentation and interaction: typography, styling, responsive
layout, UI states and transitions. Preserve agreed functionality and positioning.
Domain rules, persistence, authentication and migrations remain developer-owned.
Use representative local fixtures or an isolated test database; design reviews
must not mutate production data or weaken authentication for preview access.

For alternatives, build two or three meaningful variants with identical data.
Give each a direct local URL, such as `/design/workout/1` and
`/design/workout/2`, and provide a comparison index with concise differences.
Each variant should explore a clear choice rather than cosmetic permutations.
These routes belong to the prototype branch, not the production navigation.

## Review the experience

Provide the branch, worktree, server URL, variant links and what to try. State
which interactions are real and which use fixtures. Include empty inputs, saved
and editable values, long labels, loading/error states and narrow mobile widths
where relevant. Check keyboard focus, touch targets and safe areas. Use browser
acceptance and the repository handoff checks; follow the testing guide rather
than introducing a separate design verification process.

Valentin selects or refines a proposal by interacting with it. Design approval
does not authorize deploying preview routes or changing domain behavior.

## Complete delivery

The developer reviews the selected components and completes their integration
with application operations. Reuse the selected implementation rather than
recreating the approved design. Remove discarded variants, comparison routes and
fixture scaffolding before production handoff. Run frontend review, QA and the
required checks, then coordinate release through the Engineering Manager.

Keep reusable visual rules in the design system and feature-specific behavior in
the feature guides. Linear holds approval evidence and delivery state.
