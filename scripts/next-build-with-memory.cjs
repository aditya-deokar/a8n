const { spawnSync } = require("node:child_process");
const path = require("node:path");

const heapMb = process.env.NEXT_BUILD_MAX_OLD_SPACE_SIZE || "4096";
const existingNodeOptions = process.env.NODE_OPTIONS || "";
const hasHeapOption = /--max-old-space-size(?:=|\s+)\d+/.test(existingNodeOptions);
const nodeOptions = hasHeapOption
  ? existingNodeOptions
  : `${existingNodeOptions} --max-old-space-size=${heapMb}`.trim();

const repoRoot = path.resolve(__dirname, "..");
const nextCli = path.join(repoRoot, "node_modules", "next", "dist", "bin", "next");
const args = [nextCli, "build", ...process.argv.slice(2)];

console.log(`[build] Using NODE_OPTIONS="${nodeOptions}"`);

const result = spawnSync(process.execPath, args, {
  cwd: repoRoot,
  env: {
    ...process.env,
    NODE_OPTIONS: nodeOptions,
  },
  stdio: "inherit",
});

if (result.error) {
  console.error(result.error);
  process.exit(1);
}

process.exit(result.status ?? 1);
