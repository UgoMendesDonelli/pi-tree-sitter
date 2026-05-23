export const VERSION = "1.0.0";

export function greet(name) {
  return `Hello ${name}`;
}

export default class Logger {
  log(msg) {
    console.log(msg);
  }
}
