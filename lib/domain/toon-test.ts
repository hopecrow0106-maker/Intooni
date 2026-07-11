import { normalizeText } from "@/lib/normalize";

export type ToonRouteNode = {
  id: string;
  type: "question" | "result";
  title: string;
  description: string;
  x: number;
  y: number;
  selectionMode?: "single" | "multi";
  maxSelections?: number;
  imageUrl?: string;
  traits?: string;
  artistIds?: string[];
};

export type ToonRouteOption = {
  id: string;
  questionId: string;
  label: string;
  actionNote: string;
  includeTags: string;
  excludeTags: string;
  includeTone?: string;
  excludeTone?: string;
  includePace?: string;
  excludePace?: string;
  includeStyle?: string;
  excludeStyle?: string;
  includeTopic?: string;
  excludeTopic?: string;
  nextNodeId: string;
};

export type ToonRouteDraft = {
  startNodeId: string;
  nodes: ToonRouteNode[];
  options: ToonRouteOption[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function textValue(value: unknown, maxLength = 500) {
  return normalizeText(typeof value === "string" ? value : "").slice(0, maxLength);
}

function numberValue(value: unknown, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function normalizeToonRouteDraft(value: unknown): ToonRouteDraft {
  if (!isRecord(value) || !Array.isArray(value.nodes) || !Array.isArray(value.options)) {
    throw new Error("Route draft must contain nodes and options arrays.");
  }
  if (value.nodes.length === 0 || value.nodes.length > 200 || value.options.length > 500) {
    throw new Error("Route draft node or option count is invalid.");
  }

  const nodes = value.nodes.map((rawNode): ToonRouteNode => {
    if (!isRecord(rawNode)) throw new Error("Route node is invalid.");
    const id = textValue(rawNode.id, 120);
    const type = rawNode.type === "result" ? "result" : rawNode.type === "question" ? "question" : null;
    const title = textValue(rawNode.title, 200);
    if (!id || !type || !title) throw new Error("Every route node needs id, type, and title.");
    const artistIds = Array.isArray(rawNode.artistIds)
      ? Array.from(new Set(rawNode.artistIds.map((item) => textValue(item, 80)).filter(Boolean)))
      : [];
    return {
      id,
      type,
      title,
      description: textValue(rawNode.description, 2000),
      x: numberValue(rawNode.x),
      y: numberValue(rawNode.y),
      selectionMode: rawNode.selectionMode === "multi" ? "multi" : "single",
      maxSelections: Math.max(1, Math.min(20, Math.trunc(numberValue(rawNode.maxSelections, 1)))),
      imageUrl: textValue(rawNode.imageUrl, 2000),
      traits: textValue(rawNode.traits, 1000),
      artistIds
    };
  });
  const nodeIds = new Set(nodes.map((node) => node.id));
  if (nodeIds.size !== nodes.length) throw new Error("Route node ids must be unique.");

  const options = value.options.map((rawOption): ToonRouteOption => {
    if (!isRecord(rawOption)) throw new Error("Route option is invalid.");
    const id = textValue(rawOption.id, 120);
    const questionId = textValue(rawOption.questionId, 120);
    const nextNodeId = textValue(rawOption.nextNodeId, 120);
    const label = textValue(rawOption.label, 300);
    if (!id || !questionId || !nextNodeId || !label) {
      throw new Error("Every route option needs id, source, target, and label.");
    }
    if (!nodeIds.has(questionId) || !nodeIds.has(nextNodeId)) {
      throw new Error("Route option references an unknown node.");
    }
    if (nodes.find((node) => node.id === questionId)?.type !== "question") {
      throw new Error("Route options must start from question nodes.");
    }
    return {
      id,
      questionId,
      label,
      actionNote: textValue(rawOption.actionNote, 1000),
      includeTags: textValue(rawOption.includeTags, 1000),
      excludeTags: textValue(rawOption.excludeTags, 1000),
      includeTone: textValue(rawOption.includeTone, 1000),
      excludeTone: textValue(rawOption.excludeTone, 1000),
      includePace: textValue(rawOption.includePace, 1000),
      excludePace: textValue(rawOption.excludePace, 1000),
      includeStyle: textValue(rawOption.includeStyle, 1000),
      excludeStyle: textValue(rawOption.excludeStyle, 1000),
      includeTopic: textValue(rawOption.includeTopic, 1000),
      excludeTopic: textValue(rawOption.excludeTopic, 1000),
      nextNodeId
    };
  });
  if (new Set(options.map((option) => option.id)).size !== options.length) {
    throw new Error("Route option ids must be unique.");
  }

  const startNodeId = textValue(value.startNodeId, 120);
  if (!nodeIds.has(startNodeId) || nodes.find((node) => node.id === startNodeId)?.type !== "question") {
    throw new Error("Route start node must be an existing question.");
  }
  return { startNodeId, nodes, options };
}

export function validatePublishableToonRouteDraft(draft: ToonRouteDraft) {
  const nodesById = new Map(draft.nodes.map((node) => [node.id, node]));
  const optionsByQuestion = new Map<string, ToonRouteOption[]>();
  for (const option of draft.options) {
    const current = optionsByQuestion.get(option.questionId) ?? [];
    current.push(option);
    optionsByQuestion.set(option.questionId, current);
  }

  const visited = new Set<string>();
  const active = new Set<string>();
  let reachableResultCount = 0;

  const visit = (nodeId: string) => {
    if (active.has(nodeId)) throw new Error("Published routes cannot contain cycles.");
    if (visited.has(nodeId)) return;

    const node = nodesById.get(nodeId);
    if (!node) throw new Error("Published route references an unknown node.");
    active.add(nodeId);

    if (node.type === "result") {
      if ((node.artistIds ?? []).length === 0) {
        throw new Error("Every published result needs at least one artist.");
      }
      reachableResultCount += 1;
    } else {
      const options = optionsByQuestion.get(nodeId) ?? [];
      if (options.length === 0) {
        throw new Error("Every published question needs at least one option.");
      }
      for (const option of options) visit(option.nextNodeId);
    }

    active.delete(nodeId);
    visited.add(nodeId);
  };

  visit(draft.startNodeId);
  if (reachableResultCount === 0) throw new Error("Published routes need a reachable result.");
  if (visited.size !== draft.nodes.length) {
    throw new Error("Published routes cannot contain unreachable nodes.");
  }
}
