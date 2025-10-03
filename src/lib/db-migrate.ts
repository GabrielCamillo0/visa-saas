import fs from "fs";
import "dotenv/config"; 
import path from "path";
import { pool } from "@/lib/db";


async function run() {
const dir = path.join(process.cwd(), "migrations");
const files = fs.readdirSync(dir).filter(f => f.endsWith(".sql")).sort();
console.log("Running migrations:", files);


await pool.query(`
CREATE TABLE IF NOT EXISTS __migrations (
id text PRIMARY KEY,
run_at timestamptz NOT NULL DEFAULT now()
);
`);


for (const file of files) {
const already = await pool.query("SELECT 1 FROM __migrations WHERE id=$1", [file]);
if (already.rowCount) { console.log("- skip", file); continue; }
const sql = fs.readFileSync(path.join(dir, file), "utf8");
console.log("- apply", file);
await pool.query(sql);
await pool.query("INSERT INTO __migrations (id) VALUES ($1)", [file]);
}


await pool.end();
console.log("Migrations done.");
}


run().catch(err => { console.error(err); process.exit(1); });