# Swiss Teletext CLI

A small Node.js CLI for viewing Swiss television teletext pages from `api.teletext.ch`.

## Install

```bash
npm install -g swiss-teletext-cli
```

This installs two commands: `teletext` and `swisstxt`.

## Usage

```bash
teletext 113
```

Print one page and exit:

```bash
teletext 113 --no-interactive
```

Options:

```text
teletext [page] [options]

-c, --channel <name>   Channel, e.g. SRF1, SRF2, RTS1, RSI1 (default: SRF1)
-s, --subpage <n>      Subpage number/index to display
--plain                Disable ANSI colours
--no-interactive       Print one page and exit
```

Interactive keys:

```text
0-9          Type three digits on the page number to jump immediately, e.g. 113
Backspace    Remove typed digit
n / Space    Next page
p            Previous page
r            Refresh
q            Quit
```

## Development

```bash
npm test
node ./bin/teletext.js 113 --no-interactive
```

Requires Node.js 18+.
