"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const checkSession = async () => {
      const response = await fetch("/api/admin/session", { cache: "no-store" });
      const data = (await response.json()) as { authenticated?: boolean };

      if (data.authenticated) {
        router.replace("/admin");
      }
    };

    void checkSession();
  }, [router]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ password })
      });

      const data = (await response.json()) as { message?: string };

      if (!response.ok) {
        setError(data.message ?? "로그인에 실패했습니다.");
        return;
      }

      router.replace("/admin");
      router.refresh();
    } catch {
      setError("로그인 중 오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-8">
      <div className="panel-surface w-full max-w-md px-6 py-8">
        <p className="text-sm font-medium text-coral">Intooni Admin</p>
        <h1 className="mt-2 font-[var(--font-display)] text-3xl font-semibold text-ink">
          어드민 로그인
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          환경변수에 저장된 관리자 비밀번호로 로그인합니다.
        </p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <input
            type="password"
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              setError("");
            }}
            placeholder="관리자 비밀번호 입력"
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-ink"
          />
          {error && <p className="text-sm text-red-500">{error}</p>}
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-full bg-ink px-5 py-3 text-sm font-semibold text-white transition hover:bg-coral disabled:cursor-wait disabled:opacity-70"
          >
            {submitting ? "확인 중..." : "로그인"}
          </button>
        </form>
      </div>
    </main>
  );
}
