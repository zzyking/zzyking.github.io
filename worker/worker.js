const ALLOWED_ORIGINS = new Set([
  "https://zzyking.github.io",
  "http://localhost:8787"
]);
const TTL_SECONDS = 60 * 60 * 24 * 30;
const DEFAULT_STATS_LIMIT = 1000;
const MAX_STATS_RECORDS = 2000;
const STATS_REALM = "visit-stats";
const TRANSPARENT_GIF_BASE64 = "R0lGODlhAQABAPAAAAAAAAAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==";

function base64ToUint8Array(base64) {
  var binary = atob(base64);
  var len = binary.length;
  var bytes = new Uint8Array(len);
  for (var i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

var GIF_BYTES = base64ToUint8Array(TRANSPARENT_GIF_BASE64);

function buildCorsHeaders(origin) {
  var headers = {
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400"
  };

  if (origin && ALLOWED_ORIGINS.has(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Vary"] = "Origin";
  }

  return headers;
}

function isAllowedRequest(origin, referer) {
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    return true;
  }

  if (!referer) {
    return false;
  }

  try {
    var refUrl = new URL(referer);
    return ALLOWED_ORIGINS.has(refUrl.origin);
  } catch (err) {
    return false;
  }
}

async function parseBody(request) {
  if (request.method === "GET") {
    return Object.fromEntries(new URL(request.url).searchParams);
  }

  if (request.method !== "POST") {
    return {};
  }

  var contentType = request.headers.get("content-type") || "";
  if (contentType.indexOf("application/json") !== -1) {
    try {
      return await request.json();
    } catch (err) {
      return {};
    }
  }

  var text = await request.text();
  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch (err) {
    return Object.fromEntries(new URLSearchParams(text));
  }
}

function unauthorizedResponse() {
  return new Response("Unauthorized", {
    status: 401,
    headers: {
      "WWW-Authenticate": "Basic realm=\"" + STATS_REALM + "\"",
      "Cache-Control": "no-store"
    }
  });
}

function requireStatsAuth(request, env) {
  if (!env.STATS_USER || !env.STATS_PASS) {
    return new Response("Missing stats credentials", { status: 500 });
  }

  var expected = "Basic " + btoa(env.STATS_USER + ":" + env.STATS_PASS);
  var auth = request.headers.get("authorization");
  if (auth !== expected) {
    return unauthorizedResponse();
  }

  return null;
}

function statsPageHtml() {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Visit Ledger</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Fraunces:wght@600&family=Space+Grotesk:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #f3efe6;
      --card: #ffffff;
      --ink: #1c1a16;
      --muted: #6a655b;
      --accent: #0b4f6c;
      --accent-soft: #d4e2ff;
      --edge: #e6e0d5;
      --shadow: 0 20px 60px rgba(28, 26, 22, 0.12);
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Space Grotesk", "Helvetica Neue", Arial, sans-serif;
      color: var(--ink);
      background: radial-gradient(circle at 20% 20%, #fff8e5 0%, var(--bg) 55%, #e8e0d2 100%);
      min-height: 100vh;
    }
    .page {
      max-width: 1200px;
      margin: 0 auto;
      padding: 48px 24px 64px;
      display: grid;
      gap: 24px;
    }
    header {
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      gap: 24px;
      animation: rise 0.6s ease-out;
    }
    h1 {
      font-family: "Fraunces", serif;
      font-size: clamp(2.1rem, 3vw, 3rem);
      margin: 0;
      letter-spacing: 0.02em;
    }
    .subtitle {
      color: var(--muted);
      font-size: 0.98rem;
      max-width: 560px;
    }
    .card {
      background: var(--card);
      border-radius: 22px;
      padding: 20px;
      box-shadow: var(--shadow);
      border: 1px solid var(--edge);
    }
    .stats {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 18px;
    }
    .stat-card {
      background: linear-gradient(135deg, rgba(255, 255, 255, 0.96), rgba(255, 250, 240, 0.92));
    }
    .stat-label {
      font-size: 0.8rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--muted);
      margin-bottom: 8px;
    }
    .stat-value {
      font-size: 1.8rem;
      font-weight: 600;
    }
    .stat-meta {
      font-size: 0.85rem;
      color: var(--muted);
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 18px;
    }
    .list-card h2 {
      margin: 0 0 12px;
      font-size: 1.1rem;
      letter-spacing: 0.02em;
    }
    .list {
      display: grid;
      gap: 10px;
    }
    .list-row {
      display: grid;
      gap: 6px;
      padding: 8px 0;
      border-bottom: 1px dashed var(--edge);
    }
    .list-row:last-child {
      border-bottom: none;
    }
    .row-head {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      font-size: 0.95rem;
    }
    .row-value {
      font-weight: 600;
      color: var(--ink);
    }
    .row-bar {
      height: 8px;
      background: var(--edge);
      border-radius: 999px;
      overflow: hidden;
    }
    .row-bar span {
      display: block;
      height: 100%;
      background: linear-gradient(90deg, var(--accent-soft), var(--accent));
      width: 0;
    }
    .actions {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
      align-items: center;
    }
    button {
      border: none;
      padding: 10px 16px;
      border-radius: 999px;
      background: var(--accent);
      color: #fff;
      font-weight: 600;
      cursor: pointer;
      transition: transform 0.2s ease, box-shadow 0.2s ease;
    }
    button:hover {
      transform: translateY(-1px);
      box-shadow: 0 10px 25px rgba(11, 79, 108, 0.25);
    }
    .meta {
      font-size: 0.85rem;
      color: var(--muted);
    }
    .error {
      color: #9f2d2d;
      font-size: 0.9rem;
    }
    footer {
      color: var(--muted);
      font-size: 0.85rem;
      text-align: right;
    }
    @keyframes rise {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }
    @media (max-width: 1000px) {
      header {
        flex-direction: column;
        align-items: flex-start;
      }
      .stats {
        grid-template-columns: 1fr;
      }
      .grid {
        grid-template-columns: 1fr;
      }
      footer {
        text-align: left;
      }
    }
  </style>
</head>
<body>
  <div class="page">
    <header>
      <div>
        <h1>Visit Ledger</h1>
        <div class="subtitle">Private summary of your Cloudflare KV visit logs.</div>
      </div>
      <div class="meta" id="status">Loading data...</div>
    </header>
    <section class="stats">
      <div class="card stat-card">
        <div class="stat-label">Records processed</div>
        <div class="stat-value" id="total">-</div>
        <div class="stat-meta" id="limit-note"></div>
      </div>
      <div class="card stat-card">
        <div class="stat-label">Top country</div>
        <div class="stat-value" id="top-country">-</div>
      </div>
      <div class="card stat-card">
        <div class="stat-label">Top city</div>
        <div class="stat-value" id="top-city">-</div>
      </div>
    </section>
    <section class="grid">
      <div class="card list-card">
        <h2>Countries</h2>
        <div class="list" id="countries"></div>
      </div>
      <div class="card list-card">
        <h2>Regions</h2>
        <div class="list" id="regions"></div>
      </div>
      <div class="card list-card">
        <h2>Cities</h2>
        <div class="list" id="cities"></div>
      </div>
    </section>
    <div class="actions">
      <button id="refresh">Refresh</button>
      <span class="meta" id="updated"></span>
    </div>
    <div class="error" id="error"></div>
    <footer>KV data is capped per request. Add ?limit=2000 to fetch more.</footer>
  </div>
  <script>
    (function () {
      var statusEl = document.getElementById("status");
      var totalEl = document.getElementById("total");
      var topCountryEl = document.getElementById("top-country");
      var topCityEl = document.getElementById("top-city");
      var limitNoteEl = document.getElementById("limit-note");
      var updatedEl = document.getElementById("updated");
      var errorEl = document.getElementById("error");
      var countriesEl = document.getElementById("countries");
      var regionsEl = document.getElementById("regions");
      var citiesEl = document.getElementById("cities");
      var params = new URLSearchParams(window.location.search);
      var limit = params.get("limit");
      var endpoint = "/stats/data" + (limit ? ("?limit=" + encodeURIComponent(limit)) : "");

      limitNoteEl.textContent = limit ? ("Limit: " + limit) : "Limit: default";

      var displayNames = (typeof Intl !== "undefined" && Intl.DisplayNames)
        ? new Intl.DisplayNames(["en"], { type: "region" })
        : null;
      var countryCodeOverrides = {
        US: "United States",
        CD: "Democratic Republic of the Congo",
        CG: "Republic of the Congo",
        CZ: "Czech Republic",
        MK: "Macedonia",
        MM: "Myanmar",
        KP: "Dem. Rep. Korea",
        KR: "Republic of Korea",
        LA: "Lao PDR",
        TL: "East Timor",
        SZ: "Swaziland",
        VA: "Vatican",
        CV: "Cabo Verde",
        CI: "Cote d'Ivoire"
      };

      function toCountryName(code) {
        if (!code || code === "Unknown") {
          return "Unknown";
        }
        if (countryCodeOverrides[code]) {
          return countryCodeOverrides[code];
        }
        if (displayNames) {
          try {
            var display = displayNames.of(code);
            if (display) {
              return display;
            }
          } catch (err) {
          }
        }
        return code;
      }

      function mapCounts(raw, mapper) {
        var output = {};
        Object.keys(raw || {}).forEach(function (key) {
          var count = raw[key];
          if (!count) {
            return;
          }
          var label = mapper(key);
          if (!label) {
            return;
          }
          output[label] = (output[label] || 0) + count;
        });
        return output;
      }

      function mapCountryCounts(raw) {
        return mapCounts(raw, function (code) {
          return toCountryName(code);
        });
      }

      function mapLocationCounts(raw) {
        return mapCounts(raw, function (key) {
          var parts = String(key).split(" / ");
          var countryCode = parts.shift() || "Unknown";
          var rest = parts.join(" / ");
          var countryName = toCountryName(countryCode);
          if (!rest) {
            return countryName;
          }
          return countryName + " / " + rest;
        });
      }

      function toSortedEntries(obj) {
        return Object.entries(obj || {}).sort(function (a, b) { return b[1] - a[1]; });
      }

      function renderBars(target, entries) {
        target.innerHTML = "";
        if (!entries.length) {
          target.innerHTML = '<div class="meta">No data</div>';
          return;
        }
        var max = entries[0][1] || 1;
        entries.slice(0, 12).forEach(function (item) {
          var row = document.createElement("div");
          row.className = "list-row";
          var head = document.createElement("div");
          head.className = "row-head";
          var label = document.createElement("span");
          label.textContent = item[0];
          var value = document.createElement("span");
          value.className = "row-value";
          value.textContent = item[1];
          head.appendChild(label);
          head.appendChild(value);
          var bar = document.createElement("div");
          bar.className = "row-bar";
          var fill = document.createElement("span");
          var width = max ? (item[1] / max) * 100 : 0;
          fill.style.width = width.toFixed(1) + "%";
          bar.appendChild(fill);
          row.appendChild(head);
          row.appendChild(bar);
          target.appendChild(row);
        });
      }

      function pickTop(entries) {
        if (!entries.length) {
          return "-";
        }
        return entries[0][0] + " (" + entries[0][1] + ")";
      }

      function applyData(payload) {
        var countryCounts = mapCountryCounts(payload.countries || {});
        var regionCounts = mapLocationCounts(payload.regions || {});
        var cityCounts = mapLocationCounts(payload.cities || {});
        var countryEntries = toSortedEntries(countryCounts);
        var regionEntries = toSortedEntries(regionCounts);
        var cityEntries = toSortedEntries(cityCounts);

        totalEl.textContent = payload.total || 0;
        topCountryEl.textContent = pickTop(countryEntries);
        topCityEl.textContent = pickTop(cityEntries);
        renderBars(countriesEl, countryEntries);
        renderBars(regionsEl, regionEntries);
        renderBars(citiesEl, cityEntries);
        updatedEl.textContent = payload.generatedAt ? ("Updated: " + payload.generatedAt) : "";
      }

      function loadData() {
        statusEl.textContent = "Refreshing...";
        errorEl.textContent = "";
        return fetch(endpoint, { credentials: "include" })
          .then(function (response) {
            if (!response.ok) {
              throw new Error("HTTP " + response.status);
            }
            return response.json();
          })
          .then(function (data) {
            applyData(data);
            statusEl.textContent = "Loaded";
          })
          .catch(function (err) {
            statusEl.textContent = "Load failed";
            errorEl.textContent = "Unable to fetch stats. " + err.message;
          });
      }

      document.getElementById("refresh").addEventListener("click", function () {
        loadData();
      });

      loadData();
    })();
  </script>
</body>
</html>`;
}

async function buildStats(env, limit) {
  var countries = {};
  var cities = {};
  var regions = {};
  var total = 0;
  var cursor;
  var pageLimit = 100;

  while (total < limit) {
    var page = await env.VISITS.list({
      cursor: cursor,
      limit: Math.min(pageLimit, limit - total)
    });

    for (var i = 0; i < page.keys.length && total < limit; i++) {
      var key = page.keys[i];
      var record = await env.VISITS.get(key.name, { type: "json" });
      if (!record) {
        continue;
      }
      total += 1;
      var country = record.country || "Unknown";
      countries[country] = (countries[country] || 0) + 1;
      var cityKey = country + " / " + (record.city || "Unknown");
      cities[cityKey] = (cities[cityKey] || 0) + 1;
      var regionKey = country + " / " + (record.region || "Unknown");
      regions[regionKey] = (regions[regionKey] || 0) + 1;
    }

    if (page.list_complete || !page.cursor) {
      break;
    }
    cursor = page.cursor;
  }

  return {
    total: total,
    countries: countries,
    cities: cities,
    regions: regions,
    generatedAt: new Date().toISOString()
  };
}

async function handlePing(request, env, ctx) {
  var origin = request.headers.get("origin");
  var corsHeaders = buildCorsHeaders(origin);

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (request.method !== "GET" && request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
  }

  var referer = request.headers.get("referer");
  if (!isAllowedRequest(origin, referer)) {
    return new Response("Forbidden", { status: 403, headers: corsHeaders });
  }

  if (!env.VISITS) {
    return new Response("Missing KV binding", { status: 500, headers: corsHeaders });
  }

  var data = await parseBody(request);
  var now = new Date().toISOString();
  var safeTime = now.replace(/[:.]/g, "-");
  var id = crypto.randomUUID();
  var key = safeTime + "_" + id;

  var cf = request.cf || {};
  var record = {
    id: id,
    ts: now,
    ip: request.headers.get("cf-connecting-ip"),
    path: data.path || null,
    ref: data.ref || null,
    ua: request.headers.get("user-agent"),
    country: cf.country || null,
    region: cf.region || null,
    city: cf.city || null,
    postalCode: cf.postalCode || null,
    latitude: cf.latitude || null,
    longitude: cf.longitude || null,
    timezone: cf.timezone || null,
    continent: cf.continent || null,
    colo: cf.colo || null,
    asOrganization: cf.asOrganization || null
  };

  ctx.waitUntil(env.VISITS.put(key, JSON.stringify(record), { expirationTtl: TTL_SECONDS }));

  if (request.method === "GET") {
    var responseHeaders = new Headers(corsHeaders);
    responseHeaders.set("Content-Type", "image/gif");
    responseHeaders.set("Cache-Control", "no-store");
    return new Response(GIF_BYTES, { status: 200, headers: responseHeaders });
  }

  return new Response(null, { status: 204, headers: corsHeaders });
}

export default {
  async fetch(request, env, ctx) {
    var url = new URL(request.url);

    if (url.pathname === "/img/p") {
      return handlePing(request, env, ctx);
    }

    if (url.pathname === "/stats") {
      var authResponse = requireStatsAuth(request, env);
      if (authResponse) {
        return authResponse;
      }
      return new Response(statsPageHtml(), {
        status: 200,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store"
        }
      });
    }

    if (url.pathname === "/stats/data") {
      var dataAuthResponse = requireStatsAuth(request, env);
      if (dataAuthResponse) {
        return dataAuthResponse;
      }
      if (request.method !== "GET") {
        return new Response("Method Not Allowed", { status: 405 });
      }
      if (!env.VISITS) {
        return new Response("Missing KV binding", { status: 500 });
      }
      var limitParam = Number.parseInt(url.searchParams.get("limit") || "", 10);
      var limit = Number.isFinite(limitParam) && limitParam > 0
        ? Math.min(limitParam, MAX_STATS_RECORDS)
        : DEFAULT_STATS_LIMIT;
      var stats = await buildStats(env, limit);
      return new Response(JSON.stringify(stats), {
        status: 200,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "no-store"
        }
      });
    }

    return new Response("Not Found", { status: 404 });
  }
};
