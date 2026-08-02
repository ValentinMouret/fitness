import { DotsVerticalIcon } from "@radix-ui/react-icons";
import {
  AlertDialog,
  Box,
  Button,
  DropdownMenu,
  Flex,
  IconButton,
  Text,
  Tooltip,
} from "@radix-ui/themes";
import { useState } from "react";
import { Form, Link, useFetcher } from "react-router";
import { z } from "zod";
import { zfd } from "zod-form-data";
import { EmptyState } from "~/components/EmptyState";
import {
  deleteTemplate,
  getTemplatesForStartDialog,
} from "~/modules/fitness/infra/workout-template.service.server";
import { createWorkoutTemplateCardViewModel } from "~/modules/fitness/presentation/view-models/workout-template-card.view-model";
import { formText } from "~/utils/form-data";
import type { Route } from "./+types/index";
import "./index.css";

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
                <Box className="workout-templates__main">
                  <Text
                    size="4"
                    weight="bold"
                    className="workout-templates__title"
                  >
                    {template.name}
                  </Text>
                  <Text
                    as="p"
                    size="2"
                    mt="1"
                    className="workout-templates__muted"
                  >
                    {template.exerciseCount} exercises
                    {template.usageCount > 0 &&
                      ` \u00B7 ${template.usageLabel}`}
                  </Text>
                  <Text
                    as="p"
                    size="1"
                    mt="1"
                    className="workout-templates__muted"
                  >
                    {template.lastUsedLabel}
                  </Text>
                  {template.exerciseNames.length > 0 && (
                    <Text
                      as="p"
                      size="1"
                      mt="2"
                      className="workout-templates__muted"
                    >
                      {template.exerciseNames.join(", ")}
                      {template.exerciseCount > template.exerciseNames.length &&
                        ` +${template.exerciseCount - template.exerciseNames.length} more`}
                    </Text>
                  )}
                </Box>

                <Flex
                  align="center"
                  gap="2"
                  className="workout-templates__actions"
                >
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

                  <TemplateActions
                    templateId={template.id}
                    templateName={template.name}
                  />
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

function TemplateActions({
  templateId,
  templateName,
}: {
  readonly templateId: string;
  readonly templateName: string;
}) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const fetcher = useFetcher();

  return (
    <>
      <DropdownMenu.Root>
        <Tooltip content="Template actions">
          <DropdownMenu.Trigger>
            <IconButton variant="ghost" size="1" aria-label="Template actions">
              <DotsVerticalIcon />
            </IconButton>
          </DropdownMenu.Trigger>
        </Tooltip>
        <DropdownMenu.Content>
          <DropdownMenu.Item
            color="red"
            onSelect={() => setShowDeleteDialog(true)}
          >
            Delete Template
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Root>

      <AlertDialog.Root
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
      >
        <AlertDialog.Content maxWidth="450px">
          <AlertDialog.Title>Delete template</AlertDialog.Title>
          <AlertDialog.Description size="2">
            Delete {templateName}? This action cannot be undone.
          </AlertDialog.Description>

          <Flex gap="3" mt="4" justify="end">
            <AlertDialog.Cancel>
              <Button variant="soft" color="gray">
                Cancel
              </Button>
            </AlertDialog.Cancel>
            <fetcher.Form method="post">
              <input type="hidden" name="intent" value="delete-template" />
              <input type="hidden" name="templateId" value={templateId} />
              <Button type="submit" color="red">
                Delete
              </Button>
            </fetcher.Form>
          </Flex>
        </AlertDialog.Content>
      </AlertDialog.Root>
    </>
  );
}
