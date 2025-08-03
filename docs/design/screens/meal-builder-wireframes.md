# Meal Builder Wireframes & Design Specification

## Overview
The Meal Builder feature enables users to compose meals that meet specific nutritional objectives while ensuring adequate satiety. This specification provides detailed wireframes and interaction patterns for implementation.

## Screen Layout

### Desktop View (1440px)
```
┌────────────────────────────────────────────────────────────────────────┐
│ ← Back to Nutrition                                    Meal Builder     │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  ┌─────────────────────────────────┐  ┌─────────────────────────────┐│
│  │ Set Your Objectives             │  │ Current Totals              ││
│  │                                 │  │                             ││
│  │ Calories  ┌─────────┐          │  │ ███████░░░ 650/700 kcal     ││
│  │          │  700    │ kcal      │  │            93%              ││
│  │          └─────────┘           │  │                             ││
│  │                                 │  │ ██████░░░░ 25/30g protein   ││
│  │ Protein  ┌─────────┐           │  │            83%              ││
│  │          │   30    │ g         │  │                             ││
│  │          └─────────┘           │  │ Carbs: 72g  Fats: 28g       ││
│  │                                 │  │ Fiber: 8.5g                 ││
│  │ Carbs    ┌─────────┐           │  │                             ││
│  │          │        │ g (optional)│  │ ┌───────────────────────┐   ││
│  │          └─────────┘           │  │ │ Satiety Prediction    │   ││
│  │                                 │  │ │ ●●●●○ High (4/5)      │   ││
│  │ Fats     ┌─────────┐           │  │ │ ~3-4 hours fullness   │   ││
│  │          │        │ g (optional)│  │ │ Volume: ~650ml        │   ││
│  │          └─────────┘           │  │ └───────────────────────┘   ││
│  │                                 │  │                             ││
│  │ Desired Satiety (1-5)          │  │                             ││
│  │ ○ 1 ○ 2 ○ 3 ● 4 ○ 5           │  │                             ││
│  │ Light    Moderate    Very Full │  │                             ││
│  └─────────────────────────────────┘  └─────────────────────────────┘│
│                                                                        │
│  Selected Ingredients (4)                                             │
│  ┌──────────────────────────────────────────────────────────────────┐│
│  │ ┌────────────────────────────────────────────────────────────┐  ││
│  │ │ 🍗 Chicken Breast (Firm Solid)                          ⋮ │  ││
│  │ │ [●━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━] 150g         │  ││
│  │ │  50g        100g       150g       200g       250g       │  ││
│  │ │ 180 kcal • 38g protein • 0g carbs • 4g fat             │  ││
│  │ └────────────────────────────────────────────────────────────┘  ││
│  │                                                                  ││
│  │ ┌────────────────────────────────────────────────────────────┐  ││
│  │ │ 🍚 White Rice, Cooked (Soft Solid)                      ⋮ │  ││
│  │ │ [━━━━━━━━━●━━━━━━━━━━━━━━━━━━━━━━━━━━━━━] 80g          │  ││
│  │ │  30g        60g        90g       120g      150g        │  ││
│  │ │ 104 kcal • 2g protein • 23g carbs • 0.3g fat           │  ││
│  │ └────────────────────────────────────────────────────────────┘  ││
│  │                                                                  ││
│  │ ┌────────────────────────────────────────────────────────────┐  ││
│  │ │ 🥦 Broccoli, Steamed (Firm Solid)                       ⋮ │  ││
│  │ │ [━━━━━━━━━━━━━━━●━━━━━━━━━━━━━━━━━━━━━━━] 150g         │  ││
│  │ │  50g       100g      150g      200g      250g          │  ││
│  │ │ 51 kcal • 4g protein • 10g carbs • 0.5g fat • 3.9g fiber│  ││
│  │ └────────────────────────────────────────────────────────────┘  ││
│  │                                                                  ││
│  │ ┌────────────────────────────────────────────────────────────┐  ││
│  │ │ 🫒 Olive Oil (Liquid)                                   ⋮ │  ││
│  │ │ [━━●━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━] 10g          │  ││
│  │ │  5g    10g    15g    20g    25g                        │  ││
│  │ │ 88 kcal • 0g protein • 0g carbs • 10g fat              │  ││
│  │ └────────────────────────────────────────────────────────────┘  ││
│  └──────────────────────────────────────────────────────────────────┘│
│                                                                        │
│  ┌─────────────────┐  ┌──────────────────┐  ┌───────────────────┐   │
│  │ + Add Ingredient│  │ 🤖 AI Suggest    │  │ 💾 Save Template  │   │
│  └─────────────────┘  └──────────────────┘  └───────────────────┘   │
│                                                                        │
│  ┌──────────────────────────────────────────────────────────────────┐│
│  │ Satiety Analysis                                          [▼ Hide]││
│  │                                                                  ││
│  │ Satiety Score Breakdown:                                         ││
│  │ • Protein contribution: 38g × 0.4 = 15.2 points                  ││
│  │ • Fiber contribution: 4.5g × 0.3 = 1.35 points                   ││
│  │ • Volume factor: 8.2 × 0.2 = 1.64 points                         ││
│  │ • Texture modifier: 1.28 (mixed textures)                        ││
│  │ Total Score: 23.3 = High satiety (4/5)                           ││
│  │                                                                  ││
│  │ Tips to increase satiety:                                         ││
│  │ • Add more vegetables for volume and fiber                       ││
│  │ • Consider adding beans or lentils for fiber + protein           ││
│  └──────────────────────────────────────────────────────────────────┘│
└────────────────────────────────────────────────────────────────────────┘
```

