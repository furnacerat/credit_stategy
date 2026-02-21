import "dotenv/config";
import { pool } from "./db.js";
import { r2, R2_BUCKET } from "./r2.js";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { PDFParse } from "pdf-parse";
import { analyzeCreditText } from "./analyzeCreditText.js";
import { generateDisputeLetters } from "./generateLetters.js";
import type { PoolClient } from "pg";

async function sleep(ms: number) {
    await new Promise((r) => setTimeout(r, ms));
}

async function streamToBuffer(stream: any): Promise<Buffer> {
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(Buffer.from(chunk));
    return Buffer.concat(chunks);
}

async function cleanupStaleJobs() {
    console.log("[WORKER] cleaning up stale jobs...");
    try {
        const result = await pool.query(
            `update jobs 
             set status='failed', progress='Error', error='job_timeout', updated_at=now() 
             where (status='queued' or status='processing') 
             and updated_at < now() - interval '10 minutes'
             returning id`
        );
        if (result.rowCount && result.rowCount > 0) {
            console.log(`[WORKER] timed out ${result.rowCount} stale jobs:`, result.rows.map(r => r.id));
        }
    } catch (e) {
        console.error("[WORKER] cleanupStaleJobs error", e);
    }
}

async function runOnce() {
    const client: PoolClient = await pool.connect();
    try {
        await client.query("BEGIN");

        // pick 1 job safely
        const jobPick = await client.query(
            `select id, report_id, user_id
             from jobs
             where status='queued'
             order by created_at asc
             limit 1
             for update skip locked`
        );

        if (!jobPick.rowCount) {
            await client.query("COMMIT");
            return;
        }

        const job = jobPick.rows[0];
        console.log("[WORKER] picked job", { jobId: job.id, report_id: job.report_id, user_id: job.user_id });

        try {
            // 1) Update to processing
            await client.query(`update jobs set status='processing', progress='Downloading', updated_at=now() where id=$1`, [job.id]);

            // 2) Look up the report
            const rep = await client.query(
                `select file_key, filename from reports where id=$1 and user_id=$2`,
                [job.report_id, job.user_id]
            );
            if (!rep.rowCount) throw new Error("report_not_found");

            const { file_key } = rep.rows[0];

            // 3) Download PDF bytes from R2
            const obj = await r2.send(new GetObjectCommand({ Bucket: R2_BUCKET, Key: file_key }));
            if (!obj.Body) throw new Error("r2_empty_body");

            const pdfBuffer = await streamToBuffer(obj.Body);
            console.log("[WORKER] downloaded bytes:", pdfBuffer.length);

            await client.query(`update jobs set status='processing', progress='Parsing', updated_at=now() where id=$1`, [job.id]);

            // 4) Parse PDF
            const parser = new PDFParse({ data: pdfBuffer });
            const result = await parser.getText();
            const text = result.text || "";
            await parser.destroy();
            console.log("[WORKER] extracted chars:", text.length);

            await client.query(`update jobs set status='processing', progress='Analyzing', updated_at=now() where id=$1`, [job.id]);

            // 5) AI Analysis
            console.log("[WORKER] starting AI analysis...");
            const analysis = await analyzeCreditText(text);
            console.log("[WORKER] AI analysis complete");

            await client.query(
                `insert into analysis_results (report_id, user_id, result_json)
                 values ($1,$2,$3)
                 on conflict (report_id) do update set result_json=excluded.result_json, created_at=now()`,
                [job.report_id, job.user_id, analysis]
            );

            // 6) Background Letter Generation
            await generateDisputeLetters(job.report_id, job.user_id, analysis);

            await client.query(`update jobs set status='complete', progress='Complete', updated_at=now() where id=$1`, [job.id]);
            await client.query("COMMIT");
        } catch (e: unknown) {
            await client.query("ROLLBACK");
            const msg = (e as Error)?.message ?? "worker_error";
            console.error(`[WORKER] job ${job.id} failed:`, msg);
            await pool.query(`update jobs set status='failed', progress='Error', error=$2, updated_at=now() where id=$1`, [
                job.id,
                msg,
            ]);
        }
    } catch (outerError) {
        console.error("[WORKER] runOnce outer error", outerError);
    } finally {
        client.release();
    }
}

async function main() {
    console.log("[WORKER] started");
    let lastCleanup = 0;
    while (true) {
        try {
            if (Date.now() - lastCleanup > 5 * 60 * 1000) {
                await cleanupStaleJobs();
                lastCleanup = Date.now();
            }

            await runOnce();
        } catch (e: unknown) {
            console.error("[WORKER] main loop error", (e as Error)?.message ?? e);
            await sleep(2000);
        }
        await sleep(2000);
    }
}

main().catch((e) => {
    console.error("[WORKER] fatal", e);
    process.exit(1);
});
