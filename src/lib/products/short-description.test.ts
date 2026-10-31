/**
 * @jest-environment node
 */
import {
  getShortDescription,
  hasMoreThanShortDescription,
} from "./short-description";

describe("getShortDescription", () => {
  it("uses the first non-empty line", () => {
    expect(
      getShortDescription(
        "\n\nPremium Salem Elampillai Soft Silk Material\nRich pallu",
      ),
    ).toBe("Premium Salem Elampillai Soft Silk Material");
  });

  it("returns empty for missing descriptions", () => {
    expect(getShortDescription(null)).toBe("");
    expect(getShortDescription("   \n  ")).toBe("");
  });

  it("cuts long lines at a word boundary with an ellipsis", () => {
    const long =
      "Premium Salem Elampillai soft silk saree with rich contrast pallu, zari border and matching blouse piece for weddings";
    const short = getShortDescription(long, 60);
    expect(short.length).toBeLessThanOrEqual(61);
    expect(short.endsWith("…")).toBe(true);
    expect(short).not.toMatch(/\s…$/);
  });

  it("keeps emoji lines intact", () => {
    expect(getShortDescription("✨ Soft silk 🍇\nMore")).toBe(
      "✨ Soft silk 🍇",
    );
  });
});

describe("hasMoreThanShortDescription", () => {
  it("is false for a single-line description", () => {
    expect(hasMoreThanShortDescription("Soft silk saree")).toBe(false);
  });

  it("is true when more lines follow", () => {
    expect(hasMoreThanShortDescription("Soft silk\nWash gently")).toBe(true);
  });
});
