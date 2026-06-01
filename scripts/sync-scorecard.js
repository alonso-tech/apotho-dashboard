require("dotenv").config(); // loads .env
require("dotenv").config({ path: ".env.local", override: true }); // loads .env.local (API keys)
const { Client } = require("pg");

const EVO_KEY = process.env.NOTION_EVO_KEY;
const SENTRI_KEY = process.env.NOTION_SENTRI_KEY;
const STRIPE_KEY = process.env.STRIPE_SECRET_KEY;
const VICTOR_KEY = process.env.VICTOR_API_KEY;

// MDT = UTC-6. Notion displays dates in user's timezone.
const TZ_OFFSET_HOURS = 6;

const db = new Client({ connectionString: process.env.DATABASE_URL });

async function queryNotionSorted(apiKey, dbId, cutoffISO) {
  let results = [], cursor;
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
      if (r.created_time < cutoffISO) { stop = true; break; }
      results.push(r);
    }
    if (stop || !data.has_more) break;
    cursor = data.next_cursor;
  }
  return results;
}

async function queryNotion(apiKey, dbId, filter) {
  let results = [], cursor;
  while (true) {
    const body = { filter, page_size: 100 };
    if (cursor) body.start_cursor = cursor;
    const res = await fetch(`https://api.notion.com/v1/databases/${dbId}/query`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Notion-Version": "2022-06-28", "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    results = results.concat(data.results || []);
    if (!data.has_more) break;
    cursor = data.next_cursor;
  }
  return results;
}

function compareOnTrack(actual, goal, dir) {
  if (isNaN(actual) || isNaN(goal)) return false;
  switch (dir) {
    case "lte": return actual <= goal;
    case "lt":  return actual < goal;
    case "gt":  return actual > goal;
    case "eq":  return actual === goal;
    default:    return actual >= goal; // gte
  }
}

async function upsert(measId, weekOf, actual) {
  const mRes = await db.query('SELECT goal, "goalDirection" FROM "Measurable" WHERE id = $1', [measId]);
  if (!mRes.rows.length) return;
  const goalNum = parseFloat(mRes.rows[0].goal.replace(/,/g, ""));
  const actualNum = parseFloat(String(actual).replace(/,/g, ""));
  const dir = mRes.rows[0].goalDirection || "gte";
  const onTrack = compareOnTrack(actualNum, goalNum, dir);
  await db.query(
    'INSERT INTO "MeasurableEntry" (id, "measurableId", "weekOf", actual, "onTrack", "createdAt") VALUES (gen_random_uuid(), $1, $2, $3, $4, NOW()) ON CONFLICT ("measurableId", "weekOf") DO UPDATE SET actual = $3, "onTrack" = $4',
    [measId, weekOf + "T00:00:00.000Z", String(actual), onTrack]
  );
}

// Convert a local date string "YYYY-MM-DD" to UTC ISO boundaries
// e.g., "2026-04-12" in MDT -> "2026-04-12T06:00:00.000Z" (start of that day in UTC)
function localToUTCStart(dateStr) {
  return `${dateStr}T${String(TZ_OFFSET_HOURS).padStart(2, "0")}:00:00.000Z`;
}
function localToUTCEnd(dateStr) {
  // End of day = next day's start
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + 1);
  return `${d.toISOString().split("T")[0]}T${String(TZ_OFFSET_HOURS).padStart(2, "0")}:00:00.000Z`;
}

// Check if a UTC timestamp falls within a local date range
function inLocalWeek(utcTimestamp, weekStartLocal, weekEndLocal) {
  if (!utcTimestamp) return false;
  const utcStart = localToUTCStart(weekStartLocal);
  const utcEnd = localToUTCEnd(weekEndLocal);
  return utcTimestamp >= utcStart && utcTimestamp < utcEnd;
}

// Check if a date-only value (YYYY-MM-DD) falls within a local date range
function dateInRange(dateStr, weekStart, weekEnd) {
  if (!dateStr) return false;
  const d = dateStr.split("T")[0];
  return d >= weekStart && d <= weekEnd;
}

// Build Sunday-Saturday weeks. First week includes the full week containing the quarter start.
function buildWeeks(qStart, qEnd) {
  const weeks = [];
  const start = new Date(qStart + "T00:00:00Z");
  const end = new Date(qEnd + "T00:00:00Z");

  // First Sunday on or before the quarter start
  const firstDay = start.getUTCDay(); // 0=Sun
  const firstSunday = new Date(start);
  firstSunday.setUTCDate(firstSunday.getUTCDate() - firstDay);

  const cursor = new Date(firstSunday);
  while (cursor.getTime() <= end.getTime()) {
    const ws = cursor.toISOString().split("T")[0];
    const we = new Date(cursor);
    we.setUTCDate(we.getUTCDate() + 6);
    weeks.push({ start: ws, end: we.toISOString().split("T")[0], key: ws });
    cursor.setUTCDate(cursor.getUTCDate() + 7);
  }

  const today = new Date().toISOString().split("T")[0];
  return weeks.filter((w) => w.start <= today);
}

