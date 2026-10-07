# Nestplate UI conventions

## Foundation

React 19 SPA, HeroUI 2.8, Tailwind 4 and Motion. Reuse existing layout, DataTable, forms,
confirmation, modal and skeleton components. Starter uses a responsive administration shell,
collapsible desktop sidebar and mobile navigation. Backend permissions remain authoritative.

## Colors and typography

Semantic CSS tokens live in `frontend/src/styles/tokens.css`; HeroUI configuration lives
in `frontend/src/hero.ts`. Use semantic utilities rather than per-page hardcoded colors.

| Role | Light | Dark |
|---|---|---|
| Background | #FFFFFF | #000000 |
| Foreground | #11181C | #ECEDEE |
| Primary | #CA2222 | #DC2626 |
| Muted | #F3F4F6 | #262626 |
| Muted foreground | #6A7282 | #A1A1AA |
| Border | #E5E7EB | #27272A |
| Focus | #155DFC | #155DFC |

Success: #16A34A; warning: #FBBF24; danger: #F31260; info: #155DFC.
Poppins with system sans-serif fallback. Keep labels readable and hierarchy clear.
Long table cells use truncation plus accessible full content where necessary.

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