### Mobile View (375px)
```
┌─────────────────────────┐
│ ← Meal Builder         │
├─────────────────────────┤
│                         │
│ Objectives              │
│ ┌─────────────────────┐ │
│ │ Calories: 700 kcal  │ │
│ │ Protein: 30g        │ │
│ │ Carbs: -- (optional)│ │
│ │ Fats: -- (optional) │ │
│ │ Satiety: ●●●●○ (4)  │ │
│ └─────────────────────┘ │
│                         │
│ Current Totals          │
│ ┌─────────────────────┐ │
│ │ ████████░ 650/700   │ │
│ │          kcal (93%) │ │
│ │                     │ │
│ │ ██████░░░ 25/30g    │ │
│ │         protein 83% │ │
│ │                     │ │
│ │ Satiety: ●●●●○ High │ │
│ │ ~3-4 hrs fullness   │ │
│ │ Volume: ~650ml      │ │
│ └─────────────────────┘ │
│                         │
│ Ingredients (4)         │
│ ┌─────────────────────┐ │
│ │ 🍗 Chicken Breast   │ │
│ │ [●━━━━━━━━━] 150g   │ │
│ │ 180 kcal • 38g pro  │ │
│ ├─────────────────────┤ │
│ │ 🍚 White Rice       │ │
│ │ [━━━●━━━━━━] 80g    │ │
│ │ 104 kcal • 23g carb │ │
│ ├─────────────────────┤ │
│ │ 🥦 Broccoli         │ │
│ │ [━━━━━●━━━━] 150g   │ │
│ │ 51 kcal • 3.9g fib  │ │
│ ├─────────────────────┤ │
│ │ 🫒 Olive Oil        │ │
│ │ [●━━━━━━━━━] 10g    │ │
│ │ 88 kcal • 10g fat   │ │
│ └─────────────────────┘ │
│                         │
│ [+ Add] [AI] [Save]     │
│                         │
└─────────────────────────┘
```

## Component Specifications

### 1. Objectives Panel

**Purpose**: Allow users to set nutritional targets and desired satiety level

**Elements**:
- Numeric input fields for all macros:
  - Calories and protein (required)
  - Carbs and fats (optional - empty means no target)
- Radio button group for desired satiety (1-5 scale)
- Visual scale indicator below radio buttons

