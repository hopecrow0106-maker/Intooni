export type TextBlockSize = "small" | "body" | "large" | "title";
export type TextBlockAlign = "left" | "center" | "right";
export type TextBlockFont = "sans" | "serif" | "mono";
export type ImageBlockSize = "wide" | "medium" | "full";
export type ListBlockStyle = "bullet" | "number" | "check";
export type CalloutTone = "note" | "tip" | "warning";

export type MagazineContentBlock =
  | { type: "paragraph"; value: string }
  | { type: "html"; value: string }
  | {
      type: "text";
      value: string;
      size: TextBlockSize;
      align: TextBlockAlign;
      bold: boolean;
      font: TextBlockFont;
      strike: boolean;
    }
  | { type: "image"; url: string; size: ImageBlockSize }
  | { type: "instagram"; url: string }
  | { type: "quote"; value: string; cite: string }
  | { type: "callout"; title: string; value: string; tone: CalloutTone }
  | { type: "list"; items: string[]; style: ListBlockStyle }
  | { type: "divider" };

const VALID_TEXT_SIZES = new Set<TextBlockSize>(["small", "body", "large", "title"]);
const VALID_TEXT_ALIGNS = new Set<TextBlockAlign>(["left", "center", "right"]);
const VALID_TEXT_FONTS = new Set<TextBlockFont>(["sans", "serif", "mono"]);
const VALID_IMAGE_SIZES = new Set<ImageBlockSize>(["wide", "medium", "full"]);
const VALID_LIST_STYLES = new Set<ListBlockStyle>(["bullet", "number", "check"]);
const VALID_CALLOUT_TONES = new Set<CalloutTone>(["note", "tip", "warning"]);

export function stripHtmlTags(value: string) {
  return value.replace(/<[^>]*>/g, "").trim();
}

function escapeTokenValue(value: string) {
  return stripHtmlTags(value)
    .replace(/\{\{/g, "｛｛")
    .replace(/\}\}/g, "｝｝")
    .replace(/\|/g, "｜");
}

function escapeRawTokenValue(value: string) {
  return value
    .replace(/\{\{/g, "｛｛")
    .replace(/\}\}/g, "｝｝")
    .replace(/\|/g, "｜");
}

function restoreTokenValue(value = "") {
  return value.replace(/｛｛/g, "{{").replace(/｝｝/g, "}}").replace(/｜/g, "|").trim();
}

function splitTokenParts(value: string) {
  return value.split("|").map((item) => restoreTokenValue(item));
}

function cleanVisibleText(value: string) {
  return stripHtmlTags(
    value
      .replace(/\{\{[\s\S]*?\}\}/g, "")
      .replace(/\{\{[\s\S]*$/g, "")
      .replace(/[{}]/g, "")
  );
}

function parseToken(innerToken: string): MagazineContentBlock | null {
  if (innerToken === "divider") {
    return { type: "divider" };
  }

  if (innerToken.startsWith("instagram:")) {
    const url = restoreTokenValue(innerToken.slice("instagram:".length));
    return url ? { type: "instagram", url } : null;
  }

  if (innerToken.startsWith("html:")) {
    const value = restoreTokenValue(innerToken.slice("html:".length));
    return value ? { type: "html", value: sanitizeMagazineHtml(value) } : null;
  }

  if (innerToken.startsWith("image:")) {
    const [url, rawSize] = splitTokenParts(innerToken.slice("image:".length));
    const size = VALID_IMAGE_SIZES.has(rawSize as ImageBlockSize)
      ? (rawSize as ImageBlockSize)
      : "wide";
    return url ? { type: "image", url, size } : null;
  }

  if (innerToken.startsWith("text:")) {
    const [value, rawSize, rawAlign, rawWeight, rawFont, rawDecoration] = splitTokenParts(
      innerToken.slice("text:".length)
    );
    const size = VALID_TEXT_SIZES.has(rawSize as TextBlockSize)
      ? (rawSize as TextBlockSize)
      : "body";
    const align = VALID_TEXT_ALIGNS.has(rawAlign as TextBlockAlign)
      ? (rawAlign as TextBlockAlign)
      : "left";

    return value
      ? {
          type: "text",
          value,
          size,
          align,
          bold: rawWeight === "bold",
          font: VALID_TEXT_FONTS.has(rawFont as TextBlockFont)
            ? (rawFont as TextBlockFont)
            : "sans",
          strike: rawDecoration === "strike"
        }
      : null;
  }

  if (innerToken.startsWith("quote:")) {
    const [value, cite = ""] = splitTokenParts(innerToken.slice("quote:".length));
    return value ? { type: "quote", value, cite } : null;
  }

  if (innerToken.startsWith("callout:")) {
    const [title, value, rawTone] = splitTokenParts(innerToken.slice("callout:".length));
    const tone = VALID_CALLOUT_TONES.has(rawTone as CalloutTone)
      ? (rawTone as CalloutTone)
      : "note";
    return value ? { type: "callout", title: title || "Note", value, tone } : null;
  }

  if (innerToken.startsWith("list:")) {
    const [rawItems, rawStyle] = splitTokenParts(innerToken.slice("list:".length));
    const items = rawItems
      .split(/\n+/)
      .map((item) => item.replace(/^[-*•\d.)\s]+/, "").trim())
      .filter(Boolean);
    const style = VALID_LIST_STYLES.has(rawStyle as ListBlockStyle)
      ? (rawStyle as ListBlockStyle)
      : "bullet";
    return items.length > 0 ? { type: "list", items, style } : null;
  }

  return null;
}

export function parseMagazineContent(content: string): MagazineContentBlock[] {
  const blocks: MagazineContentBlock[] = [];
  const tokenRegex = /\{\{([\s\S]*?)\}\}/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenRegex.exec(content)) !== null) {
    const before = cleanVisibleText(content.slice(lastIndex, match.index));
    if (before) {
      blocks.push({ type: "paragraph", value: before });
    }

    const tokenBlock = parseToken(match[1]);
    if (tokenBlock) {
      blocks.push(tokenBlock);
    }

    lastIndex = tokenRegex.lastIndex;
  }

  const tail = cleanVisibleText(content.slice(lastIndex));
  if (tail) {
    blocks.push({ type: "paragraph", value: tail });
  }

  return blocks;
}

