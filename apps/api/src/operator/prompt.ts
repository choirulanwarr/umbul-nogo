import { createInterface } from "node:readline";
import { Writable } from "node:stream";

export function prompt(label: string, hidden = false): Promise<string> {
  if (!process.stdin.isTTY || !process.stderr.isTTY)
    throw new Error("Prompt memerlukan terminal interaktif; pipe tidak diterima.");
  const silent = new Writable({
    write(_chunk, _encoding, callback) {
      callback();
    },
  });
  const input = createInterface({
    input: process.stdin,
    output: hidden ? silent : process.stderr,
    terminal: true,
    historySize: 0,
  });
  process.stderr.write(label);
  return new Promise((resolve, reject) => {
    let answered = false;
    input.once("SIGINT", () => input.close());
    input.once("close", () => {
      silent.destroy();
      if (hidden) process.stderr.write("\n");
      if (!answered) reject(new Error("Input dibatalkan."));
    });
    input.question("", (answer) => {
      answered = true;
      input.close();
      resolve(answer);
    });
  });
}
