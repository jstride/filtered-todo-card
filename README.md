# Filtered Todo Card

A lightweight Home Assistant Lovelace card that displays a filtered view of any `todo.*` entity.

The source to-do list remains authoritative. The card reads items through Home Assistant's `todo.get_items` action and updates the original item by UID when it is completed. This means it can be used with CalDAV-backed lists, Local To-do, and other integrations that expose Home Assistant to-do entities.

## Features

- Native Home Assistant visual card editor
- Filter a to-do list without creating duplicate entities or lists
- Filter by summary, description, UID, status, and due date
- Due-date shortcuts for `today`, `tomorrow`, `overdue`, and `today_or_overdue`
- Case-insensitive text filtering by default
- Optional regex filtering
- Strip tags or prefixes from displayed task names without modifying the source task
- Show or hide the task summary independently of the description
- Optionally include completed tasks alongside active tasks
- Mark active tasks complete from the card
- Compact 40px status icon mode with configurable MDI icon and colours for pending, completed, and missing tasks
- Optionally reopen completed tasks from an icon (useful for reversing restrictions)
- Sort by due date or summary
- Browser cache for immediate rendering on subsequent dashboard loads
- Shared in-memory cache when multiple cards use the same source list
- Refresh immediately when Home Assistant reports the source todo entity changed
- Configurable fallback reconciliation interval, defaulting to 15 minutes
- Uses the Home Assistant configured time zone
- Uses Home Assistant theme variables
- No external dependencies

## Installation

### HACS

1. Open HACS in Home Assistant.
2. Open the three-dot menu and select **Custom repositories**.
3. Add `https://github.com/jstride/filtered-todo-card`.
4. Select **Dashboard** as the repository type.
5. Install **Filtered Todo Card**.
6. Reload the browser or Home Assistant app if prompted.

HACS should add the Lovelace resource automatically.

### Manual

Copy `filtered-todo-card.js` to `/config/www/filtered-todo-card.js`, then add `/local/filtered-todo-card.js` as a JavaScript module under **Settings > Dashboards > Resources**.

## Visual editor

Filtered Todo Card supports Home Assistant's native graphical card configuration.

From a dashboard:

1. Select **Edit dashboard**.
2. Select **Add card**.
3. Choose **Filtered Todo Card**.
4. Select a `todo.*` entity.
5. Configure filters and display options in the visual editor.

The visual editor supports:

- `todo.*` entity selection
- Card title
- Summary filters: equals, does not equal, contains, does not contain, starts with, ends with, and regex
- Description filters using the same operators
- Due-date presets: today, tomorrow, overdue, today or overdue, future, has a due date, and no due date
- Text stripping
- Sort order
- Card title display
- Summary, due-date, and description display
- Optional completed-task display
- Empty-card behaviour
- Completion controls
- Compact icon mode, icon name, three status colours, and completed-task reopening
- Item status
- Fallback refresh interval
- Case-sensitive matching

Advanced filter shapes remain available in YAML. If a card uses an advanced YAML-only option, Home Assistant will keep the YAML configuration available rather than trying to represent that option incorrectly in the visual editor.

## Basic usage

```yaml
type: custom:filtered-todo-card
entity: todo.tasks
title: Work
filter:
  summary:
    contains: "[Work]"
  due: today
strip: "[Work]"
```

This displays incomplete items from `todo.tasks` that are due today and contain `[Work]` in the summary. The tag is removed from the displayed summary only - the source task is unchanged.

## Hiding the card title

The card title is shown by default. To hide it while keeping the card contents:

```yaml
type: custom:filtered-todo-card
entity: todo.tasks
title: School
show_title: false
```

## Description-only example

The summary is shown by default. To use the description as the primary displayed text instead:

```yaml
type: custom:filtered-todo-card
entity: todo.tasks
title: Notes
filter:
  due: today
show_summary: false
show_description: true
```

## Showing completed tasks

Completed items are hidden by default. To show them alongside active items:

```yaml
type: custom:filtered-todo-card
entity: todo.tasks
show_completed: true
```

The card requests both `needs_action` and `completed` items in a single `todo.get_items` call. Completed items use a checked icon and remain visible when `show_completed` is enabled.

## Example: multiple filtered cards from one list

