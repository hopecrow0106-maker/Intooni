import { describe, expect, it } from "vitest";

import {
  normalizeToonRouteDraft,
  validatePublishableToonRouteDraft
} from "@/lib/domain/toon-test";

const draft = {
  startNodeId: "q-start",
  nodes: [
    {
      id: " q-start ",
      type: "question",
      title: " 첫 질문 ",
      description: "설명",
      x: 10,
      y: 20,
      selectionMode: "single",
      maxSelections: 1
    },
    {
      id: "r-result",
      type: "result",
      title: " 공포 매니아 ",
      description: "결과",
      x: 100,
      y: 20,
      artistIds: ["artist-1", "artist-1"]
    }
  ],
  options: [
    {
      id: "o-1",
      questionId: "q-start",
      label: "괴담",
      actionNote: "",
      includeTags: "",
      excludeTags: "",
      nextNodeId: "r-result"
    }
  ]
};

describe("new ToonBTI route draft", () => {
  it("normalizes nodes/options and deduplicates result artists", () => {
    const normalized = normalizeToonRouteDraft(draft);
    expect(normalized.nodes[0].id).toBe("q-start");
    expect(normalized.nodes[1].title).toBe("공포 매니아");
    expect(normalized.nodes[1].artistIds).toEqual(["artist-1"]);
    expect(normalized.options[0].nextNodeId).toBe("r-result");
  });

  it("rejects edges that reference missing nodes", () => {
    expect(() =>
      normalizeToonRouteDraft({
        ...draft,
        options: [{ ...draft.options[0], nextNodeId: "missing" }]
      })
    ).toThrow("unknown node");
  });

  it("requires the start node to be an existing question", () => {
    expect(() => normalizeToonRouteDraft({ ...draft, startNodeId: "r-result" })).toThrow(
      "existing question"
    );
  });

  it("accepts a complete acyclic published route", () => {
    expect(() => validatePublishableToonRouteDraft(normalizeToonRouteDraft(draft))).not.toThrow();
  });

  it("rejects published routes with cycles or unreachable nodes", () => {
    const cyclic = {
      ...draft,
      options: [
        { ...draft.options[0], nextNodeId: "q-second" },
        {
          ...draft.options[0],
          id: "o-2",
          questionId: "q-second",
          nextNodeId: "q-start"
        }
      ],
      nodes: [
        ...draft.nodes,
        { ...draft.nodes[0], id: "q-second", title: "두 번째 질문" }
      ]
    };
    expect(() => validatePublishableToonRouteDraft(normalizeToonRouteDraft(cyclic))).toThrow(
      "cycles"
    );

    const unreachable = {
      ...draft,
      nodes: [...draft.nodes, { ...draft.nodes[1], id: "r-unused" }]
    };
    expect(() => validatePublishableToonRouteDraft(normalizeToonRouteDraft(unreachable))).toThrow(
      "unreachable"
    );
  });

  it("requires options and artist-backed result cards before publish", () => {
    const withoutOptions = normalizeToonRouteDraft({ ...draft, options: [] });
    expect(() => validatePublishableToonRouteDraft(withoutOptions)).toThrow("at least one option");

    const withoutArtists = normalizeToonRouteDraft({
      ...draft,
      nodes: draft.nodes.map((node) =>
        node.type === "result" ? { ...node, artistIds: [] } : node
      )
    });
    expect(() => validatePublishableToonRouteDraft(withoutArtists)).toThrow("at least one artist");
  });
});
