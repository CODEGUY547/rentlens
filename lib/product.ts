import type { ChargeRow } from "./types";

export const KAMPALA_TIME_ZONE = "Africa/Kampala";

export function localDateISO(timeZone = KAMPALA_TIME_ZONE, date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

export function currentMonthKey(timeZone = KAMPALA_TIME_ZONE, date = new Date()) {
  return localDateISO(timeZone, date).slice(0, 7);
}

export function formatRentPeriod(value: string) {
  return new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString("en-UG", {
    month: "long",
    year: "numeric",
  });
}

export function splitUnit(value: string) {
  const [property = "Property", ...unitParts] = value.split(" · ");
  return { property, unit: unitParts.join(" · ") || value };
}

export function allocatePayment(charges: ChargeRow[], amount: number) {
  let remaining = Math.max(0, amount);
  return charges
    .filter((charge) => charge.status === "due" || charge.status === "partial")
    .sort((a, b) => a.due_date.localeCompare(b.due_date))
    .map((charge) => {
      const outstanding = Math.max(0, charge.amount - charge.paid_amount);
      const allocated = Math.min(remaining, outstanding);
      remaining -= allocated;
      return { ...charge, outstanding, allocated };
    })
    .filter((charge) => charge.allocated > 0);
}
