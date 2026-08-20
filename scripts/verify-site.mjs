import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');
const index = read('index.html');
const expectedTitle = 'Embla — GLP-1 & health tracking that survives a bad week';

function count(text, needle) {
  return text.split(needle).length - 1;
}

assert.equal(count(index, `<title>${expectedTitle}</title>`), 2, 'metadata title must exist in the outer and embedded documents');
assert.equal(count(index, '<meta property=\\"og:title\\"'), 1, 'embedded OG title must be serialized once');
assert.equal(count(index, '<meta property="og:title"'), 1, 'outer OG title must exist once');
assert.match(index, /<meta property="og:image" content="https:\/\/emblahealth\.com\/og\.png">/);
assert.match(index, /<link rel="canonical" href="https:\/\/emblahealth\.com\/">/);
assert.doesNotMatch(index, /<title>Bundled Page<\/title>/);

const templateMatch = index.match(/<script type="__bundler\/template">\s*("(?:[^"\\]|\\[\s\S])*?")\s*<\/script>/);
assert.ok(templateMatch, 'embedded template must be parseable');
const template = JSON.parse(templateMatch[1]);

for (const [label, value] of [
  ['Starting from scratch', 'scratch'],
  ['Recovering after a baby', 'postpartum'],
  ['Recovering from surgery or illness', 'recovering-other'],
  ['Training for something', 'training'],
  ['Keeping something steady', 'steady'],
]) {
  const labelIndex = template.indexOf(`>${label}</span>`);
  assert.ok(labelIndex >= 0, `Q1 label is present: ${label}`);
  const optionStart = template.lastIndexOf('<div data-opt=""', labelIndex);
  assert.match(template.slice(optionStart, labelIndex), new RegExp(`data-value="${value}"`));
}

assert.doesNotMatch(template, /Recovering from something/);
assert.equal(count(template, 'Put me on the day-one list'), 2, 'final CTA must exist in markup and reset behavior');
assert.equal(count(template, '>Join the waitlist</button>'), 1, 'hero submit keeps its original label');
assert.match(template, /data-step="1" data-key="stage"/);
assert.match(template, /subscribe\(c\.input\.value\.trim\(\), c\.hero \? \{ source:getSource\(\) \} : answers/);
assert.match(template, /if\(key\) answers\[key\] = opt\.getAttribute\('data-value'\)/);
assert.match(template, /href="\/privacy\/"/);
assert.match(template, /href="\/terms\/"/);
assert.match(template, /href="mailto:hello@embla\.app"[^>]*>Support<\/a>/);

const waitlistScript = template.match(/<script>\s*(\(function\(\)\{[\s\S]*?\}\)\(\);)\s*<\/script>/)?.[1];
assert.ok(waitlistScript, 'waitlist script must be extractable');
new vm.Script(waitlistScript, { filename: 'embedded-waitlist.js' });

for (const relative of ['privacy/index.html', 'terms/index.html']) {
  const legal = read(relative);
  assert.match(legal, /<title>.+ — Embla<\/title>/);
  assert.match(legal, /hello@embla\.app/);
  assert.match(legal, /<link rel="canonical" href="https:\/\/emblahealth\.com\//);
}

const privacy = read('privacy/index.html');
for (const detail of ['email address', 'questionnaire', 'referral or campaign source', 'do not sell']) {
  assert.match(privacy.toLowerCase(), new RegExp(detail));
}

assert.equal(read('robots.txt'), 'User-agent: *\nAllow: /\nSitemap: https://emblahealth.com/sitemap.xml\n');
const sitemap = read('sitemap.xml');
for (const url of ['https://emblahealth.com/', 'https://emblahealth.com/privacy/', 'https://emblahealth.com/terms/']) {
  assert.match(sitemap, new RegExp(`<loc>${url.replaceAll('/', '\\/')}</loc>`));
}

const png = fs.readFileSync(path.join(root, 'og.png'));
assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
assert.equal(png.readUInt32BE(16), 1200, 'OG image width');
assert.equal(png.readUInt32BE(20), 630, 'OG image height');

console.log('Site verification passed.');
