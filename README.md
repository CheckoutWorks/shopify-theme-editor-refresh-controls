# Shopify Theme Editor Refresh Controls

An unofficial, dependency-free userscript by CheckoutWorks that adds two focused recovery controls to Shopify's Theme Editor:

- **Refresh storefront preview** reloads only the active storefront preview iframe and preserves unsaved editor settings.
- **Discard and refresh the theme editor** invokes Shopify's currently mounted native refresh action after confirmation and discards unsaved editor changes.

The current release is `1.0.1`. Version `1.0.0` was the Initial Public Release. The repository contains one canonical release userscript; earlier development, experimental, and diagnostic scripts are intentionally excluded.

> [!WARNING]
> **Discard and refresh the theme editor permanently removes all unsaved Theme Editor changes.** Read the browser confirmation carefully before continuing.

## Features

### Preview-only refresh

The preview control sends a namespaced `postMessage` request to the active design-mode storefront iframe. The preview validates the origin, source window, nonce, design mode, and `oseid` context before acknowledging the request and reloading its own document.

If the listener does not acknowledge the request, the script falls back to Shopify's preview form or a validated `myshopify.com` iframe URL. It does not use a full-page Admin reload as a fallback.

### Native discard refresh

The discard control resolves the callback behind Shopify's mounted native refresh action through a language-independent structural matcher. It correlates the destructive action shape, callback identity, secondary conflict action, and modal state, then fails closed if the result is missing, ambiguous, inconsistent, already open, or disabled.

The matcher does not depend on translated action labels. It has been inspected in English, Simplified Chinese, and Japanese Shopify Admin interfaces.

If the Theme Editor has no unsaved changes, the discard control follows Shopify's native Save state and appears disabled. Its tooltip explains that there is nothing to discard, and it does not attempt to invoke Shopify's disabled native refresh action. A narrowly scoped observer watches only the native Save control's `disabled` attribute; if that structural signal is unavailable, the control fails open and retains its existing click-time safety checks.

### Native-style controls

The controls reuse Shopify's current toolbar button structure and runtime classes. Their accessible tooltips match the current Theme Editor surface, typography, spacing, radius, shadow, and directional tail behavior.

## Installation

1. Install [Tampermonkey](https://www.tampermonkey.net/) in a supported browser.
2. Disable older development versions of this userscript to prevent duplicate controls.
3. Open `shopify-theme-editor-refresh-controls.user.js` on GitHub and select **Raw**.
4. Confirm the installation prompt in Tampermonkey.
5. Open a Shopify theme through **Online Store → Themes → Customize**.

The controls appear immediately to the left of Sidekick in the Theme Editor toolbar.

For userscript community mirrors, install only a release whose source matches the canonical file in this repository and whose version is listed in [CHANGELOG.md](./CHANGELOG.md).

## Compatibility

- Current release: `1.0.1` (2026-08-01).
- Initial Public Release: `1.0.0` (2026-07-31).
- Tested with Google Chrome and Tampermonkey.
- The preview listener supports Shopify design-mode previews on `*.myshopify.com`.
- Other userscript managers may work but are not currently supported or guaranteed.

Shopify can change its internal DOM, React tree, labels, or editor behavior without notice. The discard control relies on an unsupported private implementation because Shopify does not expose this action as a public userscript API.

## Privacy and security

This userscript:

- Has no analytics, telemetry, tracking, storage, or external runtime dependencies.
- Does not send data to CheckoutWorks or another third-party service.
- Does not call `fetch`, `XMLHttpRequest`, `sendBeacon`, or `WebSocket`.
- Does not reconstruct Shopify HMAC parameters or signed editor URLs.
- Never intentionally reloads or navigates `window.top`.

Shopify and the storefront preview still make their normal network requests when Shopify reloads the preview or refreshes the editor. See [SECURITY.md](./SECURITY.md) for responsible disclosure guidance.

## Performance

The script is event-driven. It does not poll or continuously traverse Shopify's React tree. Native-action discovery is bounded and runs only after the user activates the discard control. A `MutationObserver` restores controls if Shopify replaces the toolbar during React navigation and exits early while both controls remain connected.

## Limitations

- A preview reload cannot repair theme JavaScript that freezes again immediately after loading.
- Discard refresh restores Shopify's last saved editor state, not the theme's factory defaults.
- The script cannot guarantee that Shopify will never require authentication or human verification.
- If the native action cannot be resolved safely, the script reports an error and does not fall back to a full-page reload.

## Troubleshooting

### The controls do not appear

- Confirm that the canonical script is enabled in Tampermonkey.
- Disable older `Shopify Theme Preview Refresh` script versions.
- Confirm that the current route is a Theme Editor route rather than the Themes index.
- Reload the Theme Editor once after installing or updating the script.

### The discard control reports an error

- If Shopify's conflict dialog is open, use its native refresh action.
- Check the browser console for messages prefixed with `[Shopify Theme Editor Refresh Controls]`.
- Include the userscript version, browser version, Tampermonkey version, Admin language, and redacted console warning in a bug report.

### A refresh icon keeps spinning

Both actions use a 20-second watchdog. If Shopify does not complete the operation, the control enters a temporary error state instead of remaining locked indefinitely.

## Development

The release artifact is a standalone userscript and has no build step.

```sh
node --check shopify-theme-editor-refresh-controls.user.js
node scripts/validate.mjs
```

See [CONTRIBUTING.md](./CONTRIBUTING.md) before proposing a change. Release history is maintained in [CHANGELOG.md](./CHANGELOG.md).

## Project links

- [Source repository](https://github.com/CheckoutWorks/shopify-theme-editor-refresh-controls)
- [Issue tracker](https://github.com/CheckoutWorks/shopify-theme-editor-refresh-controls/issues)
- [CheckoutWorks website](https://checkoutworks.dev/)

## Repository structure

```text
.
├── .github/
│   ├── ISSUE_TEMPLATE/
│   └── workflows/
├── scripts/
│   └── validate.mjs
├── CHANGELOG.md
├── CONTRIBUTING.md
├── LICENSE
├── README.md
├── SECURITY.md
└── shopify-theme-editor-refresh-controls.user.js
```

## License

Released under the [MIT License](./LICENSE).

## Disclaimer

Shopify is a trademark of Shopify Inc. This project is independent and is not affiliated with, endorsed by, or supported by Shopify Inc.

Built by CheckoutWorks, a Shopify development agency.
