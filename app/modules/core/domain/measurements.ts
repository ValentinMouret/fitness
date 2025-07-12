// Weight throughout the app should be in kg.
export const Weight = {
  kg(input: number): number {
    return input;
  },
  g(input: number): number {
    return input / 1000;
  },
};

// Height throughout the app should be in cm.
export const Height = {
  cm(input: number): number {
    return input;
  },
  m(input: number): number {
    return input * 100;
  },
};

export const Age = {
  years(input: number): number {
    if (input < 0) {
      throw new Error(`Invalid age: ${input} should be positive`);
    }

    return input;
  },
};