```yaml
type: grid
columns: 2
square: false
cards:
  - type: custom:filtered-todo-card
    entity: todo.tasks
    title: Work
    filter:
      summary:
        contains: "[Work]"
      due: today
    strip: "[Work]"

  - type: custom:filtered-todo-card
    entity: todo.tasks
    title: Home
    filter:
      summary:
        contains: "[Home]"
      due: today
    strip: "[Home]"

  - type: custom:filtered-todo-card
    entity: todo.tasks
    title: Urgent
    filter:
      summary:
        contains: "[Urgent]"
      due: today
    strip: "[Urgent]"

  - type: custom:filtered-todo-card
    entity: todo.tasks
    title: Shopping
    filter:
      summary:
        contains: "[Shopping]"
      due: today
    strip: "[Shopping]"
```

Cards using the same source entity and item status share one cache and one in-flight `todo.get_items` request. This avoids four cards making four identical requests when a dashboard opens.

## Compact status icons

Use `display: icon` to show one **40 x 40px**, background-free icon instead of a task list. It is suitable for placing beside a person avatar in a Home Assistant grid or horizontal stack. The icon changes colour as the to-do item is updated, without a template sensor or helper.

- The card fetches both `needs_action` and `completed` items automatically in icon mode; `show_completed: true` is not required.
- Outstanding tasks are tappable to complete. Completed tasks can also be tapped to return to `needs_action` with `allow_uncomplete: true`.
- When no matching task exists, the `color_missing` icon is visible but disabled; `hide_empty` does not hide it.
- If several tasks match, an outstanding task wins. Prefer filters that uniquely identify one task.
- Icons remain grey/disabled until data loads, and the card preserves its usual cache and refresh behaviour.

### Daily medication

```yaml
# Daddy: today's tablet from the Personal to-do list
type: custom:filtered-todo-card
entity: todo.personal
filter:
  summary:
    equals: Tablet
  due: today
display: icon
icon: mdi:pill
color_pending: red
color_completed: green
color_missing: grey
```

Use `entity: todo.tilly` for Tilly's equivalent card. A missing task is grey, an outstanding tablet red, and a completed tablet green. The card does not create or reset the daily task.

### Reversible iPad ban

```yaml
# A completed iPad task means a ban is active
type: custom:filtered-todo-card
entity: todo.tilly
filter:
  summary:
    equals: iPad
display: icon
icon: mdi:tablet
color_pending: green
color_completed: red
color_missing: green
allow_uncomplete: true
```

Repeat with the appropriate to-do entity for each child. Tapping a green icon completes the `iPad` task and turns it red; tapping red reopens it and turns it green. A missing task is green but cannot be tapped until an `iPad` task exists. **Keep ban tasks persistent rather than resetting them daily** if a restriction must carry across days.

Red and green use Home Assistant theme colours (`--error-color` and `--success-color`). Grey uses `--secondary-text-color`. Other basic CSS named colours and `#RRGGBB` hex colours are supported.

## Cache and refresh behaviour

The card keeps the last successful unfiltered item list in browser storage. If no cache exists, the card shows `Loading…` while it retrieves the initial list. Once a cache exists, later dashboard loads render it immediately and keep it up to date silently in the background.

The refresh strategy is:

1. If no cache exists, show `Loading…`, fetch the items, cache them, then render the list.
2. If a cache exists, display it immediately with no loading state.
3. Refresh silently in the background as soon as Home Assistant reports that the source `todo.*` entity has changed.
4. Use `refresh_interval` as a fallback background reconciliation timer for changes that cannot be detected from the normal dashboard entity state stream.

The default fallback is **900 seconds (15 minutes)**. This matches Home Assistant's current CalDAV todo polling interval. The fallback calls Home Assistant's `todo.get_items` action and does not itself force another CalDAV server poll.

For CalDAV, this matters because the todo entity state is the number of incomplete tasks. A CalDAV refresh can change task text, due dates, or replace one task with another without changing that count. Home Assistant may therefore have new todo item data without a normal visible entity state change. The 15-minute fallback reconciles those cases.

To change the fallback interval:

```yaml
type: custom:filtered-todo-card
entity: todo.tasks
refresh_interval: 900
```

Set `refresh_interval: 0` to disable fallback reconciliation. Source-entity changes and updates made through the card still trigger refreshes.

The browser cache is only a display cache. Home Assistant and the underlying todo integration remain authoritative.

## Configuration

