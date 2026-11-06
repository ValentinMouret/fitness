# Review the typography proposals

Draft · ENSO-105 · branchmarco/enso105-typography, dedicated worktree/Users/valentinmouret/.codex/worktrees/marco-typography/fitness from current origin/main4d63598.

- Comparison:http://localhost:5196/design/type
- A, quiet editorial:http://localhost:5196/design/type/editorial?screen=workout&saved=warm
- B, unified sans:http://localhost:5196/design/type/sans?screen=workout&saved=warm
- Dashboard:http://localhost:5196/design/type/editorial?screen=dashboard
- Nutrition:http://localhost:5196/design/type/editorial?screen=nutrition
- Habits:http://localhost:5196/design/type/editorial?screen=habits
- Editor:http://localhost:5196/design/type/editorial?screen=editor
- Public component:http://localhost:5196/design/type/editorial?screen=public
- Auth component:http://localhost:5196/design/type/editorial?screen=auth

Use the page selector and Compare link; same data/roles, different title family. RecommendationA preserves warm editorial title while using DM Sans consistently elsewhere. ChoiceB is meaningful if title-family contrast itself distracts. No new font family needed yet.

Exactly what to try: compare the whole workout, not just rows; read long exercise/cue text, clear numeric input and navigate away/back; edit stored RIR; open workout details modal. On Dashboard log an empty then filled weight; toggle habit. On Nutrition edit long template name; save empty then filled editor, open preview dialog. On public meal use keyboard on the quantity slider and Reset. Reload resets synthetic changes. Auth specimen sends no email. Page selectors do not navigate production routes.

Uses actual shared PageHeader/SectionHeader/EmptyState/NumberInput,Radix Theme/Dialog/Button/Checkbox/fields,actual SharedMealView and auth primitives. Representative compositions are fixtures, not copies of every production route. Workout fixture is the prior approved interaction prototype. No domain/auth/persistence implementation. Scope includes illustrative reflow when text enlarges; no app-wide migration until owner approval. Routes areDEV-only404production. Local-only; existing hosted preview copies production data and is not suitable.

See audit.md for every current route’s evidence/gaps, research-and-proposal.md for role table and primary citations. Current approved row handoff remains separate; these broader roles are pending approval.

Verification: gate passed typecheck/lint/build,376unit tests and8browser regressions. Targeted42-page matrix covers2families×7screens×320/390/1024. Additional42checks cover200% root text resize, custom spacing and blocked fontstylesheet fallback at320px; no document overflow. Dialog computedtitle20/body16/action14 confirmed. Frontend review cleared portal/font-label fixes. Workout draft/navigation/RIR and publicslider/reset checked. Enlarged text screenshot inspection caught compressed header and overlapping navigation, fixed by elastic wrapping. These checks supplement, not replace, feature acceptance. Fullgate:e2e not run: no separately configured isolated E2E database/credentials verified for this design server; invoking write suites against shared env would be inappropriate. Auth is a component specimen only, release holds unchanged.
