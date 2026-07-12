## Alias Linker

Alias Linker is an Obsidian plugin that lets you link to notes by alias as if the alias were the note name.

Instead of writing `[[filename|alias]]`, you can often just write `[[alias]]` and the plugin will open the right note.

The original idea and a working prototype came from [nothingislost/obsidian-auto-linker](https://github.com/nothingislost/obsidian-auto-linker). This repository builds on that prototype under the Alias Linker name.

### What it does

- Lets bare wikilinks like `[[alias]]` resolve to notes that define that alias.
- Keeps normal Obsidian behavior when `[[link]]` already matches a real file name.
- Picks the nearest matching note first when multiple notes share the same alias.
- Supports alias resolution across graph view, backlinks, embeds, and preview link state.
- Can be disabled at any time to immediately return to default Obsidian link behavior.

If you intentionally reuse the same alias in multiple notes, prefer explicit links like `[[file|alias]]` whenever you need deterministic targeting.

### Technical details (plain language)

Internally, the plugin extends Obsidian's link lookup step with an alias fallback. In practice, this means Obsidian tries its normal file-path resolution first, and only if that fails does Alias Linker look for notes whose aliases match the link text.

To keep results stable, Alias Linker keeps an index of aliases and refreshes it when files or metadata change. When several notes share the same alias, candidates are sorted and the closest note (by folder distance from the source note) is chosen first.

For Obsidian 1.12+, this fallback is applied through metadata cache methods used by both normal link resolution and newer graph-related internals. The plugin stays runtime-only (no desktop-only APIs), so it remains compatible with mobile setups.

In real use, the most reliable approach has been to patch `MetadataCache.getFirstLinkpathDest` (main wikilink path) and `MetadataCache.getLinkpathDest` (used more often in newer internals, including graph flows).

Some alternatives were tested but were incomplete: editor-only extensions and markdown post-processors only affect visible/editor contexts, and metadata events can react to changes but cannot choose link destinations globally.

### Components that now support bare aliases

- Graph view
- Backlinks
- Embeds
- Resolved/Unresolved link display in preview mode

In theory, this patch may automatically allow other plugins, like DataView, to resolve bare aliases but that has not yet been tested.

### Installing via BRAT

Install the BRAT plugin via the Obsidian Plugin Browser and then add the beta repository `johannrichard/alias-linker`.

### Manually installing the plugin

- Copy over `main.js`, `manifest.json` to your vault `VaultFolder/.obsidian/plugins/alias-linker/`.
