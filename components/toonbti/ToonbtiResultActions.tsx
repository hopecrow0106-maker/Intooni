"use client";

import { Download, Link2, RotateCcw, Share2 } from "lucide-react";
import { useRouter } from "next/navigation";

type ResultCardData = {
  testId: string;
  code: string;
  name: string;
  shortDescription: string;
  traitNames: string[];
  shareText: string;
  imageUrl: string;
  resultUrl: string;
};

function sendEvent(payload: Record<string, string>) {
  void fetch("/api/toonbti-events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    keepalive: true
  }).catch(() => undefined);
}

function roundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
  context.fill();
}

async function createCardBlob(data: ResultCardData) {
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1350;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("이미지 생성 기능을 사용할 수 없습니다.");

  context.fillStyle = "#f8f7f4";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#ff4d6d";
  roundedRect(context, 80, 80, 920, 1190, 44);
  context.fillStyle = "#ffffff";
  roundedRect(context, 110, 110, 860, 1130, 32);

  context.textAlign = "center";
  context.fillStyle = "#ff4d6d";
  context.font = "700 42px sans-serif";
  context.fillText("인투니 TOON-BTI", 540, 220);
  context.fillStyle = "#111827";
  context.font = "900 144px sans-serif";
  context.fillText(data.code, 540, 430);
  context.font = "800 60px sans-serif";
  context.fillText(data.name, 540, 545);

  let resultImage: ImageBitmap | null = null;
  if (data.imageUrl) {
    try {
      const response = await fetch(`/api/toonbti-image?url=${encodeURIComponent(data.imageUrl)}`);
      if (response.ok) resultImage = await createImageBitmap(await response.blob());
    } catch {
      resultImage = null;
    }
  }

  if (resultImage) {
    const sourceSize = Math.min(resultImage.width, resultImage.height);
    const sourceX = Math.max(0, (resultImage.width - sourceSize) / 2);
    const sourceY = Math.max(0, (resultImage.height - sourceSize) / 2);
    context.save();
    context.beginPath();
    context.roundRect(375, 600, 330, 330, 24);
    context.clip();
    context.drawImage(resultImage, sourceX, sourceY, sourceSize, sourceSize, 375, 600, 330, 330);
    context.restore();
    resultImage.close();
  }

  const traitY = resultImage ? 975 : 615;
  context.fillStyle = "#f1edff";
  roundedRect(context, 180, traitY, 720, 92, 46);
  context.fillStyle = "#6d4aff";
  context.font = "700 34px sans-serif";
  context.fillText(data.traitNames.join(" · "), 540, traitY + 59);

  context.fillStyle = "#475569";
  context.font = resultImage ? "500 28px sans-serif" : "500 34px sans-serif";
  const words = data.shortDescription.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (context.measureText(next).width > 720 && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  const descriptionY = resultImage ? 1120 : 820;
  const lineHeight = resultImage ? 42 : 54;
  lines.slice(0, resultImage ? 2 : 4).forEach((text, index) =>
    context.fillText(text, 540, descriptionY + index * lineHeight)
  );

  context.fillStyle = "#111827";
  context.font = "700 30px sans-serif";
  context.fillText("intooni.com/toonbti", 540, 1205);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("이미지 생성에 실패했습니다."))), "image/png");
  });
}

export function ToonbtiResultActions({ data }: { data: ResultCardData }) {
  const router = useRouter();

  const saveImage = async () => {
    try {
      const blob = await createCardBlob(data);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `intooni-toonbti-${data.code}.png`;
      anchor.click();
      URL.revokeObjectURL(url);
      sendEvent({
        eventType: "toonbti_image_save",
        testId: data.testId,
        resultCode: data.code
      });
    } catch {
      window.alert("결과 이미지를 만들지 못했습니다. 다시 시도해 주세요.");
    }
  };

  const share = async () => {
    const text = data.shareText || `내 툰비티아이 결과는 ${data.code} ${data.name}!`;
    try {
      let file: File | null = null;
      try {
        const blob = await createCardBlob(data);
        file = new File([blob], `intooni-toonbti-${data.code}.png`, { type: "image/png" });
      } catch {
        file = null;
      }
      if (file && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ title: `툰비티아이 ${data.code}`, text, url: data.resultUrl, files: [file] });
      } else if (navigator.share) {
        await navigator.share({ title: `툰비티아이 ${data.code}`, text, url: data.resultUrl });
      } else {
        await navigator.clipboard.writeText(`${text}\n${data.resultUrl}`);
        window.alert("결과 링크를 복사했습니다.");
      }
      sendEvent({
        eventType: "toonbti_result_share",
        testId: data.testId,
        resultCode: data.code
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      window.alert("공유하지 못했습니다. 다시 시도해 주세요.");
    }
  };

  const restart = () => {
    sendEvent({
      eventType: "toonbti_restart",
      testId: data.testId,
      resultCode: data.code
    });
    router.push("/toonbti");
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(data.resultUrl);
      window.alert("결과 링크를 복사했습니다.");
    } catch {
      window.prompt("아래 결과 링크를 복사해 주세요.", data.resultUrl);
    }
    sendEvent({
      eventType: "toonbti_result_share",
      testId: data.testId,
      resultCode: data.code
    });
  };

  return (
    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
      <button
        type="button"
        onClick={() => void share()}
        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#ff4d6d] px-4 text-sm font-bold text-white"
      >
        <Share2 size={17} />
        결과 공유
      </button>
      <button
        type="button"
        onClick={() => void saveImage()}
        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[#ff4d6d] px-4 text-sm font-bold text-[#d92f51]"
      >
        <Download size={17} />
        이미지 저장
      </button>
      <button
        type="button"
        onClick={() => void copyLink()}
        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 px-4 text-sm font-bold text-slate-700"
      >
        <Link2 size={17} />
        링크 복사
      </button>
      <button
        type="button"
        onClick={restart}
        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-slate-200 px-4 text-sm font-bold text-slate-700"
      >
        <RotateCcw size={17} />
        다시 테스트
      </button>
    </div>
  );
}
