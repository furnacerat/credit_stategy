import "dotenv/config";
import { pool } from "./db.js";
import { r2, R2_BUCKET } from "./r2.js";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { PDFParse } from "pdf-parse";
import { analyzeCreditText } from "./analyzeCreditText.js";

async function sleep(ms: number) {
    await new Promise((r) => setTimeout(r, ms));
}

// S3 Body can be a variety of stream types depending on the environment
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function streamToBuffer(stream: any): Promise<Buffer> {
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(Buffer.from(chunk));
    return Buffer.concat(chunks);
}

/**
 * Functional wrapper for PDFParse class logic
 */
async function pdfParse(data: Buffer) {
    const parser = new PDFParse({ data });
    const result = await parser.getText();
    await parser.destroy();
    return result;
}

async function runOnce() {
    // pick 1 job safely
    const jobPick = await pool.query(
        `select id, report_id, user_id
     from jobs
     where status='queued'
     order by created_at asc
     limit 1
     for update skip locked`
    );

    if (!jobPick.rowCount) {
        console.log("[WORKER] no queued jobs found");
        return;
    }

    const job = jobPick.rows[0];
    console.log("[WORKER] picked job", { jobId: job.id, report_id: job.report_id, user_id: job.user_id });

    try {
        // 1) Look up the report to get file_key + filename
        const rep = await pool.query(
            `select file_key, filename from reports where id=$1 and user_id=$2`,
            [job.report_id, job.user_id]
        );
        if (!rep.rowCount) throw new Error("report_not_found");

        const { file_key } = rep.rows[0];

        await pool.query(`update jobs set status='processing', progress='Downloading', updated_at=now() where id=$1`, [job.id]);

        // 2) Download PDF bytes from R2
        const obj = await r2.send(new GetObjectCommand({ Bucket: R2_BUCKET, Key: file_key }));
        if (!obj.Body) throw new Error("r2_empty_body");

        const pdfBuffer = await streamToBuffer(obj.Body);
        console.log("[WORKER] downloaded bytes:", pdfBuffer.length);

        await pool.query(`update jobs set status='processing', progress='Parsing', updated_at=now() where id=$1`, [job.id]);

        // Parse PDF
        const parsed = await pdfParse(pdfBuffer);
        const text = parsed.text || "";
        console.log("[WORKER] extracted chars:", text.length);

        await pool.query(`update jobs set status='processing', progress='Analyzing', updated_at=now() where id=$1`, [job.id]);

        // 3) AI Analysis
        const analysis = await analyzeCreditText(text);

        await pool.query(
            `insert into analysis_results (report_id, user_id, result_json)
         values ($1,$2,$3)
         on conflict (report_id) do update set result_json=excluded.result_json, created_at=now()`,
            [job.report_id, job.user_id, analysis]
        );

        await pool.query(`update jobs set status='complete', progress='Complete', updated_at=now() where id=$1`, [job.id]);
    } catch (e: unknown) {
        const msg = (e as Error)?.message ?? "worker_error";
        console.error(`[WORKER] job ${job.id} failed:`, msg);
        await pool.query(`update jobs set status='failed', progress='Error', error=$2, updated_at=now() where id=$1`, [
            job.id,
            msg,
        ]);
    }
}

async function main() {
    console.log("[WORKER] started");
    while (true) {
        try {
            console.log("[WORKER] checking for queued jobs...");
            await pool.query("begin");
            await runOnce();
            await pool.query("commit");
        } catch (e: unknown) {
            await pool.query("rollback");
            console.error("[WORKER] error", (e as Error)?.message ?? e);
            await sleep(2000);
        }
        await sleep(1000);
    }
}

main().catch((e) => {
    console.error("[WORKER] fatal", e);
    process.exit(1);
});
