import { anchorAt, labelIndices } from "../axisLabels";

describe("labelIndices", () => {
  it("fits fewer labels as the axis gets narrower", () => {
    const wide = labelIndices(24, 900);
    const narrow = labelIndices(24, 240);
    expect(wide.length).toBeGreaterThan(narrow.length);
    // never more labels than fit at 76px each
    expect(narrow.length).toBeLessThanOrEqual(Math.floor(240 / 76) + 1);
  });

  it("labels every point when there is room for all of them", () => {
    expect(labelIndices(5, 2000)).toEqual([0, 1, 2, 3, 4]);
  });

  it("always keeps at least two labels and starts at the first point", () => {
    const out = labelIndices(50, 60);
    expect(out[0]).toBe(0);
    expect(out.length).toBeGreaterThanOrEqual(2);
  });

  it("uses the fallback before the axis has been measured", () => {
    expect(labelIndices(24, 0).length).toBe(4);
  });

  it("handles an empty series", () => {
    expect(labelIndices(0, 500)).toEqual([]);
  });
});

describe("anchorAt", () => {
  it("left-aligns at the start, centres in the middle, right-aligns at the end", () => {
    expect(anchorAt(0)).toBe("translateX(-0%)");
    expect(anchorAt(0.5)).toBe("translateX(-50%)");
    expect(anchorAt(1)).toBe("translateX(-100%)");
  });

  it("clamps out-of-range positions so a label never leaves the axis", () => {
    expect(anchorAt(-0.2)).toBe("translateX(-0%)");
    expect(anchorAt(1.3)).toBe("translateX(-100%)");
  });
});
