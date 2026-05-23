class DataProcessor {
  process(input: string): string {
    return input.trim();
  }
}

function identity<T>(value: T): T {
  return value;
}
