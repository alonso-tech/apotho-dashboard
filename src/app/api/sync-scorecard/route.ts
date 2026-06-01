import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Only syncs the CURRENT week — fast enough for Vercel's 10s limit
// MDT = UTC-6
const TZ_OFFSET = 6;

type Props = Record<string, { date?: { start?: string }; number?: number; status?: { name?: string }; rich_text?: { plain_text?: string }[] }>;

function getCurrentWeekBounds(): { start: string; end: string; key: string } {
  // Current date in MDT
  const now = new Date();
  const mdtNow = new Date(now.getTime() - TZ_OFFSET * 3600000);
  const localDate = mdtNow.toISOString().split("T")[0];
  const d = new Date(localDate + "T00:00:00Z");
  const day = d.getUTCDay(); // 0=Sun
  // Go back to Sunday
  d.setUTCDate(d.getUTCDate() - day);
  const start = d.toISOString().split("T")[0];
  d.setUTCDate(d.getUTCDate() + 6);
  const end = d.toISOString().split("T")[0];

  const month = new Date().getMonth();
  const qStartMonth = Math.floor(month / 3) * 3;
  const qStart = `${new Date().getFullYear()}-${String(qStartMonth + 1).padStart(2, "0")}-01`;
  const effectiveStart = start < qStart ? qStart : start;

  return { start: effectiveStart, end, key: effectiveStart };
}

function dateInRange(d: string | undefined, s: string, e: string) {
  if (!d) return false;
  const ds = d.split("T")[0];
  return ds >= s && ds <= e;
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
    const df = { on_or_after: week.start, on_or_before: week.end };
    const results: Record<string, unknown> = { week };

    // ── Evolution Drafting (Victor + Stripe) ──
    const victorKey = process.env.VICTOR_API_KEY;
    const stripeKey = process.env.EVOLUTION_STRIPE_API_KEY;
    if (victorKey) {
      const IDS = {
        leads: "cmnghk4n2002eg0vp8xnlce1r", answerRate: "cmo99tx3c00000ajvtdf2fsct",
        conversion: "cmnghk4qg002fg0vpvk7bjgas", sales: "cmo98szor00000ajl0pd53jd7",
        jobsCompleted: "cmnghk4tt002gg0vp6b1ni46z", finalsCollected: "cmoa7li1800000akvlcw9ys8a",
        revenue: "cmnghk4x5002hg0vplxap51fy", avgTurnaround: "cmoa9su9w00000ai5l735u1wy",
        upsellRevenue: "cmo99rnyz00000ak16eovbe20",
      };

      const victorRes = await fetch(
        `https://victor-evo.vercel.app/api/v1/scorecards/company-weekly?from=${week.start}&to=${week.end}`,
        { headers: { Authorization: `Bearer ${victorKey}` } }
      );
      const victorData = await victorRes.json();
      const vw = victorData.data?.[0];

      if (vw) {
        // Count total leads from clients API (scorecard filters junk)
        let totalLeads = vw.leadsByWeek;
        try {
          let pg = 1, pgDone = false, lc = 0;
          const cutoff = week.start + "T00:00:00.000Z";
          while (!pgDone) {
            const cRes = await fetch(
              `https://victor-evo.vercel.app/api/v1/clients?limit=100&sort=createdAt&order=desc&page=${pg}`,
              { headers: { Authorization: `Bearer ${victorKey}` } }
            );
            const cData = await cRes.json();
            for (const c of cData.data || []) {
              if (c.createdAt < cutoff) { pgDone = true; break; }
              const ds = c.createdAt.split("T")[0];
              if (ds >= week.start && ds <= week.end) lc++;
            }
            if (!cData.data?.length || pg >= (cData.meta?.totalPages || 1)) pgDone = true;
            pg++;
          }
          if (lc > 0) totalLeads = lc;
        } catch { /* fall back to scorecard count */ }

        const cr = totalLeads > 0 ? ((vw.salesCount / totalLeads) * 100).toFixed(1) : "0";
        await upsertEntry(IDS.leads, week.key, String(totalLeads));
        await upsertEntry(IDS.answerRate, week.key, vw.answerRatePercent.toFixed(1));
        await upsertEntry(IDS.conversion, week.key, cr);
        await upsertEntry(IDS.sales, week.key, String(vw.salesCount));
        await upsertEntry(IDS.jobsCompleted, week.key, String(vw.jobsCompleted));
        await upsertEntry(IDS.finalsCollected, week.key, String(vw.finalsCollected));
        await upsertEntry(IDS.avgTurnaround, week.key, vw.avgTurnaroundDays.toFixed(1));
        await upsertEntry(IDS.upsellRevenue, week.key, String(Math.round(vw.revenueFromUpsellsCents / 100)));

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
        await upsertEntry(IDS.revenue, week.key, String(Math.round(stripeRev)));

        results.evolution = {
          leads: totalLeads, ar: vw.answerRatePercent.toFixed(1), cr,
          sold: vw.salesCount, completed: vw.jobsCompleted, finals: vw.finalsCollected,
          avgTT: vw.avgTurnaroundDays.toFixed(1), stripeRev: Math.round(stripeRev),
          upsell: Math.round(vw.revenueFromUpsellsCents / 100),
        };
      }
    }

    // ── Sentri Homes ──
    const sentriKey = process.env.SENTRI_NOTION_API_KEY;
    if (sentriKey) {
      const IDS = { revenue: "cmnghk5aq002lg0vph9xkl73d", sales: "cmo996jw100000ajs6s1qqztt", jobsCompleted: "cmo996vv400010ajsra5ndqel", homeBuildingSales: "cmo997jja00020ajs7rl286os" };

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

      await upsertEntry(IDS.sales, week.key, String(weekSold.length));
      await upsertEntry(IDS.jobsCompleted, week.key, String(validFP.length));
      await upsertEntry(IDS.revenue, week.key, String(Math.round(rev)));
      await upsertEntry(IDS.homeBuildingSales, week.key, String(homeBuild));

      results.sentri = { sales: weekSold.length, jobs: validFP.length, rev: Math.round(rev), homeBuild };
    }

    return NextResponse.json({ success: true, ...results });
  } catch (error) {
    console.error("Scorecard sync error:", error);
    return NextResponse.json({ error: "Sync failed", details: String(error) }, { status: 500 });
  }
}
