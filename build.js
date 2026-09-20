import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const publicDir = path.join(__dirname, "public");
const distDir = path.join(__dirname, "dist");
const publicExternalDir = path.join(__dirname, "public-external");
const releaseDir = path.join(__dirname, "release");

if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

// Copy public to dist
fs.cpSync(publicDir, distDir, { recursive: true });

// Copy public-external to dist/external
if (fs.existsSync(publicExternalDir)) {
  fs.cpSync(publicExternalDir, path.join(distDir, "external"), { recursive: true });
}

// Copy release to dist/release
if (fs.existsSync(releaseDir)) {
  fs.cpSync(releaseDir, path.join(distDir, "release"), { recursive: true });
}

console.log("Build completed successfully: static assets copied to dist/");
