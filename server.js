// Minimal probe: does Open-Meteo answer from this host's egress IP?
// Deploy on Render, then open the service URL.

import express from "express";

const app = express();

const GEO =
  "https://geocoding-api.open-meteo.com/v1/search?name=Chicago&count=1&language=en&format=json";
const FORECAST =
  "https://api.open-meteo.com/v1/forecast?latitude=41.88&longitude=-87.63&current=temperature_2m";

async function probe(label, url) {
  const started = Date.now();
  try {
    const res = await fetch(url);
    const body = await res.text();
    return {
      label,
      url,
      status: res.status,
      ok: res.ok,
      ms: Date.now() - started,
      retryAfter: res.headers.get("retry-after"),
      rateLimit: {
        limit: res.headers.get("x-ratelimit-limit"),
        remaining: res.headers.get("x-ratelimit-remaining"),
        reset: res.headers.get("x-ratelimit-reset"),
      },
      body: body.slice(0, 400),
    };
  } catch (err) {
    return { label, url, error: String(err), ms: Date.now() - started };
  }
}

app.get("/", async (_req, res) => {
  let egress = null;
  try {
    egress = (await (await fetch("https://api.ipify.org?format=json")).json()).ip;
  } catch {
    egress = "lookup failed";
  }

  const results = [
    await probe("geocoding", GEO),
    await probe("forecast", FORECAST),
  ];

  res.type("application/json").send(
    JSON.stringify(
      { checkedAt: new Date().toISOString(), egressIp: egress, results },
      null,
      2,
    ),
  );
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`meteo-probe listening on ${port}`));
