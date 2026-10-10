import { useDialog } from "~/components/ui/dialog-provider";
import { DialogID } from "~/components/ui/dialog-provider/utils";
import {
  PURRFECT_CONTEXTUAL_ADD_PATH,
  acceptInventoryNavigation,
  contextualCreateRequest,
  deriveItemLocationHandoff,
  discardIncompatibleInventoryContext,
  inventoryDestinationHref,
  itemsSearchHref,
  resolveAddItemLaunch,
  type InventoryContext,
  type ItemLocationHandoff,
} from "~~/lib/inventory-context";

export type { InventoryContext, ItemLocationHandoff } from "~~/lib/inventory-context";
export { deriveItemLocationHandoff } from "~~/lib/inventory-context";

type LaunchContext = InventoryContext | string | URLSearchParams | Record<string, unknown> | null | undefined;

/**
 * Shared launcher for search and Add item.
 * Purrfect Home opens `/item/add`. Other themes keep the existing dialog.
 * `PURRFECT_CONTEXTUAL_ADD_PATH` is the only switch, and it is not a URL
 * the caller can replace.
 */
export function useInventoryNavigation() {
  const route = useRoute();
  const { theme } = useTheme();
  const { selectedCollection } = useCollections();
  const { openDialog } = useDialog();

  function launchAddItem(context?: LaunchContext) {
    const currentCollectionId = selectedCollection.value?.id ?? null;
    const decision = resolveAddItemLaunch({
      theme: theme.value,
      currentCollectionId,
      context: context ?? null,
      contextualAddPath: PURRFECT_CONTEXTUAL_ADD_PATH,
    });

    if (decision.mode === "page") {
      return navigateTo(decision.href);
    }

    // Incompatible context is dropped. The dialog stays the global create flow
    // and must not inherit another collection's location ids or a return URL.
    const request = contextualCreateRequest({
      currentCollectionId,
      context: context ?? null,
    });
    openDialog(DialogID.CreateEntity, {
      params: request ? { baseType: "item", ...request } : { baseType: "item" },
      onClose: result => {
        if (!result?.created || !result.contextual || !request?.rootLocationId) {
          return;
        }
        const href = inventoryDestinationHref({ kind: "location", rootLocationId: request.rootLocationId }, request);
        if (!href || route.path === `/location/${request.rootLocationId}`) {
          return;
        }
        return navigateTo(href);
      },
    });
    return decision;
  }

  function submitSearch(query: string) {
    const href = itemsSearchHref(query);
    if (!href) {
      return null;
    }
    return navigateTo(href);
  }

  /**
   * Follow an already-built location handoff. Re-checks the signed-in
   * collection and navigates only. It never creates, moves, or updates a record.
   */
  function openLocation(href: string | null) {
    if (!href) {
      return null;
    }
    const currentCollectionId = selectedCollection.value?.id ?? null;
    const decision = discardIncompatibleInventoryContext(href, currentCollectionId);
    if (decision.replacementHref) {
      return null;
    }
    const accepted = acceptInventoryNavigation(href, { currentCollectionId });
    if (!accepted.ok || accepted.navigation.destination.kind !== "location") {
      return null;
    }
    const target = inventoryDestinationHref(accepted.navigation.destination, accepted.navigation.context);
    if (!target) {
      return null;
    }
    return navigateTo(target);
  }

  function itemLocationHref(input: Parameters<typeof deriveItemLocationHandoff>[0]): ItemLocationHandoff {
    return deriveItemLocationHandoff({
      ...input,
      currentCollectionId: input.currentCollectionId ?? selectedCollection.value?.id ?? null,
    });
  }

  return { launchAddItem, submitSearch, openLocation, itemLocationHref };
}

/**
 * Location-page reader for the item handoff. The query is a transient hint:
 * it is not stored, it cannot switch collection, and an incompatible hint is
 * removed from the address without an inventory request.
 */
export function useLocationHandoffContext() {
  const route = useRoute();
  const { selectedId } = useCollections();

  const decision = computed(() => discardIncompatibleInventoryContext(route.fullPath, selectedId.value));

  watch(
    decision,
    value => {
      if (!value.replacementHref || value.replacementHref === route.fullPath) {
        return;
      }
      void navigateTo(value.replacementHref, { replace: true });
    },
    { immediate: true }
  );

  return { context: computed(() => decision.value.context) };
}