**States**:
- Default: Empty optional fields show placeholder "(optional)"
- Active: Filled values with visual feedback
- Error: Red highlight if targets conflict
- Empty optional: Gray text shows "--" in summary

**Interactions**:
- Tab navigation between fields
- Enter key to confirm values
- Real-time validation
- Empty optional fields are ignored in calculations

### 2. Current Totals Panel

**Purpose**: Show real-time progress toward objectives with satiety prediction

**Visual Design**:
- Progress bars with gradient fill (green when close to target)
- Percentage indicators (only for set targets)
- Satiety score with visual representation (filled circles, 1-5 scale)
- Estimated fullness duration
- Volume indicator

**Color Coding**:
- Under 80%: Gray/neutral
- 80-95%: Transitioning to green
- 95-105%: Green (on target)
- Over 105%: Amber warning

### 3. Ingredient Cards

**Purpose**: Control ingredient quantities with detailed nutritional feedback

**Anatomy**:
- Icon + name + texture indicator
- Smart slider with contextual range
- Quantity display with unit
- Macro breakdown (calories, protein, carbs, fat, fiber)
- Three-dot menu for actions

**Slider Design**:
- Thumb: Large touch target (44px on mobile)
- Track: Thick line with subtle gradient
- Markers: Common portion sizes
- Labels: Key measurements below track

**Texture Indicators**:
- 💧 Liquid (water drop)
- 🥤 Semi-liquid (cup)
- 🍮 Soft solid (pudding)
- 🥩 Firm solid (meat)

### 4. Satiety Prediction Component

**Purpose**: Provide clear, actionable satiety information

**Visual Elements**:
```
┌─────────────────────────┐
│ Satiety Prediction      │
│                         │
│ ●●●●○ High (4/5)        │
│                         │
│ Expected fullness:      │
│ ~3-4 hours              │
│                         │
│ Volume: ~650ml          │
│ (2.5 cups)              │
└─────────────────────────┘
```

**Satiety Scale**:
- 1/5: ●○○○○ Light snack (~1-2 hours)
- 2/5: ●●○○○ Small meal (~2-3 hours)
- 3/5: ●●●○○ Moderate meal (~3-4 hours)
- 4/5: ●●●●○ Filling meal (~4-5 hours)
- 5/5: ●●●●● Very filling meal (~5+ hours)

**Interaction**:
- Hover/tap for detailed breakdown
- Expandable panel with calculation details

### 5. Add Ingredient Modal

**Purpose**: Browse and select ingredients from categorized library

**Layout**:
```
┌──────────────────────────────┐
│ Add Ingredient         [×]   │
├──────────────────────────────┤
│ [🔍 Search ingredients...]   │
│                              │
│ Categories:                  │
│ [All] [Proteins] [Carbs]     │
│ [Fats] [Vegetables] [Dairy]  │
│                              │
│ ┌────────────────────────┐   │
│ │ 🥩 Beef, Lean Ground   │   │
│ │ 250 kcal/100g • 26g pro│   │
│ ├────────────────────────┤   │
│ │ 🍗 Chicken Thigh       │   │
│ │ 220 kcal/100g • 18g pro│   │
│ ├────────────────────────┤   │
│ │ 🥚 Eggs, Whole         │   │
│ │ 155 kcal/100g • 13g pro│   │
│ └────────────────────────┘   │
└──────────────────────────────┘
```

### 6. AI Suggestion Panel

**Purpose**: Smart recommendations to reach targets

**Design**:
```
┌────────────────────────────────┐
│ AI Suggestions                 │
│                                │
│ To reach your protein target:  │
│                                │
│ Option 1: Add 50g Greek Yogurt │
│ [+7g protein, +50 kcal]        │
│ [Add this]                     │
│                                │
│ Option 2: Increase chicken to  │
│ 170g [+4g protein, +24 kcal]   │
│ [Apply]                        │
│                                │
│ For satiety level 4, consider  │
│ adding high-fiber vegetables   │
└────────────────────────────────┘
```