async function syncEvolution(qStart, qEnd) {
  console.log("\n=== Evolution Drafting (Victor + Stripe) ===");
  const IDS = {
    leads: "cmnghk4n2002eg0vp8xnlce1r",
    answerRate: "cmo99tx3c00000ajvtdf2fsct",
    conversion: "cmnghk4qg002fg0vpvk7bjgas",
    sales: "cmo98szor00000ajl0pd53jd7",
    jobsCompleted: "cmnghk4tt002gg0vp6b1ni46z",
    finalsCollected: "cmoa7li1800000akvlcw9ys8a",
    revenue: "cmnghk4x5002hg0vplxap51fy",
    avgTurnaround: "cmoa9su9w00000ai5l735u1wy",
    upsellRevenue: "cmo99rnyz00000ak16eovbe20",
    google: "cmo97po5800000ajpg5fjh4wy",
    angi: "cmo97q9se00000al5mfa7ars1",
    bbb: "cmo97qnak00010al5qo6fjsfr",
  };

  // 1. Fetch Victor scorecard data
  console.log(`  Fetching Victor scorecard (${qStart} to ${qEnd})...`);
  const victorRes = await fetch(
    `https://victor-evo.vercel.app/api/v1/scorecards/company-weekly?from=${qStart}&to=${qEnd}`,
    { headers: { Authorization: `Bearer ${VICTOR_KEY}` } }
  );
  const victorData = await victorRes.json();
  if (victorData.error) { console.error("  Victor error:", victorData.error); return; }
  console.log(`  Victor weeks: ${victorData.data.length}`);

  // 1b. Count TOTAL leads per week from Victor clients API (scorecard filters out junk)
  console.log("  Counting total leads from clients API...");
  const leadCounts = {};
  let page = 1, pageDone = false;
  const cutoffISO = qStart + "T00:00:00.000Z";
  while (!pageDone) {
    const cRes = await fetch(
      `https://victor-evo.vercel.app/api/v1/clients?limit=100&sort=createdAt&order=desc&page=${page}`,
      { headers: { Authorization: `Bearer ${VICTOR_KEY}` } }
    );
    const cData = await cRes.json();
    for (const client of cData.data || []) {
      if (client.createdAt < cutoffISO) { pageDone = true; break; }
      const dateStr = client.createdAt.split("T")[0];
      for (const week of victorData.data) {
        if (dateStr >= week.weekStart && dateStr <= week.weekEnd) {
          leadCounts[week.weekStart] = (leadCounts[week.weekStart] || 0) + 1;
          break;
        }
      }
    }
    if (!cData.data?.length || page >= cData.meta.totalPages) pageDone = true;
    page++;
  }
  console.log(`  Lead counts from clients API:`, JSON.stringify(leadCounts));

  // 2. Fetch Stripe payouts for revenue
  console.log("  Fetching Stripe payouts...");
  const startTs = Math.floor(new Date(qStart + "T00:00:00Z").getTime() / 1000);
  const endTs = Math.floor(new Date(qEnd + "T23:59:59Z").getTime() / 1000);
  const payouts = [];
  let hasMore = true, startingAfter;
  while (hasMore) {
    const params = new URLSearchParams({ "created[gte]": String(startTs), "created[lte]": String(endTs), limit: "100", status: "paid" });
    if (startingAfter) params.set("starting_after", startingAfter);
    const res = await fetch(`https://api.stripe.com/v1/payouts?${params}`, { headers: { Authorization: `Bearer ${STRIPE_KEY}` } });
    const data = await res.json();
    if (data.error) { console.error("  Stripe error:", data.error.message); break; }
    payouts.push(...(data.data || []));
    hasMore = data.has_more;
    if (data.data?.length) startingAfter = data.data[data.data.length - 1].id;
    else hasMore = false;
  }
  console.log(`  Stripe payouts: ${payouts.length}`);

  // 3. Upsert each week
  let count = 0;
  for (const week of victorData.data) {
    const weekKey = week.weekStart; // Sunday YYYY-MM-DD

    // Skip partial current week if it has no meaningful data
    if (victorData.meta.currentWeekIsPartial && weekKey === victorData.meta.currentWeekStart && week.leadsByWeek === 0 && week.salesCount === 0) {
      console.log(`  ${weekKey}: skipping (partial current week with no data)`);
      continue;
    }

    // Victor data — use real lead count from clients API, recalculate conversion
    const totalLeads = leadCounts[weekKey] || week.leadsByWeek;
    const cr = totalLeads > 0 ? ((week.salesCount / totalLeads) * 100).toFixed(1) : "0";
    await upsert(IDS.leads, weekKey, totalLeads);
    await upsert(IDS.answerRate, weekKey, week.answerRatePercent.toFixed(1));
    await upsert(IDS.conversion, weekKey, cr);
    await upsert(IDS.sales, weekKey, week.salesCount);
    await upsert(IDS.jobsCompleted, weekKey, week.jobsCompleted);
    await upsert(IDS.finalsCollected, weekKey, week.finalsCollected);
    await upsert(IDS.avgTurnaround, weekKey, week.avgTurnaroundDays.toFixed(1));
    await upsert(IDS.upsellRevenue, weekKey, Math.round(week.revenueFromUpsellsCents / 100));

    // Stripe revenue for this week
    let stripeRev = 0;
    for (const p of payouts) {
      const ad = new Date((p.arrival_date || p.created) * 1000).toISOString().split("T")[0];
      if (ad >= week.weekStart && ad <= week.weekEnd) stripeRev += p.amount / 100;
    }
    await upsert(IDS.revenue, weekKey, Math.round(stripeRev));

    // Platform ratings (static for now — TODO: pull from Google API)
    await upsert(IDS.google, weekKey, "4.1");
    await upsert(IDS.angi, weekKey, "3.8");
    await upsert(IDS.bbb, weekKey, "1.0");
    count += 12;

    console.log(`  ${weekKey}: leads=${totalLeads} ar=${week.answerRatePercent.toFixed(1)}% cr=${cr}% sold=${week.salesCount} jobs=${week.jobsCompleted} finals=${week.finalsCollected} tt=${week.avgTurnaroundDays.toFixed(1)}d rev=$${Math.round(stripeRev)} upsell=$${Math.round(week.revenueFromUpsellsCents / 100)}`);
  }
  console.log(`  Total: ${count} entries`);
}

