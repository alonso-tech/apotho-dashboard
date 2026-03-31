"use client";

import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCwIcon, TrendingUpIcon, TrendingDownIcon, DollarSignIcon } from "lucide-react";

interface FinancialRow {
  date: string;
  description: string;
  amount: number;
  category: string;
  isRevenue: boolean;
}

interface FinancialSummary {
  sheetName: string;
  revenue: number;
  expenses: number;
  netIncome: number;
  rows: FinancialRow[];
  expenseByCategory: Record<string, number>;
}

interface FinancialsDashboardProps {
  slug: string;
}

function formatCurrency(n: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

export function FinancialsDashboard({ slug }: FinancialsDashboardProps) {
  const [data, setData] = useState<FinancialSummary[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedSheet, setSelectedSheet] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/financials?slug=${encodeURIComponent(slug)}`);
      const json = await res.json();
      if (json.error && !json.data?.length) {
        setError(json.error);
        setData([]);
      } else {
        setData(json.data ?? []);
        if (json.data?.length && !selectedSheet) {
          setSelectedSheet(json.data[0].sheetName);
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch");
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [slug, selectedSheet]);

  const activeSheet = data?.find((s) => s.sheetName === selectedSheet) ?? data?.[0] ?? null;

  return (
    <div className="flex flex-col gap-6">
      {/* Refresh button */}
      <div className="flex items-center gap-3">
        <Button onClick={fetchData} disabled={loading} variant="outline">
          <RefreshCwIcon className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          {loading ? "Loading..." : data ? "Refresh" : "Load Financial Data"}
        </Button>
        {data && (
          <span className="text-xs text-muted-foreground">
            Data pulled from Google Sheets
          </span>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {data !== null && data.length === 0 && !error && (
        <div className="rounded-lg border border-dashed p-6 text-center text-muted-foreground text-sm">
          No MACU/bank tabs found in the spreadsheet. Make sure the sheet tab name includes &quot;MACU&quot; or &quot;bank&quot;.
        </div>
      )}

      {/* Sheet selector (if multiple sheets) */}
      {data && data.length > 1 && (
        <div className="flex gap-2">
          {data.map((s) => (
            <button
              key={s.sheetName}
              onClick={() => setSelectedSheet(s.sheetName)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors border ${
                s.sheetName === (selectedSheet ?? data[0]?.sheetName)
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background hover:bg-accent border-input"
              }`}
            >
              {s.sheetName}
            </button>
          ))}
        </div>
      )}

      {/* Summary cards */}
      {activeSheet && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center gap-2 pb-2">
                <TrendingUpIcon className="h-4 w-4 text-green-500" />
                <CardTitle className="text-sm font-medium">Revenue</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-green-600">{formatCurrency(activeSheet.revenue)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center gap-2 pb-2">
                <TrendingDownIcon className="h-4 w-4 text-red-500" />
                <CardTitle className="text-sm font-medium">Expenses</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-red-600">{formatCurrency(activeSheet.expenses)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center gap-2 pb-2">
                <DollarSignIcon className="h-4 w-4 text-blue-500" />
                <CardTitle className="text-sm font-medium">Net Income</CardTitle>
              </CardHeader>
              <CardContent>
                <p className={`text-2xl font-bold ${activeSheet.netIncome >= 0 ? "text-blue-600" : "text-red-600"}`}>
                  {formatCurrency(activeSheet.netIncome)}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Expense breakdown */}
          {Object.keys(activeSheet.expenseByCategory).length > 0 && (
            <div>
              <h2 className="text-base font-semibold mb-3">Expense Breakdown</h2>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {Object.entries(activeSheet.expenseByCategory)
                  .sort(([, a], [, b]) => b - a)
                  .map(([category, amount]) => (
                    <div key={category} className="flex items-center justify-between rounded-lg border p-3">
                      <span className="text-sm truncate">{category}</span>
                      <span className="text-sm font-medium text-red-600 ml-3 shrink-0">
                        {formatCurrency(amount)}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Transaction table */}
          <div>
            <h2 className="text-base font-semibold mb-3">
              Transactions ({activeSheet.rows.length})
            </h2>
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left py-2 px-3 font-medium">Date</th>
                    <th className="text-left py-2 px-3 font-medium">Description</th>
                    <th className="text-left py-2 px-3 font-medium">Category</th>
                    <th className="text-right py-2 px-3 font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {activeSheet.rows.slice(0, 100).map((row, i) => (
                    <tr key={i} className="border-b last:border-0 hover:bg-muted/20">
                      <td className="py-2 px-3 text-muted-foreground whitespace-nowrap">{row.date}</td>
                      <td className="py-2 px-3 max-w-[280px] truncate">{row.description}</td>
                      <td className="py-2 px-3 text-muted-foreground">{row.category}</td>
                      <td className={`py-2 px-3 text-right font-medium ${row.isRevenue ? "text-green-600" : "text-red-600"}`}>
                        {row.isRevenue ? "+" : ""}{formatCurrency(row.amount)}
                      </td>
                    </tr>
                  ))}
                  {activeSheet.rows.length > 100 && (
                    <tr>
                      <td colSpan={4} className="py-3 px-3 text-center text-xs text-muted-foreground">
                        Showing first 100 of {activeSheet.rows.length} transactions
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
