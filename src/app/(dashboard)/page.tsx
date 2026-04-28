import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCurrentQuarter } from "@/lib/quarter";
import { getVisibleBusinesses } from "@/lib/access";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { TargetIcon, CheckSquareIcon, BuildingIcon } from "lucide-react";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  const { quarter: currentQ, year: currentYear } = getCurrentQuarter();

  // Get businesses the user can see
  const visibleBusinesses = session?.user?.id
    ? await getVisibleBusinesses(session.user.id, session.user.role)
    : [];
  const visibleIds = visibleBusinesses.map((b) => b.id);

  const businesses = await prisma.business.findMany({
    where: { id: { in: visibleIds } },
    orderBy: { name: "asc" },
    include: {
      rocks: { where: { year: currentYear, quarter: currentQ } },
      todos: { where: { done: false } },
      owners: { include: { user: true } },
    },
  });

  // My rocks / todos for summary
  const userId = session?.user?.id;
  const myRocks = userId
    ? await prisma.rock.count({ where: { ownerId: userId, year: currentYear, quarter: currentQ, done: false } })
    : 0;
  const myTodos = userId
    ? await prisma.todo.count({ where: { ownerId: userId, done: false } })
    : 0;

  return (
    <div className="flex flex-col gap-6 animate-fade-in-up">
      {/* Welcome + personal summary */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight gradient-text">
          Welcome, {session?.user?.name ?? "Owner"}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Here&apos;s a summary of your portfolio.
        </p>
      </div>

      {/* Personal quick stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Link href="/my-rocks">
          <Card className="cursor-pointer card-interactive">
            <CardHeader className="flex flex-row items-center gap-2 pb-2">
              <TargetIcon className="h-4 w-4 text-orange-500" />
              <CardTitle className="text-sm font-medium">My Open Rocks</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{myRocks}</p>
              <p className="text-xs text-muted-foreground mt-1">Q{currentQ} {currentYear}</p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/my-todos">
          <Card className="cursor-pointer card-interactive">
            <CardHeader className="flex flex-row items-center gap-2 pb-2">
              <CheckSquareIcon className="h-4 w-4 text-blue-500" />
              <CardTitle className="text-sm font-medium">My Open To-Dos</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{myTodos}</p>
              <p className="text-xs text-muted-foreground mt-1">Across all businesses</p>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Business cards */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Portfolio</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {businesses.map((business) => {
            const totalRocks = business.rocks.length;
            const doneRocks = business.rocks.filter((r) => r.done).length;
            const openTodos = business.todos.length;

            return (
              <Link key={business.id} href={`/${business.slug}`}>
                <Card className="cursor-pointer card-interactive h-full">
                  <CardHeader className="pb-2">
                    <div className="flex items-start gap-2">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10">
                        <BuildingIcon className="h-4 w-4 text-primary" />
                      </div>
                      <CardTitle className="text-base leading-tight">{business.name}</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Q{currentQ} Rocks</span>
                        <span className="font-medium">
                          {doneRocks}/{totalRocks}
                        </span>
                      </div>
                      {totalRocks > 0 && (
                        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full bg-green-500 transition-all"
                            style={{ width: `${Math.round((doneRocks / totalRocks) * 100)}%` }}
                          />
                        </div>
                      )}
                      <div className="flex items-center justify-between text-xs mt-1">
                        <span className="text-muted-foreground">Open To-Dos</span>
                        <span className="font-medium">{openTodos}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
