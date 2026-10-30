const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const output = path.join(root, "www");
const files = [
  "about.html",
  "app.js",
  "capacitor-adapter.js",
  "favicon.svg",
  "icons",
  "index.html",
  "logo.svg",
  "manifest.webmanifest",
  "privacy.html",
  "social-preview.png",
  "sw.js",
  "terms.html",
  "vendor",
];

fs.rmSync(output, {recursive: true, force: true});
fs.mkdirSync(output, {recursive: true});
for (const file of files) {
  fs.cpSync(path.join(root, file), path.join(output, file), {recursive: true});
}
