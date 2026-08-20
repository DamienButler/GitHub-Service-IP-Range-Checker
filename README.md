# GitHub Meta IP Checker

A client-side web application hosted on GitHub Pages that checks whether an IP address or CIDR range exists within GitHub's infrastructure IP ranges.

**Live site:** https://damienbutler.github.io/GitHub-Service-IP-Range-Checker/

## Features

### Single Lookup
- Enter any IPv4 or IPv6 address (or CIDR range) to check if it belongs to GitHub
- Returns every matching CIDR range and the GitHub service it belongs to (Actions, Pages, Copilot, API, etc.)
- Handles range-to-range overlap detection, not just single-IP containment

### Bulk Check
- Paste a list of IP addresses / CIDR ranges separated by **commas, spaces, tabs, semicolons, or new lines**
- **Upload** a `.txt`, `.csv`, or `.list` file, or **drag & drop** a file onto the input area
- Lines beginning with `#` or `//` are treated as comments and ignored (so exported files with headers work as-is)
- Duplicate entries are automatically de-duplicated
- Results are shown in a colour-coded table:

| Status | Colour | Meaning |
|---|---|---|
| **In Range** | 🟢 Green | Matched GitHub ranges — shows service badge(s) and matched CIDR(s) |
| **Not In Range** | 🔴 Red | Valid IP/CIDR, but not part of GitHub's infrastructure |
| **Invalid** | 🟠 Orange | Not a parseable IP address or CIDR range |

- Summary bar showing totals: `X checked · Y in range · Z not in range · N invalid`
- Export bulk results as **CSV** or **JSON** for audit reporting

### Services Overview
- Expandable accordion cards for each GitHub service showing range counts
- Displays the first 50 ranges per service, with a link to the full Meta API response
- Per-service and "all services" export in **JSON**, **CSV**, and **TXT** formats

#### Export format guidance

| Format | Best for |
|---|---|
| **JSON** | Automation — Azure CLI/PowerShell (`ConvertFrom-Json`), AWS Boto3, Terraform (`jsondecode()`), `jq` |
| **CSV** | Manual review in Excel/Sheets, or firewall/SIEM UIs that accept CSV upload |
| **TXT** | Direct import into network appliances (Palo Alto, Fortinet, pfSense, iptables) and shell scripts — one CIDR per line |

### Daily Monitoring
- A GitHub Actions workflow runs daily to track changes to the Meta API endpoint
- Added and removed IP ranges are recorded with the date and affected service
- Viewable in the **Recent Updates** tab as an audit trail

### Privacy
- Runs **entirely client-side** — no backend, no logging, no telemetry
- The only external request is to GitHub's public Meta API

## How It Works

1. The app fetches data directly from [`https://api.github.com/meta`](https://api.github.com/meta) in your browser
2. IP/CIDR matching is performed entirely client-side using JavaScript (IPv4 via bitwise integer math, IPv6 via `BigInt`)
3. A daily GitHub Actions cron job compares the current Meta API response with a stored snapshot
4. Any changes (added/removed IP ranges) are committed to `data/updates.json` and displayed in the app

## Setup for GitHub Pages

1. Push this repository to GitHub
2. Go to **Settings → Pages**
3. Set the source to **Deploy from a branch** → `main` → `/ (root)`
4. The site will be available at `https://<username>.github.io/<repo-name>/`

## Setup Daily Monitoring

The GitHub Actions workflow (`.github/workflows/monitor-meta.yml`) will automatically:
- Run daily at 06:00 UTC
- Fetch the latest GitHub Meta API data
- Compare with the previous snapshot
- Commit any changes to the `data/` directory

To initialize the first snapshot, manually trigger the workflow:
1. Go to **Actions → Daily GitHub Meta IP Monitor**
2. Click **Run workflow**

## Automated Checks

| Workflow | Trigger | Purpose |
|---|---|---|
| `monitor-meta.yml` | Daily 06:00 UTC + manual | Tracks changes to the GitHub Meta API |
| `codeql.yml` | Push / PR to `main` + weekly | Static analysis for security vulnerabilities (CodeQL, `security-and-quality` suite) |
| `code-quality.yml` | Push / PR to `main` | ESLint linting, JSON validation, secret scanning (Gitleaks) |

## Project Structure

```
MetaIPCheck/
├── index.html                          # Main HTML page
├── css/
│   └── style.css                       # Styles (GitHub dark theme)
├── js/
│   ├── ip-utils.js                     # IPv4/IPv6 CIDR matching logic
│   └── app.js                          # Main application logic
├── data/
│   ├── meta-snapshot.json              # Latest Meta API snapshot
│   └── updates.json                    # Change history
├── eslint.config.js                    # ESLint rules (CI only)
└── .github/
    ├── dependabot.yml                  # Keeps GitHub Actions up to date
    └── workflows/
        ├── monitor-meta.yml            # Daily Meta API monitoring
        ├── codeql.yml                  # CodeQL security scanning
        └── code-quality.yml            # Lint, validate, secret scan
```

## Security

This application runs **entirely client-side**. No IP addresses or search queries are logged or transmitted to any server. The only external API call is to GitHub's public Meta API endpoint.

### Dependency posture

The shipped application has **zero third-party runtime dependencies** — no frameworks, no CDN scripts, no npm packages. All IP parsing and CIDR matching is hand-written vanilla JavaScript. This removes the entire third-party supply-chain attack surface from the delivered site.

The only dependency surface is the **GitHub Actions** used by the CI workflows. These are monitored by Dependabot (`.github/dependabot.yml`), which opens a pull request weekly when a newer action version is published — catching deprecations such as the Node 20 → Node 24 runner migration before they break the build.

ESLint is fetched at CI runtime via `npx` and is never committed or shipped.

### Automated scanning

| Tool | What it checks |
|---|---|
| **CodeQL** | Semantic static analysis using the `security-and-quality` query suite — flags injection risks, unsafe DOM handling, and logic errors |
| **Gitleaks** | Scans full commit history for accidentally committed secrets and credentials |
| **ESLint** | Code quality plus security-adjacent rules (`no-eval`, `no-implied-eval`, `no-new-func`, `no-script-url`) |
| **Dependabot** | Weekly checks for outdated or deprecated GitHub Actions |

## License

MIT
