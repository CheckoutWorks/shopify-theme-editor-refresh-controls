# Contributing

Thank you for helping improve Shopify Theme Editor Refresh Controls.

## Project scope

This repository ships one canonical, dependency-free userscript. Changes should preserve its narrow purpose: refreshing the active storefront preview or invoking Shopify's native discard-and-refresh action safely.

Please do not add:

- Analytics, telemetry, tracking, or data collection.
- External runtime dependencies or remotely loaded code.
- Historical, experimental, or diagnostic userscripts.
- Automatic full-page Admin reloads as an error fallback.
- Logic that bypasses the destructive-action confirmation.

## Reporting bugs

Use the [GitHub bug report form](https://github.com/CheckoutWorks/shopify-theme-editor-refresh-controls/issues/new?template=bug_report.yml) and include reproducible steps, userscript version, browser version, userscript manager version, Shopify Admin language, and relevant console warnings. Remove store identifiers, signed URLs, customer data, and other private information before posting.

Security vulnerabilities should be reported privately according to [SECURITY.md](./SECURITY.md).

## Development workflow

1. Work from the current canonical release.
2. Keep all code, comments, commit messages, and public documentation in English.
3. Preserve origin, source-window, nonce, route, design-mode, and URL validation.
4. Keep the React Fiber traversal bounded, user-triggered, and fail-closed.
5. Preserve the explicit destructive-action confirmation.
6. Update `CHANGELOG.md` for user-visible behavior changes.
7. Run the repository checks:

```sh
node --check shopify-theme-editor-refresh-controls.user.js
node scripts/validate.mjs
```

Manual verification should cover both controls, toolbar reinjection, keyboard focus, tooltip positioning, reduced-motion behavior, preview acknowledgement and fallback, discard cancellation, conflict-modal handling, and timeout recovery.

## Pull requests

Keep pull requests focused and explain the compatibility assumptions behind changes to Shopify DOM or React internals. Include screenshots or recordings for visible UI changes, but redact store and customer information.

By contributing, you agree that your contribution is licensed under the repository's MIT License.
