# Nested Hidden Folders

Index hidden folders (names starting with `.`) at **every vault level**, not only the root.

Fork of [Hidden Folders Access](https://github.com/dsebastien/obsidian-hidden-folders-access), which only lists root-level paths like `.claude`. This plugin also finds `classes/.grok` and other nested dot-folders, then lets you toggle each path into the file tree.

Disable Hidden Folders Access while this is enabled. Both patch the same file adapter.

Missing paths are dropped so a copied settings file cannot invent folders like `.pi`.

Desktop only.

## Use

1. Enable the plugin.
2. **Settings → Nested Hidden Folders**.
3. Refresh, then toggle each hidden path.

## Tokens / paths

Examples this is built for: `.grok`, `classes/.grok`, `.github`, nested agent skill folders.
