import { around } from "monkey-around";
import { parseLinktext, Plugin, TFile } from "obsidian";

export default class ObsidianAutoLinkerPlugin extends Plugin {
  patchMDCacheUninstaller?: () => void;
  aliasIndex = new Map<string, TFile[]>();

  normalizeAlias(alias: string): string {
    return alias.trim().toLocaleLowerCase();
  }

  rebuildAliasIndex() {
    this.aliasIndex.clear();
    const suggestions = this.app.metadataCache.getLinkSuggestions();
    for (const suggestion of suggestions) {
      if (!suggestion.alias) {
        continue;
      }

      const alias = this.normalizeAlias(suggestion.alias);
      const entries = this.aliasIndex.get(alias);
      if (entries) {
        entries.push(suggestion.file);
      } else {
        this.aliasIndex.set(alias, [suggestion.file]);
      }
    }
  }

  resolveFileByAlias(linkpath: string): TFile | null {
    const targetPath = parseLinktext(linkpath).path;
    if (!targetPath) {
      return null;
    }

    if (this.aliasIndex.size === 0) {
      this.rebuildAliasIndex();
    }

    const candidates = this.aliasIndex.get(this.normalizeAlias(targetPath));
    return candidates?.[0] ?? null;
  }

  async onload() {
    const plugin = this;
    const invalidateAliasIndex = () => {
      this.aliasIndex.clear();
    };

    this.registerEvent(this.app.metadataCache.on("resolved", invalidateAliasIndex));
    this.registerEvent(this.app.metadataCache.on("changed", invalidateAliasIndex));
    this.registerEvent(this.app.metadataCache.on("deleted", invalidateAliasIndex));
    this.registerEvent(this.app.vault.on("rename", invalidateAliasIndex));
    this.registerEvent(this.app.vault.on("create", invalidateAliasIndex));

    this.patchMDCacheUninstaller = around(
      this.app.metadataCache.constructor.prototype,
      {
        // Here we patch the logic of getFirstLinkpathDest to resolve aliases
        //   and treat them with top priority
        // This means that if an alias name exists,it will always take priority
        //   over an actual file with the same name.
        getFirstLinkpathDest(oldMethod) {
          return function (linkpath: string, sourcePath: string) {
            const result = oldMethod.call(this, linkpath, sourcePath);
            if (result) {
              return result;
            }
            try {
              // don't crash the method!
              return plugin.resolveFileByAlias(linkpath);
            } catch {
              return null;
            }
          };
        },
        // On Obsidian 1.12+ this path is increasingly used by graph-related internals.
        getLinkpathDest(oldMethod) {
          return function (origin: string, path: string) {
            const result = oldMethod.call(this, origin, path);
            if (result?.length) {
              return result;
            }
            try {
              const alias = plugin.resolveFileByAlias(path);
              return alias ? [alias] : [];
            } catch {
              return [];
            }
          };
        },
      }
    );
    this.register(this.patchMDCacheUninstaller);
  }

  onunload(): void {
    this.patchMDCacheUninstaller?.();
  }
}
