import { afterEach, describe, expect, it } from "vitest";

import { isProductionDeployment } from "@/lib/site";

const originalVercelEnv = process.env.VERCEL_ENV;

describe("site deployment helpers", () => {
  afterEach(() => {
    if (originalVercelEnv === undefined) {
      delete process.env.VERCEL_ENV;
    } else {
      process.env.VERCEL_ENV = originalVercelEnv;
    }
  });

  it("treats Vercel production as indexable production", () => {
    process.env.VERCEL_ENV = "production";

    expect(isProductionDeployment()).toBe(true);
  });

  it("treats Vercel preview deployments as non-production", () => {
    process.env.VERCEL_ENV = "preview";

    expect(isProductionDeployment()).toBe(false);
  });
});
