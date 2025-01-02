import { around } from "monkey-around";
import { debounce, MetadataCache, Plugin, TFile } from "obsidian";
import {
  LinkSuggestion,
  MetadataCacheFileCacheRecord,
  MetadataCacheMetadataCacheRecord,
} from "obsidian-typings";

export default class ObsidianAutoLinkerPlugin extends Plugin {
  aliasCache: LinkSuggestion[];
  clearAliasCache = debounce(
    () => {
      this.aliasCache = [];
    },
    2000,
    true
  );

  patchMDCacheUninstaller: () => void;

  getFileByAlias(alias: string) {
    // populate an emphemeral alias cache so that we don't slow this method down horribly
    // the cache lives for 2 seconds before being cleared
    this.populateAliasCache();
    return this.aliasCache.find(
      (a) => a.alias?.toLowerCase() === alias.toLowerCase()
    );
  }

  async onload() {
    const plugin = this;
    this.aliasCache = [];
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
              const alias = plugin.getFileByAlias(linkpath);
              if (alias) {
                return alias.file;
              } else {
                return null;
              }
            } catch {
              return null;
            }
          };
        },
      }
    );
    this.register(this.patchMDCacheUninstaller);

    if (this.app.metadataCache.initialized) {
      // this.refreshLinkResolverCache();
    } else {
      // If not initialized, we're still in the startup phase
      // We don't need to force a refresh because we managed to patch
      //    before the link resolver could kick in
    }
  }

  onunload(): void {
    this.patchMDCacheUninstaller();
    // this.refreshLinkResolverCache();
  }

  populateAliasCache() {
    // on a vault of ~3k files, this takes around 3ms to populate
    if (!this.aliasCache.length) {
      this.aliasCache = this.app.metadataCache
        .getLinkSuggestions()
        .filter((file) => file.alias);
    }
    // Call this every time so that we keep resetting the debounced cache reset timer
    // This means the cache will only reset after 2 seconds of getFirstLinkpathDest call inactivity
    this.clearAliasCache();
  }

  refreshLinkResolverCache = () => {
    // This will force a refresh of the link resolver cache
    // Logic was borrowed from the default Obsidian MetadataCache.initialize() method
    const cache: MetadataCache = this.app.metadataCache;
    const metadataCache: MetadataCacheMetadataCacheRecord = cache.metadataCache;
    const fileCache: MetadataCacheFileCacheRecord = cache.fileCache;
    const markdownFiles: Record<string, TFile> = {};
    const allLoadedFiles = this.app.vault.getAllLoadedFiles();

    for (const file of allLoadedFiles) {
      if (file instanceof TFile) {
        cache.uniqueFileLookup.add(file.name.toLowerCase(), file);
        markdownFiles[file.path] = file;
      }
    }

    for (const filePath in fileCache) {
      const markdownFile = markdownFiles[filePath];
      const cacheEntry = fileCache[filePath];
      if (markdownFile && metadataCache.hasOwnProperty(cacheEntry.hash)) {
        cache.linkResolverQueue?.add(markdownFile);
      }
    }
  };
}
