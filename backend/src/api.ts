import "dotenv/config";
import express from "express";

import { z } from "zod";
import crypto from "crypto";
import { PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { pool } from "./db.js";
import { SQL } from "./schema.js";
import { r2, R2_BUCKET } from "./r2.js";
import { authMiddleware } from "./authMiddleware.js";
import type { AuthRequest } from "./authMiddleware.js";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";

const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_one_two_three';

const app = express();


// ---------- CORS (must be BEFORE routes) ----------
const allowedOrigins = (process.env.CORS_ORIGIN || "http://localhost:3000")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

app.use((req, res, next) => {
  const origin = req.headers.origin as string | undefined;

  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization,x-user-id");
  }

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  next();
});

app.use(express.json({ limit: "20mb" }));

function safeFilename(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
}

// One-time: ensure tables exist (simple for MVP)
app.get("/health", (_req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "https://creditstrategyai.com");
  return res.json({ ok: true });
});


// Migration endpoint (updated to handle table resets if needed)
app.post("/admin/migrate", async (req, res) => {
  const reset = req.query.reset === 'true';
  try {
    await pool.query("create extension if not exists pgcrypto;");
    if (reset) {
      console.log("[ADMIN] Resetting tables...");
      await pool.query("drop table if exists analysis_results cascade;");
      await pool.query("drop table if exists dispute_letters cascade;");
      await pool.query("drop table if exists jobs cascade;");
      await pool.query("drop table if exists reports cascade;");
      await pool.query("drop table if exists users cascade;");
    }
    await pool.query(SQL);
    res.json({ ok: true, reset });
  } catch (e: unknown) {
    res.status(500).json({ ok: false, error: (e as Error)?.message ?? "migrate_error" });
  }
});

// ---------- AUTH ENDPOINTS ----------

app.post("/auth/register", async (req, res) => {
  const bodySchema = z.object({
    email: z.string().email(),
    password: z.string().min(8),
  });

  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ ok: false, error: parsed.error.flatten() });

  const { email, password } = parsed.data;
  const hash = await bcrypt.hash(password, 10);

  try {
    const result = await pool.query(
      "insert into users (email, password_hash) values ($1, $2) returning id, email, created_at",
      [email, hash]
    );
    const user = result.rows[0];
    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });

    res.json({ ok: true, user, token });
  } catch (e: unknown) {
    const msg = (e as any)?.code === '23505' ? 'email_exists' : 'register_error';
    res.status(400).json({ ok: false, error: msg });
  }
});

app.post("/auth/login", async (req, res) => {
  const bodySchema = z.object({
    email: z.string().email(),
    password: z.string(),
  });

  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ ok: false, error: parsed.error.flatten() });

  const { email, password } = parsed.data;

  try {
    const result = await pool.query("select * from users where email = $1", [email]);
    const user = result.rows[0];

    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ ok: false, error: "invalid_credentials" });
    }

    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ ok: true, user: { id: user.id, email: user.email }, token });
  } catch (e: unknown) {
    res.status(500).json({ ok: false, error: "login_error" });
  }
});

function getUserId(req: AuthRequest) {
  return req.user?.id || "demo_user";
}

app.post("/uploads/presign", authMiddleware, async (req: AuthRequest, res) => {
  console.log("PRESIGN HIT", new Date().toISOString());
  const bodySchema = z.object({
    filename: z.string().min(1),
    contentType: z.string().default("application/pdf"),
  });

  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ ok: false, error: parsed.error.flatten() });

  const userId = getUserId(req);
  const filename = safeFilename(parsed.data.filename);
  const contentType = parsed.data.contentType || "application/pdf";

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const rand = crypto.randomBytes(6).toString("hex");
  const fileKey = `${userId}/${stamp}_${rand}_${filename}`;

  const command = new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: fileKey,
    ContentType: contentType,
  });

  try {
    const uploadUrl = await getSignedUrl(r2, command, { expiresIn: 600 });

    res.json({
      ok: true,
      file_key: fileKey,
      upload_url: uploadUrl,
      expires_in: 600,
    });
  } catch (e: unknown) {
    res.status(500).json({ ok: false, error: (e as Error)?.message ?? "r2_error" });
  }
});

