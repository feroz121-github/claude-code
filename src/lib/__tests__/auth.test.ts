// @vitest-environment node
import { describe, test, expect, vi, beforeEach } from "vitest";
import { jwtVerify } from "jose";

const { mockSet } = vi.hoisted(() => ({ mockSet: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  cookies: vi.fn(() => Promise.resolve({ set: mockSet })),
}));

import { createSession } from "@/lib/auth";

const JWT_SECRET = new TextEncoder().encode("development-secret-key");

describe("createSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("sets a cookie named auth-token", async () => {
    await createSession("user-1", "a@b.com");

    expect(mockSet).toHaveBeenCalledOnce();
    const [name] = mockSet.mock.calls[0];
    expect(name).toBe("auth-token");
  });

  test("cookie is httpOnly with lax sameSite and root path", async () => {
    await createSession("user-1", "a@b.com");

    const [, , options] = mockSet.mock.calls[0];
    expect(options.httpOnly).toBe(true);
    expect(options.sameSite).toBe("lax");
    expect(options.path).toBe("/");
  });

  test("cookie expires in approximately 7 days", async () => {
    const before = Date.now();
    await createSession("user-1", "a@b.com");
    const after = Date.now();

    const [, , options] = mockSet.mock.calls[0];
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    expect(options.expires.getTime()).toBeGreaterThanOrEqual(before + sevenDays);
    expect(options.expires.getTime()).toBeLessThanOrEqual(after + sevenDays + 100);
  });

  test("secure is false outside production", async () => {
    await createSession("user-1", "a@b.com");

    const [, , options] = mockSet.mock.calls[0];
    expect(options.secure).toBe(false);
  });

  test("secure is true in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    await createSession("user-1", "a@b.com");

    const [, , options] = mockSet.mock.calls[0];
    expect(options.secure).toBe(true);
    vi.unstubAllEnvs();
  });

  test("cookie value is a JWT containing userId and email", async () => {
    await createSession("user-1", "a@b.com");

    const [, token] = mockSet.mock.calls[0];
    const { payload } = await jwtVerify(token, JWT_SECRET);
    expect(payload.userId).toBe("user-1");
    expect(payload.email).toBe("a@b.com");
  });

  test("JWT expires in 7 days", async () => {
    const before = Math.floor(Date.now() / 1000);
    await createSession("user-1", "a@b.com");

    const [, token] = mockSet.mock.calls[0];
    const { payload } = await jwtVerify(token, JWT_SECRET);
    const sevenDays = 7 * 24 * 60 * 60;
    expect(payload.exp).toBeGreaterThanOrEqual(before + sevenDays);
    expect(payload.exp).toBeLessThanOrEqual(before + sevenDays + 5);
  });
});
