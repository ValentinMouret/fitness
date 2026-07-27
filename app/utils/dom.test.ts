import {
  isButtonTarget,
  isEditableTarget,
  isLinkTarget,
  isTextAreaTarget,
} from "./dom";

class TestHTMLElement extends EventTarget {
  constructor(
    readonly tagName: string,
    readonly isContentEditable = false,
  ) {
    super();
  }

  closest(selector: string): TestHTMLElement | null {
    return selector === "a" && this.tagName === "A" ? this : null;
  }
}

describe("DOM target utilities", () => {
  beforeEach(() => {
    vi.stubGlobal("HTMLElement", TestHTMLElement);
    vi.stubGlobal("Element", TestHTMLElement);
    vi.stubGlobal("HTMLTextAreaElement", TestHTMLTextAreaElement);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.each(["INPUT", "TEXTAREA", "SELECT"])(
    "recognizes %s elements as editable",
    (tagName) => {
      expect(isEditableTarget(new TestHTMLElement(tagName))).toBe(true);
    },
  );

  it("recognizes content-editable elements", () => {
    expect(isEditableTarget(new TestHTMLElement("DIV", true))).toBe(true);
  });

  it("rejects non-editable and missing targets", () => {
    expect(isEditableTarget(new TestHTMLElement("DIV"))).toBe(false);
    expect(isEditableTarget(null)).toBe(false);
  });

  it("recognizes only button elements", () => {
    expect(isButtonTarget(new TestHTMLElement("BUTTON"))).toBe(true);
    expect(isButtonTarget(new TestHTMLElement("DIV"))).toBe(false);
  });

  it("recognizes link elements", () => {
    expect(isLinkTarget(new TestHTMLElement("A"))).toBe(true);
    expect(isLinkTarget(new TestHTMLElement("DIV"))).toBe(false);
  });

  it("recognizes textarea elements", () => {
    expect(isTextAreaTarget(new TestHTMLTextAreaElement())).toBe(true);
    expect(isTextAreaTarget(new TestHTMLElement("INPUT"))).toBe(false);
  });
});

class TestHTMLTextAreaElement extends TestHTMLElement {
  constructor() {
    super("TEXTAREA");
  }
}
