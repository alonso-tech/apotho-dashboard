require("dotenv").config();
const { Client } = require("pg");

const EVO_KEY = process.env.NOTION_EVO_KEY;
const SENTRI_KEY = process.env.NOTION_SENTRI_KEY;
const STRIPE_KEY = process.env.STRIPE_SECRET_KEY;

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
  console.log("\n=== Evolution Drafting ===");
  const DB = {
    terraform: "4744e36c-8f09-491e-b054-82fd117e5e4b",
    bids: "f7b0b0db-279c-4cc1-9005-2c5712d29e1e",
    jobs: "ce4aa69c-f909-4422-8451-55cda1219f91",
    commissions: "1db39750-91c8-805d-9972-c3fc1b8073de",
  };
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

  const weeks = buildWeeks(qStart, qEnd);
  const dataStart = weeks[0].start; // Full week start (may be before quarter start)
  const df = { on_or_after: dataStart, on_or_before: qEnd };

  // Leads (sorted desc — created_time filter broken on this DB)
  console.log(`  Fetching leads from ${dataStart} (sorted desc with MDT offset)...`);
  const allLeads = await queryNotionSorted(EVO_KEY, DB.terraform, localToUTCStart(dataStart));
  console.log(`  ${allLeads.length} leads`);

  // Bids (Deposit Paid = Sales), Final Paid (= Finals Collected), Jobs (sorted desc), Commissions
  console.log("  Fetching bids, jobs, finals, commissions...");
  const [allBids, allFinalPaid, allComms] = await Promise.all([
    queryNotion(EVO_KEY, DB.bids, { property: "Deposit Paid", date: df }),
    queryNotion(EVO_KEY, DB.bids, { property: "Final Paid", date: df }),
    queryNotion(EVO_KEY, DB.commissions, { property: "Transaction Date", date: df }),
  ]);

  // Jobs: sort descending by Job Submitted and stop at data start (date filter is unreliable)
  console.log("  Fetching jobs (sorted desc)...");
  const allJobsRaw = [];
  let jobCursor;
  while (true) {
    const body = { sorts: [{ property: "Job Submitted", direction: "descending" }], page_size: 100 };
    if (jobCursor) body.start_cursor = jobCursor;
    const res = await fetch(`https://api.notion.com/v1/databases/${DB.jobs}/query`, {
      method: "POST",
      headers: { Authorization: `Bearer ${EVO_KEY}`, "Notion-Version": "2022-06-28", "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    let stop = false;
    for (const r of data.results || []) {
      const js = r.properties?.["Job Submitted"]?.date?.start || "";
      if (js && js.split("T")[0] < dataStart) { stop = true; break; }
      allJobsRaw.push(r);
    }
    if (stop || !data.has_more) break;
    jobCursor = data.next_cursor;
  }
  // Filter to only jobs with Job Submitted in our date range
  const allJobs = allJobsRaw.filter(j => {
    const js = j.properties?.["Job Submitted"]?.date?.start;
    return js && js.split("T")[0] >= dataStart;
  });

  console.log(`  Bids: ${allBids.length}, Finals: ${allFinalPaid.length}, Jobs: ${allJobs.length}, Comms: ${allComms.length}`);

  // Stripe revenue
  console.log("  Fetching Stripe payouts...");
  const startTs = Math.floor(new Date(dataStart + "T00:00:00Z").getTime() / 1000);
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

  let count = 0;
  for (const week of weeks) {
    let leads = 0, noAnswer = 0, sold = 0, completed = 0, finals = 0, upsell = 0, stripeRev = 0;

    // Leads: use created_time with MDT offset
    for (const l of allLeads) {
      if (inLocalWeek(l.created_time, week.start, week.end)) {
        leads++;
        const status = (l.properties?.Status?.status?.name || "").toLowerCase();
        if (status === "no answer" || status === "never answered") noAnswer++;
      }
    }

    // Sales: Deposit Paid date (date property, use direct comparison)
    for (const b of allBids) {
      if (dateInRange(b.properties?.["Deposit Paid"]?.date?.start, week.start, week.end)) sold++;
    }

    // Jobs Completed: Job Submitted on Jobs DB + track turnaround times
    const weekTurnarounds = [];
    for (const j of allJobs) {
      const js = j.properties?.["Job Submitted"]?.date?.start;
      if (js && js.split("T")[0] >= week.start && js.split("T")[0] <= week.end) {
        completed++;
        const tt = j.properties?.["Turn Time"]?.formula?.number;
        if (tt != null) weekTurnarounds.push(Math.abs(tt));
      }
    }

    // Finals Collected: Final Paid on Service Pipeline (only 2026 dates)
    for (const b of allFinalPaid) {
      const fp = b.properties?.["Final Paid"]?.date?.start || "";
      if (fp.startsWith("2026-") && dateInRange(fp, week.start, week.end)) finals++;
    }

    // Upsell revenue: not Initial or Final payment type
    for (const c of allComms) {
      const td = c.properties?.["Transaction Date"]?.date?.start || "";
      if (!dateInRange(td, week.start, week.end)) continue;
      const pt = (c.properties?.["Payment Type"]?.rich_text?.[0]?.plain_text || "").toLowerCase().trim();
      if (pt && !pt.includes("initial") && !pt.includes("final")) {
        upsell += c.properties?.["Transaction Amount"]?.number || 0;
      }
    }

    // Stripe revenue
    for (const p of payouts) {
      const ad = new Date((p.arrival_date || p.created) * 1000).toISOString().split("T")[0];
      if (ad >= week.start && ad <= week.end) stripeRev += p.amount / 100;
    }

    // Answer rate = (leads that ARE answered) / total
    const answered = leads - noAnswer;
    const ar = leads > 0 ? ((answered / leads) * 100).toFixed(1) : "0";
    const cr = leads > 0 ? ((sold / leads) * 100).toFixed(1) : "0";

    await upsert(IDS.leads, week.key, leads);
    await upsert(IDS.answerRate, week.key, ar);
    await upsert(IDS.conversion, week.key, cr);
    await upsert(IDS.sales, week.key, sold);
    await upsert(IDS.jobsCompleted, week.key, completed);
    await upsert(IDS.finalsCollected, week.key, finals);
    await upsert(IDS.revenue, week.key, Math.round(stripeRev));
    const avgTT = weekTurnarounds.length > 0 ? (weekTurnarounds.reduce((a, b) => a + b, 0) / weekTurnarounds.length).toFixed(1) : "0";
    await upsert(IDS.avgTurnaround, week.key, avgTT);
    await upsert(IDS.upsellRevenue, week.key, Math.round(upsell));
    await upsert(IDS.google, week.key, "4.1");
    await upsert(IDS.angi, week.key, "3.8");
    await upsert(IDS.bbb, week.key, "1.0");
    count += 12;

    console.log(`  ${week.key}: leads=${leads} ar=${ar}% cr=${cr}% sold=${sold} jobs=${completed} finals=${finals} tt=${avgTT}d rev=$${Math.round(stripeRev)} upsell=$${Math.round(upsell)}`);
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

  const evoBiz = await db.query("SELECT id FROM \"Business\" WHERE slug = 'evolution-drafting'");
  const shBiz = await db.query("SELECT id FROM \"Business\" WHERE slug = 'sentri-homes'");
  await db.query('DELETE FROM "MeasurableEntry" WHERE "measurableId" IN (SELECT id FROM "Measurable" WHERE "businessId" = $1)', [evoBiz.rows[0].id]);
  await db.query('DELETE FROM "MeasurableEntry" WHERE "measurableId" IN (SELECT id FROM "Measurable" WHERE "businessId" = $1)', [shBiz.rows[0].id]);
  console.log("Cleared old entries");

  await syncEvolution("2026-04-01", "2026-06-30");
  await syncSentri("2026-04-01", "2026-06-30");

  await db.end();
  console.log("\nDone!");
}

main().catch((e) => { console.error(e); process.exit(1); });
