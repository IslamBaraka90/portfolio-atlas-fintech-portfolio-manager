import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { buildApp } from "../src/app.js";
import { demoMandate, fixtureTime } from "@portfolio-atlas/testing";
import type { AccessConfig, Role } from "@portfolio-atlas/contracts";
import { seedTrading } from "../../../tests/helpers/seed-trading.js";

export const testToken = (id: string) => (id + "-test-only-credential-").padEnd(48, "x");
export function testAccess(): AccessConfig {
  const actors: [string, Role[], string][] = [
    ["analyst", ["analyst", "approver"], "course-workspace"],
    ["operator", ["operator"], "course-workspace"],
    ["reviewer", ["approver"], "course-workspace"],
    ["reader", ["reader"], "course-workspace"],
    ["outsider", ["reader", "approver"], "other-workspace"],
  ];
  return {
    scopeId: "course-workspace",
    policyRevision: "chapter-17.test.v1",
    validFrom: "2020-01-01T00:00:00Z",
    validTo: "2030-01-01T00:00:00Z",
    actors: actors.map(([id, roles, scopeId]) => ({
      id,
      name: id,
      roles,
      scopeId,
      tokenHash: createHash("sha256").update(testToken(id)).digest("hex"),
      validFrom: "2020-01-01T00:00:00Z",
      validTo: "2030-01-01T00:00:00Z",
    })),
  };
}
test("server roles, workspace scope, creator separation, actor binding and replay audit survive direct calls", async (t) => {
  let now = fixtureTime;
  const app = buildApp({ accessConfig: testAccess(), clock: { now: () => now } });
  t.after(() => app.close());
  const send = async (actor: string, path: string, payload?: object, key = "governance-command") =>
    app.inject({
      method: payload ? "POST" : "GET",
      url: "/api/v1" + path,
      headers: { authorization: "Bearer " + testToken(actor), "idempotency-key": key },
      ...(payload ? { payload } : {}),
    });
  assert.equal((await app.inject("/api/v1/portfolios")).statusCode, 401);
  assert.equal((await send("reader", "/mandates", demoMandate)).statusCode, 403);
  assert.equal((await send("outsider", "/portfolios/guessed-private-id")).statusCode, 403);
  const m = await send("analyst", "/mandates", demoMandate, "same-actor-key");
  assert.equal(m.statusCode, 201, m.body);
  const m2 = await send("analyst", "/mandates", demoMandate, "same-actor-key");
  assert.deepEqual(m2.json().data, m.json().data);
  const other = await send("reviewer", "/mandates", demoMandate, "same-actor-key");
  assert.equal(other.statusCode, 403);
  const portfolio = await send(
    "operator",
    "/portfolios",
    { name: "Governed book", mandateId: m.json().data.id },
    "portfolio-command",
  );
  assert.equal(portfolio.statusCode, 201, portfolio.body);
  const report = await send(
    "analyst",
    "/reports",
    {
      portfolioId: portfolio.json().data.id,
      title: "Governed missing report",
      asOf: now,
      dataCutoff: now,
    },
    "report-create",
  );
  assert.equal(report.statusCode, 201, report.body);
  assert.equal((await send("reviewer", "/governance/approvals")).json().data[0].canApprove, true);
  const route = "/reports/" + report.json().data.id + "/approval";
  const approval = {
    expectedRevision: 1,
    actor: "Spoofed identity",
    reason: "Reviewed the missing sections and their limitations.",
    acknowledgeExceptions: true,
  };
  assert.equal((await send("analyst", route, approval, "self-approval")).statusCode, 403);
  const approved = await send("reviewer", route, approval, "review-approval");
  assert.equal(approved.statusCode, 201, approved.body);
  assert.equal(approved.json().data.approval.actor, "reviewer");
  assert.deepEqual(
    (await send("reviewer", route, approval, "review-approval")).json().data,
    approved.json().data,
  );
  const audit = (await send("reader", "/governance/audit")).json().data;
  assert.equal(
    audit.filter(
      (v: { operation: string; decision: string }) =>
        v.operation === "mandate.create" && v.decision === "committed",
    ).length,
    1,
  );
  assert.equal(
    audit.filter(
      (v: { operation: string; decision: string }) =>
        v.operation === "report.approve" && v.decision === "committed",
    ).length,
    1,
  );
  assert.ok(audit.some((v: { decision: string }) => v.decision === "denied"));
  assert.ok(!JSON.stringify(audit).includes(testToken("analyst")));
  assert.ok(!JSON.stringify(approved.json()).includes("Spoofed identity"));
  now = "2030-01-01T00:00:00Z";
  assert.equal((await send("reader", "/portfolios")).statusCode, 401);
});
test("browser sessions require CSRF, expire, revoke on logout and never expose bearer credentials", async (t) => {
  let now = fixtureTime;
  const app = buildApp({
    accessConfig: testAccess(),
    clock: { now: () => now },
    secureCookie: true,
  });
  t.after(() => app.close());
  const login = await app.inject({
    method: "POST",
    url: "/api/v1/auth/session",
    headers: { authorization: "Bearer " + testToken("analyst") },
  });
  assert.equal(login.statusCode, 200, login.body);
  const cookie = String(login.headers["set-cookie"]);
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Strict/);
  assert.match(cookie, /Secure/);
  const sessionCookie = cookie.split(";")[0]!,
    csrf = login.json().data.csrf;
  assert.ok(!login.body.includes(testToken("analyst")));
  const post = (token?: string, origin?: string) =>
    app.inject({
      method: "POST",
      url: "/api/v1/mandates",
      payload: demoMandate,
      headers: {
        cookie: sessionCookie,
        "idempotency-key": "cookie-create",
        ...(token ? { "x-csrf-token": token } : {}),
        ...(origin ? { origin } : {}),
      },
    });
  assert.equal((await post()).statusCode, 403);
  assert.equal((await post(csrf, "https://attacker.example")).statusCode, 403);
  assert.equal((await post(csrf)).statusCode, 201);
  const logout = await app.inject({
    method: "POST",
    url: "/api/v1/auth/logout",
    headers: { cookie: sessionCookie, "x-csrf-token": csrf },
  });
  assert.equal(logout.statusCode, 200);
  assert.equal((await post(csrf)).statusCode, 401);
  const second = await app.inject({
    method: "POST",
    url: "/api/v1/auth/session",
    headers: { authorization: "Bearer " + testToken("reader") },
  });
  now = new Date(Date.parse(now) + 30 * 60 * 1000).toISOString();
  assert.equal(
    (
      await app.inject({
        url: "/api/v1/portfolios",
        headers: { cookie: String(second.headers["set-cookie"]).split(";")[0]! },
      })
    ).statusCode,
    401,
  );
});
test("a price override records authenticated prior and new mark evidence and rejects analysts", async (t) => {
  const access = testAccess();
  access.actors.find((a) => a.id === "analyst")!.roles = ["analyst"];
  access.actors.find((a) => a.id === "operator")!.roles = ["operator", "analyst", "approver"];
  const app = buildApp({ accessConfig: access, clock: { now: () => fixtureTime } });
  t.after(() => app.close());
  const get = async (path: string) =>
    (
      await app.inject({
        url: "/api/v1" + path,
        headers: { authorization: "Bearer " + testToken("operator") },
      })
    ).json().data;
  const post = async (path: string, key: string, payload: object) => {
    const r = await app.inject({
      method: "POST",
      url: "/api/v1" + path,
      payload,
      headers: {
        authorization: "Bearer " + testToken("operator"),
        "idempotency-key": "override-" + key,
      },
    });
    assert.equal(r.statusCode, 201, r.body);
    return r.json().data;
  };
  const seed = await seedTrading(get, post, "override-seed", () => fixtureTime);
  const book = await post("/ledger/events", "buy", {
    portfolioId: seed.portfolio.id,
    kind: "buy",
    currency: "USD",
    instrumentId: seed.instruments[0]!.instrumentId,
    instrumentRevision: seed.instruments[0]!.revision,
    quantity: "10",
    unitPrice: "100",
    fee: "0",
    occurredAt: fixtureTime,
    sourceRef: "override-buy",
  });
  const input = {
    portfolioId: seed.portfolio.id,
    checkpoint: book.book.checkpoint,
    asOf: fixtureTime,
    prices: [],
    overrides: [seed.input.newPrices[0]],
  };
  await post("/valuations", "first", input);
  await post("/valuations", "second", {
    ...input,
    overrides: [
      {
        ...input.overrides[0],
        price: "110",
        reason: "Correct the authored closing price with reviewed evidence.",
      },
    ],
  });
  const audit = await get("/governance/audit");
  const changed = audit.find(
    (v: { operation: string; overrides: unknown[] }) =>
      v.operation === "valuation.create" && v.overrides.length,
  );
  assert.equal(changed.actorId, "operator");
  assert.equal(changed.overrides[0].prior.price, "100.00000000");
  assert.equal(changed.overrides[0].next.price, "110");
  assert.equal(changed.policyRevision, access.policyRevision);
  // An analyst without override authority is denied before financial validation.
  assert.equal(
    (
      await app.inject({
        method: "POST",
        url: "/api/v1/valuations",
        payload: input,
        headers: {
          authorization: "Bearer " + testToken("analyst"),
          "idempotency-key": "analyst-override",
        },
      })
    ).statusCode,
    403,
  );
});

