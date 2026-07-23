import { normalizeText } from "@/lib/normalize";

export type ToonbtiTestStatus = "draft" | "published";

export type ToonbtiTestSettings = {
  id: string;
  slug: string;
  title: string;
  version: number;
  description: string;
  introImageUrl: string;
  startButtonLabel: string;
  shareText: string;
  status: ToonbtiTestStatus;
  isActive: boolean;
};

export type ToonbtiAxis = {
  id: string;
  testId: string;
  name: string;
  position: number;
  tieBreakTraitId: string;
  isActive: boolean;
};

export type ToonbtiTrait = {
  id: string;
  testId: string;
  axisId: string;
  code: string;
  name: string;
  description: string;
  position: number;
  isActive: boolean;
};

export type ToonbtiQuestion = {
  id: string;
  testId: string;
  axisId: string;
  questionText: string;
  position: number;
  isActive: boolean;
};

export type ToonbtiQuestionOption = {
  id: string;
  questionId: string;
  axisId: string;
  traitId: string;
  optionText: string;
  score: 5 | 10;
  position: number;
  isActive: boolean;
};

export type ToonbtiResultType = {
  id: string;
  testId: string;
  code: string;
  name: string;
  shortDescription: string;
  longDescription: string;
  imageUrl: string;
  shareImageUrl: string;
  keywords: string[];
  shareText: string;
  position: number;
  isActive: boolean;
};

export type ToonbtiConfig = {
  test: ToonbtiTestSettings;
  axes: ToonbtiAxis[];
  traits: ToonbtiTrait[];
  questions: ToonbtiQuestion[];
  options: ToonbtiQuestionOption[];
  resultTypes: ToonbtiResultType[];
};

export const CANONICAL_TOONBTI_AXES = [
  {
    name: "1축",
    summary: "이야기의 배경과 소재가 현실 경험 중심인지, 상상 세계 중심인지 구분합니다.",
    traits: [
      {
        code: "R",
        name: "현실형",
        description:
          "실제 일상, 연애, 직장, 가족, 경험담처럼 현실에서 겪을 법한 이야기가 중심"
      },
      {
        code: "F",
        name: "판타지형",
        description:
          "창작 캐릭터, 의인화, 독특한 설정과 세계관처럼 현실 밖의 상상력이 중심"
      }
    ]
  },
  {
    name: "2축",
    summary: "작품에서 가장 크게 느끼는 감정이 가벼운 재미인지, 깊은 몰입인지 구분합니다.",
    traits: [
      {
        code: "L",
        name: "유쾌형",
        description:
          "웃음, 개그, 병맛, 반전처럼 재미있고 가볍게 즐기는 감정이 중심"
      },
      {
        code: "D",
        name: "몰입형",
        description:
          "공감, 감동, 위로, 긴장, 감정선처럼 작품에 깊게 빠져드는 경험이 중심"
      }
    ]
  },
  {
    name: "3축",
    summary: "내용을 하나의 핵심 포인트로 전달하는지, 이야기의 흐름으로 전개하는지 구분합니다.",
    traits: [
      {
        code: "P",
        name: "포인트형",
        description:
          "공감·개그·정보 등 한 가지 핵심 포인트를 빠르고 명확하게 전달"
      },
      {
        code: "S",
        name: "스토리형",
        description: "사건의 시작·전개·결말과 이야기의 흐름이 중심"
      }
    ]
  },
  {
    name: "4축",
    summary: "사건과 표현의 강도가 편안하고 순한지, 강하고 자극적인지 구분합니다.",
    traits: [
      {
        code: "M",
        name: "순한맛형",
        description:
          "편안하고 귀엽거나 잔잔하며, 갈등과 표현의 강도가 비교적 낮음"
      },
      {
        code: "H",
        name: "매운맛형",
        description:
          "강한 사건, 갈등, 자극적인 소재, 거친 표현이나 반전의 강도가 높음"
      }
    ]
  }
] as const;

export type ToonbtiAnswer = {
  questionId: string;
  optionId: string;
};

