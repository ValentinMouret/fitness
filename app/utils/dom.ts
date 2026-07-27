export function isEditableTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) ||
      target.isContentEditable)
  );
}

export function isButtonTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && target.tagName === "BUTTON";
}

export function isLinkTarget(target: EventTarget | null): boolean {
  return target instanceof Element && target.closest("a") !== null;
}

export function isTextAreaTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLTextAreaElement;
}
