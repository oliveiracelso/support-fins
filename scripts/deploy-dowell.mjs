import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
process.chdir(root);
const profile = 'celsoetnrlz', region = 'us-east-1', stackName = 'DowellStudio-prod';
function aws(args) {
  const output = execFileSync('aws', [...args, '--profile', profile, '--region', region, '--output', 'json'], {
    encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 8 * 1024 * 1024,
  });
  return output.trim() ? JSON.parse(output) : {};
}
if (aws(['sts', 'get-caller-identity']).Account !== '464899062437') throw new Error('Unexpected AWS account');
const stack = aws(['cloudformation', 'describe-stacks', '--stack-name', stackName]).Stacks[0];
if (!['CREATE_COMPLETE', 'UPDATE_COMPLETE'].includes(stack.StackStatus)) throw new Error(`Stack not ready: ${stack.StackStatus}`);
const outputs = Object.fromEntries(stack.Outputs.map(x => [x.OutputKey, x.OutputValue]));
if (outputs.Url !== 'https://dowell.etnrlz.com') throw new Error('Unexpected deployment URL');
const distribution = aws(['cloudfront', 'get-distribution-config', '--id', outputs.DistributionId]).DistributionConfig;
const behavior = distribution.CacheBehaviors.Items.find(x => x.PathPattern === '/support-fins*');
if (!behavior) throw new Error('Deploy dowell-studio infrastructure first');
const headers = aws(['cloudfront', 'get-response-headers-policy', '--id', behavior.ResponseHeadersPolicyId]);
const html = readFileSync('web/index.html', 'utf8').replace(/\r\n/g, '\n');
const map = html.match(/<script type="importmap">([\s\S]*?)<\/script>/)?.[1];
if (!map) throw new Error('Import map missing');
const hash = createHash('sha256').update(map).digest('base64');
if (!headers.ResponseHeadersPolicy.ResponseHeadersPolicyConfig.SecurityHeadersConfig.ContentSecurityPolicy.ContentSecurityPolicy.includes(`'sha256-${hash}'`)) {
  throw new Error('Import map changed: deploy dowell-studio infrastructure first');
}
// Fixed subdirectory: never sync/delete the root dashboard, its API or private files.
const destination = `s3://${outputs.WebBucket}/support-fins/`;
execFileSync('aws', ['s3', 'sync', 'web/', destination, '--exclude', '_headers', '--no-follow-symlinks',
  '--cache-control', 'public,max-age=60', '--only-show-errors', '--profile', profile, '--region', region], { stdio: 'inherit' });
// Windows MIME databases differ; WebAssembly streaming requires this content type.
aws(['s3', 'cp', 'web/vendor/occt-import-js-0.0.23/occt-import-js.wasm', `${destination}vendor/occt-import-js-0.0.23/occt-import-js.wasm`,
  '--content-type', 'application/wasm', '--cache-control', 'public,max-age=60', '--only-show-errors']);
const invalidation = aws(['cloudfront', 'create-invalidation', '--distribution-id', outputs.DistributionId, '--paths', '/support-fins*']);
const result = {
  url: `${outputs.Url}/support-fins/`, at: new Date().toISOString(),
  commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  indexSha256: createHash('sha256').update(readFileSync('web/index.html')).digest('hex'),
  invalidationId: invalidation.Invalidation.Id,
};
mkdirSync('.local', { recursive: true });
writeFileSync('.local/deployment.json', JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