export type ToonbtiAxisResult = {
  axisId: string;
  traitId: string;
  code: string;
  score: number;
  opposingScore: number;
};

export type ToonbtiCalculationResult = {
  code: string;
  axes: ToonbtiAxisResult[];
  resultType: ToonbtiResultType | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function textValue(value: unknown, maxLength = 500) {
  return normalizeText(typeof value === "string" ? value : "").slice(0, maxLength);
}

function booleanValue(value: unknown, fallback = true) {
  return typeof value === "boolean" ? value : fallback;
}

function integerValue(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : fallback;
}

function requiredId(value: unknown, label: string) {
  const id = textValue(value, 100);
  if (!id) throw new Error(`${label} ID가 필요합니다.`);
  return id;
}

function normalizeKeywords(value: unknown) {
  const raw = Array.isArray(value) ? value : typeof value === "string" ? value.split(",") : [];
  return Array.from(
    new Set(raw.map((item) => textValue(item, 80)).filter(Boolean))
  ).slice(0, 30);
}

export function normalizeToonbtiConfig(value: unknown): ToonbtiConfig {
  if (!isRecord(value) || !isRecord(value.test)) {
    throw new Error("Toon-BTI 기본 설정이 필요합니다.");
  }

  const testId = requiredId(value.test.id, "테스트");
  const arrays = {
    axes: Array.isArray(value.axes) ? value.axes : [],
    traits: Array.isArray(value.traits) ? value.traits : [],
    questions: Array.isArray(value.questions) ? value.questions : [],
    options: Array.isArray(value.options) ? value.options : [],
    resultTypes: Array.isArray(value.resultTypes) ? value.resultTypes : []
  };

  if (
    arrays.axes.length > 20 ||
    arrays.traits.length > 40 ||
    arrays.questions.length > 200 ||
    arrays.options.length > 800 ||
    arrays.resultTypes.length > 200
  ) {
    throw new Error("Toon-BTI 설정 항목 수가 허용 범위를 넘었습니다.");
  }

  const test: ToonbtiTestSettings = {
    id: testId,
    slug: textValue(value.test.slug, 80) || "default",
    title: textValue(value.test.title, 160) || "툰비티아이",
    version: Math.max(1, integerValue(value.test.version, 1)),
    description: textValue(value.test.description, 2000),
    introImageUrl: textValue(value.test.introImageUrl, 2000),
    startButtonLabel: textValue(value.test.startButtonLabel, 80) || "테스트 시작하기",
    shareText: textValue(value.test.shareText, 500),
    status: value.test.status === "published" ? "published" : "draft",
    isActive: booleanValue(value.test.isActive, false)
  };

  const axes = arrays.axes.map((raw): ToonbtiAxis => {
    if (!isRecord(raw)) throw new Error("성향축 데이터가 올바르지 않습니다.");
    return {
      id: requiredId(raw.id, "성향축"),
      testId,
      name: textValue(raw.name, 100),
      position: integerValue(raw.position),
      tieBreakTraitId: textValue(raw.tieBreakTraitId, 100),
      isActive: booleanValue(raw.isActive)
    };
  });

  const axisIds = new Set(axes.map((axis) => axis.id));
  if (axisIds.size !== axes.length) throw new Error("성향축 ID가 중복되었습니다.");

  const traits = arrays.traits.map((raw): ToonbtiTrait => {
    if (!isRecord(raw)) throw new Error("성향 데이터가 올바르지 않습니다.");
    const axisId = requiredId(raw.axisId, "성향의 성향축");
    if (!axisIds.has(axisId)) throw new Error("성향이 존재하지 않는 성향축을 참조합니다.");
    return {
      id: requiredId(raw.id, "성향"),
      testId,
      axisId,
      code: textValue(raw.code, 4).toUpperCase(),
      name: textValue(raw.name, 100),
      description: textValue(raw.description, 1000),
      position: integerValue(raw.position),
      isActive: booleanValue(raw.isActive)
    };
  });

  const traitIds = new Set(traits.map((trait) => trait.id));
  if (traitIds.size !== traits.length) throw new Error("성향 ID가 중복되었습니다.");

  const questions = arrays.questions.map((raw): ToonbtiQuestion => {
    if (!isRecord(raw)) throw new Error("질문 데이터가 올바르지 않습니다.");
    const axisId = requiredId(raw.axisId, "질문의 성향축");
    if (!axisIds.has(axisId)) throw new Error("질문이 존재하지 않는 성향축을 참조합니다.");
    return {
      id: requiredId(raw.id, "질문"),
      testId,
      axisId,
      questionText: textValue(raw.questionText, 500),
      position: integerValue(raw.position),
      isActive: booleanValue(raw.isActive)
    };
  });

  const questionIds = new Set(questions.map((question) => question.id));
  if (questionIds.size !== questions.length) throw new Error("질문 ID가 중복되었습니다.");

  const options = arrays.options.map((raw): ToonbtiQuestionOption => {
    if (!isRecord(raw)) throw new Error("답변 데이터가 올바르지 않습니다.");
    const questionId = requiredId(raw.questionId, "답변의 질문");
    const axisId = requiredId(raw.axisId, "답변의 성향축");
    const traitId = requiredId(raw.traitId, "답변의 성향");
    if (!questionIds.has(questionId)) throw new Error("답변이 존재하지 않는 질문을 참조합니다.");
    if (!axisIds.has(axisId)) throw new Error("답변이 존재하지 않는 성향축을 참조합니다.");
    if (!traitIds.has(traitId)) throw new Error("답변이 존재하지 않는 성향을 참조합니다.");
    const score = integerValue(raw.score);
    if (score !== 5 && score !== 10) throw new Error("답변 점수는 5점 또는 10점이어야 합니다.");
    return {
      id: requiredId(raw.id, "답변"),
      questionId,
      axisId,
      traitId,
      optionText: textValue(raw.optionText, 500),
      score,
      position: integerValue(raw.position),
      isActive: booleanValue(raw.isActive)
    };
  });

  if (new Set(options.map((option) => option.id)).size !== options.length) {
    throw new Error("답변 ID가 중복되었습니다.");
  }

  const resultTypes = arrays.resultTypes.map((raw): ToonbtiResultType => {
    if (!isRecord(raw)) throw new Error("결과 유형 데이터가 올바르지 않습니다.");
    return {
      id: requiredId(raw.id, "결과 유형"),
      testId,
      code: textValue(raw.code, 20).toUpperCase(),
      name: textValue(raw.name, 160),
      shortDescription: textValue(raw.shortDescription, 500),
      longDescription: textValue(raw.longDescription, 4000),
      imageUrl: textValue(raw.imageUrl, 2000),
      shareImageUrl: textValue(raw.shareImageUrl, 2000),
      keywords: normalizeKeywords(raw.keywords),
      shareText: textValue(raw.shareText, 500),
      position: integerValue(raw.position),
      isActive: booleanValue(raw.isActive)
    };
  });

  if (new Set(resultTypes.map((result) => result.id)).size !== resultTypes.length) {
    throw new Error("결과 유형 ID가 중복되었습니다.");
  }

  return { test, axes, traits, questions, options, resultTypes };
}

export function getActiveToonbtiAxes(config: ToonbtiConfig) {
  return config.axes.filter((axis) => axis.isActive).sort((a, b) => a.position - b.position);
}

export function getActiveTraitsForAxis(config: ToonbtiConfig, axisId: string) {
  return config.traits
    .filter((trait) => trait.axisId === axisId && trait.isActive)
    .sort((a, b) => a.position - b.position);
}

export function getPossibleToonbtiCodes(config: ToonbtiConfig) {
  const traitGroups = getActiveToonbtiAxes(config).map((axis) =>
    getActiveTraitsForAxis(config, axis.id)
  );
  if (traitGroups.length !== 4 || traitGroups.some((traits) => traits.length !== 2)) return [];

  return traitGroups.reduce<string[]>(
    (codes, traits) => codes.flatMap((code) => traits.map((trait) => `${code}${trait.code}`)),
    [""]
  );
}

export function validatePublishableToonbtiConfig(config: ToonbtiConfig) {
  const axes = getActiveToonbtiAxes(config);
  if (axes.length !== 4) throw new Error("활성 성향축은 정확히 4개여야 합니다.");
  if (new Set(axes.map((axis) => axis.position)).size !== axes.length) {
    throw new Error("활성 성향축의 표시 순서가 중복되었습니다.");
  }
  CANONICAL_TOONBTI_AXES.forEach((definition, axisIndex) => {
    const axis = axes[axisIndex];
    const traits = getActiveTraitsForAxis(config, axis.id);
    if (
      axis.name !== definition.name ||
      traits.length !== definition.traits.length ||
      definition.traits.some((trait, traitIndex) => {
        const configured = traits[traitIndex];
        return (
          configured?.code !== trait.code ||
          configured?.name !== trait.name ||
          configured?.description !== trait.description
        );
      })
    ) {
      throw new Error(
        `${definition.name}은 인투니 고정 분류 기준과 일치해야 합니다.`
      );
    }
  });

  const activeCodes = new Set<string>();
  const activeAxisIds = new Set(axes.map((axis) => axis.id));
  const questionOnInactiveAxis = config.questions.find(
    (question) => question.isActive && !activeAxisIds.has(question.axisId)
  );
  if (questionOnInactiveAxis) {
    throw new Error("활성 질문은 활성 성향축에만 연결할 수 있습니다.");
  }

  for (const axis of axes) {
    if (!axis.name) throw new Error("모든 활성 성향축에는 이름이 필요합니다.");
    const traits = getActiveTraitsForAxis(config, axis.id);
    if (traits.length !== 2) throw new Error(`${axis.name}에는 활성 성향이 정확히 2개 필요합니다.`);
    for (const trait of traits) {
      if (!/^[A-Z0-9]$/.test(trait.code)) {
        throw new Error("활성 성향 코드는 영문 대문자 또는 숫자 한 글자여야 합니다.");
      }
      if (!trait.name || !trait.description) {
        throw new Error(`${axis.name}의 모든 성향에는 한글 이름과 설명이 필요합니다.`);
      }
      if (activeCodes.has(trait.code)) throw new Error(`성향 코드 ${trait.code}가 중복되었습니다.`);
      activeCodes.add(trait.code);
    }
    if (axis.tieBreakTraitId && !traits.some((trait) => trait.id === axis.tieBreakTraitId)) {
      throw new Error(`${axis.name}의 동점 기본 성향이 해당 축의 활성 성향이 아닙니다.`);
    }

    const questions = config.questions
      .filter((question) => question.axisId === axis.id && question.isActive)
      .sort((a, b) => a.position - b.position);
    if (questions.length !== 4) {
      throw new Error(`${axis.name}에는 활성 질문이 정확히 4개 필요합니다.`);
    }
    for (const question of questions) {
      if (!question.questionText) throw new Error("활성 질문에는 질문 문구가 필요합니다.");
      const options = config.options
        .filter((option) => option.questionId === question.id && option.isActive)
        .sort((a, b) => a.position - b.position);
      if (options.length !== 4) throw new Error("활성 질문에는 활성 답변이 정확히 4개 필요합니다.");
      if (new Set(options.map((option) => option.position)).size !== 4) {
        throw new Error("질문 답변의 표시 순서가 중복되었습니다.");
      }
      for (const option of options) {
        const trait = config.traits.find((item) => item.id === option.traitId);
        if (!option.optionText) throw new Error("활성 답변에는 답변 문구가 필요합니다.");
        if (option.axisId !== axis.id || trait?.axisId !== axis.id || !trait.isActive) {
          throw new Error("질문 답변은 질문과 같은 축의 활성 성향만 참조할 수 있습니다.");
        }
      }
    }
  }

  const possibleCodes = getPossibleToonbtiCodes(config);
  const activeResults = config.resultTypes.filter((result) => result.isActive);
  const resultCodes = activeResults.map((result) => result.code);
  if (new Set(resultCodes).size !== resultCodes.length) {
    throw new Error("활성 결과 유형 코드가 중복되었습니다.");
  }
  const invalidCode = resultCodes.find((code) => !possibleCodes.includes(code));
  if (invalidCode) throw new Error(`${invalidCode}는 현재 성향축으로 만들 수 없는 결과 코드입니다.`);
  const missingCodes = possibleCodes.filter((code) => !resultCodes.includes(code));
  if (missingCodes.length > 0) {
    throw new Error(`활성 결과 유형이 없는 코드가 있습니다: ${missingCodes.join(", ")}`);
  }
  for (const result of activeResults) {
    if (!result.name || !result.shortDescription || !result.longDescription) {
      throw new Error(`${result.code} 결과에는 이름과 한 줄·상세 설명이 필요합니다.`);
    }
  }
}

export function calculateToonbtiResult(
  config: ToonbtiConfig,
  answers: ToonbtiAnswer[]
): ToonbtiCalculationResult {
  const axes = getActiveToonbtiAxes(config);
  if (axes.length !== 4) throw new Error("활성 성향축 설정이 올바르지 않습니다.");

  const activeAxisIds = new Set(axes.map((axis) => axis.id));
  const activeQuestions = config.questions.filter(
    (question) => question.isActive && activeAxisIds.has(question.axisId)
  );
  const answerByQuestionId = new Map(answers.map((answer) => [answer.questionId, answer.optionId]));
  if (activeQuestions.some((question) => !answerByQuestionId.has(question.id))) {
    throw new Error("모든 질문에 답해야 결과를 계산할 수 있습니다.");
  }

  const axisResults = axes.map((axis): ToonbtiAxisResult => {
    const traits = getActiveTraitsForAxis(config, axis.id);
    if (traits.length !== 2) throw new Error(`${axis.name}의 성향 설정이 올바르지 않습니다.`);
    const scores = new Map(traits.map((trait) => [trait.id, 0]));
    const strongCounts = new Map(traits.map((trait) => [trait.id, 0]));
    const axisQuestions = activeQuestions.filter((question) => question.axisId === axis.id);

    for (const question of axisQuestions) {
      const optionId = answerByQuestionId.get(question.id);
      const option = config.options.find(
        (item) => item.id === optionId && item.questionId === question.id && item.isActive
      );
      if (!option || !scores.has(option.traitId)) {
        throw new Error("질문 답변이 현재 성향축 설정과 일치하지 않습니다.");
      }
      scores.set(option.traitId, (scores.get(option.traitId) ?? 0) + option.score);
      if (option.score === 10) {
        strongCounts.set(option.traitId, (strongCounts.get(option.traitId) ?? 0) + 1);
      }
    }

    const [first, second] = traits;
    const firstScore = scores.get(first.id) ?? 0;
    const secondScore = scores.get(second.id) ?? 0;
    let winner = firstScore >= secondScore ? first : second;
    if (firstScore === secondScore) {
      const firstStrong = strongCounts.get(first.id) ?? 0;
      const secondStrong = strongCounts.get(second.id) ?? 0;
      if (firstStrong !== secondStrong) {
        winner = firstStrong > secondStrong ? first : second;
      } else {
        winner =
          traits.find((trait) => trait.id === axis.tieBreakTraitId) ??
          traits.sort((a, b) => a.position - b.position)[0];
      }
    }
    const opponent = winner.id === first.id ? second : first;
    return {
      axisId: axis.id,
      traitId: winner.id,
      code: winner.code,
      score: scores.get(winner.id) ?? 0,
      opposingScore: scores.get(opponent.id) ?? 0
    };
  });

  const code = axisResults.map((axis) => axis.code).join("");
  return {
    code,
    axes: axisResults,
    resultType:
      config.resultTypes.find((result) => result.isActive && result.code === code) ?? null
  };
}
