// Backfill lead sources, engineering sold, and answer rate for pre-Victor weeks (3/29 - 5/3)
// Does NOT touch any other metrics — only adds the new ones and fixes answer rate.
require("dotenv").config();
require("dotenv").config({ path: ".env.local", override: true });
const { Client } = require("pg");

const EVO_KEY = process.env.NOTION_EVO_KEY;
const db = new Client({ connectionString: process.env.DATABASE_URL });
const TZ_OFFSET_HOURS = 6; // MDT = UTC-6

const IDS = {
  leadsGoogle: "f2284634-c2a4-478e-8978-5cb9c7295063",
  leadsAngi: "679f09f3-16d6-4d98-b749-289c61653813",
  leadsMeta: "be25698d-1704-463f-a2b5-4216707f0965",
  leadsThumbtack: "b4cfb3ba-ded6-4342-87f6-2ad7fa897a62",
  engineeringSold: "d1e9ea80-0ea6-40bf-b36e-62279e6eb185",
  answerRate: "cmo99tx3c00000ajvtdf2fsct",
};

async function upsert(measId, weekOf, actual) {
  const mRes = await db.query('SELECT goal, "goalDirection" FROM "Measurable" WHERE id = $1', [measId]);
  if (!mRes.rows.length) return;
  const goalNum = parseFloat(mRes.rows[0].goal.replace(/,/g, ""));
  const actualNum = parseFloat(String(actual).replace(/,/g, ""));
  const dir = mRes.rows[0].goalDirection || "gte";
  let onTrack = false;
  switch (dir) {
    case "lte": onTrack = actualNum <= goalNum; break;
    case "lt":  onTrack = actualNum < goalNum; break;
    case "gt":  onTrack = actualNum > goalNum; break;
    case "eq":  onTrack = actualNum === goalNum; break;
    default:    onTrack = actualNum >= goalNum;
  }
  await db.query(
    'INSERT INTO "MeasurableEntry" (id, "measurableId", "weekOf", actual, "onTrack", "createdAt") VALUES (gen_random_uuid(), $1, $2, $3, $4, NOW()) ON CONFLICT ("measurableId", "weekOf") DO UPDATE SET actual = $3, "onTrack" = $4',
    [measId, weekOf + "T00:00:00.000Z", String(actual), onTrack]
  );
}

function localToUTCStart(dateStr) {
  return `${dateStr}T${String(TZ_OFFSET_HOURS).padStart(2, "0")}:00:00.000Z`;
}
function localToUTCEnd(dateStr) {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + 1);
  return `${d.toISOString().split("T")[0]}T${String(TZ_OFFSET_HOURS).padStart(2, "0")}:00:00.000Z`;
}
function inLocalWeek(utcTs, weekStart, weekEnd) {
  if (!utcTs) return false;
  return utcTs >= localToUTCStart(weekStart) && utcTs < localToUTCEnd(weekEnd);
}
function dateInRange(d, s, e) {
  if (!d) return false;
  const ds = d.split("T")[0];
  return ds >= s && ds <= e;
}

async function queryNotionSorted(apiKey, dbId, cutoff) {
  const results = [];
  let cursor;
  while (true) {
    const body = { sorts: [{ timestamp: "created_time", direction: "descending" }], page_size: 100 };
    if (cursor) body.start_cursor = cursor;
    const res = await fetch(`https://api.notion.com/v1/databases/${dbId}/query`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Notion-Version": "2022-06-28", "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    let stop = false;
    for (const r of data.results || []) {
      if (r.created_time < cutoff) { stop = true; break; }
      results.push(r);
    }
    if (stop || !data.has_more) break;
    cursor = data.next_cursor;
  }
  return results;
}

async function queryNotion(apiKey, dbId, filter) {
  const results = [];
  let cursor;
  while (true) {
    const body = { filter, page_size: 100 };
    if (cursor) body.start_cursor = cursor;
    const res = await fetch(`https://api.notion.com/v1/databases/${dbId}/query`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Notion-Version": "2022-06-28", "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    results.push(...(data.results || []));
    if (!data.has_more) break;
    cursor = data.next_cursor;
  }
  return results;
}

const weeks = [
  { start: "2026-03-29", end: "2026-04-04" },
  { start: "2026-04-05", end: "2026-04-11" },
  { start: "2026-04-12", end: "2026-04-18" },
  { start: "2026-04-19", end: "2026-04-25" },
  { start: "2026-04-26", end: "2026-05-02" },
  { start: "2026-05-03", end: "2026-05-09" },
];

async function main() {
  await db.connect();

  const dataStart = weeks[0].start;
  const DB = {
    terraform: "4744e36c-8f09-491e-b054-82fd117e5e4b",
    bids: "f7b0b0db-279c-4cc1-9005-2c5712d29e1e",
  };

  // 1. Fetch all leads for lead source + answer rate
  console.log("Fetching leads from Notion...");
  const allLeads = await queryNotionSorted(EVO_KEY, DB.terraform, localToUTCStart(dataStart));
  console.log(`  ${allLeads.length} leads`);

  // 2. Fetch bids with Engineering Paid date for engineering sold
  console.log("Fetching bids with Engineering Paid...");
  const engBids = await queryNotion(EVO_KEY, DB.bids, {
    property: "Engineering Paid",
    date: { on_or_after: dataStart, on_or_before: "2026-05-09" },
  });
  console.log(`  ${engBids.length} engineering bids`);

  // 3. Process each week
  for (const week of weeks) {
    let leadsGoogle = 0, leadsAngi = 0, leadsMeta = 0, leadsThumbtack = 0;
    let totalLeads = 0, excludeCount = 0;

    for (const l of allLeads) {
      if (!inLocalWeek(l.created_time, week.start, week.end)) continue;
      totalLeads++;

      // Answer rate: exclude new, no_answer, never_answered
      const status = (l.properties?.Status?.status?.name || "").toLowerCase();
      if (status === "new" || status === "no answer" || status === "never answered") excludeCount++;

      // Lead source
      const src = (l.properties?.["Lead Source"]?.select?.name || "").toLowerCase();
      if (src.includes("google")) leadsGoogle++;
      else if (src.includes("angi")) leadsAngi++;
      else if (src.includes("meta") || src.includes("facebook")) leadsMeta++;
      else if (src.includes("thumbtack")) leadsThumbtack++;
    }

    const ar = totalLeads > 0 ? (((totalLeads - excludeCount) / totalLeads) * 100).toFixed(1) : "0";

    // Engineering sold: count bids with Engineering Paid in this week
    let engSold = 0;
    for (const b of engBids) {
      const ep = b.properties?.["Engineering Paid"]?.date?.start;
      if (ep && dateInRange(ep, week.start, week.end)) engSold++;
    }

    await upsert(IDS.leadsGoogle, week.start, leadsGoogle);
    await upsert(IDS.leadsAngi, week.start, leadsAngi);
    await upsert(IDS.leadsMeta, week.start, leadsMeta);
    await upsert(IDS.leadsThumbtack, week.start, leadsThumbtack);
    await upsert(IDS.engineeringSold, week.start, engSold);
    await upsert(IDS.answerRate, week.start, ar);

    console.log(`${week.start}: total=${totalLeads} G=${leadsGoogle} A=${leadsAngi} M=${leadsMeta} T=${leadsThumbtack} eng=${engSold} ar=${ar}%`);
  }

  await db.end();
  console.log("\nDone!");
}

main().catch(e => { console.error(e); process.exit(1); });
