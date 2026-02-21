import { Pool } from 'pg';
import type { QueryResult, QueryResultRow } from 'pg';
export declare const pool: Pool;
export declare const query: <T extends QueryResultRow = QueryResultRow>(text: string, params?: unknown[]) => Promise<QueryResult<T>>;
//# sourceMappingURL=db.d.ts.map