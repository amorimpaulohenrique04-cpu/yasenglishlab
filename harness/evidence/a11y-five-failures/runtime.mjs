import { execFileSync, spawn } from 'node:child_process';
import { writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
const path = join(tmpdir(), 'yas-a11y-runtime.json');
if (process.argv[2] === 'prepare') {
  const output = execFileSync('C:/Users/PAULO HENRIQUE/scoop/apps/supabase/current/supabase.exe', ['status', '-o', 'env'], {encoding:'utf8'});
  const local = Object.fromEntries(output.split(/\r?\n/).filter(l=>l.includes('=')).map(l=>{const i=l.indexOf('='); return [l.slice(0,i),l.slice(i+1).replace(/^"|"$/g,'')]}));
  const env = { ...process.env, APP_URL:'http://127.0.0.1:3000', NEXT_PUBLIC_SUPABASE_URL:local.API_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:local.PUBLISHABLE_KEY ?? local.ANON_KEY, SUPABASE_SERVICE_ROLE_KEY:local.SECRET_KEY ?? local.SERVICE_ROLE_KEY, SUPABASE_PROTECTED_ASSETS_BUCKET:'yas-protected-assets', DATABASE_URL:local.DB_URL, CANONICAL_E2E:'1', CANONICAL_E2E_PASSWORD:randomBytes(30).toString('base64url') };
  writeFileSync(path, JSON.stringify(env));
  const child=spawn(process.execPath,['scripts/setup-canonical-e2e.mjs'],{env,stdio:'inherit'});
  child.on('exit',code=>process.exit(code??1));
} else {
  const env=JSON.parse(readFileSync(path,'utf8'));
  const args=process.argv[2]==='server' ? ['node_modules/next/dist/bin/next','dev','--hostname','127.0.0.1','--port','3000'] : process.argv.slice(2);
  const child=process.argv[2]==='a11y'
    ? spawn('npm.cmd',['run','test:a11y'],{env,stdio:'inherit',shell:true})
    : spawn(process.execPath,args,{env,stdio:'inherit'});
  child.on('exit',code=>process.exit(code??1));
}
