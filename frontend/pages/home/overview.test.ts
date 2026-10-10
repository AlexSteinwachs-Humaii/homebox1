import { describe, expect, it } from "vitest";
import { FEATURED_BELONGING_LIMIT, featuredBelongings } from "./overview";

describe("featuredBelongings", () => {
  const recent = [
    { id: "zebra", name: "Zebra lamp", tags: [] as string[] },
    { id: "apple", name: "Apple crate", tags: ["pet"] },
    { id: "mango", name: "Mango bowl", tags: ["cat"] },
    { id: "carrier", name: "Cat carrier", tags: ["cat"] },
    { id: "mixer", name: "Stand mixer", tags: [] as string[] },
  ];

  it("takes the first three of the recent response and leaves the rest", () => {
    expect(FEATURED_BELONGING_LIMIT).toBe(3);
    expect(featuredBelongings(recent).map(item => item.id)).toEqual(["zebra", "apple", "mango"]);
  });

  it("does not promote pet or cat records and does not reorder", () => {
    const featured = featuredBelongings(recent);
    expect(featured.some(item => item.name === "Cat carrier")).toBe(false);
    expect(featured.map(item => item.name)).toEqual(["Zebra lamp", "Apple crate", "Mango bowl"]);
    expect(featuredBelongings([...recent].reverse()).map(item => item.id)).toEqual(["mixer", "carrier", "mango"]);
  });

  it("returns only the records that exist", () => {
    expect(featuredBelongings(recent.slice(0, 2))).toHaveLength(2);
    expect(featuredBelongings([])).toEqual([]);
    expect(featuredBelongings(recent, 0)).toEqual([]);
    expect(featuredBelongings(recent, -1)).toEqual([]);
  });

  it("does not mutate or copy away from the response order", () => {
    const source = [...recent];
    featuredBelongings(source);
    expect(source.map(item => item.id)).toEqual(recent.map(item => item.id));
  });
});
