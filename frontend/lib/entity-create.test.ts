import { describe, expect, it } from "vitest";
import {
  ARTBOARD_SAMPLE,
  SAFE_CREATE_EXIT,
  buildCreateRequest,
  chooseFilingLocation,
  classifyCreateResult,
  compatibleCreateIds,
  consumeDraftClear,
  draftUsesArtboardSample,
  emptyCreateDraft,
  locationChain,
  locationRowState,
  parsePurchasePriceInput,
  resolveCreateExit,
  serverCreateDetail,
  settleSave,
  shelfPreviewPhase,
  shelfRows,
  shouldApplyShelfPreview,
  startSave,
  templateApplyFields,
} from "./entity-create";

const ROOM = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1";
const SHELF = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2";
const OTHER = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1";
const COLLECTION = "cccccccc-cccc-4ccc-8ccc-ccccccccccc1";
const FOREIGN = "dddddddd-dddd-4ddd-8ddd-ddddddddddd1";

describe("entity create draft", () => {
  it("starts empty instead of the artboard litter mat", () => {
    const draft = emptyCreateDraft();
    expect(draft.name).toBe("");
    expect(draft.description).toBe("");
    expect(draft.purchaseFrom).toBe("");
    expect(draft.purchasePrice).toBe("");
    expect(draft.tagIds).toEqual([]);
    expect(draft.insured).toBe(false);
    expect(draft.locationId).toBe("");
    expect(draftUsesArtboardSample(draft)).toBe(false);
    expect(JSON.stringify(draft)).not.toContain(ARTBOARD_SAMPLE.name);
    expect(JSON.stringify(draft)).not.toContain(ARTBOARD_SAMPLE.purchaseFrom);
  });

  it("lets an explicit shelf win over a template location", () => {
    const applied = templateApplyFields(
      {
        defaultName: "Carrier",
        defaultLocation: { id: ROOM },
        defaultInsured: true,
        defaultTags: [{ id: "tag-1" }],
      },
      { keepLocation: true }
    );
    expect(applied.locationId).toBeUndefined();
    expect(applied.name).toBe("Carrier");
    expect(applied.insured).toBe(true);

    const choice = chooseFilingLocation({
      explicitDestinationId: SHELF,
      templateLocationId: ROOM,
      knownLocationIds: [ROOM, SHELF],
      collectionId: COLLECTION,
      currentCollectionId: COLLECTION,
    });
    expect(choice).toEqual({ locationId: SHELF, source: "explicit", rejectedExplicit: false });
  });

  it("rejects a shelf that is not in this collection and does not invent one", () => {
    expect(
      chooseFilingLocation({
        explicitDestinationId: SHELF,
        templateLocationId: ROOM,
        knownLocationIds: [ROOM, SHELF],
        collectionId: FOREIGN,
        currentCollectionId: COLLECTION,
      })
    ).toEqual({ locationId: null, source: "none", rejectedExplicit: true });

    expect(
      chooseFilingLocation({
        templateLocationId: OTHER,
        knownLocationIds: [ROOM],
      })
    ).toEqual({ locationId: null, source: "none", rejectedExplicit: false });

    expect(
      chooseFilingLocation({
        templateLocationId: ROOM,
        knownLocationIds: [ROOM, SHELF],
      })
    ).toEqual({ locationId: ROOM, source: "template", rejectedExplicit: false });
  });

  it("describes location and shelf states without pretending data arrived", () => {
    expect(locationRowState({ status: "loading", requestedId: SHELF, confirmedId: null })).toBe("loading");
    expect(locationRowState({ status: "error", requestedId: SHELF, confirmedId: null })).toBe("error");
    expect(locationRowState({ status: "ready", requestedId: SHELF, confirmedId: null })).toBe("rejected");
    expect(locationRowState({ status: "ready", requestedId: null, confirmedId: null })).toBe("missing");
    expect(locationRowState({ status: "ready", requestedId: SHELF, confirmedId: SHELF })).toBe("ready");

    expect(shelfPreviewPhase({ locationId: null, status: "ready", count: 3 })).toBe("absent");
    expect(shelfPreviewPhase({ locationId: SHELF, status: "loading", count: 0 })).toBe("loading");
    expect(shelfPreviewPhase({ locationId: SHELF, status: "error", count: 2 })).toBe("error");
    expect(shelfPreviewPhase({ locationId: SHELF, status: "ready", count: 0 })).toBe("empty");
    expect(shelfPreviewPhase({ locationId: SHELF, status: "ready", count: 1 })).toBe("ready");
    expect(shouldApplyShelfPreview(2, 2, SHELF, SHELF)).toBe(true);
    expect(shouldApplyShelfPreview(1, 2, SHELF, SHELF)).toBe(false);
    expect(shouldApplyShelfPreview(2, 2, ROOM, SHELF)).toBe(false);
  });

  it("walks a real parent chain and lists only that shelf's belongings", () => {
    expect(
      locationChain(SHELF, [
        { id: ROOM, name: "Utility room", parent: null },
        { id: SHELF, name: "Top shelf", parent: { id: ROOM, name: "ignored" } },
      ]).map(part => part.name)
    ).toEqual(["Utility room", "Top shelf"]);

    const rows = shelfRows(
      [
        { id: "item-1", name: "Cat carrier", purchasePrice: 68, parent: { id: SHELF }, imageId: null },
        { id: "item-2", name: "Food container", purchasePrice: 0, parent: { id: SHELF }, thumbnailId: "thumb" },
        { id: "place", name: "Bin", entityType: { isLocation: true }, parent: { id: SHELF }, purchasePrice: 10 },
        { id: "other", name: "Elsewhere", parent: { id: ROOM }, purchasePrice: 4 },
        { id: "blank", name: "No price", parent: { id: SHELF } },
      ],
      SHELF
    );
    expect(rows.map(row => row.name)).toEqual(["Cat carrier", "Food container", "No price"]);
    expect(rows[1]?.purchasePrice).toBe(0);
    expect(rows[2]?.purchasePrice).toBeNull();
    expect(rows[0]?.imageId).toBeNull();
  });

  it("omits blank purchase fields and sends an explicit insured false", () => {
    expect(parsePurchasePriceInput("")).toEqual({ ok: true, value: undefined });
    expect(parsePurchasePriceInput("$16.00")).toEqual({ ok: true, value: 16 });
    expect(parsePurchasePriceInput("1,250.5")).toEqual({ ok: true, value: 1250.5 });
    expect(parsePurchasePriceInput("nope").ok).toBe(false);
    expect(parsePurchasePriceInput("Infinity").ok).toBe(false);

    const created = buildCreateRequest({
      name: "Bowl",
      description: "",
      quantity: 1.5,
      purchasePrice: "",
      purchaseFrom: "",
      insured: false,
      tagIds: ["real", "Travel"],
      knownTagIds: ["real"],
      locationId: SHELF,
      entityTypeId: "type-1",
      manufacturer: "",
      modelNumber: "",
    });
    expect(created.ok).toBe(true);
    if (created.ok && created.kind === "item") {
      expect(created.body.purchasePrice).toBeUndefined();
      expect(created.body.purchaseFrom).toBeUndefined();
      expect(created.body.insured).toBe(false);
      expect(created.body.tagIds).toEqual(["real"]);
      expect(created.body.quantity).toBe(1.5);
      expect(created.body.parentId).toBe(SHELF);
      expect(JSON.stringify(created.body)).not.toContain(ARTBOARD_SAMPLE.name);
    }

    const templated = buildCreateRequest({
      name: "Bowl",
      description: "From the template",
      quantity: 2,
      purchasePrice: "0",
      purchaseFrom: "Shop",
      insured: false,
      tagIds: [],
      locationId: SHELF,
      entityTypeId: "type-1",
      templateId: "template-1",
    });
    expect(templated.ok).toBe(true);
    if (templated.ok && templated.kind === "template") {
      expect(templated.body.insured).toBe(false);
      expect(templated.body.purchasePrice).toBe(0);
      expect(templated.body.purchaseFrom).toBe("Shop");
    }
  });

  it("rejects an incomplete or invalid create before a write", () => {
    expect(
      buildCreateRequest({
        name: "",
        description: "",
        quantity: 1,
        tagIds: [],
        locationId: SHELF,
        entityTypeId: "type-1",
      }).ok
    ).toBe(false);
    expect(
      buildCreateRequest({
        name: "Bowl",
        description: "",
        quantity: 1,
        tagIds: [],
        locationId: "",
        entityTypeId: "type-1",
      })
    ).toMatchObject({ ok: false, reason: "missing-location" });
    expect(
      buildCreateRequest({
        name: "Bowl",
        description: "",
        quantity: -1,
        tagIds: [],
        locationId: SHELF,
        entityTypeId: "type-1",
      })
    ).toMatchObject({ ok: false, reason: "invalid-quantity" });
  });
});