| Option | Required | Default | Description |
| --- | --- | --- | --- |
| `entity` | Yes | | Source `todo.*` entity |
| `title` | No | Entity friendly name | Card title |
| `filter` | No | `{}` | Filter rules. All configured fields must match |
| `display` | No | `list` | `list` or `icon` (compact 40px status icon) |
| `icon` | No | `mdi:check-circle-outline` | Icon for `display: icon`, e.g. `mdi:pill` or `mdi:tablet` |
| `color_pending` | No | `red` | Icon colour when an incomplete task matches |
| `color_completed` | No | `green` | Icon colour when a completed task matches |
| `color_missing` | No | `grey` | Icon colour when no task matches |
| `allow_uncomplete` | No | `false` | Allow completed icons to be tapped to reopen the task |
| `status` | No | `needs_action` | Status requested from `todo.get_items`. Can also be a list in YAML |
| `strip` | No | | String or list of literal strings to remove from displayed summaries |
| `sort` | No | `due_asc` | `due_asc`, `due_desc`, `summary_asc`, `summary_desc`, or `none` |
| `show_title` | No | `true` | Show the card title |
| `show_summary` | No | `true` | Show the item summary. Disable for description-only cards |
| `show_due` | No | `false` | Show the source due value |
| `show_description` | No | `false` | Show item descriptions |
| `show_completed` | No | `false` | Include completed items in list mode (icon mode always loads both states) |
| `empty_text` | No | `Nothing due` | Text displayed when no items match |
| `hide_empty` | No | `false` | Hide the list card when no items match (ignored in icon mode) |
| `allow_complete` | No | `true` | Show a completion checkbox in list mode; enable icon taps in icon mode |
| `refresh_interval` | No | `900` | Fallback reconciliation interval in seconds. Set to `0` to disable it |
| `case_sensitive` | No | `false` | Make text operators case-sensitive |

## Text filters

Text fields (`summary`, `description`, `uid`, and `status`) accept either a simple string for an exact match:

```yaml
filter:
  status: needs_action
```

or an operator object:

```yaml
filter:
  summary:
    contains: urgent
```

Supported operators are:

- `equals`
- `not_equals`
- `contains`
- `not_contains`
- `starts_with`
- `ends_with`
- `regex`
- `exists`

Multiple operators in the same field rule are ANDed together.

Empty visual-editor filter values are ignored. For example, `summary: {}` is treated as if no summary filter was configured.

Example:

```yaml
filter:
  summary:
    contains: project
    not_contains: archived
```

## Due-date filters

The simplest form is:

```yaml
filter:
  due: today
```

Supported relative values:

- `today`
- `tomorrow`
- `overdue`
- `today_or_overdue`
- `future`
- `any`
- `none`

You can also match an exact date:

```yaml
filter:
  due: "2026-08-26"
```

Date comparisons use the Home Assistant configured time zone. Both date-only and date-time to-do items are supported.

For range comparisons:

```yaml
filter:
  due:
    after: "2026-08-01"
    before: "2026-09-01"
```

`before` and `after` are exclusive.

## Regex example

```yaml
type: custom:filtered-todo-card
entity: todo.tasks
title: Priorities
filter:
  summary:
    regex: "^\\[(Urgent|Important|Routine)\\]"
  due: today
```

## Time-of-day filtering (YAML)

Use `filter.due_time` to switch between tasks due before and after a particular clock time. The card uses Home Assistant's configured timezone and re-evaluates each minute without fetching tasks again.

```yaml
type: custom:filtered-todo-card
entity: todo.tilly
filter:
  due: today
  due_time:
    split_at: "10:00"
    mode: current_period
show_completed: true
```

The `split_at` setting accepts either one time or a list of daily boundaries. For example:

```yaml
filter:
  due: today
  due_time:
    split_at:
      - "10:00"
      - "14:00"
    mode: current_period
    carry_over: true
```

Before 10:00 the active period covers tasks due before 10:00; from 10:00 to 13:59 it covers tasks due at or after 10:00 but before 14:00; from 14:00 onwards it covers tasks due at or after 14:00. Unfinished tasks from earlier periods carry over, while future-period tasks remain hidden. Boundary times use Home Assistant's timezone. Completed morning tasks no longer appear after 10:00. Tasks with a date but no clock time are shown in both periods by default.

Optional YAML settings:

- `carry_over: false` - do not retain unfinished morning tasks after the split.
- `untimed: exclude` - hide date-only tasks that have no time.

The `due: today` rule still applies, so tasks from previous dates are not included. Time filtering currently supports the `current_period` mode and is configured in YAML rather than the visual editor.

## Notes

- Filters only affect what this card displays. They do not create a new Home Assistant `todo.*` entity.
- Completing an item updates the original source item using its UID.
- All top-level filter fields are ANDed together.
- The card requests `needs_action` items by default, so completed items are not shown unless `status` is changed.
- Cache data is stored locally in the browser running the dashboard and is not sent anywhere outside Home Assistant.

## License

Apache-2.0
