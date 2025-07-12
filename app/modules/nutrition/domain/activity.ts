export const Activity = {
  ratio(input: number): number {
    if (input < 0) {
      throw new Error(`Invalid activity: ${input} should be positive`);
    }
    return input;
  },
  sedentary(): number {
    return Activity.ratio(1.2);
  },
  light(): number {
    return Activity.ratio(1.2);
  },
  moderate(): number {
    return Activity.ratio(1.2);
  },
  veryActive(): number {
    return Activity.ratio(1.2);
  },
};
