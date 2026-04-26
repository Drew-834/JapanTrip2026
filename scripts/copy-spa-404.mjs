import { copyFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const dist = join(__dirname, "..", "dist");
const index = join(dist, "index.html");
const dest = join(dist, "404.html");

if (existsSync(index)) {
  copyFileSync(index, dest);
  console.log("Copied index.html -> 404.html for GitHub Pages SPA");
} else {
  console.warn("dist/index.html missing; skip 404 copy");
}
