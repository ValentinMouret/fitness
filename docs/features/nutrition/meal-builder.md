# Meal Builder Feature Specification

## Overview
The Meal Builder is an objective-based meal composition tool that helps users create meals that meet specific nutritional targets. Users can set calorie and macro goals, then build meals using ingredient sliders with real-time nutritional feedback.

## User Story
As a fitness-conscious user, I want to build meals that meet my specific calorie and macro targets while ensuring adequate satiety, so that I can achieve my nutritional goals while feeling satisfied and avoiding hunger.

## Core Features

### 1. Nutritional Objectives
- **Primary Targets**
  - Target calories (e.g., 700 kcal)
  - Target protein (e.g., 30g)
  - Optional: Target carbs and fats
  - Note: target macros implies a minimum target calories.
- **Satiety Indicators**
  - Meal volume estimation
  - Fiber content tracking
  - Satiety score/rating
- **Target Display**
  - Visual progress indicators showing current vs. target
  - Color-coded feedback (under/on-target/over)
  - Percentage of target achieved

### 2. Ingredient Selection & Management
- **Ingredient Library**
  - Pre-populated common ingredients
  - Searchable/filterable list
  - Categories (proteins, carbs, fats, vegetables, etc.)
- **Smart Quantity Sliders**
  - Context-aware ranges per ingredient type
    - Proteins: 50-300g
    - Oils/fats: 5-30g
    - Grains: 30-200g
    - Vegetables: 50-400g
  - Common portion indicators (e.g., "1 cup", "1 tbsp")
  - Precise gram input option

### 3. Real-time Feedback
- **Live Nutritional Updates**
  - Total calories, protein, carbs, fats
  - Fiber content
  - Estimated meal volume
  - Satiety prediction
  - Micronutrient summary (collapsible)
  - Visual diff from targets
- **Progress Visualization**
  - Progress bars for each macro target
  - Pie chart for macro distribution
  - Satiety/fullness indicator

### 4. AI-Powered Suggestions
- **Smart Recommendations**
  - Suggest ingredients to reach targets
  - Consider flavor compatibility
  - Balance macro ratios
  - Optimize for satiety when requested
- **Personalization (Future)**
  - Learn from meal history
  - Respect dietary preferences
  - Seasonal/availability awareness

### 5. Meal Templates
- **Template Creation**
  - Save completed meals as reusable templates
  - Name and categorize (breakfast, lunch, dinner, snack)
  - Add notes/tags
  - Store satiety rating
- **Template Usage**
  - Quick-start from existing template
  - Modify quantities via sliders
  - Add/remove ingredients
  - One-click logging with adjustments

## User Interface

### Layout Structure
```
┌─────────────────────────────────────────────────┐
│ Meal Builder                                    │
├─────────────────────────────────────────────────┤
│ ┌─────────────┐  ┌────────────────────────────┐│
│ │ Objectives  │  │ Current Totals             ││
│ │             │  │ ████████░░ 650/700 kcal    ││
│ │ 700 kcal    │  │ ██████░░░░ 25/30g protein  ││
│ │ 30g protein │  │ Fiber: 8g  Volume: ~450ml  ││
│ │             │  │ Satiety: ●●●●○ (High)      ││
│ └─────────────┘  └────────────────────────────┘│
├─────────────────────────────────────────────────┤
│ Selected Ingredients                            │
│ ┌─────────────────────────────────────────────┐│
│ │ Chicken Breast  [====|====] 150g  180kcal  ││
│ │ White Rice      [===|=====] 80g   280kcal  ││
│ │ Broccoli        [=====|===] 150g  50kcal   ││
│ │ Olive Oil       [=|=======] 10g   90kcal   ││
│ └─────────────────────────────────────────────┘│
├─────────────────────────────────────────────────┤
│ [+ Add Ingredient] [AI Suggest] [Save Template] │
└─────────────────────────────────────────────────┘
```

### Interaction Patterns
- **Slider Behavior**
  - Smooth dragging with haptic feedback
  - Click on track to jump to value
  - Double-click to reset to default
  - Keyboard navigation (arrow keys)
- **Ingredient Management**
  - Drag to reorder
  - Swipe to delete (with undo)
  - Tap to expand nutrition details

## Satiety Estimation System