## Interaction Patterns

### Slider Interactions
1. **Click & Drag**: Smooth sliding with live updates
2. **Click on Track**: Jump to clicked position
3. **Keyboard Control**: 
   - Arrow keys: ±5g increments
   - Shift + Arrow: ±25g increments
4. **Direct Input**: Click quantity to type exact value

### Responsive Behavior
- **Desktop**: Side-by-side panels, horizontal sliders
- **Tablet**: Stacked panels, maintain horizontal sliders
- **Mobile**: Single column, compact cards, touch-optimized

### Loading States
- Skeleton screens for initial load
- Inline spinners for AI suggestions
- Optimistic updates for slider changes

### Error Handling
- Inline validation messages
- Toast notifications for save errors
- Graceful degradation if AI unavailable

## Animation Specifications

### Slider Animations
```css
/* Thumb hover */
transform: scale(1.1);
transition: transform 0.15s ease-out;

/* Value change */
transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
```

### Progress Bar Fills
```css
/* Smooth fill animation */
transition: width 0.35s cubic-bezier(0.4, 0, 0.2, 1);

/* Color transitions */
transition: background-color 0.25s ease;
```

### Card Expand/Collapse
```css
/* Height animation */
transition: height 0.25s cubic-bezier(0.4, 0, 0.2, 1);

/* Opacity for content */
transition: opacity 0.15s ease-in-out;
```

## Accessibility

### Keyboard Navigation
- Tab through all interactive elements
- Arrow keys for sliders and radio groups
- Enter/Space to activate buttons
- Escape to close modals

### Screen Reader Support
- ARIA labels for all controls
- Live regions for real-time updates
- Descriptive button text
- Progress announcements

### Visual Accessibility
- High contrast mode support
- Focus indicators (2px green outline)
- Minimum touch targets (44x44px)
- Clear visual hierarchy

## Implementation Notes

### React Router Integration
```typescript
// Route definition
{
  path: "nutrition/meal-builder",
  lazy: () => import("./routes/nutrition/meal-builder"),
}

// Loader for ingredient data
export async function loader() {
  const ingredients = await getIngredientLibrary();
  return json({ ingredients });
}

// Action for saving templates
export async function action({ request }) {
  const formData = await request.formData();
  // Save meal template logic
  return redirect("/nutrition");
}
```

### Component Structure
```
routes/nutrition/meal-builder.tsx
├── ObjectivesPanel
├── CurrentTotalsPanel
│   └── SatietyIndicator
├── IngredientList
│   └── IngredientCard
│       └── SmartSlider
├── AddIngredientModal
├── AISuggestionPanel
└── SaveTemplateDialog
```

### State Management
- Use `useFetcher` for optimistic updates
- Local state for slider values
- Debounced updates to prevent excessive rerenders
- Derived state for totals and satiety calculations

## Design Tokens

### Colors
```typescript
const mealBuilderColors = {
  satiety: {
    low: 'var(--gray-9)',
    moderate: 'var(--amber-9)', 
    high: 'var(--green-9)',
  },
  progress: {
    under: 'var(--gray-6)',
    near: 'var(--green-6)',
    over: 'var(--amber-6)',
  },
  texture: {
    liquid: 'var(--blue-3)',
    semiLiquid: 'var(--blue-4)',
    softSolid: 'var(--sand-4)',
    firmSolid: 'var(--sand-5)',
  },
};
```

### Spacing
```typescript
const mealBuilderSpacing = {
  cardPadding: 'var(--space-4)',
  panelGap: 'var(--space-6)',
  ingredientGap: 'var(--space-3)',
  sliderHeight: '40px',
};
```

## Next Steps
1. Implement base components following Radix UI patterns
2. Create satiety calculation service
3. Build ingredient library with texture categories
4. Implement smart slider with contextual ranges
5. Add AI suggestion logic
6. Create template save/load functionality
7. Add comprehensive tests
8. Gather user feedback and iterate