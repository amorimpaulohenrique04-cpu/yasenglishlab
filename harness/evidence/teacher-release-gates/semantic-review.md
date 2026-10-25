# Semantic review of historical UI primitives

Read-only review performed by the diagnostic specialist on 2026-10-24. No functional duplicate was found among the six new files and existing primitives. This is manual evidence, not a passing automatic evaluator result.

| Primitive                | Distinct responsibility                                                  | Existing comparison                                                                                                       |
| ------------------------ | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| `calendar.tsx:91`        | Date selection, ARIA grid, keyboard, bounds and range                    | `display.tsx:452` ScheduleGrid distributes content; generic Input does not select calendar dates                          |
| `command-palette.tsx:38` | Search, groups, global shortcut, combobox/listbox and keyboard execution | Dropdown is an action menu; Dialog provides modal structure. Some dialog mechanics repeat, but the responsibility differs |
| `popover.tsx:37`         | Anchored nonmodal surface in top layer                                   | Dialog/Drawer are modal; Tooltip is auxiliary content. Dropdown reuses Popover at `navigation.tsx:351`                    |
| `stepper.tsx:17`         | Ordered task steps, current step and inert future steps                  | Tabs switches panels; ProgressBar represents a numerical measure                                                          |
| `time-field.tsx:53`      | Time parsing/normalization and relative-duration suggestions             | Input/Select are generic controls                                                                                         |
| `toast.tsx:25`           | Queue, timers and dismiss lifecycle                                      | Reuses the existing Toast presentation from `feedback.tsx:41`, imported at `toast.tsx:16`                                 |

Paths above are relative to `src/components/ui/`. The responsibilities are documented in `docs/DESIGN_SYSTEM.md:53–69` and `src/components/ui/README.md:9–51`.

`scripts/eval-agent.mjs` remains unchanged and fails on added primitive files even after manual review, because its current interface does not accept review evidence. No alternative base/head comparison is used to hide historical files.
