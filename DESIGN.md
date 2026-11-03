# Nestplate UI conventions

## Foundation

React 19 SPA, HeroUI 2.8, Tailwind 4 and Motion. Reuse existing layout, DataTable, forms,
confirmation, modal and skeleton components. Starter uses a responsive administration shell,
collapsible desktop sidebar and mobile navigation. Backend permissions remain authoritative.

## Colors and typography

### Theme contract

Semantic CSS tokens live in `frontend/src/styles/tokens.css`; HeroUI 2.8 configuration
lives in `frontend/src/hero.ts`. Both derive from the single palette source in
`frontend/src/lib/theme/palette.ts`; after changing it run `bun run tokens:generate`.
Use the white, zinc and teal palette below in both modes,
with a small amber brand accent (`#F3AA28`) reserved for the wordmark. The primary action
color uses `#0F766E` rather than the source brand `#0D9488` so white labels meet the 4.5:1
contrast requirement. The names below are application tokens (`--app-{token}`), not
additional native HeroUI color keys. Use semantic utilities and shared component variants, never page-specific hex
colors. Every token must exist in both themes; never inherit a missing dark value from light.

Set exactly one theme class (`light` or `dark`) on the document root. Scope application
variables to the same selector and set `color-scheme: light` or `dark` respectively. An
explicit user preference overrides the system preference; use the system only when no
explicit preference is stored. Apply the resolved theme before the first visible render.
Portaled modals, popovers and toasts inherit the same root theme. Do not nest opposite
themes inside operational screens or apply independent theme state to individual components.

The background style is a separate persisted preference stored in
`frontend/src/lib/stores/background.store.ts` and applied as `data-background` on the
document root: `gradient` (default light ambient wash), `neutral` (transparent) or `gray`
(`#F5F5F7`). Dark mode always overrides the background with `#000000`. Apply both the
resolved theme and background before the first visible render. Keep the background
preference controls hidden in dark mode, where the styles do not apply.

### Surfaces, actions and inputs

| Application token | Light | Dark |
|---|---|---|
| `background` | #FFFFFF | #000000 |
| `surface` | #FFFFFF | #18181B |
| `surface-hover` | #E4E4E7 | #3F3F46 |
| `surface-pressed` | #D4D4D8 | #52525B |
| `foreground` | #11181C | #ECEDEE |
| `muted` | #F4F4F5 | #27272A |
| `muted-foreground` | #52525B | #D4D4D8 |
| `border-subtle` | #E4E4E7 | #3F3F46 |
| `border-control` | #71717A | #A1A1AA |
| `primary` | #0F766E | #0F766E |
| `primary-hover` | #115E59 | #115E59 |
| `primary-pressed` | #134E4A | #134E4A |
| `primary-foreground` | #FFFFFF | #FFFFFF |
| `link` | #0F766E | #5EEAD4 |
| `link-hover` | #115E59 | #99F6E4 |
| `selected-background` | #F0FDFA | #134E4A |
| `selected-hover` | #CCFBF1 | #115E59 |
| `selected-foreground` | #0F766E | #99F6E4 |
| `selected-border` | #0D9488 | #2DD4BF |
| `focus` | #0D9488 | #5EEAD4 |
| `focus-offset` | #FFFFFF | #18181B |
| `disabled-background` | #F4F4F5 | #27272A |
| `disabled-foreground` | #71717A | #A1A1AA |
| `disabled-border` | #D4D4D8 | #52525B |
| `input-background` | #FFFFFF | #18181B |
| `input-foreground` | #11181C | #ECEDEE |
| `input-placeholder` | #71717A | #A1A1AA |
| `input-border` | #71717A | #A1A1AA |
| `input-border-hover` | #3F3F46 | #D4D4D8 |
| `input-border-focus` | #0D9488 | #5EEAD4 |
| `input-border-error` | #B91C1C | #F87171 |
| `accent` | #F3AA28 | #F3AA28 |

