# Filtered Todo Card

A lightweight Home Assistant Lovelace card that displays a filtered view of any `todo.*` entity.

The source to-do list remains authoritative. The card reads items through Home Assistant's `todo.get_items` action and updates the original item by UID when it is completed. This means it can be used with CalDAV-backed lists, Local To-do, and other integrations that expose Home Assistant to-do entities.

## Features

- Filter a to-do list without creating duplicate entities or lists
- Filter by summary, description, UID, status, and due date
- Due-date shortcuts for `today`, `tomorrow`, `overdue`, and `today_or_overdue`
- Case-insensitive text filtering by default
- Optional regex filtering
- Strip tags or prefixes from displayed task names without modifying the source task
- Mark tasks complete from the card
- Sort by due date or summary
- Uses Home Assistant theme variables
- No external dependencies

## Installation

### HACS

1. Open HACS in Home Assistant.
2. Add `https://github.com/jstride/filtered-todo-card` as a custom repository.
3. Select **Dashboard** as the repository type.
4. Install **Filtered Todo Card**.
5. Reload the browser or Home Assistant app if prompted.

HACS should add the Lovelace resource automatically.

### Manual

Copy `filtered-todo-card.js` to `/config/www/filtered-todo-card.js`, then add `/local/filtered-todo-card.js` as a JavaScript module under **Settings > Dashboards > Resources**.

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

## Configuration

| Option | Required | Default | Description |
| --- | --- | --- | --- |
| `entity` | Yes | | Source `todo.*` entity |
| `title` | No | Entity friendly name | Card title |
| `filter` | No | `{}` | Filter rules. All configured fields must match |
| `status` | No | `needs_action` | Status requested from `todo.get_items`. Can also be a list |
| `strip` | No | | String or list of literal strings to remove from displayed summaries |
| `sort` | No | `due_asc` | `due_asc`, `due_desc`, `summary_asc`, `summary_desc`, or `none` |
| `show_due` | No | `false` | Show the source due value below the summary |
| `show_description` | No | `false` | Show item descriptions |
| `empty_text` | No | `Nothing due` | Text displayed when no items match |
| `hide_empty` | No | `false` | Hide the whole card when no items match |
| `allow_complete` | No | `true` | Show a completion checkbox |
| `refresh_interval` | No | `30` | Refresh interval in seconds. Set to `0` to disable polling |
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

## License

Apache-2.0
