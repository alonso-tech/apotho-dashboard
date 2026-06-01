require("dotenv").config();
require("dotenv").config({ path: ".env.local", override: true });
const { Client } = require("pg");

const VICTOR_KEY = process.env.VICTOR_API_KEY;
const STRIPE_KEY = process.env.STRIPE_SECRET_KEY;
const db = new Client({ connectionString: process.env.DATABASE_URL });

const IDS = {
  leads: "cmnghk4n2002eg0vp8xnlce1r", leadsGoogle: "f2284634-c2a4-478e-8978-5cb9c7295063",
  leadsAngi: "679f09f3-16d6-4d98-b749-289c61653813", leadsMeta: "be25698d-1704-463f-a2b5-4216707f0965",
  leadsThumbtack: "b4cfb3ba-ded6-4342-87f6-2ad7fa897a62",
  answerRate: "cmo99tx3c00000ajvtdf2fsct", conversion: "cmnghk4qg002fg0vpvk7bjgas",
  sales: "cmo98szor00000ajl0pd53jd7", engineeringSold: "d1e9ea80-0ea6-40bf-b36e-62279e6eb185",
  jobsCompleted: "cmnghk4tt002gg0vp6b1ni46z", finalsCollected: "cmoa7li1800000akvlcw9ys8a",
  revenue: "cmnghk4x5002hg0vplxap51fy", avgTurnaround: "cmoa9su9w00000ai5l735u1wy",
  upsellRevenue: "cmo99rnyz00000ak16eovbe20",
  google: "cmo97po5800000ajpg5fjh4wy", angi: "cmo97q9se00000al5mfa7ars1", bbb: "cmo97qnak00010al5qo6fjsfr",
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

async function paginateDesc(endpoint, dateField, cutoffISO) {
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

const weeks = [
  { start: "2026-05-10", end: "2026-05-16" },
  { start: "2026-05-17", end: "2026-05-23" },
  { start: "2026-05-24", end: "2026-05-30" },
];

async function main() {
  await db.connect();

  // Scorecard for jobs/turnaround/upsell revenue (line-item level logic we can't replicate)
  const scRes = await fetch(
    "https://victor-evo.vercel.app/api/v1/scorecards/company-weekly?from=2026-05-10&to=2026-05-30",
    { headers: { Authorization: `Bearer ${VICTOR_KEY}` } }
  );
  const scData = await scRes.json();

  console.log("Fetching clients...");
  const clients = await paginateDesc("clients", "createdAt", "2026-05-10T00:00:00.000Z");
  console.log(`  ${clients.length} clients`);

  console.log("Fetching revenue...");
  const revenue = await paginateDesc("revenue", "createdAt", "2026-05-10T00:00:00.000Z");
  console.log(`  ${revenue.length} revenue entries`);

  console.log("Fetching Stripe...");
  const startTs = Math.floor(new Date("2026-05-10T00:00:00Z").getTime() / 1000);
  const endTs = Math.floor(new Date("2026-05-31T23:59:59Z").getTime() / 1000);
  const payouts = [];
  let hasMore = true, startingAfter;
  while (hasMore) {
    const params = new URLSearchParams({ "created[gte]": String(startTs), "created[lte]": String(endTs), limit: "100", status: "paid" });
    if (startingAfter) params.set("starting_after", startingAfter);
    const pRes = await fetch(`https://api.stripe.com/v1/payouts?${params}`, { headers: { Authorization: `Bearer ${STRIPE_KEY}` } });
    const pData = await pRes.json();
    if (pData.error) { console.error("Stripe error:", pData.error.message); break; }
    payouts.push(...(pData.data || []));
    hasMore = pData.has_more;
    if (pData.data?.length) startingAfter = pData.data[pData.data.length - 1].id;
    else hasMore = false;
  }
  console.log(`  ${payouts.length} payouts`);

  for (let i = 0; i < weeks.length; i++) {
    const w = weeks[i];
    const sc = scData.data?.[i];
    // MDT boundaries (UTC-6)
    const wStartUTC = w.start + "T06:00:00.000Z";
    const nd = new Date(w.end + "T00:00:00Z");
    nd.setUTCDate(nd.getUTCDate() + 1);
    const wEndUTC = nd.toISOString().split("T")[0] + "T05:59:59.999Z";

    // === LEADS + ANSWER RATE + LEAD SOURCES ===
    const wClients = clients.filter(c => c.createdAt >= wStartUTC && c.createdAt <= wEndUTC);
    const totalLeads = wClients.length;
    let excludeCount = 0, leadsGoogle = 0, leadsAngi = 0, leadsMeta = 0, leadsThumbtack = 0;
    for (const c of wClients) {
      const s = (c.status || "").toLowerCase();
      if (s === "new" || s === "no_answer" || s === "never_answered") excludeCount++;
      const src = (c.leadSource || "").toLowerCase();
      if (src.includes("google") || src === "gmb" || src === "gmb_inbound") leadsGoogle++;
      else if (src.includes("angi") || src.includes("terraform angie")) leadsAngi++;
      else if (src === "meta") leadsMeta++;
      else if (src.includes("thumbtack")) leadsThumbtack++;
    }
    const ar = totalLeads > 0 ? (((totalLeads - excludeCount) / totalLeads) * 100).toFixed(1) : "0";

    // === SALES + ENGINEERING SOLD + FINALS ===
    const paidRev = revenue.filter(r => r.status === "paid" && r.paidAt && r.paidAt >= wStartUTC && r.paidAt <= wEndUTC);

    // Sales: initial payments, excluding Engineering/3D service types
    const initialPayments = paidRev.filter(r => r.paymentType === "initial");
    let sales = initialPayments.length;
    for (const r of initialPayments) {
      if (r.projectId) {
        try {
          const pRes = await fetch(`https://victor-evo.vercel.app/api/v1/projects/${r.projectId}`, {
            headers: { Authorization: `Bearer ${VICTOR_KEY}` }
          });
          const pData = await pRes.json();
          const svc = (pData.data?.serviceType || "").toLowerCase();
          if (svc === "engineering" || svc === "3d") sales--;
        } catch {}
      }
    }

    // Engineering sold: count engineering paymentType entries
    const engSold = paidRev.filter(r => r.paymentType === "engineering").length;

    // Finals
    const finals = paidRev.filter(r => r.paymentType === "final").length;

    // Upsell revenue from scorecard (tracks line-item level upsell products across all payment types)
    const upsellCents = sc ? sc.revenueFromUpsellsCents : 0;

    // Jobs + turnaround from scorecard
    const jobs = sc ? sc.jobsCompleted : 0;
    const tt = sc ? sc.avgTurnaroundDays.toFixed(1) : "0";

    const cr = totalLeads > 0 ? ((sales / totalLeads) * 100).toFixed(1) : "0";

    // Stripe revenue
    let stripeRev = 0;
    for (const p of payouts) {
      const ad = new Date((p.arrival_date || p.created) * 1000).toISOString().split("T")[0];
      if (ad >= w.start && ad <= w.end) stripeRev += p.amount / 100;
    }

    await upsert(IDS.leads, w.start, totalLeads);
    await upsert(IDS.leadsGoogle, w.start, leadsGoogle);
    await upsert(IDS.leadsAngi, w.start, leadsAngi);
    await upsert(IDS.leadsMeta, w.start, leadsMeta);
    await upsert(IDS.leadsThumbtack, w.start, leadsThumbtack);
    await upsert(IDS.answerRate, w.start, ar);
    await upsert(IDS.conversion, w.start, cr);
    await upsert(IDS.sales, w.start, sales);
    await upsert(IDS.engineeringSold, w.start, engSold);
    await upsert(IDS.jobsCompleted, w.start, jobs);
    await upsert(IDS.finalsCollected, w.start, finals);
    await upsert(IDS.avgTurnaround, w.start, tt);
    await upsert(IDS.upsellRevenue, w.start, Math.round(upsellCents / 100));
    await upsert(IDS.revenue, w.start, Math.round(stripeRev));
    await upsert(IDS.google, w.start, "4.1");
    await upsert(IDS.angi, w.start, "3.8");
    await upsert(IDS.bbb, w.start, "1.0");

    console.log(`${w.start}: leads=${totalLeads} (G=${leadsGoogle} A=${leadsAngi} M=${leadsMeta} T=${leadsThumbtack}) ar=${ar}% cr=${cr}% sold=${sales} eng=${engSold} jobs=${jobs} finals=${finals} tt=${tt}d rev=$${Math.round(stripeRev)} upsell=$${Math.round(upsellCents / 100)}`);
  }

  await db.end();
  console.log("\nDone!");
}

main().catch(e => { console.error(e); process.exit(1); });
