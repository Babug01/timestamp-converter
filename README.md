# Timestamp Converter

**Live demo:** https://babug01.github.io/timestamp-converter/

Convert between Unix timestamps and human-readable dates in either direction, across nine
timezones, with a live-ticking current-time display. Runs entirely in the browser; nothing you
enter ever leaves your machine.

## Features

- **Bidirectional conversion** — type a Unix timestamp or a human date/time and the other side
  updates immediately
- **Auto-detects seconds vs. milliseconds** by digit count (10 digits ≈ seconds, 13 ≈ milliseconds)
- **Nine timezones** via `Intl.DateTimeFormat`: UTC, your browser's local zone, America/New York,
  America/Los Angeles, Europe/Amsterdam, Europe/London, Asia/Kolkata, Asia/Singapore, and
  Australia/Sydney — each shown as a correctly-offset ISO 8601 string, DST included
- **ISO 8601 in UTC and in the selected zone**, side by side
- **Plain-language relative time** ("3 hours ago" / "in 2 days"), via `Intl.RelativeTimeFormat`
- **Live-ticking current time**, in both Unix and ISO form, updating every second

## Why I built this

Every log line, API response, and database row seems to use a different timestamp convention
(seconds vs. ms, UTC vs. local), and epochconverter.com doesn't make multi-timezone comparison or
the digit-count gotcha obvious. This is also one piece of a larger internal DevOps tool I built at
work consolidating the utility pages a platform engineer reaches for daily into one place — this
repo is the timestamp converter piece, cleaned up and open-sourced on its own.

## Tech Stack

- [React](https://react.dev/) + [Vite](https://vitejs.dev/) — no other runtime dependencies;
  timezone conversion is hand-written on top of the built-in `Intl` API (no date library)

## Running locally

```bash
git clone https://github.com/Babug01/timestamp-converter.git
cd timestamp-converter
npm install
npm run dev
```

## License

MIT — see [LICENSE](LICENSE).
