import { expect, type Locator } from "@playwright/test";

type Bounds = Readonly<{
  x: number;
  y: number;
  width: number;
  height: number;
}>;

type Layout = Readonly<Record<string, Bounds>>;
type Anchors = Readonly<Record<string, Locator>>;

/** Flow anchors exclude viewport/ancestor scrolling, retaining actual layout movement. */
export async function captureLayout(anchors: Anchors): Promise<Layout> {
  const entries = await Promise.all(
    Object.entries(anchors).map(async ([name, locator]) => {
      const bounds = await locator.evaluate((element) => {
        const box = element.getBoundingClientRect();
        let scrollX = window.scrollX;
        let scrollY = window.scrollY;
        for (
          let ancestor = element.parentElement;
          ancestor;
          ancestor = ancestor.parentElement
        ) {
          if (ancestor === document.scrollingElement) continue;
          scrollX += ancestor.scrollLeft;
          scrollY += ancestor.scrollTop;
        }
        return {
          x: box.x + scrollX,
          y: box.y + scrollY,
          width: box.width,
          height: box.height,
        };
      });
      return [name, bounds] as const;
    }),
  );
  return Object.fromEntries(entries);
}

export function expectStableLayout(
  before: Layout,
  after: Layout,
  interaction: string,
  tolerance = 0.5,
): void {
  expect(Object.keys(after)).toEqual(Object.keys(before));
  for (const [name, bounds] of Object.entries(before)) {
    for (const axis of ["x", "y", "width", "height"] as const) {
      expect(
        Math.abs(after[name][axis] - bounds[axis]),
        `${interaction}: ${name}.${axis} unexpectedly moved`,
      ).toBeLessThanOrEqual(tolerance);
    }
  }
}
