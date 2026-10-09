import { defineStore } from "pinia";
import type { ItemsApi } from "~~/lib/api/classes/items";
import type { EntitySummary, TreeItem } from "~~/lib/api/types/data-contracts";
import { activeCollectionId } from "~~/composables/use-collections";

export type LocationLoadStatus = "idle" | "loading" | "ready" | "error";

export const useLocationStore = defineStore("locations", {
  state: () => ({
    parents: null as EntitySummary[] | null,
    parentsStatus: "idle" as LocationLoadStatus,
    parentsGeneration: 0,
    Locations: null as EntitySummary[] | null,
    childrenGeneration: 0,
    client: useUserApi(),
    tree: null as TreeItem[] | null,
    treeGeneration: 0,
    boundCollectionId: null as string | null,
    refreshLocationsPromise: null as Promise<void> | null,
  }),
  getters: {
    /**
     * locations represents the locations that are currently in the store. The store is
     * synched with the server by intercepting the API calls and updating on the
     * response.
     *
     * A failed root-list request stays failed until refreshParents is called again.
     * It is not reported as an empty list, and it is not retried on every read.
     */
    parentLocations(state): EntitySummary[] {
      if (state.parents === null && state.parentsStatus !== "loading" && state.parentsStatus !== "error") {
        const store = useLocationStore();
        queueMicrotask(() => {
          if (store.parents === null && store.parentsStatus !== "loading" && store.parentsStatus !== "error") {
            void store.refreshParents();
          }
        });
      }
      return state.parents ?? [];
    },
    allLocations(state): EntitySummary[] {
      return state.Locations ?? [];
    },
  },
  actions: {
    /**
     * Drop records that belong to another collection before the next fetch.
     * In-flight location, child and tree responses are ignored.
     */
    prepareForCollection(collectionId: string | null) {
      if (this.boundCollectionId === collectionId && this.parentsStatus !== "idle") {
        return;
      }
      this.boundCollectionId = collectionId;
      this.parentsGeneration += 1;
      this.childrenGeneration += 1;
      this.treeGeneration += 1;
      this.parents = null;
      this.Locations = null;
      this.tree = null;
      this.parentsStatus = "loading";
      this.refreshLocationsPromise = null;
    },
    async ensureLocationsFetched() {
      if (this.Locations !== null) {
        return;
      }

      if (this.refreshLocationsPromise === null) {
        this.refreshLocationsPromise = this.refreshChildren().then(() => {});
      }
      await this.refreshLocationsPromise;
    },
    async refreshParents(): ReturnType<ItemsApi["getLocations"]> {
      const collectionId = activeCollectionId();
      if (this.boundCollectionId !== collectionId) {
        this.prepareForCollection(collectionId);
      }
      const generation = ++this.parentsGeneration;
      if (this.parents === null) {
        this.parentsStatus = "loading";
      }
      const result = await useUserApi().items.getLocations({ filterChildren: true });
      if (generation !== this.parentsGeneration || activeCollectionId() !== collectionId) {
        return result;
      }
      if (result.error) {
        this.parents = null;
        this.parentsStatus = "error";
        return result;
      }

      this.parents = result.data ?? [];
      this.parentsStatus = "ready";
      this.boundCollectionId = collectionId;
      return result;
    },
    async refreshChildren(): ReturnType<ItemsApi["getLocations"]> {
      const collectionId = activeCollectionId();
      const generation = ++this.childrenGeneration;
      const result = await useUserApi().items.getLocations({ filterChildren: false });
      if (generation !== this.childrenGeneration || activeCollectionId() !== collectionId) {
        return result;
      }
      if (result.error) {
        return result;
      }

      this.Locations = result.data ?? [];
      return result;
    },
    async refreshTree(): ReturnType<ItemsApi["getTree"]> {
      const collectionId = activeCollectionId();
      const generation = ++this.treeGeneration;
      const result = await useUserApi().items.getTree();
      if (generation !== this.treeGeneration || activeCollectionId() !== collectionId) {
        return result;
      }
      if (result.error) {
        return result;
      }

      this.tree = result.data;
      return result;
    },
  },
});
