# Typography system — research and proposal

Draft, 5 October 2026 · ENSO-105. Owner selection required before shared adoption. This does not replace docs/design/design-system.md.

## Finding

The problem is not just too many sizes. Current runtime combines Crimson Pro, DM Sans, Radix system sans and Arial. The body token is declared on html, but Radix’s default-font-family is not mapped. Global `!important` heading-family rules spread serif into small section labels. Inline feature styles and browser defaults add unrelated weight, tracking and leading. A loaded font is not evidence that a control uses it.

## Primary evidence and implications

- [Radix typography](https://www.radix-ui.com/themes/docs/theme/typography) couples font size, leading and tracking in a9-step scale and exposes default/heading/strong font-family mappings. Map the existing body family at Theme; name roles instead of selecting unrelated component sizes. We do not need every Radix step for everyday pages.
- [Material Web typography](https://github.com/material-components/material-web/blob/main/docs/theming/typography.md) defines type styles by purpose, with family/size/leading/weight tokens. This supports semantic roles; it does not mandate Material’s entire scale or aesthetic.
- [Apple’s UI typography session](https://developer.apple.com/videos/play/wwdc2020/10175/) explains why metrics, optical size, leading and tracking matter together. It discusses native APIs; web rem-based roles and browser resizing need their own verification. Equal nominal sizes across families do not guarantee equal visual size.
- [Crimson Pro metadata](https://github.com/google/fonts/blob/main/ofl/crimsonpro/METADATA.pb) lists a weight axis, not an optical-size axis. Existing `font-optical-sizing:auto` does not create missing optical masters. Restrict its use to the page title in proposalA.
- [DM Sans metadata](https://github.com/google/fonts/blob/main/ofl/dmsans/METADATA.pb) lists weight and optical-size axes. [CSS optical sizing](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/font-optical-sizing) applies to a font with an opsz axis. Exact Google Fonts response assets and their axes must be verified before relying on that behaviour; this prototype changes no font asset/loading policy.
- [WCAG2.2](https://www.w3.org/TR/WCAG22/) requires minimum contrast4.5:1 for normal text,3:1 for qualifying large text; actual surface/weight/size determine the requirement. Completion may be quieter without making still-meaningful values unreadable. Minimum targets under WCAG are not the same as Fitness’s44px design requirement.
- [Resize text](https://www.w3.org/WAI/WCAG22/Understanding/resize-text.html): support enlargement to200% without lost content/function. Relative roles alone are insufficient if widths/heights clip text.
- [Text spacing](https://www.w3.org/WAI/WCAG22/Understanding/text-spacing.html): tolerate user override leading1.5, paragraph spacing2em, letter spacing.12em, word spacing.16em. Those are test overrides, not required default spacing.
- [Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html): avoid two-dimensional reading at320CSSpx except content that requires two-dimensional layout. The current mobile product does not need a separate desktop redesign;1024px is an additional stress check.

The role choices below are design judgments informed by this evidence, not prescribed accessibility values. Keep current fonts while testing a coherent mapping before considering a replacement.

## Small semantic system

All sizes relative to16px root. Same role at320/390; wrap instead of shrinking. Only weights400 and500 in everyday content. Default tracking0, no decorative uppercase. Use tabular numerals for comparable data; do not force them on prose.

| Role | Size / line height | Weight | Family | Use |
|---|---|---|---|---|
| Page title |1.75rem /1.25 (28/35)|500|A:Crimson Pro; B:DM Sans|One primary page/exercise title|
| Section |1.25rem /1.4 (20/28)|500|DM Sans|Sections, dialog titles|
| Item and body |1rem /1.5 (16/24)|400; item may500 when justified|DM Sans|Names, prose, editable AND saved numeric values|
| Support and actions |.875rem /1.5 (14/21)|400; action500|DM Sans|Cues, descriptions, buttons, form labels|
| Caption and units |.75rem /1.5 (12/18)|400; label500 only for hierarchy|DM Sans|Units, RIR suffix, column labels, metadata|
| Timer/stat |Reuse section20/28|500|DM Sans/tabular|Exceptions only if actual reading task needs greater prominence|

A: quiet editorial keeps the serif only at the page title. B: unified sans uses DM Sans everywhere. Identical roles/fixtures; no new fonts. A is the first recommendation, B is a meaningful alternative if the family contrast itself remains distracting.

## Shared implementation after approval

Map Radix `--default-font-family`, `--heading-font-family`, `--strong-font-family` and applicable emphasis/quote mappings to chosen roles at one Theme boundary. PageHeader, SectionHeader, EmptyState, forms/NumberInput, units and navigation own roles. Remove global heading `!important` override and feature sizing ladders in approved migration slices. Rendered numeric16px must match saved16px regardless of the component default. Keep HTML heading levels semantic; do not use h1 only to get a size.

Use rem for text and elastic/min-height containers. At enlarged text, header controls and navigation reflow. Dialog portals must carry the same theme/class mapping. The prototype requires scoped specificity/important to override current globals; this is a review aid, not a prescription to accumulate overrides in production.

Font loading: current root requests Google Fonts with display=swap, fallbackGeorgia/system-ui. Test fallback wrapping, late-font movement and focus; loaded status/checks alone cannot identify each rendered glyph. Self-hosting/metric overrides need Dev confirmation of asset/license/config and measured fallback metrics, not guessed size-adjust values. No auth/loading/persistence change in this prototype.
