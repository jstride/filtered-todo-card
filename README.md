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
- Mark tasks complete from the card
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
- Due-date and description display
- Empty-card behaviour
- Completion controls
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

## Cache and refresh behaviour

The card keeps the last successful unfiltered item list in browser storage. On later dashboard loads it renders that cached list immediately and refreshes it in the background only when needed.

The refresh strategy is:

1. Display the browser cache immediately when available.
2. Refresh as soon as Home Assistant reports that the source `todo.*` entity has changed.
3. Use `refresh_interval` as a fallback reconciliation timer for changes that cannot be detected from the normal dashboard entity state stream.

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
| `status` | No | `needs_action` | Status requested from `todo.get_items`. Can also be a list in YAML |
| `strip` | No | | String or list of literal strings to remove from displayed summaries |
| `sort` | No | `due_asc` | `due_asc`, `due_desc`, `summary_asc`, `summary_desc`, or `none` |
| `show_due` | No | `false` | Show the source due value below the summary |
| `show_description` | No | `false` | Show item descriptions |
| `empty_text` | No | `Nothing due` | Text displayed when no items match |
| `hide_empty` | No | `false` | Hide the whole card when no items match |
| `allow_complete` | No | `true` | Show a completion checkbox |
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

## Notes

- Filters only affect what this card displays. They do not create a new Home Assistant `todo.*` entity.
- Completing an item updates the original source item using its UID.
- All top-level filter fields are ANDed together.
- The card requests `needs_action` items by default, so completed items are not shown unless `status` is changed.
- Cache data is stored locally in the browser running the dashboard and is not sent anywhere outside Home Assistant.

## License

Apache-2.0
