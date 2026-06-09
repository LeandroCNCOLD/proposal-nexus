import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "fs";

const sb = createClient(
  "https://tptohhpywdmhqdvetedz.supabase.co",
  process.env.NEW_SUPABASE_SERVICE_ROLE_KEY,
);

const manifest = JSON.parse(
  readFileSync("/mnt/documents/migration_storage/storage_manifest.json", "utf8"),
);

const stats = [];
let totalBytes = 0;

for (const bucket of manifest.buckets) {
  let ok = 0, err = 0, bytes = 0;
  const errors = [];
  for (const f of bucket.files) {
    const local = `/mnt/documents/migration_storage/${bucket.name}/${f.path}`;
    if (!existsSync(local)) { err++; errors.push(`MISSING ${f.path}`); continue; }
    const buf = readFileSync(local);
    const { error } = await sb.storage.from(bucket.name).upload(f.path, buf, {
      contentType: f.content_type || "application/octet-stream",
      upsert: true,
    });
    if (error) { err++; errors.push(`${f.path}: ${error.message}`); }
    else { ok++; bytes += buf.length; }
  }
  stats.push({ bucket: bucket.name, ok, err, mb: +(bytes/1024/1024).toFixed(2), errors });
  totalBytes += bytes;
  console.log(`[${bucket.name}] ok=${ok} err=${err} ${(bytes/1024/1024).toFixed(2)} MB`);
  if (errors.length) console.log("  errors:", errors.slice(0,5));
}

console.log("\n=== RESUMO ===");
console.table(stats.map(s => ({ bucket: s.bucket, ok: s.ok, err: s.err, MB: s.mb })));
console.log(`TOTAL: ${stats.reduce((s,x)=>s+x.ok,0)} arquivos, ${(totalBytes/1024/1024).toFixed(2)} MB, ${stats.reduce((s,x)=>s+x.err,0)} erros`);
