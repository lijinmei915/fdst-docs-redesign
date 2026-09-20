import express from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;
const HOST = "0.0.0.0";

const publicDir = path.join(__dirname, "public");
const publicExternalDir = path.join(__dirname, "public-external");
const releaseDir = path.join(__dirname, "release");

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", name: "FDS Token" });
});

// Serve external docs under /external
if (fs.existsSync(publicExternalDir)) {
  app.use("/external", express.static(publicExternalDir, { extensions: ["html", "htm"] }));
}

// Serve release artifacts under /release
if (fs.existsSync(releaseDir)) {
  app.use("/release", express.static(releaseDir));
}

// Primary static files from public/
app.use(express.static(publicDir, { extensions: ["html", "htm"] }));

// Route fallback for decoded paths & SPA navigation
app.use((req, res) => {
  try {
    const decodedPath = decodeURIComponent(req.path);
    const potentialFile = path.join(publicDir, decodedPath);
    if (fs.existsSync(potentialFile) && fs.statSync(potentialFile).isFile()) {
      return res.sendFile(potentialFile);
    }
    const potentialHtml = potentialFile + ".html";
    if (fs.existsSync(potentialHtml) && fs.statSync(potentialHtml).isFile()) {
      return res.sendFile(potentialHtml);
    }
    const potentialIndex = path.join(potentialFile, "index.html");
    if (fs.existsSync(potentialIndex) && fs.statSync(potentialIndex).isFile()) {
      return res.sendFile(potentialIndex);
    }
  } catch (err) {
    console.error("Error handling path:", err);
  }

  res.sendFile(path.join(publicDir, "index.html"));
});

app.listen(PORT, HOST, () => {
  console.log(`FDS Token documentation server running on http://${HOST}:${PORT}`);
});