app.post("/downloads/presign", authMiddleware, async (req: AuthRequest, res) => {
  const bodySchema = z.object({
    file_key: z.string().min(1),
  });

  const parsed = bodySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ ok: false, error: parsed.error.flatten() });

  const userId = getUserId(req);
  const fileKey = parsed.data.file_key;

  // basic safety: user can only download their own files
  if (!fileKey.startsWith(`${userId}/`)) {
    return res.status(403).json({ ok: false, error: "forbidden" });
  }

  const command = new GetObjectCommand({
    Bucket: R2_BUCKET,
    Key: fileKey,
  });

  try {
    const downloadUrl = await getSignedUrl(r2, command, { expiresIn: 600 });
    res.json({ ok: true, download_url: downloadUrl, expires_in: 600 });
  } catch (e: unknown) {
    res.status(500).json({ ok: false, error: (e as Error)?.message ?? "r2_error" });
  }
});

app.post("/reports", authMiddleware, async (req: AuthRequest, res) => {
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
  } catch (e: unknown) {
    res.status(500).json({ ok: false, error: (e as Error)?.message ?? "db_error" });
  }
});

app.get("/jobs/:id", authMiddleware, async (req: AuthRequest, res) => {
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
  } catch (e: unknown) {
    res.status(500).json({ ok: false, error: (e as Error)?.message ?? "db_error" });
  }
});

app.get("/reports/:reportId/result", authMiddleware, async (req: AuthRequest, res) => {
  const userId = getUserId(req);

  try {
    const r = await pool.query(
      `select result_json, created_at from analysis_results where report_id=$1 and user_id=$2`,
      [req.params.reportId, userId]
    );
    if (!r.rowCount) return res.status(404).json({ ok: false, error: "no_result" });
    res.json({ ok: true, result: r.rows[0] });
  } catch (e: unknown) {
    res.status(500).json({ ok: false, error: (e as Error)?.message ?? "db_error" });
  }
});

app.get("/reports/:reportId/letters", authMiddleware, async (req: AuthRequest, res) => {
  const userId = getUserId(req);

  try {
    const r = await pool.query(
      `select id, bureau, file_key, created_at from dispute_letters where report_id=$1 and user_id=$2`,
      [req.params.reportId, userId]
    );
    res.json({ ok: true, letters: r.rows });
  } catch (e: unknown) {
    res.status(500).json({ ok: false, error: (e as Error)?.message ?? "db_error" });
  }
});

app.post("/reports/:reportId/retry", authMiddleware, async (req: AuthRequest, res) => {
  const userId = getUserId(req);
  const reportId = req.params.reportId;

  try {
    await pool.query("begin");

    // 1) Verify report belongs to user
    const rep = await pool.query(`select id from reports where id=$1 and user_id=$2`, [reportId, userId]);
    if (!rep.rowCount) {
      await pool.query("rollback");
      return res.status(404).json({ ok: false, error: "report_not_found" });
    }

    // 2) Delete existing job & results for a fresh start
    // Note: This is an aggressive reset. 
    await pool.query(`delete from jobs where report_id=$1`, [reportId]);
    await pool.query(`delete from analysis_results where report_id=$1`, [reportId]);
    await pool.query(`delete from dispute_letters where report_id=$1`, [reportId]);

    // 3) Create new job
    const jobRes = await pool.query(
      `insert into jobs (report_id, user_id, status, progress) 
       values ($1, $2, 'queued', 'Queued') 
       returning id`,
      [reportId, userId]
    );

    await pool.query("commit");
    res.json({ ok: true, job: jobRes.rows[0] });
  } catch (e: unknown) {
    await pool.query("rollback");
    res.status(500).json({ ok: false, error: (e as Error)?.message ?? "retry_failed" });
  }
});

const port = Number(process.env.PORT || 8080);
app.listen(port, () => console.log(`[API] listening on ${port}`));
