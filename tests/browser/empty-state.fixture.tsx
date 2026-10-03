import { Theme } from "@radix-ui/themes";
import { createRoot } from "react-dom/client";
import { EmptyState } from "~/components/EmptyState";
import { SectionHeader } from "~/components/SectionHeader";

export function mountEmptyStateFixture(root: HTMLElement) {
  createRoot(root).render(
    <Theme accentColor="tomato" grayColor="sand" radius="medium">
      <main>
        <h1>Nutrition</h1>
        <EmptyState
          icon="🍽️"
          title="No meals yet"
          description="Log a meal to begin."
        />
        <SectionHeader title="Meal templates" />
        <EmptyState
          icon="🍽️"
          title="No templates yet"
          headingLevel="h3"
          description="No templates assigned to dinner yet."
        />
      </main>
    </Theme>,
  );
}
