# Nested Hidden Folders

Index hidden folders (names starting with `.`) at **every vault level**, not only the root.

Fork of [Hidden Folders Access](https://github.com/dsebastien/obsidian-hidden-folders-access), which only lists root-level paths like `.claude`. This plugin also finds `classes/.grok` and other nested dot-folders, then lets you toggle each path into the file tree.

Disable Hidden Folders Access while this is enabled. Both patch the same file adapter.

Missing paths are dropped so a copied settings file cannot invent folders like `.pi`.

Desktop only.

## Use

1. Enable the plugin. By default it indexes **all** hidden folders in the vault, including new ones, except `.git`.
2. **Settings → Nested Hidden Folders** to change that:
   - **Index all hidden folders** (default on). Turn it off to pick folders one by one with the toggles; your manual selection is kept while the option is on.
   - **Excluded folders**, one per line. A bare name such as `.git` matches at any depth (`.git`, `project/.git`, `project/.agents/.git`). A path such as `project/.cache` matches from the vault root. An excluded folder and everything below it is never indexed, in both modes. Default: `.git`.

Installs that already had a manual selection stay in manual mode after the update.

Run **Rescan hidden folders** from the command palette after creating hidden folders while Obsidian is open.

## Tokens / paths

Examples this is built for: `.grok`, `classes/.grok`, `.github`, nested agent skill folders.
