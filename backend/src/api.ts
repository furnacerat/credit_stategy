import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { z } from "zod";
import { pool } from "./db.js";
import { SQL } from "./schema.js";

dotenv.config();

const app = express();
app.use(cors({ origin: process.env.CORS_ORIGIN?.split(",") ?? ["http://localhost:3000"] }));
app.use(express.json({ limit: "2mb" }));

// One-time: ensure tables exist (simple for MVP)
app.get("/health", async (_req, res) => {
  try {
    await pool.query("select 1");
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message ?? "db_error" });
  }
});

app.post("/admin/migrate", async (_req, res) => {
  try {
    await pool.query("create extension if not exists pgcrypto;");
    await pool.query(SQL);
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message ?? "migrate_error" });
  }
});

// For now, user_id is passed in header (later replace with real auth/JWT)
function getUserId(req: express.Request) {
  return req.header("x-user-id") || "demo_user";
}

app.post("/reports", async (req, res) => {
  const bodySchema = z.object({
    filename: z.string().min(1),
    file_key: z.string().min(1), // this will be your R2 object key
  });

  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ ok: false, error: parsed.error.flatten() });

  const userId = getUserId(req);

  try {
    const report = await pool.query(
      `insert into reports (user_id, file_key, filename)
       values ($1,$2,$3)
       returning id, user_id, file_key, filename, created_at`,
      [userId, parsed.data.file_key, parsed.data.filename]
    );

    const job = await pool.query(
      `insert into jobs (user_id, report_id, status, progress)
       values ($1,$2,'queued','Queued')
       returning id, status, progress, created_at`,
      [userId, report.rows[0].id]
    );

    res.json({ ok: true, report: report.rows[0], job: job.rows[0] });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message ?? "db_error" });
  }
});

app.get("/jobs/:id", async (req, res) => {
  const userId = getUserId(req);

  try {
    const job = await pool.query(
      `select id, status, progress, error, report_id, created_at, updated_at
       from jobs
       where id=$1 and user_id=$2`,
      [req.params.id, userId]
    );

    if (!job.rowCount) return res.status(404).json({ ok: false, error: "not_found" });
    res.json({ ok: true, job: job.rows[0] });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message ?? "db_error" });
  }
});

app.get("/reports/:reportId/result", async (req, res) => {
  const userId = getUserId(req);

  try {
    const r = await pool.query(
      `select result_json, created_at from analysis_results where report_id=$1 and user_id=$2`,
      [req.params.reportId, userId]
    );
    if (!r.rowCount) return res.status(404).json({ ok: false, error: "no_result" });
    res.json({ ok: true, result: r.rows[0] });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message ?? "db_error" });
  }
});

const port = Number(process.env.PORT || 8080);
app.listen(port, () => console.log(`[API] listening on ${port}`));
