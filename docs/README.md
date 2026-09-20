# Documentation

Fitness is a mobile app for one person. Start with the [project README](../README.md)
for setup and verification commands, then read the guides relevant to your task.

## Find the right context

| Task | Read |
| --- | --- |
| Add or change a feature | [Architecture](engineering/architecture.md), then the [feature index](features/README.md) |
| Add or change a route | [React Router](engineering/react-router.md) |
| Build UI components | [Frontend](engineering/frontend.md) and [design system](design/design-system.md) |
| Model or persist data | [Database](engineering/database.md) |
| Write or run tests | [Testing](engineering/testing.md) |
| Configure login or external clients | [Authentication](operations/authentication.md) |
| Deploy the app | [Deployment guide](../deploy/README.md) |
| Understand authentication boundaries | [ADR 0001](adr/0001-server-auth-middleware.md) |
| Investigate similar CI failures | [CI incident](incidents/2026-02-10-ci-test-failures.md) |
| Explore future directions | [Ideas](proposals/ideas.md) and [habit research](features/habits/research.md) |

## What belongs where

- **Engineering** owns current implementation conventions and layer boundaries.
- **Operations** owns configuration and maintenance procedures.
- **Design** owns shared visual and interaction rules.
- **Features** owns product behaviour, domain rules, and feature-specific UX.
- **Proposals** holds exploratory ideas without an established feature home.
- **ADRs** record significant decisions, alternatives, and consequences.
- **Incidents** preserve historical symptoms, causes, and fixes, not current instructions.

## Maintain the documentation

Keep one authoritative home for each rule and link to it elsewhere. Prefer
constraints and rationale over copies of schemas, interfaces, or command lists.
Link to the relevant code when implementation detail is needed.

Feature pages distinguish code-backed behaviour from proposals and open decisions.
A code review is not evidence that a workflow has passed browser acceptance testing.
Label new proposals **Draft**, **Accepted**, or **Superseded**, and link superseded
proposals to their replacement. Keep feature-specific proposals beside their feature.

Every document should be linked from this index or its parent feature page. When
moving a document, update incoming links, including those in `AGENTS.md` and
colocated READMEs. Delete obsolete checklists and examples rather than maintaining
an archive of every draft; Git retains their history.
