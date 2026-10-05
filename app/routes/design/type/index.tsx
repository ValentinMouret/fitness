import { Button, Heading, Text } from "@radix-ui/themes";
import { Link } from "react-router";
import "./type.css";
export function loader() {
  if (!import.meta.env.DEV) throw new Response("Not found", { status: 404 });
  return null;
}
export default function TypeIndex() {
  return (
    <main className="type-index">
      <Heading as="h1">One voice for Fitness</Heading>
      <Text as="p">
        Same sizes, content and interactions. Choose how much serif belongs in
        the app.
      </Text>
      <section>
        <Heading as="h2" size="5">
          A · Quiet editorial
        </Heading>
        <p>
          Crimson Pro for the page title only. DM Sans for every supporting
          heading, control and number. Recommended first comparison.
        </p>
        <Button asChild>
          <Link to="/design/type/editorial?screen=workout&saved=warm">
            Review editorial
          </Link>
        </Button>
      </section>
      <section>
        <Heading as="h2" size="5">
          B · Unified sans
        </Heading>
        <p>
          DM Sans throughout. Less contrast between page title and working
          content; a larger change to the app’s character.
        </p>
        <Button asChild variant="soft">
          <Link to="/design/type/sans?screen=workout&saved=warm">
            Review unified sans
          </Link>
        </Button>
      </section>
      <p>
        Use the page selector to compare workout, Dashboard, Nutrition, Habits
        and an editor. Fixture only: changes reset on reload; no database
        writes. New typography is pending review. Approved set-row behaviour
        stays separate.
      </p>
    </main>
  );
}
