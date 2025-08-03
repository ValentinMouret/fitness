# Meal Logger Feature Specification

## Overview
The Meal Logger is a daily nutrition tracking system that enables users to log their actual food intake across multiple meals throughout the day. It provides a structured approach to nutrition tracking similar to MyFitnessPal, with deep integration to the existing Meal Builder functionality for seamless meal planning and logging.

## User Story
As a fitness-conscious user, I want to track my daily food intake across breakfast, lunch, dinner, and snacks, so that I can monitor my nutritional progress against my daily targets and maintain accountability for my eating habits.

## Core Problem
Users need a systematic way to:
1. **Track daily nutrition** across multiple meals throughout the day
2. **Log actual consumption** vs planned meals
3. **Monitor progress** against daily calorie and macro targets
4. **Build meal logging habits** through a simple, intuitive interface
5. **Leverage existing meal templates** from the Meal Builder for quick logging

## Key User Personas

### Primary: The Consistent Tracker
- Logs meals daily as part of established routine
- Values accuracy and wants detailed nutritional breakdowns
- Uses meal templates for recurring meals (same breakfast daily)
- Needs quick logging options for busy days

### Secondary: The Flexible Planner
- Plans some meals in advance, logs others reactively
- Uses Meal Builder to plan optimal meals, then logs actual consumption
- Wants to see how actual intake compares to planned nutrition
- Adjusts portion sizes based on hunger and activity levels

## Core Features

### 1. Daily Meal Structure
- **Fixed Meal Categories**: Breakfast, Lunch, Dinner, Snacks
- **Date-based Organization**: Navigate through different days
- **Meal State Management**: 
  - Empty (not logged)
  - Partially logged (some items added)
  - Complete (user-marked as finished)

### 2. Meal Logging Methods

#### Quick Template Logging
- **One-click template application**: Apply saved meal templates directly to meal slots
- **Portion adjustment**: Modify template quantities before logging
- **Template suggestions**: Show relevant templates based on meal category and time of day

#### Manual Ingredient Logging
- **Direct ingredient addition**: Add individual ingredients with custom quantities
- **Copy from Meal Builder**: Import a composed meal from the Meal Builder
- **Recent items**: Quick access to recently logged ingredients

#### Quick Entry Options
- **Copy from previous day**: Duplicate yesterday's meals
- **Copy meal to another day**: Plan ahead by copying successful meals
- **Favorite combinations**: Save and reuse common ingredient combinations

### 3. Daily Progress Tracking
- **Target vs Actual**: Real-time comparison against daily calorie and macro targets
- **Meal Distribution**: Visual breakdown of calories consumed per meal
- **Running totals**: Updated automatically as meals are logged
- **Remaining budget**: Show remaining calories and macros for the day

### 4. Meal Entry Interface
- **Expandable meal cards**: Each meal starts collapsed, expands when logging
- **Inline editing**: Adjust quantities directly in the logged meal view
- **Quick actions**: Remove items, duplicate to another meal, save as template
- **Visual feedback**: Clear indication of logged vs empty meals

## User Experience Flow

### Daily Dashboard Flow
1. **View today's meals**: See current day with 4 meal slots (breakfast, lunch, dinner, snacks)
2. **Check progress**: Daily summary shows progress toward targets
3. **Log a meal**: Tap/click on meal slot to begin logging
4. **Choose logging method**: Template, Meal Builder, or manual entry
5. **Confirm and save**: Review meal before saving to daily log

### Template-Based Logging Flow
1. **Select meal slot**: Choose breakfast, lunch, dinner, or snack
2. **Browse templates**: See relevant templates filtered by meal category
3. **Preview nutrition**: Review template's nutritional content
4. **Adjust portions** (optional): Modify quantities using familiar sliders
5. **Log meal**: Confirm and add to daily log

### Manual Logging Flow
1. **Open meal editor**: Access ingredient library interface
2. **Add ingredients**: Search and select ingredients with quantities
3. **Review totals**: See meal's nutritional summary
4. **Save meal**: Add to daily log and update daily totals

