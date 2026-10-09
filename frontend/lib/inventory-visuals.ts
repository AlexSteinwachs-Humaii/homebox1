/**
 * Shared inventory presentation for Design C screens.
 *
 * Item and location cards, EntityImage and DecorativeCat all use this module
 * so later screens do not invent their own photo, path or count rules.
 * Attachment URLs are the existing authenticated attachment routes. A missing
 * or failed image is a fallback, never a stock photo and never the decorative cat.
 * Counts are numbers only when the payload actually has one: zero stays zero,
 * and a missing count stays unknown.
 */

import { parseInventoryId } from "./inventory-context";

export const INVENTORY_IMAGE_FALLBACK = "missing-attachment";
export const LOCATION_PATH_SEPARATOR = "→";
const MAX_PATH_DEPTH = 64;

export type InventoryImagePreference = "thumbnail" | "original";

export type InventoryImageInput = {
  entityId: unknown;
  imageId?: unknown;
  thumbnailId?: unknown;
  attachmentId?: unknown;
  attachmentThumbnailId?: unknown;
  prefer?: InventoryImagePreference;
};

export type ResolvedInventoryImage = {
  url: string;
  kind: "thumbnail" | "original";
  attachmentId: string;
};

export type NamedAncestor = {
  id?: string | null;
  name?: string | null;
  parent?: NamedAncestor | null;
};

export type InventoryLocationPresentation = {
  segments: string[];
  label: string;
  href: string | null;
};

/**
 * A finite, non-negative count from the payload. Missing, blank and non-numeric
 * values are unknown — they are not zero.
 */
export function knownCount(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return value;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed >= 0) {
      return parsed;
    }
  }
  return null;
}

/** A finite purchase price, including zero. Missing values are not formatted as zero. */
export function knownAmount(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
}

export function splitLocationPath(value: unknown): string[] {
  if (typeof value !== "string" || value.trim() === "") {
    return [];
  }
  return value
    .split(/\s*(?:>|→)\s*/)
    .map(part => part.trim())
    .filter(Boolean);
}

function ancestorSegments(parent: NamedAncestor | null | undefined): string[] {
  const segments: string[] = [];
  const seen = new Set<string>();
  let current = parent ?? null;

  while (current && segments.length < MAX_PATH_DEPTH) {
    const marker = current.id?.trim() || current.name?.trim() || "";
    if (marker && seen.has(marker)) {
      break;
    }
    if (marker) {
      seen.add(marker);
    }
    const name = current.name?.trim();
    if (name) {
      segments.push(name);
    }
    current = current.parent ?? null;
  }

  return segments.reverse();
}

/**
 * Prefer the location tree path already used by item cards. Otherwise walk the
 * real parent chain. Never invent a room name.
 */
export function inventoryLocationPresentation(input: {
  treeString?: unknown;
  parent?: NamedAncestor | null;
  location?: NamedAncestor | null;
}): InventoryLocationPresentation {
  const fromTree = splitLocationPath(input.treeString);
  const fromParent = ancestorSegments(input.parent);
  const fromLocation = input.location?.name?.trim() ? [input.location.name.trim()] : [];
  const segments = fromTree.length > 0 ? fromTree : fromParent.length > 0 ? fromParent : fromLocation;

  const hrefId = parseInventoryId(input.parent?.id) ?? parseInventoryId(input.location?.id);

  return {
    segments,
    label: segments.join(` ${LOCATION_PATH_SEPARATOR} `),
    href: hrefId ? `/location/${hrefId}` : null,
  };
}

export function inventoryAttachmentPath(entityId: unknown, attachmentId: unknown): string | null {
  const entity = parseInventoryId(entityId);
  const attachment = parseInventoryId(attachmentId);
  if (!entity || !attachment) {
    return null;
  }
  return `/entities/${entity}/attachments/${attachment}`;
}

/**
 * Thumbnail for cards, original when asked or when no thumbnail exists.
 * Returns null when there is no real attachment — callers show the fallback.
 */
export function resolveInventoryImage(
  input: InventoryImageInput,
  authURL: (path: string) => string
): ResolvedInventoryImage | null {
  const entityId = parseInventoryId(input.entityId);
  if (!entityId) {
    return null;
  }

  const original = parseInventoryId(input.attachmentId) ?? parseInventoryId(input.imageId);
  const thumbnail = parseInventoryId(input.attachmentThumbnailId) ?? parseInventoryId(input.thumbnailId);
  const prefer = input.prefer === "original" ? "original" : "thumbnail";
  const attachmentId = prefer === "original" ? (original ?? thumbnail) : (thumbnail ?? original);
  if (!attachmentId) {
    return null;
  }

  const path = inventoryAttachmentPath(entityId, attachmentId);
  if (!path) {
    return null;
  }

  const url = authURL(path);
  if (typeof url !== "string" || url.trim() === "" || url.includes("no-image")) {
    return null;
  }

  const usedOriginal = original !== null && attachmentId === original && (prefer === "original" || thumbnail === null);
  return {
    url,
    attachmentId,
    kind: usedOriginal ? "original" : "thumbnail",
  };
}

/**
 * Decorative art is never an inventory image and is hidden from assistive
 * technology unless a caller supplies a real label.
 */
export function decorativeCatAttrs(decorative: boolean, label?: string): Record<string, string> {
  const named = label?.trim();
  if (decorative || !named) {
    return { "aria-hidden": "true", focusable: "false" };
  }
  return { role: "img", "aria-label": named, focusable: "false" };
}
