import type { Ref } from "vue";
import type { UserClient } from "~~/lib/api/user";
import { activeCollectionId } from "~~/composables/use-collections";
import { ServerEvent, onServerEvent } from "@/composables/use-server-events";
import {
  applyOverviewResult,
  createOverviewGate,
  overviewCacheKey,
  type OverviewSnapshot,
  type OverviewSource,
  type OverviewStatus,
} from "./overview-state";

type FetchOutcome<T> = { ok: true; data: T } | { ok: false };

type MutationEvents = {
  entity?: boolean;
  tag?: boolean;
};

/**
 * Load one overview source for the selected collection.
 *
 * The async-data key includes the collection id, so a payload cached for
 * collection A is not reused as collection B. The gate also ignores a response
 * that resolves after the collection changed or a newer refresh started.
 * Nothing is shown as a successful zero until the fetcher accepts the payload.
 */
export function useOverviewResource<T>(
  source: OverviewSource,
  fetcher: (api: UserClient) => Promise<FetchOutcome<T>>,
  mutations: MutationEvents = {}
) {
  const { selectedId } = useCollections();
  const preferences = useViewPreferences();
  const collectionId = computed(() => selectedId.value ?? preferences.value.collectionId ?? null);
  const gate = createOverviewGate();
  const data = ref(null) as Ref<T | null>;
  const status = ref<OverviewStatus>("pending");

  const asyncData = useAsyncData(
    () => overviewCacheKey(source, collectionId.value),
    async () => {
      const token = gate.changeCollection(collectionId.value ?? activeCollectionId());
      let outcome: FetchOutcome<T>;
      try {
        outcome = await fetcher(useUserApi());
      } catch {
        outcome = { ok: false };
      }
      // Read the gate again at settlement time. A rejected response must not
      // write at all: the snapshot captured before a newer response landed
      // would otherwise replace that newer collection.
      if (!gate.accepts(token)) {
        return data.value;
      }
      const next: OverviewSnapshot<T> = applyOverviewResult(true, outcome, {
        data: data.value,
        status: status.value,
      });
      data.value = next.data;
      status.value = next.status;
      return next.data;
    },
    {
      watch: [collectionId],
      deep: true,
      // A previous visit's payload must not satisfy a new collection, and a
      // copied key value must not skip the fetcher.
      getCachedData: () => undefined,
    }
  );

  watch(
    collectionId,
    id => {
      gate.changeCollection(id);
      data.value = null;
      status.value = "pending";
    },
    { flush: "sync" }
  );

  function refresh() {
    gate.refresh();
    if (data.value === null) {
      status.value = "pending";
    }
    return asyncData.refresh();
  }

  if (mutations.entity) {
    onServerEvent(ServerEvent.EntityMutation, () => {
      void refresh();
    });
  }
  if (mutations.tag) {
    onServerEvent(ServerEvent.TagMutation, () => {
      void refresh();
    });
  }

  return { data, status, refresh, collectionId };
}
