import { around } from "monkey-around";
import { debounce, MetadataCache, Plugin, TFile } from "obsidian";
import {
  LinkSuggestion,
  MetadataCacheFileCacheRecord,
  MetadataCacheMetadataCacheRecord,
} from "obsidian-typings";

export default class ObsidianAutoLinkerPlugin extends Plugin {
  patchMDCacheUninstaller: () => void;

  getFileByAlias(alias: string) {
    const af = (a: LinkSuggestion) => a.alias?.toLowerCase() === alias.toLowerCase();
    return this.app.metadataCache.getLinkSuggestions().find(af);
  }

  async onload() {
    const plugin = this;
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
  }

  onunload(): void {
    this.patchMDCacheUninstaller();
  }
}
