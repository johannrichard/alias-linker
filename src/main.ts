import { around } from "monkey-around";
import { debounce, normalizePath, parseLinktext, Plugin, TFile } from "obsidian";

export default class ObsidianAutoLinkerPlugin extends Plugin {
  patchMDCacheUninstaller?: () => void;
  aliasIndex = new Map<string, TFile[]>();
  aliasIndexDirty = true;
  scheduleAliasRebuild = debounce(() => {
    if (!this.aliasIndexDirty) {
      return;
    }
    this.rebuildAliasIndex();
    this.aliasIndexDirty = false;
  }, 150);

  normalizeAlias(alias: string): string {
    return alias.trim().toLowerCase();
  }

  rebuildAliasIndex() {
    this.aliasIndex.clear();
    const suggestions = this.app.metadataCache.getLinkSuggestions();
    for (const suggestion of suggestions) {
      if (!suggestion.alias || !suggestion.file) {
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
    for (const entries of this.aliasIndex.values()) {
      entries.sort((left, right) => left.path.localeCompare(right.path));
    }
  }

  getDirectoryDistance(pathA: string, pathB: string): number {
    const dirsA = normalizePath(pathA).split("/").slice(0, -1);
    const dirsB = normalizePath(pathB).split("/").slice(0, -1);
    let sharedDepth = 0;
    while (
      sharedDepth < dirsA.length &&
      sharedDepth < dirsB.length &&
      dirsA[sharedDepth] === dirsB[sharedDepth]
    ) {
      sharedDepth++;
    }
    return (
      dirsA.length - sharedDepth +
      dirsB.length - sharedDepth
    );
  }

  resolveFileByAlias(linkpath: string, sourcePath?: string): TFile | null {
    const targetPath = parseLinktext(linkpath).path;
    if (!targetPath) {
      return null;
    }

    if (this.aliasIndexDirty || this.aliasIndex.size === 0) {
      this.rebuildAliasIndex();
      this.aliasIndexDirty = false;
    }

    const candidates = this.aliasIndex.get(this.normalizeAlias(targetPath));
    if (!candidates?.length) {
      return null;
    }

    if (!sourcePath) {
      return candidates[0];
    }

    let best = candidates[0];
    let bestDistance = this.getDirectoryDistance(sourcePath, best.path);
    for (let index = 1; index < candidates.length; index++) {
      const current = candidates[index];
      const currentDistance = this.getDirectoryDistance(sourcePath, current.path);
      if (currentDistance < bestDistance) {
        best = current;
        bestDistance = currentDistance;
      }
      // When distances are tied, keep `best` so we preserve sorted candidate order.
    }
    return best;
  }

  async onload() {
    const plugin = this;
    const invalidateAliasIndex = () => {
      this.aliasIndexDirty = true;
      this.scheduleAliasRebuild();
    };

    this.registerEvent(this.app.metadataCache.on("resolved", invalidateAliasIndex));
    this.registerEvent(this.app.metadataCache.on("changed", invalidateAliasIndex));
    this.registerEvent(this.app.metadataCache.on("deleted", invalidateAliasIndex));
    this.registerEvent(this.app.vault.on("rename", invalidateAliasIndex));
    this.registerEvent(this.app.vault.on("create", invalidateAliasIndex));
    invalidateAliasIndex();

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
              return plugin.resolveFileByAlias(linkpath, sourcePath);
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
              const alias = plugin.resolveFileByAlias(path, origin);
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
