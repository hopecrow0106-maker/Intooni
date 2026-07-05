"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState, type DragEvent as ReactDragEvent } from "react";

import { InstagramEmbed } from "@/components/InstagramEmbed";
import {
  buildImageToken,
  buildHtmlToken,
  buildInstagramToken,
  getMagazineContentStats,
  parseMagazineContent,
  sanitizeMagazineHtml,
  type ImageBlockSize,
  type MagazineContentBlock,
  type TextBlockAlign,
  type TextBlockFont
} from "@/lib/magazine-content";
import type { Artist, Magazine } from "@/lib/types";

export type MagazineFormValues = {
  id?: string;
  title: string;
  tag: string;
  content: string;
  thumbnail_url: string;
  related_artist_ids: string[];
  instagram_urls: string[];
  published_at: string;
  is_public: boolean;
};

type MagazineFormProps = {
  isOpen: boolean;
  initialMagazine: Magazine | null;
  artists: Artist[];
  saving: boolean;
  onClose: () => void;
  onSave: (values: MagazineFormValues) => Promise<void>;
};

type UploadingState = {
  thumbnail: boolean;
  inlineImage: boolean;
};

type MagazineAttachment =
  | {
      id: string;
      type: "image";
      url: string;
      size: ImageBlockSize;
    }
  | {
      id: string;
      type: "instagram";
      url: string;
    };

const EMPTY_INSTAGRAM_URLS = ["", "", "", ""];
const FONT_SIZE_PRESETS = [13, 15, 17, 20, 24, 28, 32];
const TEXT_FONT_OPTIONS: Array<{ value: TextBlockFont; label: string }> = [
  { value: "sans", label: "기본체" },
  { value: "serif", label: "명조체" },
  { value: "mono", label: "고정폭" }
];

function formatDateInput(value?: string) {
  if (!value) {
    return new Date().toISOString().slice(0, 10);
  }

  return new Date(value).toISOString().slice(0, 10);
}

function formatDateLabel(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "날짜 미정";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric"
  }).format(date);
}

function createInitialState(magazine: Magazine | null): MagazineFormValues {
  return {
    id: magazine?.id,
    title: magazine?.title ?? "",
    tag: magazine?.tag ?? "",
    content: magazine?.content ?? "",
    thumbnail_url: magazine?.thumbnail_url ?? "",
    related_artist_ids: magazine?.related_artist_ids ?? [],
    instagram_urls: magazine?.instagram_urls.length
      ? [...magazine.instagram_urls, ...EMPTY_INSTAGRAM_URLS].slice(0, 4)
      : [...EMPTY_INSTAGRAM_URLS],
    published_at: formatDateInput(magazine?.published_at),
    is_public: magazine?.is_public ?? true
  };
}

function createAttachmentId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function getFontFamily(font: TextBlockFont) {
  return {
    sans: "Arial, sans-serif",
    serif: "serif",
    mono: "monospace"
  }[font];
}

