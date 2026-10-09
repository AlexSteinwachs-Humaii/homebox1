import { useDialog } from "~/components/ui/dialog-provider";
import { DialogID } from "~/components/ui/dialog-provider/utils";
import {
  PURRFECT_CONTEXTUAL_ADD_PATH,
  itemsSearchHref,
  resolveAddItemLaunch,
  type InventoryContext,
} from "~~/lib/inventory-context";

export type { InventoryContext } from "~~/lib/inventory-context";

type LaunchContext = InventoryContext | string | URLSearchParams | Record<string, unknown> | null | undefined;

/**
 * Shared launcher for search and Add item.
 * Global Add item opens the existing creation dialog. Setting
 * `PURRFECT_CONTEXTUAL_ADD_PATH` in inventory-context.ts is the only switch
 * that sends Purrfect Home to `/item/add`; other themes stay on the dialog.
 */
export function useInventoryNavigation() {
  const { theme } = useTheme();
  const { selectedCollection } = useCollections();
  const { openDialog } = useDialog();

  function launchAddItem(context?: LaunchContext) {
    const decision = resolveAddItemLaunch({
      theme: theme.value,
      currentCollectionId: selectedCollection.value?.id ?? null,
      context: context ?? null,
      contextualAddPath: PURRFECT_CONTEXTUAL_ADD_PATH,
    });

    if (decision.mode === "page") {
      return navigateTo(decision.href);
    }

    // Incompatible context is dropped. The dialog stays the global create flow
    // and must not inherit another collection's location ids.
    openDialog(DialogID.CreateEntity, { params: { baseType: "item" } });
    return decision;
  }

  function submitSearch(query: string) {
    const href = itemsSearchHref(query);
    if (!href) {
      return null;
    }
    return navigateTo(href);
  }

  return { launchAddItem, submitSearch };
}
