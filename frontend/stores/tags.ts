import { defineStore } from "pinia";
import type { TagOut, TagSummary } from "~~/lib/api/types/data-contracts";
import { activeCollectionId } from "~~/composables/use-collections";

export type TagLoadStatus = "idle" | "loading" | "ready" | "error";

export const useTagStore = defineStore("tags", {
  state: () => ({
    allTags: null as TagOut[] | null,
    tagsStatus: "idle" as TagLoadStatus,
    tagsGeneration: 0,
    boundCollectionId: null as string | null,
    client: useUserApi(),
    refreshAllTagsPromise: null as Promise<void> | null,
  }),
  getters: {
    /**
     * tags represents the tags that are currently in the store. The store is
     * synched with the server by intercepting the API calls and updating on the
     * response.
     */
    tags(state): TagOut[] {
      return state.allTags ?? [];
    },
  },
  actions: {
    async ensureAllTagsFetched() {
      if (this.allTags !== null) {
        return;
      }

      if (this.refreshAllTagsPromise === null) {
        this.refreshAllTagsPromise = this.refresh().then(() => {});
      }
      await this.refreshAllTagsPromise;
    },
    prepareForCollection(collectionId: string | null) {
      if (this.boundCollectionId === collectionId && this.tagsStatus !== "idle") {
        return;
      }
      this.boundCollectionId = collectionId;
      this.tagsGeneration += 1;
      this.allTags = null;
      this.tagsStatus = "loading";
      this.refreshAllTagsPromise = null;
    },
    async refresh() {
      const collectionId = activeCollectionId();
      if (this.boundCollectionId !== collectionId) {
        this.prepareForCollection(collectionId);
      }
      const generation = ++this.tagsGeneration;
      if (this.allTags === null) {
        this.tagsStatus = "loading";
      }
      const result = await useUserApi().tags.getAll();
      if (generation !== this.tagsGeneration || activeCollectionId() !== collectionId) {
        return result;
      }
      if (result.error || !Array.isArray(result.data)) {
        this.allTags = null;
        this.tagsStatus = "error";
        return result;
      }

      this.allTags = result.data;
      this.tagsStatus = "ready";
      this.boundCollectionId = collectionId;
      return result;
    },
    getAncestors(tags: string[]) {
      if (this.allTags === null) {
        return [];
      }

      // recursively find all ancestors of all input tags
      const toCheck = [this.allTags.filter(t => tags.includes(t.id))];
      const ancestors: TagOut[] = [];

      while (toCheck.length > 0) {
        const next = toCheck.pop();
        if (next === undefined) {
          break;
        }
        for (const tag of next) {
          if (ancestors.includes(tag)) {
            continue;
          }
          ancestors.push(tag);
          toCheck.push(this.allTags.filter(t => t.id === tag.parentId));
        }
      }

      // filter out tags from ancestors
      return ancestors.filter(t => !tags.includes(t.id));
    },
    withAncestors(tags: TagOut[] | TagSummary[]) {
      if (!tags) {
        return [];
      }
      const ancestors = this.getAncestors(tags.map(t => t.id)).map(t => ({ ...t, ancestors: true }));

      return [...tags.map(t => ({ ...t, ancestors: false })), ...ancestors].sort((a, b) =>
        a.name.localeCompare(b.name)
      );
    },
  },
});