## Interface Design

### Daily View Layout
```
┌─────────────────────────────────────────────────┐
│ ← Tuesday, Jan 15, 2025         Today →         │
├─────────────────────────────────────────────────┤
│                                                 │
│ Daily Progress                                  │
│ ████████░░ 1,847/2,100 kcal (88%)              │
│ ██████░░░░ 98/140g protein (70%)                │
│ Remaining: 253 kcal • 42g protein              │
│                                                 │
├─────────────────────────────────────────────────┤
│                                                 │
│ 🌅 Breakfast                         [+ Log]    │
│ ┌─────────────────────────────────────────────┐ │
│ │ Oatmeal & Berries Template                  │ │
│ │ 420 kcal • 18g protein • 65g carbs         │ │
│ │ ──────────────────────────────────────────  │ │
│ │ • Oats, Rolled (50g)                       │ │
│ │ • Blueberries (100g)                       │ │
│ │ • Greek Yogurt (150g)                      │ │
│ │ • Honey (15g)                              │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│ 🌞 Lunch                            [+ Log]     │
│ ┌─────────────────────────────────────────────┐ │
│ │ No meal logged                              │ │
│ │ [Use Template] [Build Meal] [Add Items]     │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│ 🌙 Dinner                           [+ Log]     │
│ ┌─────────────────────────────────────────────┐ │
│ │ Chicken & Rice (Modified)                   │ │
│ │ 650 kcal • 45g protein • 60g carbs         │ │
│ │ ──────────────────────────────────────────  │ │
│ │ • Chicken Breast (200g) [edited from 150g] │ │
│ │ • Brown Rice (80g)                          │ │
│ │ • Broccoli (150g)                          │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│ 🍎 Snacks                           [+ Log]     │
│ ┌─────────────────────────────────────────────┐ │
│ │ • Apple (1 medium) - 95 kcal               │ │
│ │ • Almonds (20g) - 120 kcal                 │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
└─────────────────────────────────────────────────┘
```

### Meal Logging Modal
```
┌─────────────────────────────────────────────────┐
│ Log Lunch                                   [×] │
├─────────────────────────────────────────────────┤
│                                                 │
│ Quick Options                                   │
│ ┌──────────────┐ ┌──────────────┐ ┌───────────┐│
│ │ Use Template │ │ Build Meal   │ │ Add Items ││
│ └──────────────┘ └──────────────┘ └───────────┘│
│                                                 │
│ Recent Templates                                │
│ ┌─────────────────────────────────────────────┐ │
│ │ 🥗 Chicken Caesar Salad                     │ │
│ │ 485 kcal • 35g protein                     │ │
│ │ [Use This] [Modify]                        │ │
│ ├─────────────────────────────────────────────┤ │
│ │ 🍝 Pasta with Marinara                      │ │
│ │ 420 kcal • 15g protein                     │ │
│ │ [Use This] [Modify]                        │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│ Or copy from:                                   │
│ [Yesterday's Lunch] [Other Meals Today]         │
│                                                 │
└─────────────────────────────────────────────────┘
```

## Integration Points

### Meal Builder Integration
- **"Log This Meal" button**: Direct logging from Meal Builder to selected meal slot
- **Template creation**: Convert logged meals back into reusable templates
- **Bidirectional flow**: Plan in Meal Builder, log actual consumption, compare results

### Target Integration
- **Daily target reference**: Pull user's current calorie and macro targets
- **Progress calculation**: Real-time updates as meals are logged
- **Deficit/surplus tracking**: Show remaining or excess intake

### Template System Integration
- **Shared template library**: Use existing meal templates from Meal Builder
- **Template refinement**: Update templates based on actual consumption patterns
- **Usage analytics**: Track which templates are used most frequently

## Behavioral Patterns

