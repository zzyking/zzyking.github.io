const ALLOWED_ORIGINS = new Set([
  "https://zzyking.github.io",
  "http://localhost:8787"
]);
const TTL_SECONDS = 60 * 60 * 24 * 30;
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

export default {
  async fetch(request, env, ctx) {
    var url = new URL(request.url);
    if (url.pathname !== "/img/p") {
      return new Response("Not Found", { status: 404 });
    }

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
};
