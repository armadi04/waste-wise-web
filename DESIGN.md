# Nestplate UI conventions

## Foundation

React 19 SPA, HeroUI 2.8, Tailwind 4 and Motion. Reuse existing layout, DataTable, forms,
confirmation, modal and skeleton components. Starter uses a responsive administration shell,
collapsible desktop sidebar and mobile navigation. Backend permissions remain authoritative.

## Colors and typography

### Theme contract

Semantic CSS tokens live in `frontend/src/styles/tokens.css`; HeroUI 2.8 configuration
lives in `frontend/src/hero.ts`. Use the white, slate and blue palette below in both modes.
The names below are application tokens (`--app-{token}`), not additional native HeroUI
color keys. Use semantic utilities and shared component variants, never page-specific hex
colors. Every token must exist in both themes; never inherit a missing dark value from light.

Set exactly one theme class (`light` or `dark`) on the document root. Scope application
variables to the same selector and set `color-scheme: light` or `dark` respectively. An
explicit user preference overrides the system preference; use the system only when no
explicit preference is stored. Apply the resolved theme before the first visible render.
Portaled modals, popovers and toasts inherit the same root theme. Do not nest opposite
themes inside operational screens or apply independent theme state to individual components.

### Surfaces, actions and inputs

| Application token | Light | Dark |
|---|---|---|
| `background` | #F8FAFC | #0F172A |
| `surface` | #FFFFFF | #1E293B |
| `surface-hover` | #F1F5F9 | #334155 |
| `surface-pressed` | #E2E8F0 | #475569 |
| `foreground` | #0F172A | #F8FAFC |
| `muted` | #F1F5F9 | #334155 |
| `muted-foreground` | #475569 | #CBD5E1 |
| `border-subtle` | #E2E8F0 | #334155 |
| `border-control` | #64748B | #94A3B8 |
| `primary` | #2563EB | #2563EB |
| `primary-hover` | #1D4ED8 | #1D4ED8 |
| `primary-pressed` | #1E40AF | #1E40AF |
| `primary-foreground` | #FFFFFF | #FFFFFF |
| `link` | #1D4ED8 | #93C5FD |
| `link-hover` | #1E40AF | #BFDBFE |
| `selected-background` | #EFF6FF | #172554 |
| `selected-hover` | #DBEAFE | #1E3A8A |
| `selected-foreground` | #1D4ED8 | #BFDBFE |
| `selected-border` | #2563EB | #60A5FA |
| `focus` | #2563EB | #93C5FD |
| `focus-offset` | #FFFFFF | #1E293B |
| `disabled-background` | #F1F5F9 | #334155 |
| `disabled-foreground` | #64748B | #94A3B8 |
| `disabled-border` | #CBD5E1 | #475569 |
| `input-background` | #FFFFFF | #1E293B |
| `input-foreground` | #0F172A | #F8FAFC |
| `input-placeholder` | #64748B | #94A3B8 |
| `input-border` | #64748B | #94A3B8 |
| `input-border-hover` | #475569 | #CBD5E1 |
| `input-border-focus` | #2563EB | #60A5FA |
| `input-border-error` | #B91C1C | #F87171 |

Surface is the background for cards, tables, forms and the sidebar. `border-subtle` is
only a decorative separator; interactive controls use `border-control` or `input-border`.
Neutral interactive rows use `surface-hover` / `surface-pressed` with `foreground`.
Primary buttons use `primary` / `primary-hover` / `primary-pressed` with
`primary-foreground` in every state. Links use `link` / `link-hover`; never use the
solid-button background as a universal text color. Selected rows and navigation use
`selected-background` / `selected-hover` with `selected-foreground`; show a selected
indicator using `selected-border`, and expose the corresponding accessible state.

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
| `info` | #2563EB | #93C5FD |
| `info-background` | #EFF6FF | #172554 |
| `info-foreground` | #1D4ED8 | #BFDBFE |
| `info-border` | #2563EB | #60A5FA |
| `info-solid` | #2563EB | #2563EB |
| `info-solid-hover` | #1D4ED8 | #1D4ED8 |
| `info-solid-pressed` | #1E40AF | #1E40AF |
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

HeroUI semantic colors also have 50–900 scales. Override these scales with blue, slate,
green, amber and red shades respectively rather than inheriting unrelated default hues;
copy the primary scale into secondary. The explicit pairs above are authoritative for
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
