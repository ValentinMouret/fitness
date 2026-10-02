import { z } from "zod";
import { fromDateString, toDateString, today } from "~/time";

export function requestDay(request: Request): Date {
  const day = z.iso
    .date()
    .safeParse(
      new URL(request.url).searchParams.get("day") ?? toDateString(today()),
    );
  if (!day.success) throw new Response("Invalid calendar day", { status: 400 });
  return fromDateString(day.data);
}
