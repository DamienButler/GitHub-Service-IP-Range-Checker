/**
 * GitHub Meta IP Checker - Main Application
 * Fetches GitHub Meta API data and performs client-side IP lookups
 */

(function () {
    'use strict';

    // ===== Configuration =====
    const META_API_URL = 'https://api.github.com/meta';
    const UPDATES_DATA_URL = 'data/updates.json';

    // Services that contain IP ranges (keys in the meta JSON that hold arrays of CIDR strings)
    const IP_SERVICES = [
        'hooks', 'web', 'api', 'git', 'github_enterprise_importer',
        'packages', 'pages', 'importer', 'actions', 'actions_macos',
        'codespaces', 'copilot', 'dependabot'
    ];

    // ===== State =====
    let metaData = null;
    let updatesData = null;

    // ===== DOM Elements =====
    const ipInput = document.getElementById('ip-input');
    const searchBtn = document.getElementById('search-btn');
    const clearBtn = document.getElementById('clear-btn');
    const resultsSection = document.getElementById('results-section');
    const resultsContainer = document.getElementById('results-container');
    const servicesGrid = document.getElementById('services-grid');
    const updatesContainer = document.getElementById('updates-container');
    const apiStatus = document.getElementById('api-status');
    const statusDot = document.querySelector('.status-dot');

    // ===== Initialization =====
    async function init() {
        bindEvents();
        await Promise.all([
            fetchMetaData(),
            fetchUpdatesData()
        ]);
    }

    function bindEvents() {
        searchBtn.addEventListener('click', performSearch);
        ipInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') performSearch();
        });
        ipInput.addEventListener('input', () => {
            clearBtn.classList.toggle('hidden', !ipInput.value);
        });
        clearBtn.addEventListener('click', () => {
            ipInput.value = '';
            clearBtn.classList.add('hidden');
            resultsSection.classList.add('hidden');
            ipInput.focus();
        });

        // Hint chips
        document.querySelectorAll('.hint-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                ipInput.value = chip.dataset.ip;
                clearBtn.classList.remove('hidden');
                performSearch();
            });
        });

        // Tabs
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
                btn.classList.add('active');
                document.getElementById(`${btn.dataset.tab}-tab`).classList.add('active');
            });
        });
    }

    // ===== Data Fetching =====
    async function fetchMetaData() {
        try {
            const response = await fetch(META_API_URL);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            metaData = await response.json();
            statusDot.classList.add('connected');
            statusDot.classList.remove('error');
            apiStatus.textContent = 'API Connected';
            renderServicesOverview();
        } catch (err) {
            console.error('Failed to fetch meta data:', err);
            statusDot.classList.add('error');
            statusDot.classList.remove('connected');
            apiStatus.textContent = 'API Error';
            servicesGrid.innerHTML = `
                <div class="loading-placeholder">
                    <p>⚠️ Failed to load GitHub Meta API. <br>
                    <a href="${META_API_URL}" target="_blank">Check API directly</a></p>
                </div>`;
        }
    }

    async function fetchUpdatesData() {
        try {
            const response = await fetch(UPDATES_DATA_URL);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            updatesData = await response.json();
            renderUpdates();
        } catch (err) {
            console.warn('No updates data available:', err.message);
            updatesData = [];
            renderUpdates();
        }
    }

    // ===== Search =====
    function performSearch() {
        const input = ipInput.value.trim();

        if (!input) {
            showError('Please enter an IP address or CIDR range.');
            return;
        }

        if (!IPUtils.isValidInput(input)) {
            showError('Invalid IP address or CIDR range. Please enter a valid IPv4 or IPv6 address.');
            return;
        }

        if (!metaData) {
            showError('GitHub Meta data is still loading. Please try again in a moment.');
            return;
        }

        const matches = findMatches(input);
        renderResults(input, matches);
    }

    function findMatches(input) {
        const results = [];

        for (const service of IP_SERVICES) {
            const ranges = metaData[service];
            if (!Array.isArray(ranges)) continue;

            for (const cidr of ranges) {
                if (IPUtils.matches(input, cidr)) {
                    results.push({
                        service: service,
                        range: cidr
                    });
                }
            }
        }

        return results;
    }

    // ===== Rendering =====
    function renderResults(input, matches) {
        resultsSection.classList.remove('hidden');

        if (matches.length === 0) {
            resultsContainer.innerHTML = `
                <div class="result-card">
                    <div class="result-header">
                        <div class="result-icon not-found">✕</div>
                        <div>
                            <div class="result-title">No Match Found</div>
                            <div class="result-subtitle">
                                <code>${escapeHTML(input)}</code> does not belong to any known GitHub IP range.
                            </div>
                        </div>
                    </div>
                </div>`;
            return;
        }

        // Deduplicate by range+service
        const uniqueMatches = [];
        const seen = new Set();
        for (const m of matches) {
            const key = `${m.range}|${m.service}`;
            if (!seen.has(key)) {
                seen.add(key);
                uniqueMatches.push(m);
            }
        }

        // Group by service
        const grouped = {};
        for (const m of uniqueMatches) {
            if (!grouped[m.service]) grouped[m.service] = [];
            grouped[m.service].push(m.range);
        }

        const serviceCount = Object.keys(grouped).length;
        const totalRanges = uniqueMatches.length;

        let html = `
            <div class="result-card">
                <div class="result-header">
                    <div class="result-icon found">✓</div>
                    <div>
                        <div class="result-title">Match Found</div>
                        <div class="result-subtitle">
                            <code>${escapeHTML(input)}</code> matches ${totalRanges} range${totalRanges > 1 ? 's' : ''} across ${serviceCount} service${serviceCount > 1 ? 's' : ''}
                        </div>
                    </div>
                </div>
                <div class="result-body">
                    <div class="result-matches">`;

        for (const m of uniqueMatches) {
            html += `
                <div class="match-item">
                    <span class="match-range">${escapeHTML(m.range)}</span>
                    <span class="match-service service-${m.service}">${formatServiceName(m.service)}</span>
                </div>`;
        }

        html += `
                    </div>
                </div>
            </div>`;

        resultsContainer.innerHTML = html;

        // Scroll to results
        resultsSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    function showError(message) {
        resultsSection.classList.remove('hidden');
        resultsContainer.innerHTML = `
            <div class="result-card">
                <div class="result-header">
                    <div class="result-icon not-found">!</div>
                    <div>
                        <div class="result-title">Error</div>
                        <div class="result-subtitle">${escapeHTML(message)}</div>
                    </div>
                </div>
            </div>`;
    }

    function renderServicesOverview() {
        let html = '';

        // Download All button at top
        html += `
            <div class="services-toolbar">
                <div class="download-all-group">
                    <span class="toolbar-label">Export all services:</span>
                    <div class="download-btn-group">
                        <button class="download-btn" onclick="downloadRanges('all', 'json')" title="Download all ranges as JSON">
                            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
                            JSON
                        </button>
                        <button class="download-btn" onclick="downloadRanges('all', 'csv')" title="Download all ranges as CSV">
                            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
                            CSV
                        </button>
                        <button class="download-btn" onclick="downloadRanges('all', 'txt')" title="Download all ranges as plain text (one CIDR per line)">
                            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
                            TXT
                        </button>
                    </div>
                </div>
            </div>`;

        for (const service of IP_SERVICES) {
            const ranges = metaData[service];
            if (!Array.isArray(ranges) || ranges.length === 0) continue;

            const previewCount = Math.min(ranges.length, 50);
            const hasMore = ranges.length > 50;
            const serviceId = `svc-${service}`;

            html += `
                <div class="service-card" id="${serviceId}">
                    <div class="service-card-header" onclick="toggleServiceCard('${serviceId}')">
                        <div class="service-card-title-row">
                            <svg class="chevron service-chevron" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="6 9 12 15 18 9"/>
                            </svg>
                            <span class="service-card-name">${formatServiceName(service)}</span>
                        </div>
                        <span class="service-card-count">${ranges.length} ranges</span>
                    </div>
                    <div class="service-card-body">
                        <div class="service-card-actions">
                            <div class="download-btn-group">
                                <button class="download-btn download-btn-sm" onclick="event.stopPropagation(); downloadRanges('${service}', 'json')" title="Download as JSON">
                                    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
                                    JSON
                                </button>
                                <button class="download-btn download-btn-sm" onclick="event.stopPropagation(); downloadRanges('${service}', 'csv')" title="Download as CSV">
                                    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
                                    CSV
                                </button>
                                <button class="download-btn download-btn-sm" onclick="event.stopPropagation(); downloadRanges('${service}', 'txt')" title="Download as plain text">
                                    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
                                    TXT
                                </button>
                            </div>
                        </div>
                        <ul class="service-ranges-list">`;

            for (let i = 0; i < previewCount; i++) {
                html += `<li class="service-range-item"><code>${escapeHTML(ranges[i])}</code></li>`;
            }

            html += `</ul>`;

            if (hasMore) {
                html += `
                        <div class="service-card-footer">
                            <span class="service-more-text">Showing ${previewCount} of ${ranges.length} ranges</span>
                            <a href="https://api.github.com/meta" target="_blank" rel="noopener noreferrer" class="service-view-all-link">
                                View full list on GitHub Meta API →
                            </a>
                        </div>`;
            }

            html += `
                    </div>
                </div>`;
        }

        servicesGrid.innerHTML = html || '<p>No services found.</p>';
    }

    // ===== Download Functions =====
    function generateDownload(filename, content, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    window.downloadRanges = function (service, format) {
        if (!metaData) return;

        const today = new Date().toISOString().split('T')[0];

        if (service === 'all') {
            // Collect all services
            const allData = {};
            for (const svc of IP_SERVICES) {
                const ranges = metaData[svc];
                if (Array.isArray(ranges) && ranges.length > 0) {
                    allData[svc] = ranges;
                }
            }

            if (format === 'json') {
                const payload = {
                    source: META_API_URL,
                    exported: today,
                    services: allData
                };
                generateDownload(`github-meta-all-ranges-${today}.json`, JSON.stringify(payload, null, 2), 'application/json');
            } else if (format === 'csv') {
                let csv = 'range,service,ip_version\n';
                for (const [svc, ranges] of Object.entries(allData)) {
                    for (const r of ranges) {
                        const version = r.includes(':') ? 'IPv6' : 'IPv4';
                        csv += `${r},${svc},${version}\n`;
                    }
                }
                generateDownload(`github-meta-all-ranges-${today}.csv`, csv, 'text/csv');
            } else if (format === 'txt') {
                let lines = `# GitHub Meta IP Ranges - All Services\n# Source: ${META_API_URL}\n# Exported: ${today}\n#\n`;
                for (const [svc, ranges] of Object.entries(allData)) {
                    lines += `\n# === ${formatServiceName(svc)} (${ranges.length} ranges) ===\n`;
                    for (const r of ranges) {
                        lines += r + '\n';
                    }
                }
                generateDownload(`github-meta-all-ranges-${today}.txt`, lines, 'text/plain');
            }
        } else {
            // Single service
            const ranges = metaData[service];
            if (!Array.isArray(ranges)) return;

            const serviceName = formatServiceName(service);

            if (format === 'json') {
                const payload = {
                    service: service,
                    service_name: serviceName,
                    source: META_API_URL,
                    exported: today,
                    count: ranges.length,
                    ranges: ranges
                };
                generateDownload(`github-${service}-ranges-${today}.json`, JSON.stringify(payload, null, 2), 'application/json');
            } else if (format === 'csv') {
                let csv = 'range,service,ip_version\n';
                for (const r of ranges) {
                    const version = r.includes(':') ? 'IPv6' : 'IPv4';
                    csv += `${r},${service},${version}\n`;
                }
                generateDownload(`github-${service}-ranges-${today}.csv`, csv, 'text/csv');
            } else if (format === 'txt') {
                let lines = `# GitHub Meta IP Ranges - ${serviceName}\n# Source: ${META_API_URL}\n# Exported: ${today}\n# Count: ${ranges.length}\n#\n`;
                for (const r of ranges) {
                    lines += r + '\n';
                }
                generateDownload(`github-${service}-ranges-${today}.txt`, lines, 'text/plain');
            }
        }
    };

    // Toggle service card expand/collapse
    window.toggleServiceCard = function (serviceId) {
        const card = document.getElementById(serviceId);
        if (!card) return;
        card.classList.toggle('expanded');
        const chevron = card.querySelector('.service-chevron');
        if (chevron) chevron.classList.toggle('open');
    };

    function renderUpdates() {
        if (!updatesData || updatesData.length === 0) {
            updatesContainer.innerHTML = `
                <div class="no-updates">
                    <div class="no-updates-icon">📋</div>
                    <p><strong>No updates recorded yet</strong></p>
                    <p style="margin-top: 8px; font-size: 0.8125rem;">
                        The daily monitoring workflow will begin tracking changes to the GitHub Meta API once configured.<br>
                        Updates will appear here showing added or removed IP ranges and their associated services.
                    </p>
                </div>`;
            return;
        }

        let html = '';

        for (const update of updatesData) {
            const addedCount = update.changes ? update.changes.filter(c => c.type === 'added').length : 0;
            const removedCount = update.changes ? update.changes.filter(c => c.type === 'removed').length : 0;

            html += `
                <div class="update-entry">
                    <div class="update-header" onclick="toggleUpdate(this)">
                        <div class="update-date">
                            <span class="update-date-icon">📅</span>
                            ${escapeHTML(update.date)}
                        </div>
                        <div class="update-summary">
                            ${addedCount > 0 ? `<span class="update-badge badge-added">+${addedCount} added</span>` : ''}
                            ${removedCount > 0 ? `<span class="update-badge badge-removed">-${removedCount} removed</span>` : ''}
                            <svg class="chevron" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="6 9 12 15 18 9"/>
                            </svg>
                        </div>
                    </div>
                    <div class="update-body">
                        <ul class="update-changes-list">`;

            if (update.changes) {
                for (const change of update.changes) {
                    html += `
                        <li class="update-change-item">
                            <span class="change-type ${change.type}">${change.type}</span>
                            <span class="change-range">${escapeHTML(change.range)}</span>
                            <span class="change-service">${formatServiceName(change.service)}</span>
                        </li>`;
                }
            }

            html += `
                        </ul>
                    </div>
                </div>`;
        }

        updatesContainer.innerHTML = html;
    }

    // ===== Helpers =====
    function formatServiceName(name) {
        return name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    }

    function escapeHTML(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // Global toggle function for update entries
    window.toggleUpdate = function (header) {
        const body = header.nextElementSibling;
        const chevron = header.querySelector('.chevron');
        body.classList.toggle('open');
        chevron.classList.toggle('open');
    };

    // ===== Start =====
    init();

})();