async function syncSentri(qStart, qEnd) {
  console.log("\n=== Sentri Homes ===");
  const DB = { leads: "2f518d01-e1b6-8002-b83a-e4022123e913", commissions: "32718d01-e1b6-81e3-8af9-e17758672af2" };
  const IDS = {
    revenue: "cmnghk5aq002lg0vph9xkl73d",
    sales: "cmo996jw100000ajs6s1qqztt",
    jobsCompleted: "cmo996vv400010ajsra5ndqel",
    homeBuildingSales: "cmo997jja00020ajs7rl286os",
    licensing: "cmo99afj700030ajs8387b61i",
    googleLocations: "cmo99b8cc00040ajsn2mx77pw",
    googleRating: "cmo99bgit00050ajsdr2ibtz2",
  };

  const weeks = buildWeeks(qStart, qEnd);
  const dataStart = weeks[0].start;
  const df = { on_or_after: dataStart, on_or_before: qEnd };
  console.log(`  Fetching data from ${dataStart}...`);
  const [soldRaw, finalPaidRaw, commsRaw] = await Promise.all([
    queryNotion(SENTRI_KEY, DB.leads, { property: "Initial Paid Date", date: df }),
    queryNotion(SENTRI_KEY, DB.leads, { property: "Final Paid Date", date: df }),
    queryNotion(SENTRI_KEY, DB.commissions, { property: "Transaction Date", date: df }),
  ]);

  const validFP = finalPaidRaw.filter((l) => (l.properties?.["Final Paid Date"]?.date?.start || "").startsWith("2026-"));
  console.log(`  Sold: ${soldRaw.length}, Final Paid (2026): ${validFP.length}, Comms: ${commsRaw.length}`);

  let count = 0;
  for (const week of weeks) {
    let sales = 0, jobs = 0, rev = 0, homeBuild = 0;
    for (const l of soldRaw) {
      const d = l.properties?.["Initial Paid Date"]?.date?.start;
      if (dateInRange(d, week.start, week.end)) {
        sales++;
        const lt = (l.properties?.["Lead Type"]?.rich_text?.[0]?.plain_text || "").toLowerCase();
        if (lt.includes("home builder") || lt.includes("home building") || lt.includes("custom home")) homeBuild++;
      }
    }
    for (const l of validFP) {
      if (dateInRange(l.properties?.["Final Paid Date"]?.date?.start, week.start, week.end)) jobs++;
    }
    for (const c of commsRaw) {
      const d = c.properties?.["Transaction Date"]?.date?.start;
      if (dateInRange(d, week.start, week.end)) rev += c.properties?.["Transaction Amount"]?.number || 0;
    }

    await upsert(IDS.sales, week.key, sales);
    await upsert(IDS.jobsCompleted, week.key, jobs);
    await upsert(IDS.revenue, week.key, Math.round(rev));
    await upsert(IDS.homeBuildingSales, week.key, homeBuild);
    await upsert(IDS.licensing, week.key, 0);
    await upsert(IDS.googleLocations, week.key, 0);
    await upsert(IDS.googleRating, week.key, 0);
    count += 7;
    console.log(`  ${week.key}: sales=${sales} jobs=${jobs} rev=$${Math.round(rev)} homeBuild=${homeBuild}`);
  }
  console.log(`  Total: ${count} entries`);
}

async function main() {
  await db.connect();

  console.log("Syncing (upsert mode — no data deleted)...");

  await syncEvolution("2026-04-01", "2026-06-30");
  await syncSentri("2026-04-01", "2026-06-30");

  await db.end();
  console.log("\nDone!");
}

main().catch((e) => { console.error(e); process.exit(1); });
