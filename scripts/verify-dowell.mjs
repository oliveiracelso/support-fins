import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

process.chdir(fileURLToPath(new URL('../', import.meta.url)));
const origin = 'https://dowell.etnrlz.com';
const digest = value => createHash('sha256').update(value).digest('hex');
const home = await fetch(origin + '/');
assert.equal(home.status, 200);
assert.match(await home.text(), /<title>Dowell Studio<\/title>/);
assert.ok(!home.headers.get('content-security-policy').includes('unsafe-eval'));
assert.equal((await fetch(origin + '/api/state')).status, 401);
const redirect = await fetch(origin + '/support-fins?stl=example.stl', { redirect: 'manual' });
assert.equal(redirect.status, 302);
assert.equal(redirect.headers.get('location'), '/support-fins/?stl=example.stl');
const page = await fetch(origin + '/support-fins/');
assert.equal(page.status, 200);
const html = await page.text();
assert.equal(digest(Buffer.from(html)), digest(readFileSync('web/index.html')));
const map = html.replace(/\r\n/g, '\n').match(/<script type="importmap">([\s\S]*?)<\/script>/)[1];
const hash = createHash('sha256').update(map).digest('base64');
assert.ok(page.headers.get('content-security-policy').includes(`'sha256-${hash}'`));
assert.ok(!page.headers.get('content-security-policy').includes('unsafe-eval'));
const files = execFileSync('git', ['ls-files', 'web'], { encoding: 'utf8' }).trim().split(/\r?\n/).filter(f => f !== 'web/_headers');
const verified = [];
for (let i = 0; i < files.length; i += 5) {
  await Promise.all(files.slice(i, i + 5).map(async file => {
    const path = file.slice(4);
    const response = await fetch(`${origin}/support-fins/${path}`);
    assert.equal(response.status, 200, path);
    const content = Buffer.from(await response.arrayBuffer());
    assert.equal(digest(content), digest(readFileSync(file)), `Content mismatch: ${path}`);
    if (path.endsWith('.js')) assert.match(response.headers.get('content-type'), /(?:javascript|ecmascript)/, path);
    if (path.endsWith('.wasm')) assert.match(response.headers.get('content-type'), /^application\/wasm/);
    if (path === 'stepworker.js') assert.ok(response.headers.get('content-security-policy').includes("'unsafe-eval'"));
    verified.push(path);
  }));
}
const result = { at: new Date().toISOString(), url: origin + '/support-fins/',
  filesVerified: verified.length, exactContent: true, importMapCsp: true, stepWorkerCsp: true,
  wasmMime: true, slashRedirect: true, dashboardAvailable: true, privateApiRejectsAnonymous: true };
mkdirSync('.local', { recursive: true });
writeFileSync('.local/verification.json', JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
