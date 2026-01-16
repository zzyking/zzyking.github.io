#!/usr/bin/env node
"use strict";

const { execFileSync } = require("node:child_process");
const path = require("node:path");

function getArg(name, fallback) {
  const index = process.argv.indexOf(name);
  if (index === -1 || index + 1 >= process.argv.length) {
    return fallback;
  }
  return process.argv[index + 1];
}

function hasFlag(name) {
  return process.argv.includes(name);
}

function runWrangler(args) {
  return execFileSync("wrangler", args, { encoding: "utf8" });
}

function parseKeyList(output) {
  const trimmed = output.trim();
  if (!trimmed) {
    return [];
  }

  // Try to parse full output as JSON array first.
  try {
    const data = JSON.parse(trimmed);
    if (Array.isArray(data)) {
      return data.map((item) => item && item.name).filter(Boolean);
    }
  } catch (err) {
    // fall through to substring/line parsing
  }

  // Try to extract JSON array from mixed output.
  const start = trimmed.indexOf("[");
  const end = trimmed.lastIndexOf("]");
  if (start !== -1 && end !== -1 && end > start) {
    try {
      const data = JSON.parse(trimmed.slice(start, end + 1));
      if (Array.isArray(data)) {
        return data.map((item) => item && item.name).filter(Boolean);
      }
    } catch (err) {
      // fall through to line parsing
    }
  }

  // Fallback: assume one key per line.
  return trimmed
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/^["']|["']$/g, ""));
}

function bump(map, key) {
  const label = key || "Unknown";
  map.set(label, (map.get(label) || 0) + 1);
}

function sortMap(map) {
  return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
}

function printTop(label, map, top) {
  const rows = sortMap(map).slice(0, top);
  console.log(label + ":");
  if (!rows.length) {
    console.log("  (none)");
    return;
  }
  for (const [key, count] of rows) {
    console.log("  " + key + "  " + count);
  }
}

const binding = getArg("--binding", "VISITS");
const config = getArg("--config", path.join("worker", "wrangler.toml"));
const top = Number.parseInt(getArg("--top", "20"), 10);
const max = Number.parseInt(getArg("--max", "1000"), 10);
const jsonOutput = hasFlag("--json");

const listOutput = runWrangler([
  "kv",
  "key",
  "list",
  "--binding",
  binding,
  "--config",
  config,
  "--remote"
]);

const keys = parseKeyList(listOutput).slice(0, max);
const byCountry = new Map();
const byRegion = new Map();
const byCity = new Map();
const byCountryRegion = new Map();
const byCountryCity = new Map();

let total = 0;
for (const key of keys) {
  let value;
  try {
    value = runWrangler([
      "kv",
      "key",
      "get",
      key,
      "--text",
      "--binding",
      binding,
      "--config",
      config,
      "--remote"
    ]);
  } catch (err) {
    continue;
  }

  let record;
  try {
    record = JSON.parse(value);
  } catch (err) {
    continue;
  }

  total += 1;
  bump(byCountry, record.country);
  bump(byRegion, record.region);
  bump(byCity, record.city);
  bump(byCountryRegion, [record.country || "Unknown", record.region || "Unknown"].join(" / "));
  bump(byCountryCity, [record.country || "Unknown", record.city || "Unknown"].join(" / "));
}

if (jsonOutput) {
  const payload = {
    total,
    topCountries: sortMap(byCountry).slice(0, top),
    topRegions: sortMap(byRegion).slice(0, top),
    topCities: sortMap(byCity).slice(0, top),
    topCountryRegions: sortMap(byCountryRegion).slice(0, top),
    topCountryCities: sortMap(byCountryCity).slice(0, top)
  };
  console.log(JSON.stringify(payload, null, 2));
} else {
  console.log("Total records: " + total);
  printTop("Top countries", byCountry, top);
  printTop("Top regions", byRegion, top);
  printTop("Top cities", byCity, top);
  printTop("Top country/region", byCountryRegion, top);
  printTop("Top country/city", byCountryCity, top);
}