describe("save and cancel exit", () => {
  const locations = [
    { id: ROOM, name: "Utility room", parent: null },
    { id: SHELF, name: "Top shelf", parent: { id: ROOM } },
    { id: OTHER, name: "Spare bin", parent: { id: ROOM } },
  ];

  it("returns cancel to the validated room and save to that room even after the shelf changes", () => {
    const cancel = resolveCreateExit({
      intent: "cancel",
      context: { rootLocationId: ROOM, branchId: SHELF, destinationId: SHELF, collectionId: COLLECTION },
      knownLocationIds: [ROOM, SHELF, OTHER],
      currentCollectionId: COLLECTION,
      locations,
    });
    expect(cancel.kind).toBe("location");
    expect(cancel.href.startsWith(`/location/${ROOM}`)).toBe(true);
    expect(cancel.href).toContain(`rootLocationId=${ROOM}`);
    expect(cancel.href).not.toContain("return=");
    expect(cancel.href).not.toContain("http");

    const saved = resolveCreateExit({
      intent: "save",
      createdId: "ffffffff-ffff-4fff-8fff-ffffffffffff",
      context: { rootLocationId: ROOM, destinationId: SHELF },
      knownLocationIds: [ROOM, SHELF, OTHER],
      currentCollectionId: COLLECTION,
      reportedDestinationId: OTHER,
      locations,
    });
    expect(saved.href.startsWith(`/location/${ROOM}`)).toBe(true);
    expect(saved.href).toContain(`destinationId=${OTHER}`);
    expect(saved.href).not.toContain(`/item/`);
  });

  it("does not file a changed shelf into a room it is not in", () => {
    const foreign = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1";
    const saved = resolveCreateExit({
      intent: "save",
      createdId: "ffffffff-ffff-4fff-8fff-ffffffffffff",
      context: { rootLocationId: ROOM, destinationId: SHELF },
      knownLocationIds: [ROOM, SHELF, foreign],
      reportedDestinationId: foreign,
      locations: [...locations, { id: foreign, name: "Other room", parent: null }],
    });
    expect(saved.href.startsWith(`/location/${ROOM}`)).toBe(true);
    expect(saved.href).toContain(`destinationId=${SHELF}`);
    expect(saved.href).not.toContain(foreign);
  });

  it("uses the branch when the room is gone, and home when neither remains", () => {
    const branch = resolveCreateExit({
      intent: "cancel",
      context: { rootLocationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa99", branchId: SHELF },
      knownLocationIds: [SHELF],
    });
    expect(branch.href.startsWith(`/location/${SHELF}`)).toBe(true);

    const missing = resolveCreateExit({
      intent: "cancel",
      context: { rootLocationId: ROOM, destinationId: SHELF },
      knownLocationIds: [],
    });
    expect(missing).toEqual({ kind: "home", href: SAFE_CREATE_EXIT });

    const globalSave = resolveCreateExit({
      intent: "save",
      createdId: "ffffffff-ffff-4fff-8fff-ffffffffffff",
      context: {},
      knownLocationIds: [ROOM],
    });
    expect(globalSave).toEqual({
      kind: "item",
      href: "/item/ffffffff-ffff-4fff-8fff-ffffffffffff",
    });
  });

  it("drops another collection's return ids", () => {
    const exit = resolveCreateExit({
      intent: "cancel",
      context: { collectionId: FOREIGN, rootLocationId: ROOM },
      knownLocationIds: [ROOM],
      currentCollectionId: COLLECTION,
    });
    expect(exit).toEqual({ kind: "home", href: SAFE_CREATE_EXIT });
  });
});

describe("one create, then stop", () => {
  it("classifies a missing response as uncertain and a validation error as retryable", () => {
    expect(classifyCreateResult({ thrown: true })).toEqual({ kind: "uncertain" });
    expect(classifyCreateResult({ status: 0 })).toEqual({ kind: "uncertain" });
    expect(classifyCreateResult({ status: 503 })).toEqual({ kind: "uncertain" });
    expect(classifyCreateResult({ status: 201 })).toEqual({ kind: "uncertain" });
    expect(classifyCreateResult({ status: 201, id: "not-an-id" })).toEqual({ kind: "uncertain" });
    expect(classifyCreateResult({ status: 422 })).toEqual({ kind: "rejected" });
    expect(classifyCreateResult({ status: 201, id: "ffffffff-ffff-4fff-8fff-ffffffffffff" })).toEqual({
      kind: "created",
      id: "ffffffff-ffff-4fff-8fff-ffffffffffff",
    });
  });

  it("refuses a second submit while saving, after success, and after an uncertain result", () => {
    const saving = startSave({ phase: "idle", draftCleared: false });
    expect(saving).toEqual({ phase: "saving", draftCleared: false });
    expect(startSave(saving!)).toBeNull();

    const saved = settleSave(saving!, "created");
    expect(saved).toEqual({ phase: "saved", draftCleared: true });
    expect(startSave(saved)).toBeNull();
    expect(consumeDraftClear(saved, false)).toBe(true);
    expect(consumeDraftClear(saved, true)).toBe(false);
    expect(settleSave(saved, "created")).toBe(saved);

    const uncertain = settleSave(saving!, "uncertain");
    expect(uncertain.phase).toBe("uncertain");
    expect(uncertain.draftCleared).toBe(false);
    expect(startSave(uncertain)).toBeNull();

    const rejected = settleSave(saving!, "rejected");
    expect(startSave(rejected)?.phase).toBe("saving");
  });

  it("reads field errors without inventing a retry", () => {
    expect(serverCreateDetail({ error: "Validation Error", fields: { name: "taken", quantity: 1 } })).toEqual({
      message: "Validation Error",
      fields: { name: "taken" },
    });
    expect(
      compatibleCreateIds({
        locationId: SHELF,
        templateId: "dddddddd-dddd-4ddd-8ddd-ddddddddddd1",
        entityTypeId: "type-1",
        tagIds: ["keep", "drop"],
        knownLocationIds: [ROOM],
        knownTagIds: ["keep"],
        knownTypeIds: null,
        knownTemplateIds: [],
      })
    ).toEqual({
      locationId: null,
      templateId: null,
      entityTypeId: null,
      tagIds: ["keep"],
    });
  });
});