test("configured scope cannot downgrade on restart and revoked credentials lose access", async () => {
  const directory = mkdtempSync(join(tmpdir(), "portfolio-atlas-access-")),
    databasePath = join(directory, "book.sqlite");
  try {
    const local = buildApp({ databasePath, clock: { now: () => fixtureTime } });
    const post = async (path: string, payload: object) => {
      const response = await local.inject({
        method: "POST",
        url: "/api/v1" + path,
        payload,
        headers: { "idempotency-key": "legacy-" + path.replaceAll("/", "-") },
      });
      assert.equal(response.statusCode, 201, response.body);
      return response.json().data;
    };
    const mandate = await post("/mandates", demoMandate);
    const portfolio = await post("/portfolios", {
      name: "Legacy local book",
      mandateId: mandate.id,
    });
    const legacy = await post("/reports", {
      portfolioId: portfolio.id,
      title: "Unauthenticated draft",
      asOf: fixtureTime,
      dataCutoff: fixtureTime,
    });
    await local.close();
    const initial = buildApp({
      databasePath,
      accessConfig: testAccess(),
      clock: { now: () => fixtureTime },
    });
    const rejected = await initial.inject({
      method: "POST",
      url: "/api/v1/reports/" + legacy.id + "/approval",
      headers: {
        authorization: "Bearer " + testToken("reviewer"),
        "idempotency-key": "legacy-approve",
      },
      payload: {
        expectedRevision: 1,
        actor: "Reviewer",
        reason: "Review a legacy unauthenticated draft.",
        acknowledgeExceptions: true,
      },
    });
    assert.equal(rejected.statusCode, 403);
    assert.equal(
      (
        await initial.inject({
          url: "/api/v1/governance/approvals",
          headers: { authorization: "Bearer " + testToken("reviewer") },
        })
      ).json().data[0].canApprove,
      false,
    );
    await initial.close();
    assert.throws(() => buildApp({ databasePath }), /cannot change scope/);
    const wrong = testAccess();
    wrong.scopeId = "other-workspace";
    assert.throws(() => buildApp({ databasePath, accessConfig: wrong }), /cannot change scope/);
    const revoked = testAccess();
    revoked.actors = revoked.actors.filter((a) => a.id !== "reader");
    const restored = buildApp({
      databasePath,
      accessConfig: revoked,
      clock: { now: () => fixtureTime },
    });
    try {
      assert.equal(
        (
          await restored.inject({
            url: "/api/v1/portfolios",
            headers: { authorization: "Bearer " + testToken("reader") },
          })
        ).statusCode,
        401,
      );
    } finally {
      await restored.close();
    }
  } finally {
    const target = resolve(directory),
      root = resolve(tmpdir()) + sep;
    assert.ok(
      target.startsWith(root) && target.slice(root.length).startsWith("portfolio-atlas-access-"),
    );
    rmSync(target, { recursive: true, force: true });
  }
});
