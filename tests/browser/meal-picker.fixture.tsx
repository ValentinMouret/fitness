import "@radix-ui/themes/styles.css";
import "~/app.css";
import { Button, Theme } from "@radix-ui/themes";
import { useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { TemplateSelectionModal } from "~/modules/nutrition/presentation/components/TemplateSelectionModal/TemplateSelectionModal";
import type { TemplateSelectionViewModel } from "~/modules/nutrition/presentation/view-models/template-selection.view-model";
import { mountWorkoutCompletionFixture } from "./workout-completion.fixture";

function MealPickerFixture() {
  const [open, setOpen] = useState(false);
  const openerRef = useRef<HTMLButtonElement>(null);
  const [isPublic, setIsPublic] = useState(false);
  const [result, setResult] = useState("No template applied");
  const viewModel: TemplateSelectionViewModel = {
    mealType: "lunch",
    mealDisplayName: "Lunch",
    hasTemplates: true,
    templates: [
      {
        id: "lunch-template",
        name: "Lunch bowl",
        usageCount: 2,
        isPublic,
        nutrition: { calories: "400", protein: "30", carbs: "40", fat: "10" },
      },
    ],
  };

  return (
    <Theme accentColor="tomato" grayColor="sand" radius="medium">
      <Button
        type="button"
        onClick={(event) => {
          openerRef.current = event.currentTarget;
          setOpen(true);
        }}
      >
        Use template for Lunch
      </Button>
      <output>{result}</output>
      <TemplateSelectionModal
        isOpen={open}
        returnFocusRef={openerRef}
        onClose={() => setOpen(false)}
        viewModel={viewModel}
        onApply={() => {
          setResult("Template applied");
          setOpen(false);
        }}
        onCopyLink={() => setResult("Link copied")}
        onToggleShare={(_id, shared) => {
          setIsPublic(shared);
          setResult(shared ? "Template published" : "Sharing stopped");
        }}
      />
    </Theme>
  );
}

const root = document.getElementById("root");
if (!root) throw new Error("Missing picker fixture root");
if (window.location.hash === "#workout") mountWorkoutCompletionFixture(root);
else createRoot(root).render(<MealPickerFixture />);
