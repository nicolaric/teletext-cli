#!/usr/bin/env node

import { stdin as input, stdout as output } from 'node:process';

const API_BASE = 'https://api.teletext.ch/channels';
const DEFAULT_CHANNEL = 'SRF1';
const DEFAULT_PAGE = 100;

const COLORS = {
  0x00: '\x1b[30m', 0x10: '\x1b[30m', // black
  0x01: '\x1b[31m', 0x11: '\x1b[31m', // red
  0x02: '\x1b[32m', 0x12: '\x1b[32m', // green
  0x03: '\x1b[33m', 0x13: '\x1b[33m', // yellow
  0x04: '\x1b[34m', 0x14: '\x1b[34m', // blue
  0x05: '\x1b[35m', 0x15: '\x1b[35m', // magenta
  0x06: '\x1b[36m', 0x16: '\x1b[36m', // cyan
  0x07: '\x1b[37m', 0x17: '\x1b[37m', // white
};

const NATIONAL_CHARS = new Map([
  [0x5b, 'Ä'],
  [0x5c, 'Ö'],
  [0x5d, 'Ü'],
  [0x7b, 'ä'],
  [0x7c, 'ö'],
  [0x7d, 'ü'],
  [0x7e, 'ß'],
]);

function usage(exitCode = 0) {
  console.log(`Swiss Teletext CLI

Usage:
  teletext [page] [options]

Options:
  -c, --channel <name>   Channel, e.g. SRF1, SRF2, RTS1, RSI1 (default: SRF1)
  -s, --subpage <n>      Subpage number/index to display (default: first)
  --plain                Disable ANSI colours
  --no-interactive       Print one page and exit
  -h, --help             Show help

Interactive keys:
  0-9          Type three digits to jump immediately, e.g. 113
  Backspace    Remove typed digit
  n / Space    Next page
  p            Previous page
  r            Refresh
  q            Quit
`);
  process.exit(exitCode);
}

function parseArgs(argv) {
  const opts = {
    channel: DEFAULT_CHANNEL,
    page: DEFAULT_PAGE,
    subpage: undefined,
    color: true,
    interactive: process.stdout.isTTY,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '-h' || arg === '--help') usage(0);
    else if (arg === '-c' || arg === '--channel') opts.channel = requireValue(argv, ++i, arg).toUpperCase();
    else if (arg === '-s' || arg === '--subpage') opts.subpage = Number(requireValue(argv, ++i, arg));
    else if (arg === '--plain') opts.color = false;
    else if (arg === '--no-interactive') opts.interactive = false;
    else if (/^\d{3}$/.test(arg)) opts.page = Number(arg);
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return opts;
}

function requireValue(argv, index, flag) {
  if (index >= argv.length || argv[index].startsWith('-')) throw new Error(`${flag} requires a value`);
  return argv[index];
}

async function fetchPage(channel, page) {
  const url = `${API_BASE}/${encodeURIComponent(channel)}/pages/${encodeURIComponent(page)}`;
  const res = await fetch(url, {
    headers: {
      Accept: 'application/json, text/plain, */*',
      'Accept-Language': 'de-CH,en-US;q=0.9,de;q=0.8',
      Origin: 'https://www.teletext.ch',
      Referer: 'https://www.teletext.ch/',
      'User-Agent': 'Mozilla/5.0 SwissTeletextCLI/0.1',
    },
  });

  if (!res.ok) throw new Error(`HTTP ${res.status} while loading ${channel} ${page}`);
  return res.json();
}

function decodeTeletext(base64, { color = true } = {}) {
  const bytes = Buffer.from(base64, 'base64');
  const lines = [];

  for (let row = 0; row < Math.ceil(bytes.length / 40); row += 1) {
    const start = row * 40;
    const end = Math.min(start + 40, bytes.length);
    let line = color ? '\x1b[37m' : '';
    let graphics = false;

    for (let i = start; i < end; i += 1) {
      const byte = bytes[i];
      if (byte < 0x20) {
        if (byte >= 0x00 && byte <= 0x07) graphics = false; // alpha colour
        if (byte >= 0x10 && byte <= 0x17) graphics = true;  // mosaic graphics colour
        if (color && COLORS[byte]) line += COLORS[byte];
        line += ' '; // Teletext control codes occupy one character cell.
      } else if (graphics && ((byte >= 0x20 && byte <= 0x3f) || (byte >= 0x60 && byte <= 0x7f))) {
        line += byte === 0x20 ? ' ' : '█';
      } else if (byte <= 0x7e) {
        line += NATIONAL_CHARS.get(byte) ?? String.fromCharCode(byte);
      } else {
        line += ' ';
      }
    }

    lines.push(color ? `${line}\x1b[0m` : line);
  }

  return lines;
}

