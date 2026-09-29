# Yas UI primitives

Reusable primitives derived from the approved visual contract.

## Inventory

Controls:

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

- Tabs
- Dropdown

Overlays:

- Tooltip
- Dialog
- Drawer

Feedback:

- Toast
- Alert
- EmptyState
- ErrorState

Headers:

- SectionHeader
- PageHeader

## Rule

Search this inventory and its variants before creating a new component. A new primitive requires a semantic difference, not a page-specific visual preference.

Tokens live in `src/styles/tokens.css` and `src/styles/tokens.ts`. Components must consume those tokens instead of introducing equivalent local values.
