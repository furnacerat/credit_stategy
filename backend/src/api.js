import "dotenv/config";
import express from "express";
import cors from "cors";
import { z } from "zod";
import crypto from "crypto";
import { PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { pool } from "./db.js";
import { SQL } from "./schema.js";
import { r2, R2_BUCKET } from "./r2.js";
const app = express();
const allowedOrigins = (process.env.CORS_ORIGIN || "http://localhost:3000")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
app.use(cors({
    origin: (origin, callback) => {
        // allow same-origin / server-to-server / curl (no origin)
        if (!origin)
            return callback(null, true);
        // exact match allowlist
        if (allowedOrigins.includes(origin))
            return callback(null, true);
        return callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "x-user-id"],
}));
// Handle preflight for all routes
app.options("*", cors());
app.use(express.json({ limit: "2mb" }));
function safeFilename(name) {
    return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
}
// One-time: ensure tables exist (simple for MVP)
app.get("/health", async (_req, res) => {
    try {
        await pool.query("select 1");
        res.json({ ok: true });
    }
    catch (e) {
        res.status(500).json({ ok: false, error: e?.message ?? "db_error" });
    }
});
app.post("/admin/migrate", async (_req, res) => {
    try {
        await pool.query("create extension if not exists pgcrypto;");
        await pool.query(SQL);
        res.json({ ok: true });
    }
    catch (e) {
        res.status(500).json({ ok: false, error: e?.message ?? "migrate_error" });
    }
});
// For now, user_id is passed in header (later replace with real auth/JWT)
function getUserId(req) {
    return req.header("x-user-id") || "demo_user";
}
app.post("/uploads/presign", async (req, res) => {
    const bodySchema = z.object({
        filename: z.string().min(1),
        contentType: z.string().default("application/pdf"),
    });
    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ ok: false, error: parsed.error.flatten() });
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
    }
    catch (e) {
        res.status(500).json({ ok: false, error: e?.message ?? "r2_error" });
    }
});
app.post("/downloads/presign", async (req, res) => {
    const bodySchema = z.object({
        file_key: z.string().min(1),
    });
    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ ok: false, error: parsed.error.flatten() });
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
    }
    catch (e) {
        res.status(500).json({ ok: false, error: e?.message ?? "r2_error" });
    }
});
app.post("/reports", async (req, res) => {
    const bodySchema = z.object({
        filename: z.string().min(1),
        file_key: z.string().min(1), // this will be your R2 object key
    });
    const parsed = bodySchema.safeParse(req.body);
    if (!parsed.success)
        return res.status(400).json({ ok: false, error: parsed.error.flatten() });
    const userId = getUserId(req);
    try {
        const report = await pool.query(`insert into reports (user_id, file_key, filename)
       values ($1,$2,$3)
       returning id, user_id, file_key, filename, created_at`, [userId, parsed.data.file_key, parsed.data.filename]);
        const job = await pool.query(`insert into jobs (user_id, report_id, status, progress)
       values ($1,$2,'queued','Queued')
       returning id, status, progress, created_at`, [userId, report.rows[0].id]);
        res.json({ ok: true, report: report.rows[0], job: job.rows[0] });
    }
    catch (e) {
        res.status(500).json({ ok: false, error: e?.message ?? "db_error" });
    }
});
app.get("/jobs/:id", async (req, res) => {
    const userId = getUserId(req);
    try {
        const job = await pool.query(`select id, status, progress, error, report_id, created_at, updated_at
       from jobs
       where id=$1 and user_id=$2`, [req.params.id, userId]);
        if (!job.rowCount)
            return res.status(404).json({ ok: false, error: "not_found" });
        res.json({ ok: true, job: job.rows[0] });
    }
    catch (e) {
        res.status(500).json({ ok: false, error: e?.message ?? "db_error" });
    }
});
app.get("/reports/:reportId/result", async (req, res) => {
    const userId = getUserId(req);
    try {
        const r = await pool.query(`select result_json, created_at from analysis_results where report_id=$1 and user_id=$2`, [req.params.reportId, userId]);
        if (!r.rowCount)
            return res.status(404).json({ ok: false, error: "no_result" });
        res.json({ ok: true, result: r.rows[0] });
    }
    catch (e) {
        res.status(500).json({ ok: false, error: e?.message ?? "db_error" });
    }
});
const port = Number(process.env.PORT || 8080);
app.listen(port, () => console.log(`[API] listening on ${port}`));
//# sourceMappingURL=api.js.map