### Satiety Calculation Formula
Based on expert guidance, we'll use a weighted formula with texture modifier:

```
Base Score = (Protein g × 0.4) + (Fiber g × 0.3) + (Volume factor × 0.2)
Volume factor = (Water % / Energy density) × 10
Texture Modifier:
  - Liquid: 1.0
  - Semi-liquid: 1.15
  - Soft solid: 1.25
  - Firm solid: 1.35
Final Satiety Score = Base Score × Texture Modifier
```

### Texture Categories
- **Liquid**: Water, juice, broth, regular milk
- **Semi-liquid**: Smoothies, yogurt, protein shakes, soups
- **Soft solid**: Cottage cheese, scrambled eggs, oatmeal, mashed potatoes
- **Firm solid**: Chicken breast, steak, raw vegetables, nuts

### Satiety Presentation
- **Primary**: 5-point scale with descriptors
  - 1 = Light snack
  - 2 = Small meal
  - 3 = Moderate meal
  - 4 = Filling meal
  - 5 = Very filling meal
- **Secondary**: Time estimate tooltip ("Typically satisfying for 2-4 hours")
- **Visual**: Progress bar or stomach icon fill level
- **Texture indicator**: Small icon showing meal composition

### Personalization & Learning
- **Feedback collection**: Simple 1-5 hunger check 2-3 hours post-meal
- **Personal adjustments**: Learn individual texture preferences and eating speed impact
- **Pattern recognition**: "Your high-protein lunches tend to keep you fuller"
- **Gentle education**: Explain why meals are filling

### Key Satiety Factors (Priority Order)
1. **Protein** - Most satiating macronutrient (~25-30% higher than carbs/fats)
2. **Fiber** - Especially soluble fiber (25-35g daily target)
3. **Volume/Water** - Low energy density foods trigger stretch receptors
4. **Texture/Viscosity** - Affects gastric emptying and oral processing time
5. **Fat** - Moderate amounts slow gastric emptying

## Technical Considerations

### Data Model
- **Ingredient**
  - Nutritional data per 100g (calories, protein, carbs, fat)
  - Fiber content (grams)
  - Water content (percentage)
  - Energy density (calories per 100g)
  - Texture category (liquid/semi-liquid/soft solid/firm solid)
  - Default portion sizes
  - Smart slider ranges (min/max grams)
  - Category tags
- **Meal Template**
  - Ingredient list with quantities
  - Calculated satiety score
  - Creation timestamp
  - Usage count
  - User notes
  - Historical satiety ratings
  - Average actual fullness duration

### Performance
- Debounced slider updates
- Cached nutritional calculations
- Lazy-load ingredient database
- Optimistic UI updates

## Success Metrics
- Time to create a meal meeting targets
- Template reuse rate
- Accuracy of AI suggestions
- User satisfaction scores
- Satiety prediction accuracy

## Future Enhancements
1. **Meal Planning**
   - Multi-meal daily planning
   - Weekly meal prep mode
2. **Shopping Integration**
   - Generate shopping lists
   - Price optimization
3. **Recipe Import**
   - Parse recipes from URLs
   - Adjust servings to meet targets
4. **Social Features**
   - Share templates
   - Community meal ideas

## Open Questions
1. Should we support custom ingredients or only pre-defined ones? -> for the MVP, only pre-defined ingredients.
2. How do we handle composite ingredients (e.g., pre-made sauces)? -> we only have raw/basic ingredients.
3. Should the AI consider budget constraints? -> Not in MVP.
4. Do we need barcode scanning for packaged foods? -> Not in MVP.
5. How detailed should micronutrient tracking be? -> No micro-nutrients in MVP.
6. Should satiety be an objective users can optimize for directly? -> I guess they can say which satiety they want out of a meal, yes.
7. How do we handle texture changes from cooking (e.g., raw vs cooked vegetables)? -> Not in MVP.
8. Should we track eating speed as a user preference? -> Not in MVP.

## Next Steps
1. ✅ Expert feedback on satiety estimation approach received
2. ✅ Design detailed wireframes with satiety indicators
3. ✅ Define ingredient database schema with texture categories
4. ✅ Prototype smart slider interactions
5. Implement satiety calculation algorithm
6. Design feedback collection mechanism
7. Research AI recommendation algorithms that consider satiety
