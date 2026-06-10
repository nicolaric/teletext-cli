# Swiss Teletext CLI

A small Node.js CLI for viewing Swiss television teletext pages from `api.teletext.ch`.

## Usage

```bash
node ./bin/teletext.js 113 --no-interactive
```

Or install/link it locally:

```bash
npm link
teletext 113
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

Requires Node.js 18+.
