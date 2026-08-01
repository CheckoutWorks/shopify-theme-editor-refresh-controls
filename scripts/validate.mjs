import { spawnSync } from "node:child_process";
import { readFile, readdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const userscriptName = "shopify-theme-editor-refresh-controls.user.js";
const userscriptPath = resolve(repositoryRoot, userscriptName);
const errors = [];

const assert = (condition, message) => {
  if (!condition) {
    errors.push(message);
  }
};

const userscript = await readFile(userscriptPath, "utf8");
const rootEntries = await readdir(repositoryRoot);
const rootUserscripts = rootEntries.filter((entry) => entry.endsWith(".user.js"));
const requiredFiles = [
  "README.md",
  "CHANGELOG.md",
  "LICENSE",
  "SECURITY.md",
  "CONTRIBUTING.md",
  ".github/ISSUE_TEMPLATE/bug_report.yml",
  ".github/ISSUE_TEMPLATE/feature_request.yml",
];

assert(
  rootUserscripts.length === 1 && rootUserscripts[0] === userscriptName,
  "The repository must contain exactly one canonical root userscript.",
);

for (const relativePath of requiredFiles) {
  try {
    await readFile(resolve(repositoryRoot, relativePath));
  } catch {
    errors.push(`Missing required public file: ${relativePath}`);
  }
}

const requiredMetadata = [
  "// @name         Shopify Theme Editor Refresh Controls",
  "// @namespace    https://checkoutworks.dev/",
  "// @version      1.0.3",
  "// @author       CheckoutWorks",
  "// @homepageURL  https://checkoutworks.dev/blogs/shopify-field-notes/refresh-shopify-theme-editor-without-reloading-admin",
  "// @source       https://github.com/CheckoutWorks/shopify-theme-editor-refresh-controls",
  "// @supportURL   https://github.com/CheckoutWorks/shopify-theme-editor-refresh-controls/issues",
  "// @updateURL    https://raw.githubusercontent.com/CheckoutWorks/shopify-theme-editor-refresh-controls/main/shopify-theme-editor-refresh-controls.user.js",
  "// @downloadURL  https://raw.githubusercontent.com/CheckoutWorks/shopify-theme-editor-refresh-controls/main/shopify-theme-editor-refresh-controls.user.js",
  "// @license      MIT",
  "// @match        https://online-store-web.shopifyapps.com/themes*",
  "// @match        https://*.myshopify.com/*",
  "// @run-at       document-start",
  "// @sandbox      raw",
  "// @grant        none",
];

for (const metadataLine of requiredMetadata) {
  assert(userscript.includes(metadataLine), `Missing metadata: ${metadataLine}`);
}

const requiredBehaviorMarkers = [
  "checkoutworks:theme-preview-refresh:request:v1",
  "inspectHiddenNativeRefreshAction",
  "normalizeActionContent",
  "checkoutworks-theme-refresh-tooltip",
  "Discard all unsaved changes and refresh the theme editor?",
  "There are no unsaved changes to discard.",
  "showNoUnsavedChangesNotice",
  "nativeSaveStateObserver",
  "scheduleNativeSaveRetry",
  "MAX_NATIVE_SAVE_RETRY_ATTEMPTS",
  "s-internal-button[variant=\"primary\"]:not([icon])",
  "not affiliated with, endorsed by, or supported by Shopify Inc.",
];

for (const marker of requiredBehaviorMarkers) {
  assert(userscript.includes(marker), `Missing required behavior marker: ${marker}`);
}

const forbiddenRuntimePatterns = [
  [/(^|[^.\w])fetch\s*\(/u, "fetch"],
  [/new\s+XMLHttpRequest\b/u, "XMLHttpRequest"],
  [/\.sendBeacon\s*\(/u, "sendBeacon"],
  [/new\s+WebSocket\b/u, "WebSocket"],
  [/\b(?:localStorage|sessionStorage|indexedDB)\b/u, "persistent browser storage"],
  [/^\s*(?:import\s|require\s*\()/mu, "external module loading"],
];

for (const [pattern, label] of forbiddenRuntimePatterns) {
  assert(!pattern.test(userscript), `Forbidden runtime capability detected: ${label}`);
}

const syntaxCheck = spawnSync(process.execPath, ["--check", userscriptPath], {
  encoding: "utf8",
});
assert(
  syntaxCheck.status === 0,
  `JavaScript syntax check failed:\n${syntaxCheck.stderr.trim()}`,
);

if (errors.length > 0) {
  console.error("Validation failed:\n");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exitCode = 1;
} else {
  console.log("Validated Shopify Theme Editor Refresh Controls v1.0.3.");
}
