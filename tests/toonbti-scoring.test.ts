import { describe, expect, it } from "vitest";

import {
  CANONICAL_TOONBTI_AXES,
  calculateToonbtiResult,
  getPossibleToonbtiCodes,
  normalizeToonbtiConfig,
  validatePublishableToonbtiConfig,
  type ToonbtiConfig
} from "@/lib/domain/toonbti";

function makeConfig(): ToonbtiConfig {
  const testId = "test-1";
  const axes = CANONICAL_TOONBTI_AXES.map((definition, axisIndex) => ({
    id: `axis-${axisIndex + 1}`,
    testId,
    name: definition.name,
    position: axisIndex,
    tieBreakTraitId: `trait-${axisIndex + 1}-1`,
    isActive: true
  }));
  const traits = CANONICAL_TOONBTI_AXES.flatMap((definition, axisIndex) =>
    definition.traits.map((trait, traitIndex) => ({
      id: `trait-${axisIndex + 1}-${traitIndex + 1}`,
      testId,
      axisId: `axis-${axisIndex + 1}`,
      code: trait.code,
      name: trait.name,
      description: trait.description,
      position: traitIndex,
      isActive: true
    }))
  );
  const questions = axes.flatMap((axis, axisIndex) =>
    Array.from({ length: 4 }, (_, questionIndex) => ({
      id: `question-${axisIndex + 1}-${questionIndex + 1}`,
      testId,
      axisId: axis.id,
      questionText: `${axis.name} 질문 ${questionIndex + 1}`,
      position: axisIndex * 4 + questionIndex,
      isActive: true
    }))
  );
  const options = questions.flatMap((question) => {
    const [left, right] = traits.filter((trait) => trait.axisId === question.axisId);
    return [
      { trait: left, score: 10 as const },
      { trait: left, score: 5 as const },
      { trait: right, score: 5 as const },
      { trait: right, score: 10 as const }
    ].map(({ trait, score }, optionIndex) => ({
      id: `option-${question.id}-${optionIndex + 1}`,
      questionId: question.id,
      axisId: question.axisId,
      traitId: trait.id,
      optionText: `${trait.code} ${score}점 답변`,
      score,
      position: optionIndex,
      isActive: true
    }));
  });

  const base = {
    test: {
      id: testId,
      slug: "default",
      title: "툰비티아이",
      version: 1,
      description: "테스트 소개",
      introImageUrl: "",
      startButtonLabel: "시작하기",
      shareText: "공유 문구",
      status: "published" as const,
      isActive: true
    },
    axes,
    traits,
    questions,
    options,
    resultTypes: []
  };
  const codes = getPossibleToonbtiCodes(base);
  return {
    ...base,
    resultTypes: codes.map((code, index) => ({
      id: `result-${code}`,
      testId,
      code,
      name: `${code} 결과`,
      shortDescription: `${code} 한 줄 설명`,
      longDescription: `${code} 상세 설명`,
      imageUrl: "",
      shareImageUrl: "",
      keywords: [code],
      shareText: "",
      position: index,
      isActive: true
    }))
  };
}

