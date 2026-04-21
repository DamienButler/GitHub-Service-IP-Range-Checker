# GitHub Meta IP Checker

A client-side web application hosted on GitHub Pages that checks whether an IP address or CIDR range exists within GitHub's infrastructure IP ranges.

## Features

- **IP/CIDR Lookup** — Enter any IPv4 or IPv6 address (or CIDR range) to check if it belongs to GitHub
- **Service Identification** — Shows which GitHub service(s) the IP belongs to (Actions, Pages, Copilot, API, etc.)
- **Daily Monitoring** — A GitHub Actions workflow runs daily to track changes to the Meta API endpoint
- **Update History** — View a timeline of IP range additions and removals with affected services
- **Fully Client-Side** — All lookups run in your browser; no data is sent to any backend

## How It Works

1. The app fetches data directly from [`https://api.github.com/meta`](https://api.github.com/meta) in your browser
2. IP/CIDR matching is performed entirely client-side using JavaScript
3. A daily GitHub Actions cron job compares the current Meta API response with a stored snapshot
4. Any changes (added/removed IP ranges) are committed to `data/updates.json` and displayed in the app

## Setup for GitHub Pages

1. Push this repository to GitHub
2. Go to **Settings → Pages**
3. Set the source to **Deploy from a branch** → `main` → `/ (root)`
4. The site will be available at `https://<username>.github.io/MetaIPCheck/`

## Setup Daily Monitoring

The GitHub Actions workflow (`.github/workflows/monitor-meta.yml`) will automatically:
- Run daily at 06:00 UTC
- Fetch the latest GitHub Meta API data
- Compare with the previous snapshot
- Commit any changes to the `data/` directory

To initialize the first snapshot, manually trigger the workflow:
1. Go to **Actions → Daily GitHub Meta IP Monitor**
2. Click **Run workflow**

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
└── .github/
    └── workflows/
        └── monitor-meta.yml            # Daily monitoring workflow
```

## Security

This application runs **entirely client-side**. No IP addresses or search queries are logged or transmitted to any server. The only external API call is to GitHub's public Meta API endpoint.

## License

MIT
