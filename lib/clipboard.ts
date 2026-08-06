export type CopyTextResult =
  | { ok: true }
  | { ok: false; reason: "unavailable" | "denied" | "failed" };

/**
 * Copies the exact provided string to the clipboard.
 * Prefers `navigator.clipboard`, then a temporary textarea + execCommand fallback.
 */
export async function copyText(
  text: string,
  options: {
    clipboard?: Pick<Clipboard, "writeText"> | null;
    document?: Document;
  } = {},
): Promise<CopyTextResult> {
  const value = text;
  const clipboardApi =
    options.clipboard === undefined
      ? typeof navigator !== "undefined"
        ? navigator.clipboard
        : undefined
      : options.clipboard;

  if (clipboardApi?.writeText) {
    try {
      await clipboardApi.writeText(value);
      return { ok: true };
    } catch {
      // Fall through to legacy path when permission is denied or API throws.
    }
  }

  const doc =
    options.document ??
    (typeof document !== "undefined" ? document : undefined);

  if (!doc?.body) {
    return { ok: false, reason: clipboardApi ? "denied" : "unavailable" };
  }

  try {
    const textarea = doc.createElement("textarea");
    textarea.value = value;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.top = "0";
    textarea.style.left = "0";
    textarea.style.opacity = "0";
    doc.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    textarea.setSelectionRange(0, value.length);

    const succeeded =
      typeof doc.execCommand === "function"
        ? doc.execCommand("copy")
        : false;

    doc.body.removeChild(textarea);

    if (succeeded) {
      return { ok: true };
    }

    return {
      ok: false,
      reason: clipboardApi ? "denied" : "unavailable",
    };
  } catch {
    return { ok: false, reason: "failed" };
  }
}

/** Account / contract IDs shown in the details panel. */
export function isEligibleAddress(
  id: string | undefined,
  type?: string,
): id is string {
  if (!id) {
    return false;
  }

  if (type === "account" || type === "contract") {
    return true;
  }

  return id.startsWith("G") || id.startsWith("C");
}
