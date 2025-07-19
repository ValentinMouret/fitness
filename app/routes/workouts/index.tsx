import { Container, Heading, Link as RadixLink } from "@radix-ui/themes";
import { Link } from "react-router";

export default function WorkoutsPage() {
  return (
    <Container>
      <Heading>Workouts</Heading>

      <RadixLink asChild>
        <Link to="/workouts/exercises">Exercises</Link>
      </RadixLink>
    </Container>
  );
}
