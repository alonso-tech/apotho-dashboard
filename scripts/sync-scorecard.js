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

async function paginateVictorDesc(endpoint, dateField, cutoffISO) {
  const all = [];
  let page = 1, done = false;
  while (!done) {
    const res = await fetch(
      `https://victor-evo.vercel.app/api/v1/${endpoint}?limit=100&sort=${dateField}&order=desc&page=${page}`,
      { headers: { Authorization: `Bearer ${VICTOR_KEY}` } }
    );
    const data = await res.json();
    for (const item of data.data || []) {
      if (item[dateField] && item[dateField] < cutoffISO) { done = true; break; }
      all.push(item);
    }
    if (!data.data?.length || page >= (data.meta?.totalPages || 1)) done = true;
    page++;
  }
  return all;
}

async function syncEvolution(wStart, wEnd) {
  console.log("\n=== Evolution Drafting (Victor APIs + Stripe) ===");
  const IDS = {
    leads: "cmnghk4n2002eg0vp8xnlce1r",
    leadsGoogle: "f2284634-c2a4-478e-8978-5cb9c7295063",
    leadsAngi: "679f09f3-16d6-4d98-b749-289c61653813",
    leadsMeta: "be25698d-1704-463f-a2b5-4216707f0965",
    leadsThumbtack: "b4cfb3ba-ded6-4342-87f6-2ad7fa897a62",
    engineeringSold: "d1e9ea80-0ea6-40bf-b36e-62279e6eb185",
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

  // MDT = UTC-6. Victor dashboards use Mountain Time boundaries.
  const wStartUTC = wStart + "T06:00:00.000Z";
  const nextDay = new Date(wEnd + "T00:00:00Z");
  nextDay.setUTCDate(nextDay.getUTCDate() + 1);
  const wEndUTC = nextDay.toISOString().split("T")[0] + "T05:59:59.999Z";
  const cutoffISO = wStart + "T00:00:00.000Z";

  // 1. Fetch scorecard for jobs/upsells/turnaround (complex server-side logic)
  console.log(`  Fetching Victor scorecard...`);
  const victorRes = await fetch(
    `https://victor-evo.vercel.app/api/v1/scorecards/company-weekly?from=${wStart}&to=${wEnd}`,
    { headers: { Authorization: `Bearer ${VICTOR_KEY}` } }
  );
  const victorData = await victorRes.json();
  const sc = victorData.data?.[0];
  if (!sc) { console.log("  No scorecard data for this week"); return; }

  // 2. Fetch clients for leads + answer rate + lead sources
  console.log("  Fetching clients...");
  const clients = await paginateVictorDesc("clients", "createdAt", cutoffISO);
  const weekClients = clients.filter(c => c.createdAt >= wStartUTC && c.createdAt <= wEndUTC);
  const totalLeads = weekClients.length;

  // Answer rate: (total - new - no_answer - never_answered) / total
  let excludeCount = 0;
  for (const c of weekClients) {
    const s = (c.status || "").toLowerCase();
    if (s === "new" || s === "no_answer" || s === "never_answered") excludeCount++;
  }
  const ar = totalLeads > 0 ? (((totalLeads - excludeCount) / totalLeads) * 100).toFixed(1) : "0";

  // Lead sources
  let leadsGoogle = 0, leadsAngi = 0, leadsMeta = 0, leadsThumbtack = 0;
  for (const c of weekClients) {
    const src = (c.leadSource || "").toLowerCase();
    if (src.includes("google") || src === "gmb" || src === "gmb_inbound") leadsGoogle++;
    else if (src.includes("angi") || src.includes("terraform angie")) leadsAngi++;
    else if (src === "meta") leadsMeta++;
    else if (src.includes("thumbtack")) leadsThumbtack++;
  }

  // 3. Fetch revenue for sales + finals
  console.log("  Fetching revenue...");
  const allRevenue = await paginateVictorDesc("revenue", "createdAt", cutoffISO);
  const paidRevenue = allRevenue.filter(r => r.status === "paid" && r.paidAt && r.paidAt >= wStartUTC && r.paidAt <= wEndUTC);
  // Sales: initial payments, excluding Engineering/3D (Victor dashboard counts those separately)
  const initialPayments = paidRevenue.filter(r => r.paymentType === "initial");
  let sales = initialPayments.length;
  for (const r of initialPayments) {
    if (r.projectId) {
      try {
        const pRes = await fetch(`https://victor-evo.vercel.app/api/v1/projects/${r.projectId}`, { headers: { Authorization: `Bearer ${VICTOR_KEY}` } });
        const pData = await pRes.json();
        const svc = (pData.data?.serviceType || "").toLowerCase();
        if (svc === "engineering" || svc === "3d") sales--;
      } catch {}
    }
  }
  const finals = paidRevenue.filter(r => r.paymentType === "final").length;
  const engSold = paidRevenue.filter(r => r.paymentType === "engineering").length;

  // Use scorecard for upsells, jobs, turnaround (complex business logic)
  const jobs = sc.jobsCompleted;
  const tt = sc.avgTurnaroundDays.toFixed(1);
  const upsellCents = sc.revenueFromUpsellsCents;

  // Conversion rate
  const cr = totalLeads > 0 ? ((sales / totalLeads) * 100).toFixed(1) : "0";

  // 4. Stripe revenue
  console.log("  Fetching Stripe payouts...");
  const startTs = Math.floor(new Date(wStart + "T00:00:00Z").getTime() / 1000);
  const endTs = Math.floor(new Date(wEnd + "T23:59:59Z").getTime() / 1000);
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
  let stripeRev = 0;
  for (const p of payouts) stripeRev += p.amount / 100;

  // 5. Upsert all
  await upsert(IDS.leads, wStart, totalLeads);
  await upsert(IDS.leadsGoogle, wStart, leadsGoogle);
  await upsert(IDS.leadsAngi, wStart, leadsAngi);
  await upsert(IDS.leadsMeta, wStart, leadsMeta);
  await upsert(IDS.leadsThumbtack, wStart, leadsThumbtack);
  await upsert(IDS.answerRate, wStart, ar);
  await upsert(IDS.conversion, wStart, cr);
  await upsert(IDS.sales, wStart, sales);
  await upsert(IDS.engineeringSold, wStart, engSold);
  await upsert(IDS.jobsCompleted, wStart, jobs);
  await upsert(IDS.finalsCollected, wStart, finals);
  await upsert(IDS.avgTurnaround, wStart, tt);
  await upsert(IDS.upsellRevenue, wStart, Math.round(upsellCents / 100));
  await upsert(IDS.revenue, wStart, Math.round(stripeRev));
  await upsert(IDS.google, wStart, "4.2");
  await upsert(IDS.angi, wStart, "3.6");
  await upsert(IDS.bbb, wStart, "1.0");

  console.log(`  ${wStart}: leads=${totalLeads} (G=${leadsGoogle} A=${leadsAngi} M=${leadsMeta} T=${leadsThumbtack}) ar=${ar}% cr=${cr}% sold=${sales} eng=${engSold} jobs=${jobs} finals=${finals} tt=${tt}d rev=$${Math.round(stripeRev)} upsell=$${Math.round(upsellCents / 100)}`);
}

async function syncSentri(wStart, wEnd) {
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

  const df = { on_or_after: wStart, on_or_before: wEnd };
  console.log(`  Fetching data for ${wStart} to ${wEnd}...`);
  const [soldRaw, finalPaidRaw, commsRaw] = await Promise.all([
    queryNotion(SENTRI_KEY, DB.leads, { property: "Initial Paid Date", date: df }),
    queryNotion(SENTRI_KEY, DB.leads, { property: "Final Paid Date", date: df }),
    queryNotion(SENTRI_KEY, DB.commissions, { property: "Transaction Date", date: df }),
  ]);

  const validFP = finalPaidRaw.filter((l) => (l.properties?.["Final Paid Date"]?.date?.start || "").startsWith("2026-"));
  console.log(`  Sold: ${soldRaw.length}, Final Paid (2026): ${validFP.length}, Comms: ${commsRaw.length}`);

  let sales = 0, jobs = 0, rev = 0, homeBuild = 0;
  for (const l of soldRaw) {
    const d = l.properties?.["Initial Paid Date"]?.date?.start;
    if (dateInRange(d, wStart, wEnd)) {
      sales++;
      const lt = (l.properties?.["Lead Type"]?.rich_text?.[0]?.plain_text || "").toLowerCase();
      if (lt.includes("home builder") || lt.includes("home building") || lt.includes("custom home")) homeBuild++;
    }
  }
  for (const l of validFP) {
    if (dateInRange(l.properties?.["Final Paid Date"]?.date?.start, wStart, wEnd)) jobs++;
  }
  for (const c of commsRaw) {
    const d = c.properties?.["Transaction Date"]?.date?.start;
    if (dateInRange(d, wStart, wEnd)) rev += c.properties?.["Transaction Amount"]?.number || 0;
  }

  await upsert(IDS.sales, wStart, sales);
  await upsert(IDS.jobsCompleted, wStart, jobs);
  await upsert(IDS.revenue, wStart, Math.round(rev));
  await upsert(IDS.homeBuildingSales, wStart, homeBuild);
  await upsert(IDS.licensing, wStart, 0);
  await upsert(IDS.googleLocations, wStart, 0);
  await upsert(IDS.googleRating, wStart, 0);
  console.log(`  ${wStart}: sales=${sales} jobs=${jobs} rev=$${Math.round(rev)} homeBuild=${homeBuild}`);
}

async function main() {
  await db.connect();

  console.log("Syncing (upsert mode — no data deleted)...");

  // Only sync the current week. Historical data is already accurate.
  const now = new Date();
  const day = now.getDay(); // 0=Sun
  const sun = new Date(now);
  sun.setDate(sun.getDate() - day);
  const currentWeekStart = sun.toISOString().split("T")[0];
  const sat = new Date(sun);
  sat.setDate(sat.getDate() + 6);
  const currentWeekEnd = sat.toISOString().split("T")[0];
  console.log(`Current week: ${currentWeekStart} to ${currentWeekEnd}`);
  await syncEvolution(currentWeekStart, currentWeekEnd);
  await syncSentri(currentWeekStart, currentWeekEnd);

  await db.end();
  console.log("\nDone!");
}

main().catch((e) => { console.error(e); process.exit(1); });
