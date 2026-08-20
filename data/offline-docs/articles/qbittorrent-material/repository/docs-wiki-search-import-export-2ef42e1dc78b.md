# Search, Filters, Import, and Export

The documentation site ships its complete corpus in the page, so browsing and searching continue after the first load.

## Global search

Press `/` or `Ctrl+K` to focus search. Plain-text mode searches document titles, paths, headings, and bodies. Enable these options independently:

- **Regex** — interpret the query as a JavaScript regular expression.
- **Aa** — preserve case instead of matching case-insensitively.
- **Whole word** — wrap plain-text terms in word boundaries.

Invalid expressions are reported inline and never break navigation.

## Regex builder

Open the builder to compose a pattern from common tokens, select flags, and test against sample text. The live preview reports every match and capture group before the pattern is applied.

Examples:

```regex
\b(?:build|package|installer)\b
^(?:#{1,3})\s+.+$
GUI\/(?:Log|TransferList)\/[A-Za-z]+
```

## Filter builder

Rules can target title, path, category, format, or body. Combine rules with **all** or **any**, negate individual rules, and choose contains, equals, starts-with, ends-with, regex, or not-regex operators. Active filters appear as removable chips.

## Import and export

- Import `.md` and `.txt` files as local wiki pages.
- Import a wiki JSON bundle or a saved search-profile JSON file.
- Export the complete built-in and local corpus as a versioned JSON bundle.
- Export the current query, regex options, and filter rules as a portable search profile.

Imported documents remain in this browser through local storage and can be cleared at any time. They are rendered as untrusted text; scripts and unsafe URLs are never executed.

## Application Workspace exports are separate

The desktop application's **Workspace** navigation destination has its own JSON snapshot and
complete Git repository export actions. Those formats contain personal
workspace pages and appearance settings; this documentation site's wiki bundles
contain searchable documents and browser search state. The two JSON formats are
versioned independently and are not interchangeable. See [Workspace Tabs](app-doc://article/qbittorrent-material.repository.2c14bbeee788e0ec).
