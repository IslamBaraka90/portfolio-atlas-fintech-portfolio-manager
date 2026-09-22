import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { reportRequestSchema, reportApprovalSchema } from "@portfolio-atlas/contracts";
import { reportCsv, reportJson, type ReportService } from "@portfolio-atlas/core";
import type { HttpContext } from "./context.js";
export function registerReportRoutes(
  app: FastifyInstance,
  service: ReportService,
  http: HttpContext,
) {
  const params = z.object({ id: z.string().min(1) }),
    query = z.object({ revision: z.coerce.number().int().positive().optional() });
  app.get("/api/v1/reports", async (r) => http.response(service.list(), r));
  app.get("/api/v1/reports/:id", async (r) =>
    http.response(service.get(params.parse(r.params).id, query.parse(r.query).revision), r),
  );
  app.get("/api/v1/reports/:id/history", async (r) =>
    http.response(service.history(params.parse(r.params).id), r),
  );
  app.get("/api/v1/reports/:id/comparison", async (r) => {
    const q = z
      .object({ from: z.coerce.number().int().positive(), to: z.coerce.number().int().positive() })
      .parse(r.query);
    return http.response(service.compare(params.parse(r.params).id, q.from, q.to), r);
  });
  for (const format of ["json", "csv"] as const)
    app.get("/api/v1/reports/:id/export." + format, async (r, reply) => {
      const report = service.get(params.parse(r.params).id, query.parse(r.query).revision);
      return reply
        .header(
          "content-disposition",
          'attachment; filename="portfolio-atlas-' +
            report.id +
            "-r" +
            report.revision +
            "." +
            format +
            '"',
        )
        .type(format === "csv" ? "text/csv; charset=utf-8" : "application/json; charset=utf-8")
        .send(format === "csv" ? reportCsv(report) : reportJson(report));
    });
  app.post("/api/v1/reports", async (r, reply) =>
    reply
      .code(201)
      .send(http.response(service.create(reportRequestSchema.parse(r.body), http.command(r)), r)),
  );
  app.post("/api/v1/reports/:id/approval", async (r, reply) =>
    reply
      .code(201)
      .send(
        http.response(
          service.approve(
            params.parse(r.params).id,
            reportApprovalSchema.parse(r.body),
            http.command(r),
          ),
          r,
        ),
      ),
  );
}