describe("Toon-BTI axis scoring", () => {
  it("generates all sixteen four-axis result codes", () => {
    expect(getPossibleToonbtiCodes(makeConfig())).toHaveLength(16);
    expect(getPossibleToonbtiCodes(makeConfig())).toContain("RLPM");
    expect(getPossibleToonbtiCodes(makeConfig())).toContain("FDSH");
  });

  it("validates a complete four-axis test", () => {
    expect(() => validatePublishableToonbtiConfig(makeConfig())).not.toThrow();
  });

  it("requires four options for every active question and every result combination", () => {
    const missingOption = makeConfig();
    missingOption.options.pop();
    expect(() => validatePublishableToonbtiConfig(missingOption)).toThrow("정확히 4개");

    const missingResult = makeConfig();
    missingResult.resultTypes.pop();
    expect(() => validatePublishableToonbtiConfig(missingResult)).toThrow(
      "활성 결과 유형이 없는 코드"
    );
  });

  it("requires exactly four active questions on every axis", () => {
    const missingQuestion = makeConfig();
    const removed = missingQuestion.questions.find(
      (question) => question.axisId === missingQuestion.axes[0].id
    )!;
    missingQuestion.questions = missingQuestion.questions.filter(
      (question) => question.id !== removed.id
    );
    missingQuestion.options = missingQuestion.options.filter(
      (option) => option.questionId !== removed.id
    );

    expect(() => validatePublishableToonbtiConfig(missingQuestion)).toThrow(
      "활성 질문이 정확히 4개"
    );
  });

  it("calculates a result code from selected option scores", () => {
    const config = makeConfig();
    const answers = config.questions.map((question) => ({
      questionId: question.id,
      optionId: config.options.find(
        (option) =>
          option.questionId === question.id &&
          option.score === 10 &&
          option.traitId.endsWith("-2")
      )!.id
    }));
    const result = calculateToonbtiResult(config, answers);
    expect(result.code).toBe("FDSH");
    expect(result.resultType?.name).toBe("FDSH 결과");
  });

  it("calculates every possible four-axis combination", () => {
    const config = makeConfig();
    for (const code of getPossibleToonbtiCodes(config)) {
      const answers = config.questions.map((question) => {
        const axisIndex = config.axes.findIndex((axis) => axis.id === question.axisId);
        const target = config.traits.find(
          (trait) => trait.axisId === question.axisId && trait.code === code[axisIndex]
        );
        return {
          questionId: question.id,
          optionId: config.options.find(
            (option) =>
              option.questionId === question.id &&
              option.traitId === target?.id &&
              option.score === 10
          )!.id
        };
      });
      expect(calculateToonbtiResult(config, answers).code).toBe(code);
    }
  });

  it("uses the number of strong responses before the configured tie default", () => {
    const config = makeConfig();
    const axis = config.axes[0];
    const original = config.questions[0];
    const question = {
      ...original,
      id: "strong-tie-question-extra",
      position: 20
    };
    config.questions.push(question);
    config.options.push(
      ...config.options
        .filter((option) => option.questionId === original.id)
        .map((option) => ({
          ...option,
          id: `${option.id}-strong-extra`,
          questionId: question.id
        }))
    );
    const [left, right] = config.traits.filter((trait) => trait.axisId === axis.id);
    const firstAxisQuestions = config.questions.filter((question) => question.axisId === axis.id);
    const targets = [
      { traitId: left.id, score: 10 },
      { traitId: left.id, score: 5 },
      { traitId: right.id, score: 5 },
      { traitId: right.id, score: 5 },
      { traitId: right.id, score: 5 }
    ];
    const answers = config.questions.map((question) => {
      const axisQuestionIndex = firstAxisQuestions.findIndex((item) => item.id === question.id);
      const target =
        axisQuestionIndex >= 0
          ? targets[axisQuestionIndex]
          : {
              traitId: config.traits.find((trait) => trait.axisId === question.axisId)!.id,
              score: 5
            };
      return {
        questionId: question.id,
        optionId: config.options.find(
          (option) =>
            option.questionId === question.id &&
            option.traitId === target.traitId &&
            option.score === target.score
        )!.id
      };
    });

    expect(calculateToonbtiResult(config, answers).axes[0].traitId).toBe(left.id);
  });

  it("breaks score ties by strong answers, then the configured default trait", () => {
    const config = makeConfig();
    const firstAxis = config.axes[0];
    const firstAxisQuestions = config.questions.filter(
      (question) => question.axisId === firstAxis.id
    );

    const answers = config.questions.map((question) => {
      const axisTraits = config.traits.filter((trait) => trait.axisId === question.axisId);
      const firstAxisIndex = firstAxisQuestions.findIndex(
        (item) => item.id === question.id
      );
      const tieTargets = [
        { traitId: axisTraits[0].id, score: 10 },
        { traitId: axisTraits[0].id, score: 5 },
        { traitId: axisTraits[1].id, score: 10 },
        { traitId: axisTraits[1].id, score: 5 }
      ];
      const target =
        firstAxisIndex >= 0
          ? tieTargets[firstAxisIndex]
          : { traitId: axisTraits[0].id, score: 5 };
      return {
        questionId: question.id,
        optionId: config.options.find(
          (option) =>
            option.questionId === question.id &&
            option.traitId === target.traitId &&
            option.score === target.score
        )!.id
      };
    });

    const result = calculateToonbtiResult(config, answers);
    expect(result.axes[0].traitId).toBe(firstAxis.tieBreakTraitId);
  });

  it("normalizes text and rejects options that reference another axis", () => {
    const config = makeConfig();
    const normalized = normalizeToonbtiConfig({
      ...config,
      test: { ...config.test, title: "  툰비티아이  " }
    });
    expect(normalized.test.title).toBe("툰비티아이");

    normalized.options[0].traitId = normalized.traits.find(
      (trait) => trait.axisId !== normalized.options[0].axisId
    )!.id;
    expect(() => validatePublishableToonbtiConfig(normalized)).toThrow("같은 축");
  });
});