export function getMagazineContentStats(content: string) {
  const text = parseMagazineContent(content)
    .map((block) => {
      if (block.type === "list") {
        return block.items.join(" ");
      }

      if (block.type === "html") {
        return stripHtmlTags(block.value);
      }

      if ("value" in block) {
        return block.value;
      }

      return "";
    })
    .join(" ")
    .trim();

  const characterCount = text.replace(/\s+/g, "").length;
  const blockCount = parseMagazineContent(content).length;
  const readingMinutes = Math.max(1, Math.ceil(characterCount / 600));

  return {
    characterCount,
    blockCount,
    readingMinutes
  };
}

export function buildTextToken(
  value: string,
  size: TextBlockSize,
  align: TextBlockAlign,
  bold = false,
  font: TextBlockFont = "sans",
  strike = false
) {
  return `\n\n{{text:${escapeTokenValue(value)}|${size}|${align}|${bold ? "bold" : "normal"}|${font}|${strike ? "strike" : "none"}}}\n\n`;
}

export function sanitizeMagazineHtml(value: string) {
  return value
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "")
    .replace(/\son\w+="[^"]*"/gi, "")
    .replace(/\son\w+='[^']*'/gi, "")
    .replace(/\son\w+=\S+/gi, "")
    .replace(/javascript:/gi, "");
}

export function buildHtmlToken(value: string) {
  const sanitized = sanitizeMagazineHtml(value).trim();
  return sanitized ? `\n\n{{html:${escapeRawTokenValue(sanitized)}}}\n\n` : "";
}

export function buildImageToken(url: string, size: ImageBlockSize) {
  return `\n\n{{image:${escapeTokenValue(url)}|${size}}}\n\n`;
}

export function buildInstagramToken(url: string) {
  return `\n\n{{instagram:${escapeTokenValue(url)}}}\n\n`;
}

export function buildQuoteToken(value: string, cite = "") {
  return `\n\n{{quote:${escapeTokenValue(value)}|${escapeTokenValue(cite)}}}\n\n`;
}

export function buildCalloutToken(title: string, value: string, tone: CalloutTone) {
  return `\n\n{{callout:${escapeTokenValue(title)}|${escapeTokenValue(value)}|${tone}}}\n\n`;
}

export function buildListToken(value: string, style: ListBlockStyle) {
  const items = value
    .split(/\n+/)
    .map((item) => item.replace(/^[-*•\d.)\s]+/, "").trim())
    .filter(Boolean);

  return `\n\n{{list:${escapeTokenValue(items.join("\n"))}|${style}}}\n\n`;
}

export function buildDividerToken() {
  return "\n\n{{divider}}\n\n";
}
