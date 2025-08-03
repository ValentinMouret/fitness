# Meal Logger Wireframes

This document contains wireframes for the Meal Logger feature, including the daily view and logging modals. These wireframes support the feature specification in `docs/features/nutrition/meal-logger.md`.

## Daily Meal Logger View

The main interface where users view and manage their daily food intake across four meal categories.

```
┌─────────────────────────────────────────────────────────────────┐
│ ← Monday, Aug 2          Meal Logger            Today →         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ Daily Progress Summary                                          │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ Calories    ████████░░ 1,847 / 2,100 kcal (88%)            │ │
│ │ Protein     ██████░░░░ 98 / 140g (70%)                     │ │
│ │ Carbs       ████████░░ 180 / 220g (82%)                    │ │
│ │ Fat         ███████░░░ 65 / 85g (76%)                      │ │
│ │                                                             │ │
│ │ Remaining: 253 kcal • 42g protein • 40g carbs • 20g fat    │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ 🌅 Breakfast                                      [+ Add] [⋯]  │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ ✓ Oatmeal & Berries Template                               │ │
│ │ 420 kcal • 18g protein • 65g carbs • 8g fat               │ │
│ │ ───────────────────────────────────────────────────────── │ │
│ │ • Rolled Oats (50g)                              [Edit]   │ │
│ │ • Blueberries (100g)                             [Edit]   │ │
│ │ • Greek Yogurt (150g)                            [Edit]   │ │
│ │ • Honey (15g)                                    [Edit]   │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ 🌞 Lunch                                          [+ Add] [⋯]  │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ No meal logged yet                                          │ │
│ │                                                             │ │
│ │ [Use Template] [Build Meal] [Add Ingredients] [Copy From]   │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ 🌆 Dinner                                         [+ Add] [⋯]  │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ ⚠️ Chicken & Rice (Modified from template)                  │ │
│ │ 650 kcal • 45g protein • 60g carbs • 18g fat              │ │
│ │ ───────────────────────────────────────────────────────── │ │
│ │ • Chicken Breast (200g) ✏️ [was 150g]           [Edit]   │ │
│ │ • Brown Rice (80g)                               [Edit]   │ │
│ │ • Broccoli (150g)                                [Edit]   │ │
│ │ • Olive Oil (10g)                                [Edit]   │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ 🍎 Snacks                                         [+ Add] [⋯]  │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ Individual Items                                            │ │
│ │ • Apple, Medium (1 piece) - 95 kcal             [Edit]    │ │
│ │ • Almonds (20g) - 120 kcal                       [Edit]    │ │
│ │                                                             │ │
│ │ Total: 215 kcal • 6g protein • 28g carbs • 12g fat        │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Key Features

- **Progress Tracking**: Visual progress bars for calories and macronutrients against daily targets
- **Date Navigation**: Simple arrows to browse previous/next days
- **Meal States**: 
  - ✓ Completed meals show template name and ingredients
  - Empty meals show quick action buttons
  - ⚠️ Modified templates are clearly marked
- **Inline Editing**: Direct access to edit quantities within logged meals
- **Daily Actions**: Bulk operations like copying yesterday's meals

## Meal Logging Modal

The primary interface for adding meals using templates, meal builder, or manual entry.

```
┌─────────────────────────────────────────────────────────────────┐
│ Log Lunch - Tuesday, Aug 2                                 [×] │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ Quick Actions                                                   │
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌─────────┐ │
│ │ 📋 Templates │ │ 🍳 Build Meal│ │ 🥕 Add Items │ │ 📋 Copy │ │
│ │              │ │              │ │              │ │ From    │ │
│ └──────────────┘ └──────────────┘ └──────────────┘ └─────────┘ │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ Suggested Templates (for Lunch)                                 │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ 🥗 Chicken Caesar Salad                        [🌟 Favorite]│ │
│ │ 485 kcal • 35g protein • 12g carbs • 32g fat              │ │
│ │ Last used: 3 days ago                                      │ │
│ │                                                             │ │
│ │ [Use As-Is] [Modify Portions] [View Details]               │ │
│ ├─────────────────────────────────────────────────────────────┤ │
│ │ 🍝 Pasta Marinara with Chicken                             │ │
│ │ 520 kcal • 28g protein • 65g carbs • 18g fat              │ │
│ │ Last used: 1 week ago                                      │ │
│ │                                                             │ │
│ │ [Use As-Is] [Modify Portions] [View Details]               │ │
│ ├─────────────────────────────────────────────────────────────┤ │
│ │ 🌯 Turkey & Avocado Wrap                                   │ │
│ │ 425 kcal • 25g protein • 38g carbs • 22g fat              │ │
│ │ Last used: 2 weeks ago                                     │ │
│ │                                                             │ │
│ │ [Use As-Is] [Modify Portions] [View Details]               │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ Copy Options                                                    │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ From Yesterday                                              │ │
│ │ 🥙 Tuna Sandwich + Side Salad                              │ │
│ │ 380 kcal • 22g protein                    [Copy This]      │ │
│ │                                                             │ │
│ │ From Today's Other Meals                                    │ │
│ │ 🌅 Breakfast: Oatmeal & Berries          [Copy This]      │ │
│ │ 🍎 Current Snacks: Apple + Almonds       [Copy This]      │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ Recent Ingredients (Manual Add)                                 │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ • Chicken Breast     • Brown Rice       • Broccoli         │ │
│ │ • Greek Yogurt       • Blueberries      • Spinach          │ │
│ │ • Olive Oil          • Sweet Potato     • Almonds          │ │
│ │                                                             │ │
│ │ [Search All Ingredients...]                                 │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                        [Cancel] [Start Fresh]                  │
└─────────────────────────────────────────────────────────────────┘
```

### Key Features

- **Four Logging Paths**: Templates, Meal Builder integration, manual ingredients
- **Smart Template Suggestions**: Context-aware filtering by meal type and usage patterns
- **Template Actions**: Use as-is, modify portions, or view detailed nutrition breakdown
- **Copy Functionality**: Access to yesterday's meals and other meals from today
- **Recent Ingredients**: Quick access to frequently used items for manual entry

## Manual Ingredient Entry Interface
Let’s reuse the same model as in the meal-builder.

Then, while on the day’s meals page, the quantity slider appears below each ingredient.

### Key Features

- **Ingredient Search**: Real-time search with nutritional information preview
- **Visual Portion Control**: Progress bars with increment/decrement buttons for quantities
- **Live Nutrition Calculation**: Real-time meal totals and daily target contribution
- **Flexible Composition**: Add/remove ingredients dynamically during meal building
- **Template Creation**: Option to save custom meals as reusable templates for future use

## Design Principles

### Visual Hierarchy
- **Progress indicators** use consistent bar styling with percentage and remaining amounts
- **Meal cards** have clear visual separation and state indicators (✓, ⚠️, empty)
- **Action buttons** are consistently positioned and clearly labeled

### Interaction Patterns
- **Quick actions** are prominently displayed for common workflows
- **Inline editing** allows modification without modal navigation
- **Context awareness** shows relevant suggestions based on meal type and timing

### Information Architecture
- **Nutrition data** is consistently formatted across all interfaces
- **Meal organization** follows the established breakfast/lunch/dinner/snacks structure
- **Template management** integrates seamlessly with existing Meal Builder functionality

## Implementation Notes

These wireframes support the technical requirements outlined in the meal logger specification:
- Integration with existing ingredient database and nutrition calculations
- Template system compatibility with Meal Builder
- Real-time progress tracking against daily targets
- Flexible logging methods to accommodate different user workflows
