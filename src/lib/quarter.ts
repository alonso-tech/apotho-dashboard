export function getCurrentQuarter() {
  const now = new Date();
  const month = now.getMonth(); // 0-11
  const quarter = Math.floor(month / 3) + 1;
  const year = now.getFullYear();
  return { quarter, year };
}
