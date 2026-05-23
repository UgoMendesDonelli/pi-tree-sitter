/** A simple Calculator */
class Calculator {
  add(a: number, b: number): number {
    return a + b;
  }
}

function multiply(x: number, y: number): number {
  return x * y;
}

interface Shape {
  area(): number;
}

type Point = { x: number; y: number };

export { Calculator, multiply };