### Logging Habits
- **Time-based prompts**: Gentle reminders to log meals at typical meal times
- **Streak tracking**: Visual indicators for consecutive days of complete logging
- **Completion states**: Clear visual distinction between logged and unlogged meals

### Flexibility Features
- **Partial logging**: Allow incomplete meal logging without forcing completion
- **Post-meal adjustments**: Edit logged meals if portions were different than planned
- **Quick corrections**: Easy undo/redo for accidental logging

### Learning Integration
- **Pattern recognition**: Surface insights about eating patterns and timing
- **Template suggestions**: Recommend templates based on time of day and past preferences
- **Nutritional insights**: Highlight when daily nutrition is well-balanced

## Technical Considerations

### Data Model Extensions
- **Daily meal logs**: Date-based meal entries with ingredient quantities
- **Meal completion states**: Track whether meals are considered "complete"
- **Logging timestamps**: Record when meals were logged for habit analysis

### Performance Requirements
- **Fast loading**: Daily view loads instantly with cached data
- **Offline support**: Allow logging when offline, sync when connected
- **Quick actions**: Template application and ingredient addition feel instantaneous

### Mobile Optimization
- **Touch-friendly**: Large tap targets for meal cards and action buttons
- **Swipe gestures**: Swipe to delete ingredients, swipe between days
- **Compact display**: Efficient use of screen space for meal information

## Success Metrics

### Engagement Metrics
- **Daily logging rate**: Percentage of days with at least one meal logged
- **Completion rate**: Percentage of started meals that are marked complete
- **Template usage**: How often users apply templates vs manual logging

### Accuracy Metrics
- **Target adherence**: How close users get to their daily nutritional targets
- **Consistency**: Variance in daily calorie intake over time
- **Planning accuracy**: Difference between planned (Meal Builder) and actual (logged) intake

### Habit Formation
- **Streak length**: Consecutive days of logging behavior
- **Time to habit**: Days until logging becomes routine (measured by consistency)
- **Feature adoption**: Usage of different logging methods over time

## Future Enhancements

### Advanced Logging
- **Photo logging**: Take photos of meals for visual record-keeping
- **Barcode scanning**: Quick logging of packaged foods
- **Voice logging**: "Log 150g chicken breast to lunch"

### Social Features
- **Meal sharing**: Share successful meal combinations with others
- **Accountability partners**: Optional sharing with workout/nutrition buddies
- **Community templates**: Access templates created by other users

### Analytics & Insights
- **Weekly summaries**: Nutritional trends and patterns over time
- **Meal timing analysis**: Optimal meal timing based on energy and performance
- **Seasonal adjustments**: How nutritional needs change with activity levels

## Open Questions

### User Experience
1. Should users be able to split ingredients across multiple meals (e.g., cook once, eat twice)?
2. How do we handle recipes vs individual ingredients in logging?
3. Should we auto-suggest meal timing based on user patterns?

### Data & Privacy
1. How long should we retain detailed meal logs?
2. Should nutritional insights be generated locally or server-side?
3. What level of meal data export should we provide?

## Implementation Priority

### Phase 1: Core Logging (MVP)
- Daily meal view with 4 meal categories
- Template-based logging with portion adjustment
- Basic progress tracking against daily targets
- Simple manual ingredient addition

### Phase 2: Enhanced Experience
- Meal Builder integration ("Log This Meal")
- Copy meal functionality (yesterday, other meals)
- Advanced template management
- Meal completion states and streak tracking

### Phase 3: Intelligence & Insights
- Smart template suggestions based on time and patterns
- Nutritional insights and pattern recognition
- Advanced progress analytics
- Habit formation tracking and gentle coaching

## Next Steps
1. ✅ Validate core user flows with target personas
2. ✅ Define detailed acceptance criteria for MVP features
3. Create wireframes for daily view and logging modals
4. Specify API requirements for meal logging data
5. Plan integration touchpoints with existing Meal Builder
6. Design template suggestion algorithms
7. Create comprehensive test scenarios covering all logging methods
