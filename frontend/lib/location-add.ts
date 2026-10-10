/**
 * Filing place for "Add item here".
 *
 * An exact shelf is used only when the user or a verified item handoff chose
 * it and it still sits in the selected place. Otherwise the destination is
 * the selected branch, or the room itself. Nothing here picks the first shelf.
 */

import { parseInventoryId, type InventoryContext, type InventoryId } from "./inventory-context";
import type { LocationRef } from "./location-browse";
import { canonicalLocationId, locationInScope } from "./location-source";

export function buildLocationAddContext(args: {
  collectionId?: string | null;
  roomId: string;
  branchId?: string | null;
  exactDestinationId?: string | null;
  sourceItemId?: string | null;
  locations: LocationRef[];
}): InventoryContext | null {
  const room = canonicalLocationId(args.roomId, args.locations) ?? parseInventoryId(args.roomId);
  if (!room) {
    return null;
  }

  const branchKnown = args.branchId ? canonicalLocationId(args.branchId, args.locations) : null;
  const branch =
    branchKnown && branchKnown !== room && locationInScope(branchKnown, room, args.locations) ? branchKnown : null;
  const scope = branch ?? room;

  let destination = scope;
  if (args.exactDestinationId) {
    const exact = canonicalLocationId(args.exactDestinationId, args.locations);
    if (exact && locationInScope(exact, scope, args.locations)) {
      destination = exact;
    }
  }

  const context: InventoryContext = {
    rootLocationId: room as InventoryId,
    destinationId: destination as InventoryId,
  };
  const collection = parseInventoryId(args.collectionId);
  if (collection) {
    context.collectionId = collection;
  }
  if (branch) {
    context.branchId = branch as InventoryId;
  }
  const source = parseInventoryId(args.sourceItemId);
  if (source) {
    context.sourceItemId = source;
  }
  return context;
}
