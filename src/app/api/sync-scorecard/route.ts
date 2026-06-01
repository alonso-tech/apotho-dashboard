import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Syncs current week scorecard data. Runs daily at 3 AM MST (9 AM UTC).

type Props = Record<string, { date?: { start?: string }; number?: number; status?: { name?: string }; rich_text?: { plain_text?: string }[] }>;

function getCurrentWeekBounds() {
  // MDT = UTC-6
  const now = new Date();
  const mdtNow = new Date(now.getTime() - 6 * 3600000);
  const d = new Date(mdtNow.toISOString().split("T")[0] + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() - d.getUTCDay()); // Sunday
  const start = d.toISOString().split("T")[0];
  d.setUTCDate(d.getUTCDate() + 6);
  const end = d.toISOString().split("T")[0];
  return { start, end };
}

async function upsertEntry(measurableId: string, weekOf: string, actual: string) {
  const m = await prisma.measurable.findUnique({ where: { id: measurableId } });
  if (!m) return;
  const an = parseFloat(actual), gn = parseFloat(m.goal.replace(/,/g, ""));
  const dir = m.goalDirection || "gte";
  let onTrack = false;
  if (!isNaN(an) && !isNaN(gn)) {
    switch (dir) {
      case "lte": onTrack = an <= gn; break;
      case "lt":  onTrack = an < gn; break;
      case "gt":  onTrack = an > gn; break;
      case "eq":  onTrack = an === gn; break;
      default:    onTrack = an >= gn;
    }
  }
  await prisma.measurableEntry.upsert({
    where: { measurableId_weekOf: { measurableId, weekOf: new Date(weekOf + "T00:00:00.000Z") } },
    update: { actual, onTrack },
    create: { measurableId, weekOf: new Date(weekOf + "T00:00:00.000Z"), actual, onTrack },
  });
}

interface VictorClient { createdAt: string; status: string; leadSource: string }
interface VictorRevenue { createdAt: string; status: string; paidAt: string; paymentType: string; amountCents: number; projectId: string }
interface VictorProject { serviceType: string }

async function paginateVictorDesc(victorKey: string, endpoint: string, dateField: string, cutoffISO: string) {
  const all: Record<string, unknown>[] = [];
  let page = 1, done = false;
  while (!done) {
    const res = await fetch(
      `https://victor-evo.vercel.app/api/v1/${endpoint}?limit=100&sort=${dateField}&order=desc&page=${page}`,
      { headers: { Authorization: `Bearer ${victorKey}` } }
    );
    const data = await res.json();
    for (const item of (data.data || []) as Record<string, unknown>[]) {
      if (item[dateField] && (item[dateField] as string) < cutoffISO) { done = true; break; }
      all.push(item);
    }
    if (!data.data?.length || page >= ((data.meta as { totalPages: number })?.totalPages || 1)) done = true;
    page++;
  }
  return all;
}

function dateInRange(d: string | undefined, s: string, e: string) {
  if (!d) return false;
  return d.split("T")[0] >= s && d.split("T")[0] <= e;
}

