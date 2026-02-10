import { DotsVerticalIcon } from "@radix-ui/react-icons";
import {
  Box,
  Button,
  DropdownMenu,
  Flex,
  IconButton,
  Text,
} from "@radix-ui/themes";
import { Form, Link, useFetcher } from "react-router";
import { zfd } from "zod-form-data";
import { EmptyState } from "~/components/EmptyState";
import {
  deleteTemplate,
  getTemplatesForStartDialog,
} from "~/modules/fitness/application/workout-template.service.server";
import { createWorkoutTemplateCardViewModel } from "~/modules/fitness/presentation/view-models/workout-template-card.view-model";
import { formText } from "~/utils/form-data";
import { z } from "zod";
import type { Route } from "./+types/index";

export const handle = {
  header: () => ({
    title: "Templates",
    subtitle: "Workout blueprints",
  }),
};

export const loader = async () => {
  const templates = await getTemplatesForStartDialog();
  return { templates };
};

export const action = async ({ request }: Route.ActionArgs) => {
  const formData = await request.formData();
  const schema = zfd.formData({
    intent: formText(z.string()),
    templateId: formText(z.string()),
  });
  const parsed = schema.safeParse(formData);

  if (!parsed.success) {
    return { error: "Invalid form data" };
  }

  if (parsed.data.intent === "delete-template") {
    return deleteTemplate(parsed.data.templateId);
  }

  return { error: "Unknown action" };
};

export default function TemplatesPage({ loaderData }: Route.ComponentProps) {
  const { templates } = loaderData;
  const templateViewModels = templates.map(createWorkoutTemplateCardViewModel);

  return (
    <Box>
      {templateViewModels.length === 0 ? (
        <EmptyState
          icon="📋"
          title="No templates yet"
          description="Complete a workout and save it as a template."
        />
      ) : (
        templateViewModels.map((template, i) => (
          <Box key={template.id}>
            {i > 0 && <hr className="rule-divider" />}
            <Box py="4">
              <Flex justify="between" align="start">
                <Box style={{ flex: 1, minWidth: 0 }}>
                  <Text
                    size="4"
                    weight="bold"
                    style={{
                      fontFamily: "var(--font-display)",
                      display: "block",
                    }}
                  >
                    {template.name}
                  </Text>
                  <Text
                    as="p"
                    size="2"
                    mt="1"
                    style={{ color: "var(--brand-text-secondary)" }}
                  >
                    {template.exerciseCount} exercises
                    {template.usageCount > 0 &&
                      ` \u00B7 ${template.usageLabel}`}
                  </Text>
                  <Text
                    as="p"
                    size="1"
                    mt="1"
                    style={{ color: "var(--brand-text-secondary)" }}
                  >
                    {template.lastUsedLabel}
                  </Text>
                  {template.exerciseNames.length > 0 && (
                    <Text
                      as="p"
                      size="1"
                      mt="2"
                      style={{ color: "var(--brand-text-secondary)" }}
                    >
                      {template.exerciseNames.join(", ")}
                      {template.exerciseCount > template.exerciseNames.length &&
                        ` +${template.exerciseCount - template.exerciseNames.length} more`}
                    </Text>
                  )}
                </Box>

                <Flex align="center" gap="2" style={{ flexShrink: 0 }}>
                  <Form method="post" action="/workouts/create">
                    <input
                      type="hidden"
                      name="templateId"
                      value={template.id}
                    />
                    <Button type="submit" size="1" variant="soft">
                      Start
                    </Button>
                  </Form>

                  <TemplateActions templateId={template.id} />
                </Flex>
              </Flex>
            </Box>
          </Box>
        ))
      )}

      <Flex mt="6">
        <Button variant="outline" size="2" asChild>
          <Link to="/workouts">Back to Workouts</Link>
        </Button>
      </Flex>
    </Box>
  );
}

function TemplateActions({ templateId }: { readonly templateId: string }) {
  const fetcher = useFetcher();

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger>
        <IconButton variant="ghost" size="1">
          <DotsVerticalIcon />
        </IconButton>
      </DropdownMenu.Trigger>
      <DropdownMenu.Content>
        <DropdownMenu.Item
          color="red"
          onSelect={() =>
            fetcher.submit(
              { intent: "delete-template", templateId },
              { method: "post" },
            )
          }
        >
          Delete Template
        </DropdownMenu.Item>
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  );
}