Surface is the background for cards, tables, forms and the sidebar. `border-subtle` is
only a decorative separator; interactive controls use `border-control` or `input-border`.
Neutral interactive rows use `surface-hover` / `surface-pressed` with `foreground`.
Primary buttons use `primary` / `primary-hover` / `primary-pressed` with
`primary-foreground` in every state. Links use `link` / `link-hover`; never use the
solid-button background as a universal text color. Selected rows, options and navigation
use `selected-background` / `selected-hover` with `selected-foreground`; add a non-color
cue such as weight, an icon or a label, and expose the corresponding accessible state.
Reserve `selected-border` for choice controls (checkboxes/radios) and tone borders, not
for navigation, table rows or list options. The `accent` token (`#F3AA28`) is a brand-only
highlight for the wordmark; never use it for actions, status meaning or body text.

Inputs keep `input-background` and `input-foreground` across normal, hover and focus
states. Use the placeholder token only for placeholders, never as a replacement for labels.
Switch the border to hover, focus or error tokens as appropriate. Error help text uses
`danger`; expose `aria-invalid` and associate the error message with the input. Read-only
fields retain normal text contrast and allow text selection; they are not disabled fields.

Show a 2 px `focus` ring with a 2 px surface-colored offset for keyboard focus. The offset
uses the actual adjacent surface; `focus-offset` is the default on cards. Keep the error
border when an invalid input is focused and show the independent focus ring around it.
Disabled controls use the three disabled tokens, suppress hover/pressed styles and expose
the disabled state. Do not apply a second opacity reduction to the entire control.

### Status colors and explicit pairs

Status text/icons on neutral surfaces use the base status token. Soft badges and inline
alerts use the corresponding `-background`, `-foreground` and `-border` tokens together.
Filled status buttons use `-solid`, `-solid-hover`, `-solid-pressed` with
`-solid-foreground`. Their solid colors intentionally stay dark in both modes so white
button labels retain contrast. A bright dark-mode status text color must never become a
solid button background with white text. Keep status meaning consistent and include a
label or icon; never communicate status through color alone.

| Application token | Light | Dark |
|---|---|---|
| `success` | #15803D | #4ADE80 |
| `success-background` | #F0FDF4 | #14532D |
| `success-foreground` | #166534 | #DCFCE7 |
| `success-border` | #15803D | #4ADE80 |
| `success-solid` | #15803D | #15803D |
| `success-solid-hover` | #166534 | #166534 |
| `success-solid-pressed` | #14532D | #14532D |
| `success-solid-foreground` | #FFFFFF | #FFFFFF |
| `warning` | #B45309 | #FBBF24 |
| `warning-background` | #FFFBEB | #451A03 |
| `warning-foreground` | #92400E | #FDE68A |
| `warning-border` | #B45309 | #FBBF24 |
| `warning-solid` | #B45309 | #B45309 |
| `warning-solid-hover` | #92400E | #92400E |
| `warning-solid-pressed` | #78350F | #78350F |
| `warning-solid-foreground` | #FFFFFF | #FFFFFF |
| `danger` | #B91C1C | #FCA5A5 |
| `danger-background` | #FEF2F2 | #450A0A |
| `danger-foreground` | #991B1B | #FECACA |
| `danger-border` | #B91C1C | #F87171 |
| `danger-solid` | #B91C1C | #B91C1C |
| `danger-solid-hover` | #991B1B | #991B1B |
| `danger-solid-pressed` | #7F1D1D | #7F1D1D |
| `danger-solid-foreground` | #FFFFFF | #FFFFFF |
| `info` | #0F766E | #5EEAD4 |
| `info-background` | #F0FDFA | #134E4A |
| `info-foreground` | #0F766E | #99F6E4 |
| `info-border` | #0D9488 | #2DD4BF |
| `info-solid` | #0F766E | #0F766E |
| `info-solid-hover` | #115E59 | #115E59 |
| `info-solid-pressed` | #134E4A | #134E4A |
| `info-solid-foreground` | #FFFFFF | #FFFFFF |

### HeroUI 2.8 mapping

Configure both `themes.light.colors` and `themes.dark.colors` in `frontend/src/hero.ts`.
Use the same exact values as the application tokens; map semantic roles as follows.

