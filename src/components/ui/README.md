# Yas UI primitives

Reusable primitives derived from the approved visual contract.

## Inventory

Controls:

- DateField / DatePicker / DateRangePicker / Calendar — custom date entry (typed + calendar)
- TimeField — typed time + suggested list

- Button
- IconButton
- Input
- Select
- Checkbox
- Radio
- Textarea

Display:

- Card
- Badge
- Tag / SelectableTag
- ProgressBar
- ProgressRing
- Avatar
- Skeleton

Navigation:

- Tabs (`pill` | `underline`, optional decorative `badge`)
- Dropdown (link items, `iconOnly`, `triggerVariant="primary"`)
- SegmentedNav — view switch made of links (each option is a URL)
- Breadcrumbs — navigation landmark

Progress:

- Stepper — ordered steps of one task; completed steps can be revisited

Overlays:

- Tooltip
- Dialog (`icon`, `footer`)
- Drawer (`size` md/lg/xl, `icon`, `footer`; full-screen sheet on phones)
- CommandPalette — Ctrl/⌘ K combobox search
- Popover — anchored top-layer surface (native Popover API); used by Dropdown and pickers

Feedback:

- Toast / ToastProvider + useToast (transient confirmation queue)
- Alert
- EmptyState
- ErrorState

Headers:

- SectionHeader
- PageHeader

## Rule

Search this inventory and its variants before creating a new component. A new primitive requires a semantic difference, not a page-specific visual preference.

Tokens live in `src/styles/tokens.css` and `src/styles/tokens.ts`. Components must consume those tokens instead of introducing equivalent local values.