async function queryNotion(apiKey: string, dbId: string, filter: Record<string, unknown>) {
  const results: Record<string, unknown>[] = [];
  let cursor: string | undefined;
  while (true) {
    const body: Record<string, unknown> = { filter, page_size: 100 };
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

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  const { searchParams } = new URL(request.url);
  const querySecret = searchParams.get("secret");
  if (cronSecret && authHeader !== `Bearer ${cronSecret}` && querySecret !== cronSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const week = getCurrentWeekBounds();
    const results: Record<string, unknown> = { week };

    // ── Evolution Drafting (Victor + Stripe) ──
    const victorKey = process.env.VICTOR_API_KEY;
    const stripeKey = process.env.EVOLUTION_STRIPE_API_KEY;
    if (victorKey) {
      const IDS = {
        leads: "cmnghk4n2002eg0vp8xnlce1r", leadsGoogle: "f2284634-c2a4-478e-8978-5cb9c7295063",
        leadsAngi: "679f09f3-16d6-4d98-b749-289c61653813", leadsMeta: "be25698d-1704-463f-a2b5-4216707f0965",
        leadsThumbtack: "b4cfb3ba-ded6-4342-87f6-2ad7fa897a62", answerRate: "cmo99tx3c00000ajvtdf2fsct",
        conversion: "cmnghk4qg002fg0vpvk7bjgas", sales: "cmo98szor00000ajl0pd53jd7",
        engineeringSold: "d1e9ea80-0ea6-40bf-b36e-62279e6eb185",
        jobsCompleted: "cmnghk4tt002gg0vp6b1ni46z", finalsCollected: "cmoa7li1800000akvlcw9ys8a",
        revenue: "cmnghk4x5002hg0vplxap51fy", avgTurnaround: "cmoa9su9w00000ai5l735u1wy",
        upsellRevenue: "cmo99rnyz00000ak16eovbe20",
        google: "cmo97po5800000ajpg5fjh4wy", angi: "cmo97q9se00000al5mfa7ars1", bbb: "cmo97qnak00010al5qo6fjsfr",
      };

      // MDT boundaries
      const wStartUTC = week.start + "T06:00:00.000Z";
      const nd = new Date(week.end + "T00:00:00Z");
      nd.setUTCDate(nd.getUTCDate() + 1);
      const wEndUTC = nd.toISOString().split("T")[0] + "T05:59:59.999Z";
      const cutoff = week.start + "T00:00:00.000Z";

      // Scorecard for jobs/turnaround/upsell
      const scRes = await fetch(
        `https://victor-evo.vercel.app/api/v1/scorecards/company-weekly?from=${week.start}&to=${week.end}`,
        { headers: { Authorization: `Bearer ${victorKey}` } }
      );
      const scData = await scRes.json();
      const sc = scData.data?.[0];

      // Clients for leads + answer rate + lead sources
      const clients = (await paginateVictorDesc(victorKey, "clients", "createdAt", cutoff)) as unknown as VictorClient[];
      const weekClients = clients.filter(c => c.createdAt >= wStartUTC && c.createdAt <= wEndUTC);
      const totalLeads = weekClients.length;
      let excludeCount = 0, leadsGoogle = 0, leadsAngi = 0, leadsMeta = 0, leadsThumbtack = 0;
      for (const c of weekClients) {
        const s = (c.status || "").toLowerCase();
        if (s === "new" || s === "no_answer" || s === "never_answered") excludeCount++;
        const src = (c.leadSource || "").toLowerCase();
        if (src.includes("google") || src === "gmb" || src === "gmb_inbound") leadsGoogle++;
        else if (src.includes("angi") || src.includes("terraform angie")) leadsAngi++;
        else if (src === "meta") leadsMeta++;
        else if (src.includes("thumbtack")) leadsThumbtack++;
      }
      const ar = totalLeads > 0 ? (((totalLeads - excludeCount) / totalLeads) * 100).toFixed(1) : "0";

      // Revenue for sales + finals + engineering
      const allRevenue = (await paginateVictorDesc(victorKey, "revenue", "createdAt", cutoff)) as unknown as VictorRevenue[];
      const paidRev = allRevenue.filter(r => r.status === "paid" && r.paidAt && r.paidAt >= wStartUTC && r.paidAt <= wEndUTC);
      const initialPayments = paidRev.filter(r => r.paymentType === "initial");
      let sales = initialPayments.length;
      for (const r of initialPayments) {
        if (r.projectId) {
          try {
            const pRes = await fetch(`https://victor-evo.vercel.app/api/v1/projects/${r.projectId}`, { headers: { Authorization: `Bearer ${victorKey}` } });
            const pData = await pRes.json();
            const svc = ((pData.data as VictorProject)?.serviceType || "").toLowerCase();
            if (svc === "engineering" || svc === "3d") sales--;
          } catch { /* skip */ }
        }
      }
      const engSold = paidRev.filter(r => r.paymentType === "engineering").length;
      const finals = paidRev.filter(r => r.paymentType === "final").length;
      const cr = totalLeads > 0 ? ((sales / totalLeads) * 100).toFixed(1) : "0";

      // Stripe revenue
      let stripeRev = 0;
      if (stripeKey) {
        const sTs = Math.floor(new Date(week.start + "T00:00:00Z").getTime() / 1000);
        const eTs = Math.floor(new Date(week.end + "T23:59:59Z").getTime() / 1000);
        const res = await fetch(`https://api.stripe.com/v1/payouts?created[gte]=${sTs}&created[lte]=${eTs}&limit=100&status=paid`, {
          headers: { Authorization: `Bearer ${stripeKey}` },
        });
        const data = await res.json();
        for (const p of data.data || []) stripeRev += p.amount / 100;
      }

      await upsertEntry(IDS.leads, week.start, String(totalLeads));
      await upsertEntry(IDS.leadsGoogle, week.start, String(leadsGoogle));
      await upsertEntry(IDS.leadsAngi, week.start, String(leadsAngi));
      await upsertEntry(IDS.leadsMeta, week.start, String(leadsMeta));
      await upsertEntry(IDS.leadsThumbtack, week.start, String(leadsThumbtack));
      await upsertEntry(IDS.answerRate, week.start, ar);
      await upsertEntry(IDS.conversion, week.start, cr);
      await upsertEntry(IDS.sales, week.start, String(sales));
      await upsertEntry(IDS.engineeringSold, week.start, String(engSold));
      await upsertEntry(IDS.jobsCompleted, week.start, String(sc?.jobsCompleted ?? 0));
      await upsertEntry(IDS.finalsCollected, week.start, String(finals));
      await upsertEntry(IDS.avgTurnaround, week.start, sc?.avgTurnaroundDays?.toFixed(1) ?? "0");
      await upsertEntry(IDS.upsellRevenue, week.start, String(Math.round((sc?.revenueFromUpsellsCents ?? 0) / 100)));
      await upsertEntry(IDS.revenue, week.start, String(Math.round(stripeRev)));
      await upsertEntry(IDS.google, week.start, "4.2");
      await upsertEntry(IDS.angi, week.start, "3.6");
      await upsertEntry(IDS.bbb, week.start, "1.0");

      results.evolution = { leads: totalLeads, leadsGoogle, leadsAngi, leadsMeta, leadsThumbtack, ar, cr, sales, engSold, finals, stripeRev: Math.round(stripeRev) };
    }

    // ── Sentri Homes ──
    const sentriKey = process.env.SENTRI_NOTION_API_KEY;
    if (sentriKey) {
      const IDS = { revenue: "cmnghk5aq002lg0vph9xkl73d", sales: "cmo996jw100000ajs6s1qqztt", jobsCompleted: "cmo996vv400010ajsra5ndqel", homeBuildingSales: "cmo997jja00020ajs7rl286os" };
      const df = { on_or_after: week.start, on_or_before: week.end };

      const [soldRaw, fpRaw, commsRaw] = await Promise.all([
        queryNotion(sentriKey, "2f518d01-e1b6-8002-b83a-e4022123e913", { property: "Initial Paid Date", date: df }),
        queryNotion(sentriKey, "2f518d01-e1b6-8002-b83a-e4022123e913", { property: "Final Paid Date", date: df }),
        queryNotion(sentriKey, "32718d01-e1b6-81e3-8af9-e17758672af2", { property: "Transaction Date", date: df }),
      ]);

      const weekSold = soldRaw.filter((l) => dateInRange((l as { properties: Props }).properties["Initial Paid Date"]?.date?.start, week.start, week.end));
      const validFP = fpRaw.filter((l) => {
        const fp = (l as { properties: Props }).properties["Final Paid Date"]?.date?.start || "";
        return fp.startsWith("2026-") && dateInRange(fp, week.start, week.end);
      });
      let rev = 0;
      for (const c of commsRaw) {
        if (dateInRange((c as { properties: Props }).properties["Transaction Date"]?.date?.start, week.start, week.end)) {
          rev += (c as { properties: Props }).properties["Transaction Amount"]?.number || 0;
        }
      }
      let homeBuild = 0;
      for (const l of weekSold) {
        const lt = ((l as { properties: Props }).properties["Lead Type"]?.rich_text?.[0]?.plain_text || "").toLowerCase();
        if (lt.includes("home builder") || lt.includes("home building") || lt.includes("custom home")) homeBuild++;
      }

      await upsertEntry(IDS.sales, week.start, String(weekSold.length));
      await upsertEntry(IDS.jobsCompleted, week.start, String(validFP.length));
      await upsertEntry(IDS.revenue, week.start, String(Math.round(rev)));
      await upsertEntry(IDS.homeBuildingSales, week.start, String(homeBuild));

      results.sentri = { sales: weekSold.length, jobs: validFP.length, rev: Math.round(rev), homeBuild };
    }

    return NextResponse.json({ success: true, ...results });
  } catch (error) {
    console.error("Scorecard sync error:", error);
    return NextResponse.json({ error: "Sync failed", details: String(error) }, { status: 500 });
  }
}
