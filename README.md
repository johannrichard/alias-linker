## Obsidian Auto Linker

This is an early alpha of a plugin that allows for aliases to be referenced directly like `[[this]]` rather than `[[filename|this]]`

In order to accomplish this, the plugin patches the default Obsidian link resolution logic. The logic will remain the same if the link resolves to an existing file in the vault. The new behavior is that, if no existing file is found, it will attempt to find a document containing a matching alias.

The logic will pick the closest and first document with a matching alias. If you have multiple documents with the same alias, the first and closest document will always be resolved. If you want to maintain multiple documents with the same alias, it is recommended that you continue to fully qualify them as normal [[file|alias]].

If you have an actual file with the same name as one of your aliases, the actual file will always be preferred. In the future, there may be an option to always prefer aliases.

If you notice any weirdness with indexing, link resolution or the graph view, disable this plugin and everything will revert back to the default resolution logic.

### Modernization notes (Obsidian 1.12+)

This plugin now tracks latest catalyst typings using `@obsidian-typings/obsidian-catalyst-latest`.

After validating the current Obsidian 1.12+ API surface, there is still no official plugin hook to override bare wikilink destination resolution globally (editor + graph + backlinks + embeds). The practical option remains patching metadata cache internals.

What worked best:
- Patch `MetadataCache.getFirstLinkpathDest` for the core wikilink resolution fallback.
- Patch `MetadataCache.getLinkpathDest` as a secondary fallback used by newer internals (including graph-related paths on recent builds).
- Keep this plugin mobile-safe by staying in runtime-only JS monkey patches (no desktop-only APIs).

What did not provide complete coverage:
- Markdown post processors and editor-only extensions (visual/editor scope only, no graph/backlinks global resolution).
- Metadata events alone (reactive updates, but no interception point for destination selection).

### Components that now support bare aliases

- Graph view
- Backlinks
- Embeds
- Resolved/Unresolved link display in preview mode

In theory, this patch may automatically allow other plugins, like DataView, to resolve bare aliases but that has not yet been tested.

### Installing via BRAT

Install the BRAT plugin via the Obsidian Plugin Browser and then add the beta repository "nothingislost/obsidian-auto-linker"

### Manually installing the plugin

- Copy over `main.js`, `manifest.json` to your vault `VaultFolder/.obsidian/plugins/obsidian-auto-linker/`.
