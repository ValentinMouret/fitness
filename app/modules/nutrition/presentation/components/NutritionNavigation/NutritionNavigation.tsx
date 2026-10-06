import { Button } from "@radix-ui/themes";
import { Link } from "react-router";
import "./NutritionNavigation.css";

export function NutritionNavigation({
  current,
  date,
}: {
  readonly current: "today" | "templates";
  readonly date?: string;
}) {
  const params = new URLSearchParams();
  if (date) params.set("date", date);
  const path = current === "today" ? "/nutrition/templates" : "/nutrition";
  const href = params.size ? `${path}?${params}` : path;
  return (
    <nav className="nutrition-navigation" aria-label="Nutrition navigation">
      <Button asChild variant="soft">
        <Link to={href}>
          {current === "today" ? "Meal templates →" : "← Back to today"}
        </Link>
      </Button>
    </nav>
  );
}
