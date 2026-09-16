export {};

const processes = [
  Bun.spawn([process.execPath, "run", "dev:api"], { stdout: "inherit", stderr: "inherit" }),
  Bun.spawn([process.execPath, "run", "dev:web"], { stdout: "inherit", stderr: "inherit" }),
];

let stopping = false;
function stop(): void {
  if (stopping) return;
  stopping = true;
  for (const child of processes) child.kill("SIGTERM");
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
const code = await Promise.race(processes.map((child) => child.exited));
stop();
await Promise.all(processes.map((child) => child.exited));
process.exitCode = code;
