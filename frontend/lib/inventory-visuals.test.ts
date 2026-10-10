import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  decorativeCatAttrs,
  inventoryAttachmentPath,
  inventoryLocationPresentation,
  knownAmount,
  knownCount,
  resolveInventoryImage,
  splitLocationPath,
} from "./inventory-visuals";

const ENTITY = "11111111-1111-4111-8111-111111111111";
const IMAGE = "22222222-2222-4222-8222-222222222222";
const THUMB = "33333333-3333-4333-8333-333333333333";
const PARENT = "44444444-4444-4444-8444-444444444444";
const LOCATION = "55555555-5555-4555-8555-555555555555";

const authURL = (path: string) => `${path}?access_token=secret&tenant=home`;

describe("known counts and prices", () => {
  it("keeps a real zero and does not invent one", () => {
    expect(knownCount(0)).toBe(0);
    expect(knownCount("0")).toBe(0);
    expect(knownCount(12)).toBe(12);
    expect(knownCount(undefined)).toBeNull();
    expect(knownCount(null)).toBeNull();
    expect(knownCount("")).toBeNull();
    expect(knownCount("none")).toBeNull();
    expect(knownCount(false)).toBeNull();
    expect(knownCount(-1)).toBeNull();
  });

  it("formats only a known purchase price", () => {
    expect(knownAmount(0)).toBe(0);
    expect(knownAmount(68)).toBe(68);
    expect(knownAmount("24.5")).toBe(24.5);
    expect(knownAmount(undefined)).toBeNull();
    expect(knownAmount(null)).toBeNull();
    expect(knownAmount("")).toBeNull();
  });
});

describe("location paths", () => {
  it("uses the location tree path and a local location link", () => {
    const path = inventoryLocationPresentation({
      treeString: "Utility room > Pet supplies > Top shelf",
      parent: { id: PARENT, name: "Top shelf" },
    });
    expect(path.segments).toEqual(["Utility room", "Pet supplies", "Top shelf"]);
    expect(path.label).toBe("Utility room → Pet supplies → Top shelf");
    expect(path.href).toBe(`/location/${PARENT}`);
  });

  it("walks a real parent chain when the tree path is missing", () => {
    const path = inventoryLocationPresentation({
      parent: {
        id: PARENT,
        name: "Top shelf",
        parent: { id: LOCATION, name: "Pet supplies", parent: { name: "Utility room" } },
      },
    });
    expect(path.segments).toEqual(["Utility room", "Pet supplies", "Top shelf"]);
    expect(path.href).toBe(`/location/${PARENT}`);
  });

  it("does not invent a path or an external link", () => {
    expect(inventoryLocationPresentation({}).segments).toEqual([]);
    expect(inventoryLocationPresentation({}).href).toBeNull();
    expect(
      inventoryLocationPresentation({
        parent: { id: "../etc", name: "Garage" },
      }).href
    ).toBeNull();
    expect(splitLocationPath("Garage")).toEqual(["Garage"]);
  });
});

describe("attachment images", () => {
  it("uses the authenticated thumbnail, then the original", () => {
    const thumb = resolveInventoryImage({ entityId: ENTITY, imageId: IMAGE, thumbnailId: THUMB }, authURL);
    expect(thumb).toEqual({
      url: `/entities/${ENTITY}/attachments/${THUMB}?access_token=secret&tenant=home`,
      kind: "thumbnail",
      attachmentId: THUMB,
    });

    const original = resolveInventoryImage(
      { entityId: ENTITY, imageId: IMAGE, thumbnailId: THUMB, prefer: "original" },
      authURL
    );
    expect(original?.url).toContain(`/attachments/${IMAGE}`);
    expect(original?.kind).toBe("original");
  });

  it("falls back to the original attachment when there is no thumbnail", () => {
    const image = resolveInventoryImage({ entityId: ENTITY, attachmentId: IMAGE }, authURL);
    expect(image?.kind).toBe("original");
    expect(image?.url).toContain(`/entities/${ENTITY}/attachments/${IMAGE}?access_token=`);
  });

  it("never fabricates a photo url", () => {
    expect(resolveInventoryImage({ entityId: ENTITY }, authURL)).toBeNull();
    expect(resolveInventoryImage({ entityId: ENTITY, imageId: "no-image.jpg" }, authURL)).toBeNull();
    expect(resolveInventoryImage({ entityId: "not-an-id", imageId: IMAGE }, authURL)).toBeNull();
    expect(inventoryAttachmentPath(ENTITY, "../../secret")).toBeNull();
    expect(resolveInventoryImage({ entityId: ENTITY, imageId: IMAGE }, () => "/no-image.jpg")).toBeNull();
  });
});

describe("decorative cat", () => {
  it("is hidden unless it has a real label, and is not an image url", () => {
    expect(decorativeCatAttrs(true)).toEqual({ "aria-hidden": "true", focusable: "false" });
    expect(decorativeCatAttrs(false)).toEqual({ "aria-hidden": "true", focusable: "false" });
    expect(decorativeCatAttrs(false, "Illustration of a cat")).toEqual({
      role: "img",
      "aria-label": "Illustration of a cat",
      focusable: "false",
    });
    expect(decorativeCatAttrs(true, "Illustration of a cat")["aria-hidden"]).toBe("true");
  });

  it("keeps the cat component separate from inventory imagery", () => {
    const cat = readFileSync(new URL("../components/Inventory/DecorativeCat.vue", import.meta.url), "utf8");
    const image = readFileSync(new URL("../components/Inventory/EntityImage.vue", import.meta.url), "utf8");
    expect(cat).toContain("data-decorative-cat");
    expect(cat).not.toContain("authURL");
    expect(cat).not.toContain("/entities/");
    expect(cat).not.toContain("no-image");
    expect(image).not.toContain("DecorativeCat");
    expect(image).not.toContain("data-decorative-cat");
    expect(image).not.toContain("no-image");
  });
});