function getBlockHtml(block: MagazineContentBlock) {
  if (block.type === "html") {
    return block.value;
  }

  if (block.type === "paragraph") {
    return `<p>${escapeHtml(block.value).replace(/\n/g, "<br>")}</p>`;
  }

  if (block.type === "text") {
    const tag = block.size === "title" ? "h2" : block.size === "large" ? "h3" : "p";
    const fontSize = block.size === "small" ? "13px" : "";
    return `<${tag} style="text-align:${block.align};font-family:${getFontFamily(block.font)};${fontSize ? `font-size:${fontSize};` : ""}${block.strike ? "text-decoration:line-through;" : ""}">${block.bold ? "<strong>" : ""}${escapeHtml(block.value).replace(/\n/g, "<br>")}${block.bold ? "</strong>" : ""}</${tag}>`;
  }

  if (block.type === "quote") {
    return `<blockquote>${escapeHtml(block.value).replace(/\n/g, "<br>")}${block.cite ? `<cite>- ${escapeHtml(block.cite)}</cite>` : ""}</blockquote>`;
  }

  if (block.type === "callout") {
    return `<p><strong>${escapeHtml(block.title)}</strong><br>${escapeHtml(block.value).replace(/\n/g, "<br>")}</p>`;
  }

  if (block.type === "list") {
    return `<ul>${block.items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
  }

  return "";
}

function createEditorDraft(content: string) {
  const blocks = parseMagazineContent(content);
  const bodyHtml = blocks
    .map(getBlockHtml)
    .filter(Boolean)
    .join("");
  const attachments = blocks
    .map((block): MagazineAttachment | null => {
      if (block.type === "image") {
        return {
          id: createAttachmentId(),
          type: "image",
          url: block.url,
          size: block.size
        };
      }

      if (block.type === "instagram") {
        return {
          id: createAttachmentId(),
          type: "instagram",
          url: block.url
        };
      }

      return null;
    })
    .filter((item): item is MagazineAttachment => Boolean(item));

  return {
    bodyHtml,
    attachments
  };
}

function buildContentFromDraft(bodyHtml: string, attachments: MagazineAttachment[]) {
  const body = sanitizeMagazineHtml(bodyHtml).trim();
  const attachmentContent = attachments
    .map((attachment) => {
      if (attachment.type === "image") {
        return buildImageToken(attachment.url, attachment.size);
      }

      return buildInstagramToken(attachment.url);
    })
    .join("");

  return [buildHtmlToken(body), attachmentContent].filter(Boolean).join("\n\n");
}

function getImageWidthClass(size: ImageBlockSize) {
  return {
    full: "max-w-full",
    wide: "max-w-3xl",
    medium: "max-w-xl"
  }[size];
}

function getPreviewTextClass(block: Extract<MagazineContentBlock, { type: "text" }>) {
  const sizeClass = {
    small: "text-[13px] leading-7 text-slate-500",
    body: "text-[15px] leading-8 text-slate-700",
    large: "text-xl leading-9 tracking-[-0.02em] text-ink",
    title: "text-3xl font-extrabold leading-tight tracking-[-0.03em] text-ink"
  }[block.size];
  const alignClass =
    block.align === "center" ? "text-center" : block.align === "right" ? "text-right" : "text-left";
  const fontClass =
    block.font === "serif" ? "font-serif" : block.font === "mono" ? "font-mono" : "";

  return [
    sizeClass,
    alignClass,
    fontClass,
    block.bold ? "font-bold" : "",
    block.strike ? "line-through decoration-2" : ""
  ].filter(Boolean).join(" ");
}

function renderPreviewBlock(block: MagazineContentBlock, index: number) {
  if (block.type === "paragraph") {
    return (
      <p key={`text-${index}`} className="whitespace-pre-wrap text-[15px] leading-8 text-slate-700">
        {block.value}
      </p>
    );
  }

  if (block.type === "html") {
    return (
      <div
        key={`html-${index}`}
        className="magazine-rich-preview"
        dangerouslySetInnerHTML={{ __html: sanitizeMagazineHtml(block.value) }}
      />
    );
  }

  if (block.type === "text") {
    return (
      <p key={`text-${index}`} className={`whitespace-pre-wrap ${getPreviewTextClass(block)}`}>
        {block.value}
      </p>
    );
  }

  if (block.type === "image") {
    return (
      <div key={`image-${index}`} className={`mx-auto ${getImageWidthClass(block.size)}`}>
        <div className="overflow-hidden rounded-lg border border-slate-100 bg-slate-50">
          <Image
            src={block.url}
            alt="본문 이미지 미리보기"
            width={1200}
            height={800}
            className="h-auto max-h-[520px] w-full object-contain"
          />
        </div>
      </div>
    );
  }

  if (block.type === "instagram") {
    return (
      <div key={`instagram-${index}`} className="mx-auto max-w-xl">
        <InstagramEmbed url={block.url} compact className="max-h-[340px] min-h-[220px] rounded-lg" />
      </div>
    );
  }

  if (block.type === "list") {
    return (
      <ul key={`list-${index}`} className="list-disc space-y-2 pl-6 text-[15px] leading-7 text-slate-700">
        {block.items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    );
  }

  return null;
}

export function MagazineForm({
  isOpen,
  initialMagazine,
  artists,
  saving,
  onClose,
  onSave
}: MagazineFormProps) {
  const initialDraft = createEditorDraft(initialMagazine?.content ?? "");
  const [form, setForm] = useState<MagazineFormValues>(() => {
    const nextForm = createInitialState(initialMagazine);
    return {
      ...nextForm,
      content: buildContentFromDraft(initialDraft.bodyHtml, initialDraft.attachments)
    };
  });
  const [initialSnapshot, setInitialSnapshot] = useState(() => JSON.stringify(form));
  const [bodyHtml, setBodyHtml] = useState(initialDraft.bodyHtml);
  const [attachments, setAttachments] = useState<MagazineAttachment[]>(initialDraft.attachments);
  const [uploading, setUploading] = useState<UploadingState>({
    thumbnail: false,
    inlineImage: false
  });
  const [artistSearch, setArtistSearch] = useState("");
  const [inlineInstagramUrl, setInlineInstagramUrl] = useState("");
  const [formMessage, setFormMessage] = useState("");
  const [fontSizePx, setFontSizePx] = useState(17);
  const [textFont, setTextFont] = useState<TextBlockFont>("sans");
  const [textAlign, setTextAlign] = useState<TextBlockAlign>("left");
  const [textBold, setTextBold] = useState(false);
  const editorRef = useRef<HTMLDivElement | null>(null);
  const editorHtmlRef = useRef(initialDraft.bodyHtml);
  const savedSelectionRef = useRef<Range | null>(null);

  useEffect(() => {
    const nextForm = createInitialState(initialMagazine);
    const nextDraft = createEditorDraft(nextForm.content);
    const normalizedForm = {
      ...nextForm,
      content: buildContentFromDraft(nextDraft.bodyHtml, nextDraft.attachments)
    };

    setForm(normalizedForm);
    setInitialSnapshot(JSON.stringify(normalizedForm));
    setBodyHtml(nextDraft.bodyHtml);
    setAttachments(nextDraft.attachments);
    setUploading({ thumbnail: false, inlineImage: false });
    setArtistSearch("");
    setInlineInstagramUrl("");
    setFormMessage("");
    setFontSizePx(17);
    setTextFont("sans");
    setTextAlign("left");
    setTextBold(false);
    editorHtmlRef.current = nextDraft.bodyHtml;
    if (editorRef.current) {
      editorRef.current.innerHTML = nextDraft.bodyHtml;
    }
  }, [initialMagazine, isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleSelectionChange = () => {
      const selection = window.getSelection();
      const editor = editorRef.current;
      if (!selection || selection.rangeCount === 0 || !editor) {
        return;
      }

      const range = selection.getRangeAt(0);
      if (editor.contains(range.commonAncestorContainer)) {
        savedSelectionRef.current = range.cloneRange();
      }
    };

    document.addEventListener("selectionchange", handleSelectionChange);
    return () => document.removeEventListener("selectionchange", handleSelectionChange);
  }, [isOpen]);

  const isBusy = saving || uploading.thumbnail || uploading.inlineImage;
  const hasUnsavedChanges = JSON.stringify(form) !== initialSnapshot;
  const contentPreviewBlocks = useMemo(() => parseMagazineContent(form.content), [form.content]);
  const contentStats = useMemo(() => getMagazineContentStats(form.content), [form.content]);
  const selectedArtistSet = useMemo(() => new Set(form.related_artist_ids), [form.related_artist_ids]);
  const selectedArtists = useMemo(() => {
    const artistMap = new Map(artists.map((artist) => [artist.id, artist]));
    return form.related_artist_ids
      .map((id) => artistMap.get(id))
      .filter((artist): artist is Artist => Boolean(artist));
  }, [artists, form.related_artist_ids]);
  const filteredArtists = useMemo(() => {
    const query = artistSearch.trim().toLowerCase();

    if (!query) {
      return artists;
    }

    return artists.filter((artist) => {
      return (
        artist.name.toLowerCase().includes(query) ||
        artist.instagram_handle.toLowerCase().includes(query) ||
        artist.genre.toLowerCase().includes(query)
      );
    });
  }, [artistSearch, artists]);

  if (!isOpen) {
    return null;
  }

  const formId = "magazine-admin-form";

  const syncEditorContent = (nextBodyHtml: string, nextAttachments: MagazineAttachment[]) => {
    const nextContent = buildContentFromDraft(nextBodyHtml, nextAttachments);
    editorHtmlRef.current = nextBodyHtml;
    setBodyHtml(nextBodyHtml);
    setAttachments(nextAttachments);
    setForm((current) => ({
      ...current,
      content: nextContent
    }));
  };

  const requestClose = () => {
    if (isBusy) {
      return;
    }

    if (
      hasUnsavedChanges &&
      !window.confirm("작성 중인 매거진이 있습니다. 닫으면 입력한 내용이 사라집니다. 닫을까요?")
    ) {
      return;
    }

    onClose();
  };

  const uploadFile = async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("folder", "magazines");

    const response = await fetch("/api/admin/upload", {
      method: "POST",
      body: formData
    });

    const data = (await response.json()) as { publicUrl?: string; message?: string };

    if (!response.ok || !data.publicUrl) {
      throw new Error(data.message ?? "매거진 이미지 업로드에 실패했습니다.");
    }

    return data.publicUrl;
  };

  const appendInlineImage = async (file: File | undefined, size: ImageBlockSize) => {
    if (!file) {
      return;
    }

    setUploading((current) => ({ ...current, inlineImage: true }));

    try {
      const publicUrl = await uploadFile(file);
      syncEditorContent(editorHtmlRef.current, [
        ...attachments,
        {
          id: createAttachmentId(),
          type: "image",
          url: publicUrl,
          size
        }
      ]);
      setFormMessage("");
    } catch (error) {
      setFormMessage(error instanceof Error ? error.message : "본문 이미지 업로드에 실패했습니다.");
    } finally {
      setUploading((current) => ({ ...current, inlineImage: false }));
    }
  };

  const uploadCoverImage = async (file?: File) => {
    if (!file) {
      return;
    }

    setUploading((current) => ({ ...current, thumbnail: true }));
    try {
      const publicUrl = await uploadFile(file);
      setForm((current) => ({ ...current, thumbnail_url: publicUrl }));
      setFormMessage("");
    } catch (error) {
      setFormMessage(
        error instanceof Error ? error.message : "매거진 커버 업로드에 실패했습니다."
      );
    } finally {
      setUploading((current) => ({ ...current, thumbnail: false }));
    }
  };

  const saveSelection = () => {
    if (typeof window === "undefined") {
      return;
    }

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || !editorRef.current) {
      return;
    }

    const range = selection.getRangeAt(0);
    const commonAncestor = range.commonAncestorContainer;
    if (editorRef.current.contains(commonAncestor)) {
      savedSelectionRef.current = range.cloneRange();
    }
  };

  const restoreSelection = () => {
    if (typeof window === "undefined" || !savedSelectionRef.current || !editorRef.current) {
      return;
    }

    const selection = window.getSelection();
    if (!selection) {
      return;
    }

    selection.removeAllRanges();
    selection.addRange(savedSelectionRef.current);
  };

  const syncFromEditor = (updatePreview = true) => {
    const nextBodyHtml = editorRef.current?.innerHTML ?? "";
    editorHtmlRef.current = nextBodyHtml;

    if (updatePreview) {
      syncEditorContent(nextBodyHtml, attachments);
    }
  };

  const runEditorCommand = (command: string, value?: string) => {
    editorRef.current?.focus();
    restoreSelection();
    document.execCommand(command, false, value);
    saveSelection();
    syncFromEditor();
    setFormMessage("");
  };

  const applyBoldStyle = () => {
    editorRef.current?.focus();
    restoreSelection();
    const editor = editorRef.current;

    const selection = typeof window !== "undefined" ? window.getSelection() : null;
    const applyBoldToCurrentBlock = () => {
      if (!editor) {
        return;
      }

      const anchorNode = selection?.anchorNode;
      let currentNode: Node | null =
        anchorNode && editor.contains(anchorNode) ? anchorNode : editor.querySelector("p, div, h2, h3, li, blockquote");

      while (currentNode && currentNode !== editor) {
        if (
          currentNode instanceof HTMLElement &&
          ["P", "DIV", "H2", "H3", "LI", "BLOCKQUOTE"].includes(currentNode.tagName)
        ) {
          currentNode.style.fontWeight = "700";
          return;
        }

        currentNode = currentNode.parentNode;
      }

      editor.style.fontWeight = "700";
    };

    if (!selection || selection.rangeCount === 0 || !editor) {
      applyBoldToCurrentBlock();
      syncFromEditor();
      return;
    }

    const range = selection.getRangeAt(0);
    if (!editor.contains(range.commonAncestorContainer)) {
      applyBoldToCurrentBlock();
      syncFromEditor();
      return;
    }

    if (range.collapsed) {
      applyBoldToCurrentBlock();
    } else {
      try {
        const strong = document.createElement("strong");
        strong.appendChild(range.extractContents());
        range.insertNode(strong);
        const nextRange = document.createRange();
        nextRange.selectNodeContents(strong);
        selection.removeAllRanges();
        selection.addRange(nextRange);
        savedSelectionRef.current = nextRange.cloneRange();
      } catch {
        applyBoldToCurrentBlock();
      }
    }

    syncFromEditor();
    setFormMessage("");
  };

  const applyFontSize = (nextSize: number) => {
    if (!Number.isFinite(nextSize)) {
      return;
    }

    const clampedSize = Math.min(72, Math.max(10, Math.round(nextSize)));
    setFontSizePx(clampedSize);
    editorRef.current?.focus();
    restoreSelection();

    const editor = editorRef.current;
    const selection = typeof window !== "undefined" ? window.getSelection() : null;

    const applySizeToCurrentBlock = () => {
      if (!editor) {
        return;
      }

      const anchorNode = selection?.anchorNode;
      let currentNode: Node | null =
        anchorNode && editor.contains(anchorNode)
          ? anchorNode
          : editor.querySelector("p, div, h2, h3, li, blockquote");

      while (currentNode && currentNode !== editor) {
        if (
          currentNode instanceof HTMLElement &&
          ["P", "DIV", "H2", "H3", "LI", "BLOCKQUOTE", "SPAN", "STRONG"].includes(currentNode.tagName)
        ) {
          currentNode.style.fontSize = `${clampedSize}px`;
          return;
        }

        currentNode = currentNode.parentNode;
      }

      editor.style.fontSize = `${clampedSize}px`;
    };

    if (!selection || selection.rangeCount === 0 || !editor) {
      applySizeToCurrentBlock();
      syncFromEditor();
      setFormMessage("");
      return;
    }

    const range = selection.getRangeAt(0);
    if (!editor.contains(range.commonAncestorContainer) || range.collapsed) {
      applySizeToCurrentBlock();
      syncFromEditor();
      setFormMessage("");
      return;
    }

    try {
      const span = document.createElement("span");
      span.style.fontSize = `${clampedSize}px`;
      span.appendChild(range.extractContents());
      range.insertNode(span);

      const nextRange = document.createRange();
      nextRange.selectNodeContents(span);
      selection.removeAllRanges();
      selection.addRange(nextRange);
      savedSelectionRef.current = nextRange.cloneRange();
    } catch {
      applySizeToCurrentBlock();
    }

    syncFromEditor();
    setFormMessage("");
  };

  const applyTextFont = (font: TextBlockFont) => {
    setTextFont(font);
    runEditorCommand("fontName", getFontFamily(font));
  };

  const applyTextAlign = (align: TextBlockAlign) => {
    setTextAlign(align);
    runEditorCommand(
      align === "center" ? "justifyCenter" : align === "right" ? "justifyRight" : "justifyLeft"
    );
  };

  const appendInlineInstagram = () => {
    const url = inlineInstagramUrl.trim();

    if (!url) {
      setFormMessage("본문에 넣을 인스타 링크를 입력해 주세요.");
      return;
    }

    if (!/^https?:\/\/(www\.)?instagram\.com\//i.test(url)) {
      setFormMessage("인스타그램 링크만 넣을 수 있어요.");
      return;
    }

    syncEditorContent(editorHtmlRef.current, [
      ...attachments,
      {
        id: createAttachmentId(),
        type: "instagram",
        url
      }
    ]);
    setInlineInstagramUrl("");
    setFormMessage("");
  };

  const removeAttachment = (id: string) => {
    syncEditorContent(editorHtmlRef.current, attachments.filter((attachment) => attachment.id !== id));
  };

  const updateImageAttachmentSize = (id: string, size: ImageBlockSize) => {
    syncEditorContent(
      editorHtmlRef.current,
      attachments.map((attachment) =>
        attachment.id === id && attachment.type === "image"
          ? { ...attachment, size }
          : attachment
      )
    );
  };

  const handleImageDrop = async (event: ReactDragEvent<HTMLElement>, size: ImageBlockSize) => {
    event.preventDefault();
    const file = Array.from(event.dataTransfer.files).find((item) => item.type.startsWith("image/"));
    await appendInlineImage(file, size);
  };

  const handleCoverDrop = async (event: ReactDragEvent<HTMLElement>) => {
    event.preventDefault();
    const file = Array.from(event.dataTransfer.files).find((item) => item.type.startsWith("image/"));
    await uploadCoverImage(file);
  };

  return (
    <section className="space-y-4">
      <form
        id={formId}
        className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
        onSubmit={async (event) => {
          event.preventDefault();
          setFormMessage("");

          const currentBodyHtml = editorRef.current?.innerHTML ?? editorHtmlRef.current;
          const content = buildContentFromDraft(currentBodyHtml, attachments).trim();

          if (!form.title.trim()) {
            setFormMessage("제목을 입력해 주세요.");
            return;
          }

          if (!content) {
            setFormMessage("본문 또는 이미지/인스타 임베드를 한 개 이상 추가해 주세요.");
            return;
          }

          await onSave({
            ...form,
            title: form.title.trim(),
            tag: form.tag.trim(),
            content,
            instagram_urls: form.instagram_urls.map((url) => url.trim()).filter(Boolean).slice(0, 4),
            published_at: new Date(`${form.published_at}T00:00:00`).toISOString()
          });
        }}
      >
        <div className="sticky top-0 z-20 border-b border-slate-200 bg-white">
          <div className="flex flex-col gap-3 px-4 py-4 md:flex-row md:items-center md:justify-between md:px-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                Magazine Editor
              </p>
              <h2 className="mt-1 text-xl font-bold tracking-[-0.03em] text-ink">
                {initialMagazine ? "매거진 글 수정" : "매거진 글 작성"}
              </h2>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-md bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-500">
                {contentStats.blockCount}개 블록
              </span>
              <span className="rounded-md bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-500">
                약 {contentStats.readingMinutes}분
              </span>
              <button
                type="button"
                onClick={requestClose}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 transition hover:border-ink hover:text-ink"
              >
                목록
              </button>
              <button
                type="submit"
                disabled={isBusy}
                className="rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-wait disabled:opacity-70"
              >
                {isBusy ? "저장 중..." : form.is_public ? "발행 저장" : "임시저장"}
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-3 border-t border-slate-100 px-4 py-3 md:flex-row md:items-center md:px-6">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-md bg-slate-900 px-3 py-2 text-xs font-semibold text-white">
                글 작성
              </span>
              {(["wide", "full"] as const).map((size) => (
                <label
                  key={size}
                  className="cursor-pointer rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-ink hover:text-ink"
                >
                  {size === "full" ? "큰 이미지" : "이미지"}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(event) => void appendInlineImage(event.target.files?.[0], size)}
                  />
                </label>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold text-slate-600">
                <span>크기</span>
                <input
                  type="number"
                  min={10}
                  max={72}
                  value={fontSizePx}
                  onMouseDown={saveSelection}
                  onFocus={saveSelection}
                  onChange={(event) => applyFontSize(Number(event.target.value))}
                  className="w-12 border-0 bg-transparent text-right text-xs font-semibold outline-none"
                  title="글자 크기(px)"
                />
                <span>px</span>
              </label>
              <div className="flex flex-wrap items-center gap-1">
                {FONT_SIZE_PRESETS.map((size) => (
                  <button
                    key={size}
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => applyFontSize(size)}
                    className={`rounded-lg border px-2.5 py-2 text-xs font-semibold transition ${
                      fontSizePx === size
                        ? "border-ink bg-ink text-white"
                        : "border-slate-200 bg-white text-slate-600"
                    }`}
                    title={`${size}px`}
                  >
                    {size}
                  </button>
                ))}
              </div>
              <select
                value={textFont}
                onMouseDown={saveSelection}
                onFocus={saveSelection}
                onChange={(event) => applyTextFont(event.target.value as TextBlockFont)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 outline-none"
                title="글씨체"
              >
                {TEXT_FONT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  setTextBold((current) => !current);
                  applyBoldStyle();
                }}
                className={`rounded-lg border px-3 py-2 text-xs font-bold transition ${
                  textBold ? "border-ink bg-ink text-white" : "border-slate-200 bg-white text-slate-600"
                }`}
                title="굵게"
              >
                굵게
              </button>
              {(["left", "center", "right"] as const).map((align) => (
                <button
                  key={align}
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => applyTextAlign(align)}
                  className={`rounded-lg border px-3 py-2 text-xs font-semibold transition ${
                    textAlign === align
                      ? "border-ink bg-ink text-white"
                      : "border-slate-200 bg-white text-slate-600"
                  }`}
                  title={align === "left" ? "왼쪽 정렬" : align === "center" ? "가운데 정렬" : "오른쪽 정렬"}
                >
                  {align === "left" ? "왼쪽 정렬" : align === "center" ? "가운데 정렬" : "오른쪽 정렬"}
                </button>
              ))}
            </div>

            <div className="flex min-w-0 flex-1 flex-col gap-2 md:flex-row">
              <input
                value={inlineInstagramUrl}
                onChange={(event) => setInlineInstagramUrl(event.target.value)}
                placeholder="인스타 게시물 링크"
                className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-ink"
              />
              <button
                type="button"
                onClick={appendInlineInstagram}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-ink hover:text-ink"
              >
                임베드 추가
              </button>
            </div>
          </div>
        </div>

        {formMessage ? (
          <div className="border-b border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700 md:px-6">
            {formMessage}
          </div>
        ) : null}

        <div className="grid bg-slate-100 xl:grid-cols-[minmax(0,1fr)_360px]">
          <main className="min-w-0 px-4 py-6 md:px-8">
            <div className="mx-auto max-w-[920px] border border-slate-200 bg-white px-5 py-8 shadow-sm md:px-12 md:py-12">
              <input
                required
                value={form.title}
                onChange={(event) =>
                  setForm((current) => ({ ...current, title: event.target.value }))
                }
                placeholder="제목"
                className="w-full border-0 border-b border-slate-200 bg-transparent pb-5 text-4xl font-semibold tracking-[-0.04em] text-ink outline-none placeholder:text-slate-300"
              />

              <div className="relative mt-8">
                <div
                  ref={editorRef}
                  contentEditable
                  suppressContentEditableWarning
                  data-placeholder="본문을 입력하세요. 글자를 선택하고 상단 도구로 바로 서식을 적용할 수 있습니다."
                  onInput={() => syncFromEditor(false)}
                  onCompositionStart={saveSelection}
                  onCompositionEnd={() => syncFromEditor()}
                  onKeyUp={saveSelection}
                  onMouseUp={saveSelection}
                  onSelect={saveSelection}
                  onBlur={() => syncFromEditor()}
                  className="magazine-rich-editor min-h-[360px] w-full text-[17px] leading-9 text-slate-700 outline-none"
                />
              </div>

              <section
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => void handleImageDrop(event, "wide")}
                className="mt-6 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center transition hover:border-ink hover:bg-white"
              >
                <p className="text-sm font-semibold text-slate-700">이미지 끌어다 놓기</p>
                <p className="mt-1 text-xs text-slate-400">
                  이미지를 이 영역에 드롭하면 본문 첨부로 추가됩니다. 추가 후 아래에서 크기를 바꿀 수 있습니다.
                </p>
              </section>

              {attachments.length > 0 ? (
                <section className="mt-8 border-t border-slate-100 pt-6">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                    Attachments
                  </p>
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    {attachments.map((attachment) => (
                      <div key={attachment.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-slate-500">
                            {attachment.type === "image" ? "이미지" : "인스타 임베드"}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeAttachment(attachment.id)}
                            className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-500 transition hover:border-red-200 hover:text-red-500"
                          >
                            삭제
                          </button>
                        </div>
                        {attachment.type === "image" ? (
                          <>
                            <div className="mb-2 flex items-center gap-2">
                              <span className="text-xs font-semibold text-slate-500">크기</span>
                              <select
                                value={attachment.size}
                                onChange={(event) =>
                                  updateImageAttachmentSize(attachment.id, event.target.value as ImageBlockSize)
                                }
                                className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600 outline-none"
                              >
                                <option value="medium">중간</option>
                                <option value="wide">넓게</option>
                                <option value="full">전체</option>
                              </select>
                            </div>
                            <div className="overflow-hidden rounded-md bg-white">
                              <Image
                                src={attachment.url}
                                alt="첨부 이미지"
                                width={640}
                                height={420}
                                className="h-44 w-full object-contain"
                              />
                            </div>
                          </>
                        ) : (
                          <InstagramEmbed
                            url={attachment.url}
                            compact
                            className="max-h-[260px] min-h-[180px] rounded-md bg-white"
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}
            </div>

            <section className="mx-auto mt-5 max-w-[920px] rounded-xl border border-slate-200 bg-white p-5">
              <div className="mb-4 flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-700">미리보기</p>
                <span className="text-xs text-slate-400">
                  {formatDateLabel(form.published_at)}
                </span>
              </div>
              {contentPreviewBlocks.length > 0 ? (
                <div className="space-y-5">{contentPreviewBlocks.map(renderPreviewBlock)}</div>
              ) : (
                <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm text-slate-400">
                  본문을 입력하거나 이미지/임베드를 추가하면 여기에 미리보기가 표시됩니다.
                </div>
              )}
            </section>
          </main>

          <aside className="border-t border-slate-200 bg-white p-4 xl:border-l xl:border-t-0">
            <div className="space-y-4 xl:sticky xl:top-24">
              <section className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-sm font-semibold text-slate-700">발행 설정</p>
                <div className="mt-4 space-y-3">
                  <label className="space-y-2">
                    <span className="text-xs font-semibold text-slate-500">태그/카테고리</span>
                    <input
                      value={form.tag}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, tag: event.target.value }))
                      }
                      placeholder="예: 작가 추천, 인터뷰"
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-ink"
                    />
                  </label>

                  <label className="space-y-2">
                    <span className="text-xs font-semibold text-slate-500">게시일</span>
                    <input
                      type="date"
                      value={form.published_at}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, published_at: event.target.value }))
                      }
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-ink"
                    />
                  </label>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setForm((current) => ({ ...current, is_public: true }))}
                      className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                        form.is_public
                          ? "bg-ink text-white"
                          : "border border-slate-200 bg-white text-slate-600"
                      }`}
                    >
                      공개
                    </button>
                    <button
                      type="button"
                      onClick={() => setForm((current) => ({ ...current, is_public: false }))}
                      className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                        !form.is_public
                          ? "bg-ink text-white"
                          : "border border-slate-200 bg-white text-slate-600"
                      }`}
                    >
                      임시저장
                    </button>
                  </div>
                </div>
              </section>

              <section className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-700">커버 이미지</p>
                  {uploading.thumbnail ? <span className="text-xs text-slate-400">업로드 중...</span> : null}
                </div>
                <div
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => void handleCoverDrop(event)}
                  className="relative aspect-square overflow-hidden rounded-lg border border-dashed border-slate-200 bg-slate-50"
                >
                  {form.thumbnail_url ? (
                    <Image
                      src={form.thumbnail_url}
                      alt="매거진 커버"
                      fill
                      className="object-cover"
                      sizes="360px"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center px-4 text-center text-sm leading-6 text-slate-400">
                      커버 이미지를 드래그하거나 업로드하세요.
                    </div>
                  )}
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <label className="flex cursor-pointer items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700">
                    업로드
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(event) => void uploadCoverImage(event.target.files?.[0])}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => setForm((current) => ({ ...current, thumbnail_url: "" }))}
                    disabled={!form.thumbnail_url || isBusy}
                    className="rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-500 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    제거
                  </button>
                </div>
              </section>

              <section className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="mb-3">
                  <p className="text-sm font-semibold text-slate-700">관련 작가</p>
                  <p className="mt-1 text-xs text-slate-400">필요한 경우 글 하단에 연결합니다.</p>
                </div>
                <input
                  value={artistSearch}
                  onChange={(event) => setArtistSearch(event.target.value)}
                  placeholder="작가명, 계정, 카테고리 검색"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-ink"
                />
                {selectedArtists.length > 0 ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {selectedArtists.map((artist) => (
                      <button
                        key={artist.id}
                        type="button"
                        onClick={() =>
                          setForm((current) => ({
                            ...current,
                            related_artist_ids: current.related_artist_ids.filter((id) => id !== artist.id)
                          }))
                        }
                        className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600"
                      >
                        {artist.name} ×
                      </button>
                    ))}
                  </div>
                ) : null}
                <div className="mt-3 max-h-56 space-y-2 overflow-y-auto pr-1">
                  {filteredArtists.length > 0 ? (
                    filteredArtists.map((artist) => (
                      <label
                        key={artist.id}
                        className="flex items-center gap-3 rounded-lg border border-slate-100 px-3 py-3"
                      >
                        <input
                          type="checkbox"
                          checked={selectedArtistSet.has(artist.id)}
                          onChange={(event) =>
                            setForm((current) => ({
                              ...current,
                              related_artist_ids: event.target.checked
                                ? [...current.related_artist_ids, artist.id]
                                : current.related_artist_ids.filter((item) => item !== artist.id)
                            }))
                          }
                        />
                        <span className="min-w-0 text-sm text-slate-700">
                          <span className="block truncate font-semibold text-ink">{artist.name}</span>
                          <span className="block truncate text-xs text-slate-400">
                            {artist.genre} · @{artist.instagram_handle}
                          </span>
                        </span>
                      </label>
                    ))
                  ) : (
                    <div className="rounded-lg bg-slate-50 px-4 py-6 text-center text-sm text-slate-400">
                      검색되는 작가가 없습니다.
                    </div>
                  )}
                </div>
              </section>

              <section className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="mb-3">
                  <p className="text-sm font-semibold text-slate-700">하단 인스타 링크</p>
                  <p className="mt-1 text-xs text-slate-400">별도 모음이 필요할 때만 입력합니다.</p>
                </div>
                <div className="space-y-2">
                  {[0, 1, 2, 3].map((index) => (
                    <input
                      key={index}
                      value={form.instagram_urls[index] ?? ""}
                      onChange={(event) =>
                        setForm((current) => {
                          const nextInstagramUrls = [...current.instagram_urls];
                          nextInstagramUrls[index] = event.target.value;
                          return { ...current, instagram_urls: nextInstagramUrls };
                        })
                      }
                      placeholder={`인스타 링크 ${index + 1}`}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-ink"
                    />
                  ))}
                </div>
              </section>
            </div>
          </aside>
        </div>
      </form>
    </section>
  );
}