| HeroUI key | Application token / rule |
|---|---|
| `background` / `foreground` | `background` / `foreground` |
| `content1.DEFAULT` / `.foreground` | `surface` / `foreground` |
| `content2.DEFAULT` / `.foreground` | `muted` / `foreground` |
| `content3.DEFAULT` / `.foreground` | `surface-hover` / `foreground` |
| `content4.DEFAULT` / `.foreground` | `surface-pressed` / `foreground` |
| `divider` | `border-subtle` (decorative use only) |
| `focus` | `focus` |
| `default.DEFAULT` / `.foreground` | `muted` / `foreground` |
| `primary.DEFAULT` / `.foreground` | `primary` / `primary-foreground` |
| `secondary` | Same complete scale and foreground as `primary`; no extra accent color |
| `success.DEFAULT` / `.foreground` | `success-solid` / `success-solid-foreground` |
| `warning.DEFAULT` / `.foreground` | `warning-solid` / `warning-solid-foreground` |
| `danger.DEFAULT` / `.foreground` | `danger-solid` / `danger-solid-foreground` |
| Info variants | Shared app variant using `info-*`; do not invent a native `info` key |

HeroUI semantic colors also have 50–900 scales. Override these scales with teal, zinc,
green, amber and red shades respectively rather than inheriting unrelated default hues;
copy the primary scale into secondary. The neutral `default` scale is inverted in dark
mode: high indices resolve to light values so `default-400`, `default-500` and
`default-800` remain readable on dark surfaces, while `default-100`/`default-200` stay
dark for hovers and borders. The explicit pairs above are authoritative for
shared operational components. Do not assume a native `flat`, `bordered`, `light` or
`ghost` variant automatically uses them: map its rendered slots and interaction states
through shared wrappers / variants. Native scale-derived variants outside those wrappers
require contrast review before use.

Map input slots to the explicit input tokens, soft status slots to their paired tokens,
and neutral button/table/navigation states to the interaction tokens. Explicit hover and
pressed backgrounds must replace conflicting built-in opacity/filter styling. Do not rely
on inherited theme colors or stacking opacity to approximate this contract.

References: [HeroUI v2 colors](https://v2.heroui.com/docs/customization/colors) and
[theme customization](https://v2.heroui.com/docs/customization/customize-theme).

### Contrast and implementation acceptance

- Normal text, table data, placeholders and badge labels: at least 4.5:1 against their
  actual background. Large text: at least 3:1 under WCAG's large-text definition.
- Required control boundaries, state indicators and focus indicators: at least 3:1 against
  adjacent colors. Decorative separators and inactive controls are exempt; disabled text
  must still remain reasonably legible.
- Validate rendered combinations including hover, pressed, selected, invalid and focus;
  any opacity, overlay, image or custom background requires a fresh contrast check.
- Review buttons, table rows, inputs, navigation, status badges, modal/popover surfaces and
  toasts in both modes, including switching the theme while an overlay is open. Raw token
  contrast checks do not replace rendered component verification.

### Typography

Use **Plus Jakarta Sans** throughout the UI with a system sans-serif fallback:
`"Plus Jakarta Sans", ui-sans-serif, system-ui, sans-serif`. Use weights 400, 500 and 600;
avoid thin weights for operational data.

| Element | Size | Weight |
|---|---|---|
| Page title | 24–28 px | 600 |
| Section title | 18–20 px | 600 |
| Navigation, labels and buttons | 14 px | 500 |
| Body and form inputs | 14–16 px | 400 |
| Table content | 14 px | 400 |
| Metadata | 12–13 px | 400 |

Use a body line-height of 1.5 and a heading line-height of 1.25–1.3. Keep labels readable
and hierarchy clear. Use `font-variant-numeric: tabular-nums` for amounts, quantities and
dates in tables; right-align numeric amounts. Long table cells use truncation plus
accessible full content where necessary.

## Layout and interaction

- Page header owns title, description and primary actions.
- Tables use validated URL search/page/sort state; mobile layouts must remain usable.
- Forms own values through react-hook-form/Zod; modal stores own open/selection state only.
- Overlays use HeroUI focus management, labeled controls and visible keyboard focus.
- Confirm destructive actions, retain drafts on API failure and surface actionable errors.
- Permission gates apply to navigation and actions; never imply a UI gate authorizes API access.
- Use owner-specific skeletons during loading; distinguish loading, empty, forbidden and error.
- Honor reduced motion; animations provide feedback without blocking interaction.

## Customizing a clone

Update app labels, email APP_NAME, public icons/manifest and theme tokens together.
Do not embed business-specific resources or fixture metrics in the generic dashboard.
Keep light/dark modes, zoom, mobile overflow and keyboard navigation working after changes.
