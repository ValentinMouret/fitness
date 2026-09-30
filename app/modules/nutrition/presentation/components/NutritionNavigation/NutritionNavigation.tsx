import { Link } from "react-router";
import "./NutritionNavigation.css";

export function NutritionNavigation({
  current,
}: {
  readonly current: "today" | "templates";
}) {
  return (
    <nav className="nutrition-navigation" aria-label="Nutrition views">
      <Link
        to="/nutrition"
        aria-current={current === "today" ? "page" : undefined}
      >
        Today
      </Link>
      <Link
        to="/nutrition/templates"
        aria-current={current === "templates" ? "page" : undefined}
      >
        Templates
      </Link>
    </nav>
  );
}
