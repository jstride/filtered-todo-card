class FilteredTodoCard extends HTMLElement {
  static CACHE_VERSION = 3;
  static DEFAULT_REFRESH_INTERVAL = 900;
  static _memoryCache = new Map();
  static _inflight = new Map();

  static _isEmptyValue(value) {
    if (value === undefined || value === null) return true;
    if (typeof value === "string") return value.trim() === "";
    if (Array.isArray(value)) {
      return value.length === 0 || value.every((item) => this._isEmptyValue(item));
    }
    if (typeof value === "object") {
      const entries = Object.entries(value);
      return entries.length === 0 || entries.every(([, item]) => this._isEmptyValue(item));
    }
    return false;
  }

  static _cleanObject(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return value;

    const cleaned = {};
    for (const [key, item] of Object.entries(value)) {
      if (key === "exists") {
        cleaned[key] = item;
        continue;
      }
      if (this._isEmptyValue(item)) continue;

      if (item && typeof item === "object" && !Array.isArray(item)) {
        const nested = this._cleanObject(item);
        if (!this._isEmptyValue(nested)) cleaned[key] = nested;
      } else {
        cleaned[key] = item;
      }
    }
    return cleaned;
  }

  static _cleanConfig(config) {
    const cleaned = { ...config };

    if (cleaned.filter && typeof cleaned.filter === "object" && !Array.isArray(cleaned.filter)) {
      cleaned.filter = this._cleanObject(cleaned.filter);
      if (this._isEmptyValue(cleaned.filter)) cleaned.filter = {};
    }

    if (typeof cleaned.strip === "string" && cleaned.strip.trim() === "") {
      delete cleaned.strip;
    }

    return cleaned;
  }

  static getConfigForm() {
    const textOperators = [
      { name: "equals", selector: { text: {} } },
      { name: "not_equals", selector: { text: {} } },
      { name: "contains", selector: { text: {} } },
      { name: "not_contains", selector: { text: {} } },
      { name: "starts_with", selector: { text: {} } },
      { name: "ends_with", selector: { text: {} } },
      { name: "regex", selector: { text: {} } },
    ];

    return {
      schema: [
        {
          name: "entity",
          required: true,
          selector: { entity: { filter: { domain: "todo" } } },
        },
        { name: "title", selector: { text: {} } },
        {
          type: "expandable",
          name: "filter",
          title: "Filters",
          flatten: false,
          schema: [
            {
              type: "expandable",
              name: "summary",
              title: "Summary",
              flatten: false,
              schema: textOperators,
            },
            {
              type: "expandable",
              name: "description",
              title: "Description",
              flatten: false,
              schema: textOperators,
            },
            {
              name: "due",
              selector: {
                select: {
                  options: [
                    { value: "today", label: "Today" },
                    { value: "tomorrow", label: "Tomorrow" },
                    { value: "overdue", label: "Overdue" },
                    { value: "today_or_overdue", label: "Today or overdue" },
                    { value: "future", label: "Future" },
                    { value: "any", label: "Has a due date" },
                    { value: "none", label: "No due date" },
                  ],
                  mode: "dropdown",
                },
              },
            },
          ],
        },
        {
          type: "expandable",
          name: "display",
          title: "Display",
          flatten: true,
          schema: [
            { name: "strip", selector: { text: {} } },
            {
              name: "sort",
              selector: {
                select: {
                  options: [
                    { value: "due_asc", label: "Due date - earliest first" },
                    { value: "due_desc", label: "Due date - latest first" },
                    { value: "summary_asc", label: "Summary - A to Z" },
                    { value: "summary_desc", label: "Summary - Z to A" },
                    { value: "none", label: "Source order" },
                  ],
                  mode: "dropdown",
                },
              },
            },
            { name: "show_summary", selector: { boolean: {} } },
            { name: "show_due", selector: { boolean: {} } },
            { name: "show_description", selector: { boolean: {} } },
            { name: "show_completed", selector: { boolean: {} } },
            { name: "hide_empty", selector: { boolean: {} } },
            { name: "allow_complete", selector: { boolean: {} } },
            { name: "empty_text", selector: { text: {} } },
          ],
        },
        {
          type: "expandable",
          name: "advanced",
          title: "Advanced",
          flatten: true,
          schema: [
            {
              name: "status",
              selector: {
                select: {
                  options: [
                    { value: "needs_action", label: "Incomplete" },
                    { value: "completed", label: "Completed" },
                  ],
                  mode: "dropdown",
                },
              },
            },
            {
              name: "refresh_interval",
              selector: {
                number: {
                  min: 0,
                  max: 3600,
                  step: 30,
                  mode: "box",
                  unit_of_measurement: "s",
                },
              },
            },
            { name: "case_sensitive", selector: { boolean: {} } },
          ],
        },
      ],
      computeLabel: (schema) => {
        const labels = {
          entity: "To-do entity",
          title: "Title",
          due: "Due date",
          strip: "Strip from displayed summary",
          sort: "Sort order",
          show_summary: "Show summary",
          show_due: "Show due date",
          show_description: "Show description",
          show_completed: "Show completed tasks",
          hide_empty: "Hide card when empty",
          allow_complete: "Allow completing items",
          empty_text: "Empty message",
          status: "Item status",
          refresh_interval: "Fallback refresh interval",
          case_sensitive: "Case-sensitive text filters",
          equals: "Equals",
          not_equals: "Does not equal",
          contains: "Contains",
          not_contains: "Does not contain",
          starts_with: "Starts with",
          ends_with: "Ends with",
          regex: "Regular expression",
        };
        return labels[schema.name];
      },
      computeHelper: (schema) => {
        const helpers = {
          entity: "Select the Home Assistant todo.* entity to filter.",
          strip: "Removes this literal text from the displayed summary only. The source task is unchanged.",
          due: "For exact dates and date ranges, use the YAML editor.",
          refresh_interval:
            "Fallback reconciliation interval in seconds. The card refreshes sooner when Home Assistant reports the source entity changed. Default: 900 seconds (15 minutes). Set to 0 to disable the fallback.",
          regex: "JavaScript regular expression. Matching is case-insensitive unless case-sensitive filtering is enabled.",
        };
        return helpers[schema.name];
      },
      assertConfig: (config) => {
        if (config.entity && !String(config.entity).startsWith("todo.")) {
          throw new Error("The entity must be a todo.* entity.");
        }
        if (Array.isArray(config.strip)) {
          throw new Error("Multiple strip values are supported in YAML only.");
        }
        if (Array.isArray(config.status)) {
          throw new Error("Multiple status values are supported in YAML only.");
        }

        const filter = config.filter || {};
        const unsupportedFields = Object.keys(filter).filter(
          (field) => !["summary", "description", "due"].includes(field)
        );
        if (unsupportedFields.length) {
          throw new Error(`Filters for ${unsupportedFields.join(", ")} are supported in YAML only.`);
        }
        if (filter.due && typeof filter.due === "object") {
          throw new Error("Due-date comparison objects are supported in YAML only.");
        }

        for (const field of ["summary", "description"]) {
          const rule = filter[field];
          if (rule == null || FilteredTodoCard._isEmptyValue(rule)) continue;
          if (typeof rule !== "object" || Array.isArray(rule)) {
            throw new Error(`${field} shorthand filters are supported in YAML only.`);
          }
          if (Object.prototype.hasOwnProperty.call(rule, "exists")) {
            throw new Error(`${field}.exists is supported in YAML only.`);
          }
        }
      },
    };
  }

  static getStubConfig(hass) {
    const entity = Object.keys(hass?.states || {}).find((entityId) => entityId.startsWith("todo."));
    return {
      entity: entity || "todo.tasks",
      filter: { due: "today" },
    };
  }

  setConfig(config) {
    if (!config || !config.entity) throw new Error("Filtered Todo Card requires an entity");
    if (!String(config.entity).startsWith("todo.")) {
      throw new Error("Filtered Todo Card entity must be a todo.* entity");
    }
    if (config.filter && (typeof config.filter !== "object" || Array.isArray(config.filter))) {
      throw new Error("filter must be an object");
    }

    this._clearRefreshTimer();
    this._removeCacheListener();

    const cleanedConfig = FilteredTodoCard._cleanConfig(config);
    this.config = {
      filter: {},
      status: "needs_action",
      sort: "due_asc",
      show_summary: true,
      show_due: false,
      show_description: false,
      show_completed: false,
      empty_text: "Nothing due",
      hide_empty: false,
      allow_complete: true,
      refresh_interval: FilteredTodoCard.DEFAULT_REFRESH_INTERVAL,
      case_sensitive: false,
      ...cleanedConfig,
    };

    this.items = [];
    this.error = null;
    this._started = false;
    this._hasData = false;
    this._fetchedAt = 0;
    this._sourceMarkerAtFetch = null;
    this._lastObservedSourceMarker = null;
    this._pending = new Set();
    this._cacheKey = this._buildCacheKey();
    this._hydrateCache();
    this._addCacheListener();

    if (this._hass) this._start();
  }

  set hass(hass) {
    this._hass = hass;
    if (!this.config) return;

    if (!this._started) {
      this._start();
      return;
    }

    const marker = this._sourceMarker();
    if (marker && marker !== this._lastObservedSourceMarker) {
      this._lastObservedSourceMarker = marker;
      if (marker !== this._sourceMarkerAtFetch) {
        this._refreshItems("source-update");
      }
    }
  }

  connectedCallback() {
    if (this.config && this._hass && !this._started) this._start();
  }

  disconnectedCallback() {
    this._clearRefreshTimer();
    this._removeCacheListener();
  }

  _requestedStatus() {
    if (!this.config.show_completed) return this.config.status;

    const statuses = Array.isArray(this.config.status)
      ? [...this.config.status]
      : [this.config.status];

    if (!statuses.includes("needs_action")) statuses.push("needs_action");
    if (!statuses.includes("completed")) statuses.push("completed");
    return statuses.sort();
  }

  _buildCacheKey() {
    const status = this._requestedStatus();
    return `filtered-todo-card:v${FilteredTodoCard.CACHE_VERSION}:${this.config.entity}:${JSON.stringify(status)}`;
  }

  _sourceMarker() {
    const stateObj = this._hass?.states?.[this.config.entity];
    return stateObj?.last_reported || stateObj?.last_updated || stateObj?.last_changed || null;
  }

  _hydrateCache() {
    const memory = FilteredTodoCard._memoryCache.get(this._cacheKey);
    if (memory && Array.isArray(memory.items)) {
      this._applyCache(memory);
      return;
    }

    try {
      const raw = window.localStorage?.getItem(this._cacheKey);
      if (!raw) return;
      const cached = JSON.parse(raw);
      if (!cached || !Array.isArray(cached.items)) return;
      FilteredTodoCard._memoryCache.set(this._cacheKey, cached);
      this._applyCache(cached);
    } catch (error) {
      console.debug("Filtered Todo Card: unable to read browser cache", error);
    }
  }

  _applyCache(cached) {
    this.items = cached.items || [];
    this._hasData = true;
    this._fetchedAt = Number(cached.fetchedAt) || 0;
    this._sourceMarkerAtFetch = cached.sourceMarker || null;
  }

  _saveCache({ broadcast = true } = {}) {
    const cached = {
      items: this.items,
      fetchedAt: this._fetchedAt,
      sourceMarker: this._sourceMarkerAtFetch,
    };
    FilteredTodoCard._memoryCache.set(this._cacheKey, cached);

    try {
      window.localStorage?.setItem(this._cacheKey, JSON.stringify(cached));
    } catch (error) {
      console.debug("Filtered Todo Card: unable to write browser cache", error);
    }

    if (broadcast) {
      window.dispatchEvent(
        new CustomEvent("filtered-todo-card-cache-updated", {
          detail: { key: this._cacheKey },
        })
      );
    }
  }

  _addCacheListener() {
    if (this._cacheListener) return;
    this._cacheListener = (event) => {
      if (event.detail?.key !== this._cacheKey) return;
      const cached = FilteredTodoCard._memoryCache.get(this._cacheKey);
      if (!cached) return;
      this._applyCache(cached);
      this.render();
      this._scheduleFallbackRefresh();
    };
    window.addEventListener("filtered-todo-card-cache-updated", this._cacheListener);
  }

  _removeCacheListener() {
    if (!this._cacheListener) return;
    window.removeEventListener("filtered-todo-card-cache-updated", this._cacheListener);
    this._cacheListener = null;
  }

  _start() {
    if (this._started) return;
    this._started = true;

    const marker = this._sourceMarker();
    this._lastObservedSourceMarker = marker;

    this.render();

    const refreshMs = this._refreshIntervalMs();
    const cacheAge = this._fetchedAt ? Date.now() - this._fetchedAt : Number.POSITIVE_INFINITY;
    const sourceChanged = Boolean(marker && this._sourceMarkerAtFetch && marker !== this._sourceMarkerAtFetch);

    if (!this._hasData || sourceChanged || (refreshMs > 0 && cacheAge >= refreshMs)) {
      this._refreshItems(!this._hasData ? "initial" : sourceChanged ? "source-update" : "fallback");
    } else {
      this._scheduleFallbackRefresh();
    }
  }

  _refreshIntervalMs() {
    const seconds = Number(this.config.refresh_interval);
    if (!Number.isFinite(seconds) || seconds <= 0) return 0;
    return Math.max(seconds, 30) * 1000;
  }

  _scheduleFallbackRefresh() {
    this._clearRefreshTimer();
    const interval = this._refreshIntervalMs();
    if (!interval) return;

    const age = this._fetchedAt ? Date.now() - this._fetchedAt : interval;
    const delay = Math.max(1000, interval - age);
    this._refreshTimer = window.setTimeout(() => {
      this._refreshItems("fallback");
    }, delay);
  }

  _clearRefreshTimer() {
    if (!this._refreshTimer) return;
    window.clearTimeout(this._refreshTimer);
    this._refreshTimer = null;
  }

  async _refreshItems(reason = "manual") {
    if (!this._hass || !this.config) return;

    const existing = FilteredTodoCard._inflight.get(this._cacheKey);
    if (existing) {
      try {
        await existing;
        const cached = FilteredTodoCard._memoryCache.get(this._cacheKey);
        if (cached) this._applyCache(cached);
        this.error = null;
        this.render();
      } catch (_error) {
      } finally {
        this._scheduleFallbackRefresh();
      }
      return;
    }

    const promise = (async () => {
      const result = await this._hass.callService(
        "todo",
        "get_items",
        { status: this._requestedStatus() },
        { entity_id: this.config.entity },
        false,
        true
      );

      const response = result?.response ?? result;
      this.items = response?.[this.config.entity]?.items ?? [];
      this._hasData = true;
      this._fetchedAt = Date.now();
      this._sourceMarkerAtFetch = this._sourceMarker();
      this._lastObservedSourceMarker = this._sourceMarkerAtFetch;
      this.error = null;
      this._saveCache();
      return this.items;
    })();

    FilteredTodoCard._inflight.set(this._cacheKey, promise);

    try {
      await promise;
    } catch (error) {
      console.error(`Filtered Todo Card: unable to refresh items (${reason})`, error);
      this.error = error instanceof Error ? error.message : String(error);
    } finally {
      if (FilteredTodoCard._inflight.get(this._cacheKey) === promise) {
        FilteredTodoCard._inflight.delete(this._cacheKey);
      }
      this.render();
      this._scheduleFallbackRefresh();
    }
  }

  _normalise(value) {
    const text = value == null ? "" : String(value);
    return this.config.case_sensitive ? text : text.toLowerCase();
  }

  _matchTextRule(value, rule) {
    if (FilteredTodoCard._isEmptyValue(rule)) return true;

    if (typeof rule !== "object" || Array.isArray(rule)) {
      return this._normalise(value) === this._normalise(rule);
    }

    const actual = value == null ? "" : String(value);
    const normalised = this._normalise(actual);

    for (const [operator, expectedRaw] of Object.entries(rule)) {
      if (operator === "exists") {
        const exists = value !== undefined && value !== null && String(value).length > 0;
        if (exists !== Boolean(expectedRaw)) return false;
        continue;
      }
      if (FilteredTodoCard._isEmptyValue(expectedRaw)) continue;

      const expected = this._normalise(expectedRaw);
      switch (operator) {
        case "equals":
          if (normalised !== expected) return false;
          break;
        case "not_equals":
          if (normalised === expected) return false;
          break;
        case "contains":
          if (!normalised.includes(expected)) return false;
          break;
        case "not_contains":
          if (normalised.includes(expected)) return false;
          break;
        case "starts_with":
          if (!normalised.startsWith(expected)) return false;
          break;
        case "ends_with":
          if (!normalised.endsWith(expected)) return false;
          break;
        case "regex": {
          try {
            const flags = this.config.case_sensitive ? "" : "i";
            if (!new RegExp(String(expectedRaw), flags).test(actual)) return false;
          } catch (error) {
            console.warn("Filtered Todo Card: invalid regex", expectedRaw, error);
            return false;
          }
          break;
        }
        default:
          console.warn(`Filtered Todo Card: unknown filter operator '${operator}'`);
          return false;
      }
    }
    return true;
  }

  _dateKey(date) {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;

    const formatter = new Intl.DateTimeFormat("en", {
      timeZone: this._hass?.config?.time_zone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const parts = formatter.formatToParts(date);
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
  }

  _todayKey() {
    return this._dateKey(new Date());
  }

  _offsetDateKey(dateKey, days) {
    const [year, month, day] = dateKey.split("-").map(Number);
    return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
  }

  _dueDateKey(due) {
    if (!due) return null;
    const text = String(due);
    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
    return this._dateKey(new Date(text));
  }

  _resolveDueToken(token) {
    const today = this._todayKey();
    if (!today) return null;
    if (token === "today") return { type: "equals", value: today };
    if (token === "tomorrow") return { type: "equals", value: this._offsetDateKey(today, 1) };
    if (token === "overdue") return { type: "before", value: today };
    if (token === "today_or_overdue") return { type: "on_or_before", value: today };
    if (token === "future") return { type: "after", value: today };
    if (token === "any") return { type: "any" };
    if (token === "none") return { type: "none" };
    if (/^\d{4}-\d{2}-\d{2}$/.test(token)) return { type: "equals", value: token };
    return null;
  }

  _matchDueRule(due, rule) {
    if (FilteredTodoCard._isEmptyValue(rule)) return true;
    const dueKey = this._dueDateKey(due);

    if (typeof rule === "string") {
      const resolved = this._resolveDueToken(rule);
      if (!resolved) return false;
      switch (resolved.type) {
        case "any":
          return dueKey !== null;
        case "none":
          return dueKey === null;
        case "equals":
          return dueKey === resolved.value;
        case "before":
          return dueKey !== null && dueKey < resolved.value;
        case "on_or_before":
          return dueKey !== null && dueKey <= resolved.value;
        case "after":
          return dueKey !== null && dueKey > resolved.value;
        default:
          return false;
      }
    }

    if (typeof rule !== "object" || Array.isArray(rule)) return false;

    for (const [operator, expectedRaw] of Object.entries(rule)) {
      if (operator === "exists") {
        if ((dueKey !== null) !== Boolean(expectedRaw)) return false;
        continue;
      }
      if (FilteredTodoCard._isEmptyValue(expectedRaw)) continue;

      const expectedToken = String(expectedRaw);
      const resolved = this._resolveDueToken(expectedToken);
      const expected = resolved?.value ?? expectedToken;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(expected) || dueKey === null) return false;

      switch (operator) {
        case "equals":
          if (dueKey !== expected) return false;
          break;
        case "not_equals":
          if (dueKey === expected) return false;
          break;
        case "before":
          if (!(dueKey < expected)) return false;
          break;
        case "after":
          if (!(dueKey > expected)) return false;
          break;
        case "on_or_before":
          if (!(dueKey <= expected)) return false;
          break;
        case "on_or_after":
          if (!(dueKey >= expected)) return false;
          break;
        default:
          console.warn(`Filtered Todo Card: unknown due filter operator '${operator}'`);
          return false;
      }
    }
    return true;
  }

  _matches(item) {
    const filter = this.config.filter || {};
    return Object.entries(filter).every(([field, rule]) => {
      if (FilteredTodoCard._isEmptyValue(rule)) return true;
      if (field === "due") return this._matchDueRule(item.due, rule);
      if (!["summary", "description", "uid", "status"].includes(field)) {
        console.warn(`Filtered Todo Card: unknown filter field '${field}'`);
        return false;
      }
      return this._matchTextRule(item[field], rule);
    });
  }

  _sortItems(items) {
    const sorted = [...items];
    switch (this.config.sort) {
      case "none":
        return sorted;
      case "due_desc":
        return sorted.sort((a, b) => this._compareDue(b, a));
      case "summary_asc":
        return sorted.sort((a, b) => (a.summary || "").localeCompare(b.summary || ""));
      case "summary_desc":
        return sorted.sort((a, b) => (b.summary || "").localeCompare(a.summary || ""));
      case "due_asc":
      default:
        return sorted.sort((a, b) => this._compareDue(a, b));
    }
  }

  _compareDue(a, b) {
    const aDue = a.due || "9999-12-31T23:59:59";
    const bDue = b.due || "9999-12-31T23:59:59";
    return String(aDue).localeCompare(String(bDue));
  }

  _filteredItems() {
    return this._sortItems(this.items.filter((item) => this._matches(item)));
  }

  _stripSummary(summary) {
    let result = String(summary || "");
    const strips = Array.isArray(this.config.strip) ? this.config.strip : [this.config.strip];
    for (const strip of strips.filter((value) => value != null && String(value).length > 0)) {
      const escaped = String(strip).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      result = result.replace(new RegExp(escaped, "gi"), "");
    }
    return result.replace(/\s{2,}/g, " ").trim();
  }

  _formatDue(due) {
    if (!due) return "";
    const text = String(due);
    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;

    const date = new Date(text);
    if (Number.isNaN(date.getTime())) return text;
    try {
      return new Intl.DateTimeFormat(this._hass?.locale?.language, {
        timeZone: this._hass?.config?.time_zone,
        dateStyle: "medium",
        timeStyle: "short",
      }).format(date);
    } catch (_error) {
      return text;
    }
  }

  _escapeHtml(value) {
    const div = document.createElement("div");
    div.textContent = value == null ? "" : String(value);
    return div.innerHTML;
  }

  async _complete(uid) {
    if (!this._hass || !uid || this._pending.has(uid)) return;

    this._pending.add(uid);
    this.render();

    try {
      await this._hass.callService(
        "todo",
        "update_item",
        { item: uid, status: "completed" },
        { entity_id: this.config.entity }
      );

      if (this.config.show_completed) {
        this.items = this.items.map((item) =>
          item.uid === uid ? { ...item, status: "completed" } : item
        );
      } else {
        this.items = this.items.filter((item) => item.uid !== uid);
      }
      this._hasData = true;
      this._fetchedAt = Date.now();
      this._sourceMarkerAtFetch = this._sourceMarker();
      this.error = null;
      this._saveCache();
    } catch (error) {
      console.error("Filtered Todo Card: unable to complete item", error);
      this.error = error instanceof Error ? error.message : String(error);
    } finally {
      this._pending.delete(uid);
      this.render();
      window.setTimeout(() => this._refreshItems("post-update"), 500);
    }
  }

  render() {
    if (!this.shadowRoot) this.attachShadow({ mode: "open" });
    if (!this.config) return;

    const stateObj = this._hass?.states?.[this.config.entity];
    const title = this.config.title ?? stateObj?.attributes?.friendly_name ?? this.config.entity;
    const items = this._filteredItems();
    const hideCard = Boolean(this.config.hide_empty) && this._hasData && !this.error && items.length === 0;
    this.style.display = hideCard ? "none" : "";

    let content = "";
    if (this.error && !this._hasData) {
      content = `<div class="message error">${this._escapeHtml(this.error)}</div>`;
    } else if (!this._hasData) {
      content = `<div class="message">Loading…</div>`;
    } else if (items.length === 0) {
      content = `<div class="message">${this._escapeHtml(this.config.empty_text)}</div>`;
    } else {
      content = items
        .map((item) => {
          const uid = String(item.uid || "");
          const encodedUid = encodeURIComponent(uid);
          const pending = this._pending.has(uid);
          const completed = item.status === "completed";
          const summaryText = this._escapeHtml(this._stripSummary(item.summary));
          const summary = this.config.show_summary
            ? `<div class="summary">${summaryText}</div>`
            : "";
          const due =
            this.config.show_due && item.due
              ? `<div class="meta">${this._escapeHtml(this._formatDue(item.due))}</div>`
              : "";
          const description =
            this.config.show_description && item.description
              ? `<div class="description${this.config.show_summary ? "" : " primary-description"}">${this._escapeHtml(item.description)}</div>`
              : "";
          const checkbox = this.config.allow_complete
            ? `<button class="complete${completed ? " completed" : ""}" data-uid="${encodedUid}" ${pending || completed ? "disabled" : ""} aria-label="${completed ? "Completed" : "Mark item complete"}">
                 <ha-icon icon="${pending ? "mdi:progress-clock" : completed ? "mdi:checkbox-marked" : "mdi:checkbox-blank-outline"}"></ha-icon>
               </button>`
            : "";

          return `<div class="todo-row">
                    ${checkbox}
                    <div class="todo-content">
                      ${summary}
                      ${due}
                      ${description}
                    </div>
                  </div>`;
        })
        .join("");
    }

    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; }
        ha-card { overflow: hidden; }
        .header {
          padding: 16px 16px 8px;
          color: var(--primary-text-color);
          font-size: var(--ha-card-header-font-size, 20px);
          font-weight: 500;
        }
        .items { padding: 4px 16px 12px; }
        .todo-row {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          min-height: 44px;
          padding: 8px 0;
          border-top: 1px solid var(--divider-color);
        }
        .todo-row:first-child { border-top: 0; }
        .complete {
          display: flex;
          align-items: center;
          justify-content: center;
          flex: 0 0 36px;
          width: 36px;
          height: 36px;
          margin: 0 0 0 -6px;
          padding: 0;
          border: 0;
          border-radius: 50%;
          background: transparent;
          color: var(--primary-color);
          cursor: pointer;
        }
        .complete:hover:not(:disabled) { background: var(--secondary-background-color); }
        .complete:disabled { cursor: default; opacity: 0.6; }
        .complete.completed:disabled { opacity: 1; }
        .complete ha-icon { --mdc-icon-size: 26px; }
        .todo-content { min-width: 0; flex: 1; }
        .summary {
          display: flex;
          align-items: center;
          min-height: 36px;
          color: var(--primary-text-color);
          font-size: 16px;
          line-height: 1.35;
          overflow-wrap: anywhere;
        }
        .meta, .description, .message {
          color: var(--secondary-text-color);
          font-size: 13px;
          line-height: 1.35;
        }
        .meta, .description { margin-top: 3px; }
        .description.primary-description {
          display: flex;
          align-items: center;
          min-height: 36px;
          margin-top: 0;
          color: var(--primary-text-color);
          font-size: 16px;
        }
        .message { padding: 12px 0; }
        .error { color: var(--error-color); }
      </style>
      <ha-card>
        ${title === false || title === "" ? "" : `<div class="header">${this._escapeHtml(title)}</div>`}
        <div class="items">${content}</div>
      </ha-card>
    `;

    this.shadowRoot.querySelectorAll("button.complete").forEach((button) => {
      button.addEventListener("click", () => {
        const uid = decodeURIComponent(button.dataset.uid || "");
        this._complete(uid);
      });
    });
  }

  getCardSize() {
    const count = this._filteredItems().length;
    return Math.max(1, Math.ceil((count + 1) / 2));
  }
}

if (!customElements.get("filtered-todo-card")) {
  customElements.define("filtered-todo-card", FilteredTodoCard);
}

window.customCards = window.customCards || [];
if (!window.customCards.some((card) => card.type === "filtered-todo-card")) {
  window.customCards.push({
    type: "filtered-todo-card",
    name: "Filtered Todo Card",
    description: "Display filtered items from a Home Assistant todo entity",
    preview: false,
    documentationURL: "https://github.com/jstride/filtered-todo-card",
    getEntitySuggestion: (_hass, entityId) => {
      if (entityId?.split(".")[0] !== "todo") return null;
      return {
        config: {
          type: "custom:filtered-todo-card",
          entity: entityId,
          filter: { due: "today" },
        },
      };
    },
  });
}

console.info(
  "%c FILTERED-TODO-CARD %c loaded",
  "color: white; background: #03a9f4; font-weight: 700;",
  "color: inherit;"
);