function chooseSubpage(pageData, requested) {
  const subpages = pageData.subpages ?? [];
  if (subpages.length === 0) throw new Error('Page has no subpages');
  if (requested === undefined || Number.isNaN(requested)) return subpages[0];
  return subpages.find((sub) => sub.subpageNumber === requested) ?? subpages[requested] ?? subpages[0];
}

function render(pageData, opts) {
  const subpage = chooseSubpage(pageData, opts.subpage);
  const format = subpage.ep1Info?.data?.ep1Format;
  const title = subpage.ep1Info?.title ?? '';
  const lines = format?.content
    ? decodeTeletext(format.content, { color: opts.color })
    : wrapText(subpage.ep1Info?.contentText ?? '', 40);

  const subpageInfo = (pageData.subpages?.length ?? 0) > 1
    ? ` sub ${subpage.subpageNumber} (${pageData.subpages.length})`
    : '';

  const displayedPage = opts.pageInput ? (opts.pageInput + '___').slice(0, 3) : pageData.pageNumber;
  const header = formatHeader(pageData.channel, displayedPage, title, subpageInfo, opts.color);
  return [
    header,
    '┌' + '─'.repeat(40) + '┐',
    ...lines.map((line) => `│${line}│`),
    '└' + '─'.repeat(40) + '┘',
  ].join('\n');
}

function formatHeader(channel, page, title, subpageInfo, color) {
  const width = 39; // Teletext box width (42), with the rubric inset 3 columns from the right.
  const pageLabel = `${page}${subpageInfo}`;
  const leftPlain = `${channel}  ${pageLabel}`;
  const gap = ' '.repeat(Math.max(1, width - leftPlain.length - title.length));

  if (!color) return `${leftPlain}${gap}${title}`.trimEnd();

  return `\x1b[41;97;1m ${channel} \x1b[0m  \x1b[33;1m${pageLabel}\x1b[0m${gap}\x1b[1m${title}\x1b[0m`;
}

function wrapText(text, width) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const word of words) {
    if ((line + ' ' + word).trim().length > width) {
      lines.push(line.padEnd(width, ' '));
      line = word;
    } else {
      line = (line + ' ' + word).trim();
    }
  }
  if (line) lines.push(line.padEnd(width, ' '));
  return lines;
}

async function show(channel, page, opts) {
  const data = await fetchPage(channel, page);
  if (opts.interactive) console.clear();
  console.log(render(data, opts));
  return data;
}

async function interactive(opts) {
  let channel = opts.channel;
  let page = opts.page;
  let digitBuffer = '';
  let loading = false;
  let lastData;

  const renderStatus = (message = '') => {
    output.write(`\r\x1b[2Kn/Space next  p prev  r refresh  q quit${message ? `   ${message}` : ''}`);
  };

  const redrawCurrentPage = (message = '') => {
    if (opts.interactive) console.clear();
    console.log(render(lastData, { ...opts, pageInput: digitBuffer || undefined }));
    output.write('\n');
    renderStatus(message);
  };

  const showPage = async (message = '') => {
    loading = true;
    try {
      lastData = await show(channel, page, { ...opts, pageInput: undefined });
      output.write('\n');
      renderStatus(message);
    } catch (err) {
      renderStatus(`Error: ${err.message}`);
    } finally {
      loading = false;
    }
  };

  await showPage();

  return new Promise((resolve) => {
    const cleanup = () => {
      input.off('data', onData);
      if (input.isTTY) input.setRawMode(false);
      output.write('\n');
      resolve();
    };

    const onData = async (chunk) => {
      const key = chunk.toString('utf8');
      if (key === '\u0003' || key === 'q') return cleanup(); // Ctrl-C or q
      if (loading) return;

      try {
        if (/^\d$/.test(key)) {
          digitBuffer += key;
          redrawCurrentPage();
          if (digitBuffer.length === 3) {
            page = Number(digitBuffer);
            digitBuffer = '';
            await showPage();
          }
        } else if (key === '\b' || key === '\x7f') {
          digitBuffer = digitBuffer.slice(0, -1);
          redrawCurrentPage();
        } else if (key === 'n' || key === ' ') {
          digitBuffer = '';
          page = lastData?.nextPage ?? page + 1;
          await showPage();
        } else if (key === 'p') {
          digitBuffer = '';
          page = lastData?.previousPage ?? page - 1;
          await showPage();
        } else if (key === 'r') {
          digitBuffer = '';
          await showPage();
        }
      } catch (err) {
        renderStatus(`Error: ${err.message}`);
      }
    };

    if (input.isTTY) input.setRawMode(true);
    input.resume();
    input.on('data', onData);
  });
}

async function main() {
  try {
    const opts = parseArgs(process.argv.slice(2));
    if (opts.interactive) await interactive(opts);
    else await show(opts.channel, opts.page, opts);
  } catch (err) {
    console.error(`teletext: ${err.message}`);
    process.exit(1);
  }
}

main();
