import dotenv from "dotenv";
import { pool } from "./db.js";

dotenv.config();

async function sleep(ms: number) {
    await new Promise((r) => setTimeout(r, ms));
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

    if (!jobPick.rowCount) return;

    const job = jobPick.rows[0];

    await pool.query(`update jobs set status='processing', progress='Analyzing', updated_at=now() where id=$1`, [job.id]);

    // simulate some work
    await sleep(1500);

    const demoResult = {
        score_estimate: 642,
        issues_count: 7,
        top_issues: [
            { type: "utilization", severity: "high", impact_points: -45 },
            { type: "late_payment", severity: "high", impact_points: -35 },
        ],
        next_best_action: "Dispute inaccurate late payment on Account X",
    };

    await pool.query(
        `insert into analysis_results (report_id, user_id, result_json)
     values ($1,$2,$3)
     on conflict (report_id) do update set result_json=excluded.result_json, created_at=now()`,
        [job.report_id, job.user_id, demoResult]
    );

    await pool.query(`update jobs set status='complete', progress='Complete', updated_at=now() where id=$1`, [job.id]);
}

async function main() {
    console.log("[WORKER] started");
    while (true) {
        try {
            await pool.query("begin");
            await runOnce();
            await pool.query("commit");
        } catch (e: any) {
            await pool.query("rollback");
            console.error("[WORKER] error", e?.message ?? e);
            await sleep(2000);
        }
        await sleep(1000);
    }
}

main().catch((e) => {
    console.error("[WORKER] fatal", e);
    process.exit(1);
});
