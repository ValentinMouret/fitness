# Rendered typography audit

5 October2026 · initial audit. Sourcebase origin/main4d63598; live production sampled separately. This is not a claim that every data-dependent state passed. Complete migration requires filling the explicitly listed coverage gaps.

Method: read-only authenticated in-app browser,390×844; measured visible text-owned nodes, family/size/weight/line-height/tracking/numeric features, heading roles and font status. No production form submissions. Source inventory includes CSS and inline TSX declarations (source-inventory.json); declaration inventory is not rendered proof. Production may differ from this Git base. Early Habits loading snapshot discarded; later content sampled. Measurement detail returns error, recorded as error not normal-page evidence.

## Route ledger

| Route/state | Rendered sizes observed(px) | Coverage |
|---|---|---|
| /dashboard populated |10,11,11.2,12,13.3941,14,15,16,19.2,22,28|Live;4families,4weights; numeric alignment styles not uniform|
| /habits today, saved/pending |10,11,12,13,15,16,20,28|Live;DM Sans +Crimson; section h2 serif12/700/18/tracking1.2px uppercase|
| /habits/week |9,10,11,12,13,20,24|Live; missing/saved/today states; tiny9px cells|
| /habits/new step1 |11,13,14,16,26|Live; later wizard stages source-only|
| /habits/:id/edit |11,12,13,14,16,26|Live existing edit page; no save|
| /nutrition populated/empty meals |10,11,12,14,16,20,24 (later44stat)|Live; initial vs later styling/state variation warrants settled-state recheck during adoption|
| /nutrition/templates list |10,12,13,14,16,20,21,28|Live;Crimson,DM Sans,Radix system|
| /nutrition/templates?edit |10,14,16,18.72,24,28|Live; h3 UA18.72px,Arial controls|
| /nutrition/meal-builder initial |10,14,16,18,20,28|Live; populated ingredient editor/errors source-only|
| /nutrition/calculate-targets |10,12,14,16,20,28|Live; form defaults; no calculation submission|
| /nutrition/meals |Redirect /nutrition|Live redirect; no separate page|
| /workouts list |10,10.4,12,14,15.2,16,18,28|Live;4weights, status tracking.832px|
| /workouts/:id completed overview |10,12,13,14,16,20.8,32|Live;3families|
| /workouts/:id completed focus |10,11,12,13,14,16,19,36|Live; saved19px vs mobileinput16px source; equipment/heading mix|
| /workouts/:id active |Approved isolated row fixture|No active production record created; baseline active real-component state still needs dedicated test fixtures|
| /workouts/create |No content except navigation|GET renders null; action creates a workout, not run|
| /workouts/:id/substitute/:exercise-id |Source-only|No valid editable active context; needs isolated data|
| /workouts/exercises list |10,12,16,28|Live;Radix/Crimson/Arial|
| /workouts/exercises/create and/:id/edit |10,14,16,28|Both live; no submissions|
| /measurements |10,12,14,16,18,28|Live list|
| /measurements/new |10,12,14,16,28|Live form; no submission|
| /measurements/:name |Error35/18|weight route displayed rootOops; normal chart page not verified|
| /share/meal/:id |Source and actual SharedMealView localfixture|No published live link guessed/created; local public specimen includes portion slider|
| /login |14,16,24|Live; no credential handling|
| /sign-in,/account/invitations |Source;AuthPage/EmailField local specimen|Auth foundation release held; no auth configuration or invitation changes|
| /oauth/authorize |Source Consent component|No fresh OAuth session/authorization initiated|
| / |Redirect shell/source|No independent designed content|
| /logout,api/auth/*,oauth/token,oauth/revoke,mcp,api/exercises/history,api/nutrition/estimate-meal,healthz,.well-known/* |Non-page/action/API |Not typography surfaces; no mutations invoked|

There is no separate current settings page or recovery/import/generate/workout-template route at thisbase. Do not infer routes from older checkouts. Unexpected rooterror is separate evidence for error typography; it does not validate the unavailable measurement page.

## Shared component ownership and drift

- Root/app.css:fonts loaded but Radix default family notmapped; broad important serif headings; bottomnav10; sectionlabels11.2+tracking; displaynumbers serif56/32/24 and units.4em.
- PageHeader28/700 default vs Nutrition28/500, subtitle15.2. SectionHeader20/700 vs manually styled section24/500. EmptyState18/700. Keep levels independent of visual role.
- NumberInput/Radix forms:16px!important mobile rule wins over row18/19 declarations. Earlier prototype claimed18px without computed proof; explicitly corrected.
- Dashboard/HabitCheckbox/WeightChart/MeasurementChart/MacrosChart: mixed system/DM/serif; chart button can resolveArial; SVG tick text must join shared roles and be tested with zoom.
- WorkoutExerciseCard/RestTimer/WorkoutTimerBar/CompletionModal/confirmation dialogs/ExerciseSelector: overview/focus variants use separate heading ladders; portals need Theme mapping; still-active operations require isolated fixtures.
- NutritionSummary/MealCard/EmptyMealCard/IngredientCard/CurrentTotalsPanel/ObjectivesPanel/MealAssignments/NutritionNavigation/template/AI review/estimate dialogs/SharedMealView: tab, title, unit and status ladders diverge; some raw browserheading defaults remain.
- Habits index/week/new/edit: numerous static inline fontstyles, caps and tracking; inline rules must be migrated at the owner component, not globally defeated by newimportant rules.
- ExerciseCard/ExerciseForm/Pagination/auth primitives/skeleton/error:include in migration checklist. Skeletons have no readable text; verify loading→content layout rather than assigning every rectangle a type role.

Full declarations include filename/line for every matching CSS/TSX rule, including utilities/components; it is a discovery aid and intentionally does not duplicate authoritative rules.

## Remaining verification before broad rollout

Populate measurement chart baseline in isolated data; active/editable workout/substitution baseline; later habit wizard steps, populated meal editor, public ingredient scenarios, OAuth consent/auth foundation states, all loading/error/disabled variants. Then compare baseline/proposed computed metrics at320/390, text-only200%, browser zoom/reflow, custom spacing, font fallback/late loading, lineclipping, focus and numeric contrast on each actual surface. Local specimen tests below are not production acceptance.
