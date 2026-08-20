import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const indexPath = path.join(root, 'index.html');
const title = 'Embla — GLP-1 & health tracking that survives a bad week';
const description = 'Shots, protein, water, sleep — one place, five seconds a day, no streaks. Built for women with more on than time. Join the day-one waitlist.';
const ogDescription = 'Shots, protein, water, sleep — one place, five seconds a day, no streaks. Join the day-one waitlist.';

function metadata(indent = '  ') {
  return [
    `<title>${title}</title>`,
    `<meta name="description" content="${description}">`,
    '<meta name="theme-color" content="#F6EEEB">',
    `<meta property="og:title" content="${title}">`,
    `<meta property="og:description" content="${ogDescription}">`,
    '<meta property="og:type" content="website">',
    '<meta property="og:url" content="https://emblahealth.com/">',
    '<meta property="og:image" content="https://emblahealth.com/og.png">',
    '<meta property="og:image:width" content="1200">',
    '<meta property="og:image:height" content="630">',
    '<meta property="og:image:alt" content="Embla — GLP-1 and health tracking that survives a bad week">',
    '<meta name="twitter:card" content="summary_large_image">',
    `<meta name="twitter:title" content="${title}">`,
    `<meta name="twitter:description" content="${ogDescription}">`,
    '<meta name="twitter:image" content="https://emblahealth.com/og.png">',
    '<link rel="canonical" href="https://emblahealth.com/">',
  ].map((line) => `${indent}${line}`).join('\n');
}

function replaceOnce(text, before, after, label) {
  const count = text.split(before).length - 1;
  if (count !== 1) throw new Error(`${label}: expected one match, found ${count}`);
  return text.replace(before, after);
}

function addOptionValue(template, label, value) {
  const labelNeedle = `>${label}</span>`;
  const labelIndex = template.indexOf(labelNeedle);
  if (labelIndex < 0 || template.indexOf(labelNeedle, labelIndex + 1) >= 0) {
    throw new Error(`option ${label}: expected exactly one label`);
  }
  const openIndex = template.lastIndexOf('<div data-opt=""', labelIndex);
  if (openIndex < 0) throw new Error(`option ${label}: missing data-opt container`);
  const insertion = openIndex + '<div data-opt=""'.length;
  if (template.slice(insertion, insertion + 12).startsWith(' data-value=')) return template;
  return `${template.slice(0, insertion)} data-value="${value}"${template.slice(insertion)}`;
}

let page = fs.readFileSync(indexPath, 'utf8');

if (page.includes('<title>Bundled Page</title>')) {
  page = replaceOnce(page, '  <title>Bundled Page</title>', metadata('  '), 'outer metadata');
} else if (!page.includes(`<title>${title}</title>`)) {
  throw new Error('outer metadata: neither starter nor Embla title was found');
}

const templatePattern = /(<script type="__bundler\/template">\s*)("(?:[^"\\]|\\[\s\S])*?")(\s*<\/script>)/;
const match = page.match(templatePattern);
if (!match) throw new Error('embedded bundle template was not found');

let template = JSON.parse(match[2]);

if (!template.includes(`<title>${title}</title>`)) {
  template = replaceOnce(
    template,
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<meta name="viewport" content="width=device-width, initial-scale=1">\n${metadata('')}`,
    'embedded metadata',
  );
}

template = template.replace(
  "  /* Quiz answers are collected in `answers` but intentionally NOT sent to Mailchimp.\n     To store them later: create text merge fields with these tags in the audience\n     and pass them through extraFn in boot(). */\n",
  "  /* Questionnaire answers and the referral source are sent as Mailchimp merge fields. */\n",
);

if (template.includes('  var answers = {};')) {
  template = replaceOnce(
    template,
    '  var answers = {};',
    `  function getSource(){\n    var p = new URLSearchParams(window.location.search);\n    return p.get('ref') || p.get('utm_source') || p.get('utm_campaign') || p.get('utm_medium') || 'direct';\n  }\n\n  var answers = { source: getSource() };`,
    'source capture',
  );
}

template = template.replace(
  "    c.button.textContent = 'Join the waitlist';",
  "    c.button.textContent = c.hero ? 'Join the waitlist' : 'Put me on the day-one list';",
);
template = template.replace(
  '    subscribe(c.input.value.trim(), null, function(res){',
  '    subscribe(c.input.value.trim(), c.hero ? { source:getSource() } : answers, function(res){',
);
template = template.replace(
  "      answers[panel.getAttribute('data-step')] = (opt.querySelector('span') ? opt.querySelector('span').textContent : opt.textContent).trim();",
  "      var key = panel.getAttribute('data-key');\n      if(key) answers[key] = opt.getAttribute('data-value') || (opt.querySelector('span') ? opt.querySelector('span').textContent : opt.textContent).trim();",
);

template = template.replace('<div data-step="1" style=', '<div data-step="1" data-key="stage" style=');
template = template.replace('<div data-step="2" style=', '<div data-step="2" data-key="hardest" style=');
template = template.replace('<div data-step="3" style=', '<div data-step="3" data-key="meds" style=');

const optionValues = [
  ['Starting from scratch', 'scratch'],
  ['Recovering after a baby', 'postpartum'],
  ['Recovering from surgery or illness', 'recovering-other'],
  ['Training for something', 'training'],
  ['Keeping something steady', 'steady'],
  ['Managing diet', 'eating'],
  ['Finding any time to move', 'moving'],
  ['Sleep, or the lack of it', 'sleep'],
  ['Feeling like myself again', 'myself-again'],
  ['A weekly injectable', 'weekly'],
  ['Something daily', 'daily'],
  ['About to start one', 'starting-soon'],
  ['No, none', 'none'],
  ['Rather not say', 'undisclosed'],
];

if (template.includes('Recovering from something')) {
  template = replaceOnce(
    template,
    '<span style="font-size:15px; font-weight:600; flex:1">Recovering from something</span>',
    '<span style="font-size:15px; font-weight:600; flex:1">Recovering after a baby</span>\n            </div>\n            <div data-opt="" style="background:#FFFFFF; border:1px solid #E7D9D4; border-radius:12px; padding:14px 16px; cursor:pointer; display:flex; align-items:center; gap:12px; transition:background .14s ease-out, border-color .14s ease-out" style-hover="border-color:#834E5C">\n              <span style="font-size:15px; font-weight:600; flex:1">Recovering from surgery or illness</span>',
    'Q1 recovery split',
  );
}

for (const [label, value] of optionValues) template = addOptionValue(template, label, value);

template = template.replace(
  '<button data-submit="" style="height:50px;',
  '<button data-submit="" style="height:50px;',
).replace(
  '>Join the waitlist</button>\n            </div>\n            <div data-note="" style="font-size:12.5px; font-weight:500; color:#6E5259">No spam, no sharing your address.</div>',
  '>Put me on the day-one list</button>\n            </div>\n            <div data-note="" style="font-size:12.5px; font-weight:500; color:#6E5259">No spam, no sharing your address.</div>',
);

template = template.replace(
  '<a href="#privacy" style="font-size:13.5px; font-weight:600; color:#6E5259">Privacy</a>\n          <a href="#waitlist" style="font-size:13.5px; font-weight:600; color:#6E5259">Terms</a>\n          <a href="#waitlist" style="font-size:13.5px; font-weight:600; color:#6E5259">Support</a>',
  '<a href="/privacy/" style="font-size:13.5px; font-weight:600; color:#6E5259">Privacy</a>\n          <a href="/terms/" style="font-size:13.5px; font-weight:600; color:#6E5259">Terms</a>\n          <a href="mailto:hello@embla.app" style="font-size:13.5px; font-weight:600; color:#6E5259">Support</a>',
);

const required = [
  `<title>${title}</title>`,
  'Put me on the day-one list',
  'data-key="stage"',
  'data-value="postpartum"',
  'data-value="recovering-other"',
  'c.hero ? { source:getSource() } : answers',
  'href="/privacy/"',
  'href="/terms/"',
];
for (const needle of required) {
  if (!template.includes(needle)) throw new Error(`postcondition failed: ${needle}`);
}
if (template.includes('Recovering from something')) throw new Error('old Q1 recovery option remains');

const embedded = JSON.stringify(template);
page = page.replace(templatePattern, (_whole, open, _oldTemplate, close) => `${open}${embedded}${close}`);
fs.writeFileSync(indexPath, page);
console.log('Patched generated Embla bundle successfully.');
