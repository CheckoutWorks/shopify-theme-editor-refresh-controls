// ==UserScript==
// @name         Shopify Theme Editor Refresh Controls
// @namespace    https://checkoutworks.dev/
// @version      1.0.1
// @description  Refresh the storefront preview or discard unsaved edits without reloading the full Shopify Admin page.
// @author       CheckoutWorks
// @homepageURL  https://checkoutworks.dev/
// @supportURL   https://github.com/CheckoutWorks/shopify-theme-editor-refresh-controls/issues
// @license      MIT
// @match        https://online-store-web.shopifyapps.com/themes*
// @match        https://*.myshopify.com/*
// @run-at       document-start
// @sandbox      raw
// @grant        none
// ==/UserScript==

// SPDX-License-Identifier: MIT

/**
 * Shopify Theme Editor Refresh Controls
 *
 * An unofficial workflow enhancement for Shopify's Theme Editor. It adds:
 *
 * 1. Refresh storefront preview
 *    Reloads only the active design-mode storefront preview.
 *
 * 2. Discard and refresh the theme editor
 *    After confirmation, invokes Shopify's currently mounted native refresh
 *    action. This discards all unsaved Theme Editor changes.
 *
 * Privacy and security:
 * - No analytics, telemetry, storage, or external network requests are added.
 * - Preview messages are restricted by origin, source window, and nonce.
 * - The script never reconstructs or reloads Shopify's signed editor URL.
 *
 * Compatibility notice:
 * The editor reset action relies on Shopify's private React implementation and
 * a language-independent structural signature. Shopify can change these
 * implementation details without notice. Failure is handled without falling
 * back to a full-page Admin reload.
 *
 * Shopify is a trademark of Shopify Inc. This project is independent and is
 * not affiliated with, endorsed by, or supported by Shopify Inc.
 */

(() => {
  "use strict";

  /* ----------------------------------------------------------------------- */
  /* Runtime configuration                                                    */
  /* ----------------------------------------------------------------------- */

  const EDITOR_HOSTNAME = "online-store-web.shopifyapps.com";
  const EDITOR_ORIGIN = `https://${EDITOR_HOSTNAME}`;
  const MYSHOPIFY_SUFFIX = ".myshopify.com";
  const CONSOLE_PREFIX = "[Shopify Theme Editor Refresh Controls]";
  const INITIALIZATION_KEYS = [
    "__checkoutworksThemeEditorRefreshControlsInitialized",
    // Prevent older CheckoutWorks versions from initializing alongside this one.
    "__checkoutworksThemePreviewRefreshOptimizedInitialized",
  ];

  const MESSAGE_REQUEST = "checkoutworks:theme-preview-refresh:request:v1";
  const MESSAGE_ACKNOWLEDGEMENT =
    "checkoutworks:theme-preview-refresh:acknowledgement:v1";

  const PREVIEW_BUTTON_ID = "checkoutworks-theme-preview-refresh-button";
  const RESET_BUTTON_ID = "checkoutworks-theme-editor-reset-button";
  const BUTTON_WRAPPER_ATTRIBUTE =
    "data-checkoutworks-theme-refresh-wrapper";
  const STYLE_ID = "checkoutworks-theme-refresh-styles";
  const TOOLTIP_ID = "checkoutworks-theme-refresh-tooltip";
  const TOOLTIP_CONTENT_ATTRIBUTE =
    "data-checkoutworks-theme-refresh-tooltip-content";
  const TOOLTIP_TAIL_ATTRIBUTE =
    "data-checkoutworks-theme-refresh-tooltip-tail";

  const PREVIEW_LABEL = "Refresh storefront preview";
  const RESET_LABEL = "Discard and refresh the theme editor";
  const RESET_CONFIRMATION_MESSAGE =
    "Discard all unsaved changes and refresh the theme editor?\n\nYour unsaved changes will be lost.";
  const NO_UNSAVED_CHANGES_MESSAGE =
    "There are no unsaved changes to discard.";
  const REACT_FIBER_PROPERTY_PREFIXES = [
    "__reactFiber$",
    "__reactInternalInstance$",
  ];

  const ACKNOWLEDGEMENT_TIMEOUT_MS = 1_000;
  const PREVIEW_REFRESH_TIMEOUT_MS = 20_000;
  const EDITOR_RESET_WATCHDOG_MS = 20_000;
  const MAX_REACT_FIBER_NODES = 100_000;
  const COOLDOWN_MS = 1_500;
  const ERROR_STATE_MS = 3_000;
  const NOTICE_STATE_MS = 3_000;
  const TOOLTIP_SHOW_DELAY_MS = 250;
  const TOOLTIP_VIEWPORT_MARGIN_PX = 8;
  const TOOLTIP_BUTTON_GAP_PX = 12;
  const TOOLTIP_TAIL_HALF_WIDTH_PX = 9.5;

  if (INITIALIZATION_KEYS.some((key) => window[key])) {
    return;
  }

  for (const key of INITIALIZATION_KEYS) {
    Object.defineProperty(window, key, {
      configurable: false,
      enumerable: false,
      value: true,
      writable: false,
    });
  }

  /* ----------------------------------------------------------------------- */
  /* Context dispatch                                                         */
  /* ----------------------------------------------------------------------- */

  if (window.location.hostname === EDITOR_HOSTNAME) {
    initializeEditorControls();
    return;
  }

  if (window.location.hostname.endsWith(MYSHOPIFY_SUFFIX)) {
    initializePreviewListener();
  }

  /**
   * Runs inside a myshopify.com storefront preview iframe. It accepts one
   * narrowly scoped message from the parent Theme Editor and reloads only this
   * iframe document. Ordinary storefront tabs and non-design-mode frames exit.
   */
  function initializePreviewListener() {
    if (window.top === window.self) {
      return;
    }

    let listenerActive = false;
    let reloadScheduled = false;

    const handleMessage = (event) => {
      if (
        reloadScheduled ||
        event.origin !== EDITOR_ORIGIN ||
        event.source !== window.parent ||
        !isRefreshRequest(event.data) ||
        !isShopifyDesignModePreview()
      ) {
        return;
      }

      reloadScheduled = true;
      event.source.postMessage(
        {
          type: MESSAGE_ACKNOWLEDGEMENT,
          nonce: event.data.nonce,
        },
        event.origin,
      );

      window.setTimeout(() => {
        window.location.reload();
      }, 0);
    };

    const activateListener = () => {
      if (listenerActive) {
        return;
      }

      window.addEventListener("message", handleMessage);
      listenerActive = true;
    };

    const deactivateListener = () => {
      if (!listenerActive) {
        return;
      }

      window.removeEventListener("message", handleMessage);
      listenerActive = false;
    };

    window.addEventListener("pagehide", deactivateListener);
    window.addEventListener("pageshow", (event) => {
      if (!event.persisted) {
        return;
      }

      reloadScheduled = false;
      activateListener();
    });

    activateListener();
  }

  function isRefreshRequest(data) {
    return (
      data !== null &&
      typeof data === "object" &&
      data.type === MESSAGE_REQUEST &&
      typeof data.nonce === "string" &&
      data.nonce.length > 0 &&
      data.nonce.length <= 128
    );
  }

  function isShopifyDesignModePreview() {
    return (
      new URLSearchParams(window.location.search).has("oseid") &&
      window.Shopify?.designMode === true
    );
  }

  /**
   * Runs inside Shopify's embedded Theme Editor application. All editor UI,
   * lifecycle management, preview messaging, and native reset discovery stay
   * inside this frame; window.top is never navigated or reloaded.
   */
  function initializeEditorControls() {
    let activePreviewRefresh = null;
    let documentObserver = null;
    let previewButton = null;
    let resetButton = null;
    let injectionAnimationFrame = null;
    let runtimeActive = false;
    let nativeSaveButton = null;
    let nativeSaveLookupComplete = false;
    let nativeSaveStateObserver = null;
    let editorHasUnsavedChanges = null;

    let previewState = {
      kind: "idle",
      label: PREVIEW_LABEL,
    };
    let previewStateTimer = null;

    let editorResetActive = false;
    let editorResetTimer = null;
    let editorResetState = {
      kind: "idle",
      label: RESET_LABEL,
    };
    let editorResetStateTimer = null;

    let tooltip = null;
    let tooltipTarget = null;
    let tooltipShowTimer = null;

    const activateRuntime = () => {
      if (runtimeActive) {
        return;
      }

      if (!document.documentElement) {
        document.addEventListener("DOMContentLoaded", activateRuntime, {
          once: true,
        });
        return;
      }

      runtimeActive = true;
      startDocumentObserver();

      if (isEditorRoute()) {
        scheduleButtonInjection();
      }
    };

    const deactivateRuntime = () => {
      runtimeActive = false;
      documentObserver?.disconnect();
      documentObserver = null;
      nativeSaveStateObserver?.disconnect();
      nativeSaveStateObserver = null;
      nativeSaveButton = null;
      nativeSaveLookupComplete = false;
      editorHasUnsavedChanges = null;
      hideTooltip();

      if (injectionAnimationFrame !== null) {
        window.cancelAnimationFrame(injectionAnimationFrame);
        injectionAnimationFrame = null;
      }

      window.clearTimeout(previewStateTimer);
      window.clearTimeout(editorResetTimer);
      window.clearTimeout(editorResetStateTimer);
      previewStateTimer = null;
      editorResetTimer = null;
      editorResetStateTimer = null;

      if (activePreviewRefresh) {
        cleanUpPreviewRefresh(activePreviewRefresh);
      }
    };

    window.addEventListener("pagehide", deactivateRuntime);
    window.addEventListener("pageshow", (event) => {
      if (event.persisted) {
        editorResetActive = false;
        editorResetState = {
          kind: "idle",
          label: RESET_LABEL,
        };
        activateRuntime();
      }
    });
    window.addEventListener("resize", positionVisibleTooltip);
    window.addEventListener("scroll", positionVisibleTooltip, true);

    activateRuntime();

    function startDocumentObserver() {
      if (!runtimeActive || documentObserver) {
        return;
      }

      documentObserver = new MutationObserver(handleDocumentMutations);

      // Shopify can replace the entire toolbar during a React route change.
      // Observing only the current toolbar would stop working when that node is
      // detached, so this intentionally watches the editor document. The
      // callback uses cached button references and exits immediately while both
      // controls remain connected.
      documentObserver.observe(document.documentElement, {
        childList: true,
        subtree: true,
      });
    }

    function handleDocumentMutations() {
      if (!runtimeActive || !isEditorRoute()) {
        hideTooltip();
        return;
      }

      if (
        tooltipTarget &&
        (!tooltipTarget.isConnected ||
          (tooltipTarget !== getPreviewButton() &&
            tooltipTarget !== getResetButton()))
      ) {
        hideTooltip();
      }

      if (
        getPreviewButton() &&
        getResetButton() &&
        nativeSaveLookupComplete &&
        (!nativeSaveButton || nativeSaveButton.isConnected)
      ) {
        return;
      }

      scheduleButtonInjection();
    }

    function isEditorRoute() {
      return /^\/themes\/[^/]+\/editor(?:\/|$)/.test(
        window.location.pathname,
      );
    }

    function getPreviewButton() {
      previewButton = getConnectedButton(previewButton, PREVIEW_BUTTON_ID);
      return previewButton;
    }

    function getResetButton() {
      resetButton = getConnectedButton(resetButton, RESET_BUTTON_ID);
      return resetButton;
    }

    function getConnectedButton(cachedButton, id) {
      if (cachedButton?.isConnected) {
        return cachedButton;
      }

      const button = document.getElementById(id);
      return button instanceof HTMLButtonElement && button.isConnected
        ? button
        : null;
    }

    function installStyles() {
      if (document.getElementById(STYLE_ID)) {
        return;
      }

      const style = document.createElement("style");
      style.id = STYLE_ID;
      style.textContent = `
        #${PREVIEW_BUTTON_ID} svg,
        #${RESET_BUTTON_ID} svg {
          display: block;
          height: 20px;
          width: 20px;
        }

        #${PREVIEW_BUTTON_ID}[data-refresh-state="loading"] svg,
        #${RESET_BUTTON_ID}[data-refresh-state="loading"] svg {
          animation: checkoutworks-theme-refresh-spin 0.8s linear infinite;
        }

        #${PREVIEW_BUTTON_ID}[data-refresh-state="error"],
        #${RESET_BUTTON_ID}[data-refresh-state="error"] {
          color: var(--p-color-icon-critical, #8e1f0b);
        }

        #${PREVIEW_BUTTON_ID}:disabled,
        #${RESET_BUTTON_ID}:disabled {
          cursor: progress;
          opacity: 0.65;
        }

        #${RESET_BUTTON_ID}[data-disabled-reason="clean"] {
          cursor: default;
          opacity: 0.35;
        }

        #${TOOLTIP_ID} {
          --checkoutworks-tooltip-tail-left: 50%;
          background: var(--p-color-bg-surface, #ffffff);
          border-radius: var(--p-border-radius-200, 8px);
          box-shadow: var(
            --p-shadow-300,
            0 8px 24px -8px rgba(0, 0, 0, 0.28),
            0 8px 16px -4px rgba(0, 0, 0, 0.05),
            0 3px 6px rgba(0, 0, 0, 0.05),
            0 2px 4px rgba(0, 0, 0, 0.05),
            0 1px 2px rgba(0, 0, 0, 0.05),
            0 0 0 1px rgba(0, 0, 0, 0.06)
          );
          color: var(--p-color-text, #303030);
          font-family: var(
            --p-font-family-sans,
            Inter,
            -apple-system,
            BlinkMacSystemFont,
            "San Francisco",
            "Segoe UI",
            Roboto,
            "Helvetica Neue",
            sans-serif
          );
          font-size: 13px;
          font-weight: 450;
          left: 0;
          line-height: 20px;
          max-width: min(280px, calc(100vw - 16px));
          opacity: 0;
          padding: var(--p-space-100, 4px) var(--p-space-200, 8px);
          pointer-events: none;
          position: fixed;
          text-align: center;
          top: 0;
          transition: opacity 100ms ease;
          white-space: nowrap;
          z-index: 2147483647;
        }

        #${TOOLTIP_ID} [${TOOLTIP_TAIL_ATTRIBUTE}] {
          height: 11px;
          left: var(--checkoutworks-tooltip-tail-left);
          overflow: hidden;
          position: absolute;
          top: -7.2px;
          transform: translateX(-50%);
          width: 19px;
        }

        #${TOOLTIP_ID}[data-placement="top"] [${TOOLTIP_TAIL_ATTRIBUTE}] {
          bottom: -7.2px;
          top: auto;
          transform: translateX(-50%) rotate(180deg);
        }

        #${TOOLTIP_ID}[data-visible="true"] {
          opacity: 1;
        }

        #${TOOLTIP_ID}[hidden] {
          display: none;
        }

        @media (prefers-reduced-motion: reduce) {
          #${TOOLTIP_ID} {
            transition: none;
          }

          #${PREVIEW_BUTTON_ID}[data-refresh-state="loading"] svg,
          #${RESET_BUTTON_ID}[data-refresh-state="loading"] svg {
            animation-duration: 1.6s;
          }
        }

        @keyframes checkoutworks-theme-refresh-spin {
          to {
            transform: rotate(360deg);
          }
        }
      `;

      (document.head || document.documentElement).append(style);
    }

    function scheduleButtonInjection() {
      if (injectionAnimationFrame !== null) {
        return;
      }

      injectionAnimationFrame = window.requestAnimationFrame(() => {
        injectionAnimationFrame = null;
        injectButtonsIfNeeded();
      });
    }

    function injectButtonsIfNeeded() {
      if (!runtimeActive || !isEditorRoute()) {
        return;
      }

      const sidekickButton = findSidekickButton();
      const sidekickWrapper = sidekickButton?.parentElement;
      if (!sidekickButton || !sidekickWrapper) {
        return;
      }

      removeEmptyInjectedWrappers();
      installStyles();
      ensureTooltip();

      previewButton =
        getPreviewButton() ||
        createToolbarButton({
          id: PREVIEW_BUTTON_ID,
          icon: createPreviewRefreshIcon(),
          label: PREVIEW_LABEL,
          onClick: refreshVisiblePreview,
          sidekickButton,
        });

      resetButton =
        getResetButton() ||
        createToolbarButton({
          id: RESET_BUTTON_ID,
          icon: createEditorDiscardIcon(),
          label: RESET_LABEL,
          onClick: refreshAndResetEditor,
          sidekickButton,
        });

      const previewWrapper = ensureButtonWrapper(
        previewButton,
        sidekickWrapper,
        "preview",
      );
      const resetWrapper = ensureButtonWrapper(
        resetButton,
        sidekickWrapper,
        "reset",
      );

      sidekickWrapper.before(previewWrapper, resetWrapper);
      synchronizeNativeSaveState();
      applyAllToolbarStates();
    }

    function synchronizeNativeSaveState() {
      const candidates = document.querySelectorAll(
        'header s-internal-button[variant="primary"]:not([icon])',
      );
      const nextSaveButton =
        candidates.length === 1 && candidates[0] instanceof HTMLElement
          ? candidates[0]
          : null;
      nativeSaveLookupComplete = true;

      if (nextSaveButton !== nativeSaveButton) {
        nativeSaveStateObserver?.disconnect();
        nativeSaveStateObserver = null;
        nativeSaveButton = nextSaveButton;

        if (nativeSaveButton) {
          nativeSaveStateObserver = new MutationObserver(() => {
            updateEditorUnsavedState();
          });
          nativeSaveStateObserver.observe(nativeSaveButton, {
            attributeFilter: ["disabled"],
            attributes: true,
          });
        }
      }

      updateEditorUnsavedState();
    }

    function updateEditorUnsavedState() {
      const nextState = nativeSaveButton?.isConnected
        ? !nativeSaveButton.hasAttribute("disabled")
        : null;

      if (nextState === editorHasUnsavedChanges) {
        return;
      }

      editorHasUnsavedChanges = nextState;
      applyAllToolbarStates();
    }

    function ensureButtonWrapper(button, sidekickWrapper, action) {
      const currentWrapper = button.parentElement;
      if (
        currentWrapper?.getAttribute(BUTTON_WRAPPER_ATTRIBUTE) === action
      ) {
        return currentWrapper;
      }

      const wrapper = document.createElement(
        sidekickWrapper.tagName.toLowerCase(),
      );
      wrapper.className = sidekickWrapper.className;
      wrapper.setAttribute(BUTTON_WRAPPER_ATTRIBUTE, action);
      wrapper.append(button);
      return wrapper;
    }

    function removeEmptyInjectedWrappers() {
      const wrappers = document.querySelectorAll(
        `[${BUTTON_WRAPPER_ATTRIBUTE}]`,
      );

      for (const wrapper of wrappers) {
        if (
          !wrapper.querySelector(
            `#${PREVIEW_BUTTON_ID}, #${RESET_BUTTON_ID}`,
          )
        ) {
          wrapper.remove();
        }
      }
    }

    function findSidekickButton() {
      const selectors = [
        'button[data-component-extra-ui_interaction_source="sidekick"]',
        'button[aria-controls="sidekick"]',
        'button[aria-label="Open Sidekick"]',
      ];

      for (const selector of selectors) {
        const button = document.querySelector(selector);
        if (
          button instanceof HTMLButtonElement &&
          button.id !== PREVIEW_BUTTON_ID &&
          button.id !== RESET_BUTTON_ID
        ) {
          return button;
        }
      }

      return null;
    }

    function createToolbarButton({
      id,
      icon,
      label,
      onClick,
      sidekickButton,
    }) {
      // Reuse the current Shopify button structure and runtime classes instead
      // of depending on private, generated Polaris class names.
      const button = sidekickButton.cloneNode(true);
      button.id = id;
      button.type = "button";
      button.removeAttribute("aria-controls");
      button.removeAttribute("aria-describedby");
      button.removeAttribute("aria-expanded");
      button.removeAttribute("aria-pressed");
      button.removeAttribute("data-component-extra-ui_interaction_source");
      button.removeAttribute("data-polaris-tooltip-activator");
      button.removeAttribute("title");
      button.setAttribute("aria-label", label);
      button.setAttribute("aria-describedby", TOOLTIP_ID);
      button.dataset.tooltipLabel = label;

      const existingIcon = button.querySelector("s-internal-icon, svg");
      if (existingIcon) {
        existingIcon.replaceWith(icon);
      } else {
        const iconContainer =
          button.querySelector('[class*="PlainAction__Prefix"]') || button;
        iconContainer.replaceChildren(icon);
      }

      bindTooltip(button);
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        hideTooltip();
        onClick();
      });

      return button;
    }

    function createPreviewRefreshIcon() {
      return createIcon([
        "M16.25 9a6.25 6.25 0 1 0-1.83 4.42",
        "M16.25 4.75V9H12",
      ]);
    }

    function createEditorDiscardIcon() {
      return createIcon([
        "M4.25 6.75A6.25 6.25 0 1 1 4.6 13.5",
        "M4.25 3.75v3h3",
        "M8.15 8.15l3.7 3.7",
        "M11.85 8.15l-3.7 3.7",
      ]);
    }

    function createIcon(pathData) {
      const svgNamespace = "http://www.w3.org/2000/svg";
      const svg = document.createElementNS(svgNamespace, "svg");
      svg.setAttribute("viewBox", "0 0 20 20");
      svg.setAttribute("fill", "none");
      svg.setAttribute("aria-hidden", "true");
      svg.setAttribute("focusable", "false");

      for (const data of pathData) {
        const path = document.createElementNS(svgNamespace, "path");
        path.setAttribute("d", data);
        path.setAttribute("stroke", "currentColor");
        path.setAttribute("stroke-width", "1.5");
        path.setAttribute("stroke-linecap", "round");
        path.setAttribute("stroke-linejoin", "round");
        svg.append(path);
      }

      return svg;
    }

    function bindTooltip(button) {
      button.addEventListener("pointerenter", () => {
        scheduleTooltip(button);
      });
      button.addEventListener("pointerleave", () => {
        hideTooltip();
      });
      button.addEventListener("focus", () => {
        scheduleTooltip(button, true);
      });
      button.addEventListener("blur", () => {
        hideTooltip();
      });
      button.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
          hideTooltip();
        }
      });
    }

    function ensureTooltip() {
      if (tooltip?.isConnected) {
        return tooltip;
      }

      const existingTooltip = document.getElementById(TOOLTIP_ID);
      if (existingTooltip instanceof HTMLElement) {
        tooltip = existingTooltip;
        return tooltip;
      }

      if (!document.body) {
        return null;
      }

      tooltip = document.createElement("div");
      tooltip.id = TOOLTIP_ID;
      tooltip.hidden = true;
      tooltip.setAttribute("role", "tooltip");
      tooltip.setAttribute("aria-live", "polite");

      const svgNamespace = "http://www.w3.org/2000/svg";
      const tail = document.createElementNS(svgNamespace, "svg");
      tail.setAttribute(TOOLTIP_TAIL_ATTRIBUTE, "");
      tail.setAttribute("width", "19");
      tail.setAttribute("height", "11");
      tail.setAttribute("viewBox", "0 0 19 11");
      tail.setAttribute("fill", "none");
      tail.setAttribute("aria-hidden", "true");

      const borderPath = document.createElementNS(svgNamespace, "path");
      borderPath.setAttribute(
        "d",
        "M18.829 8.171 11.862.921A3 3 0 0 0 7.619.838L0 8.171h1.442l6.87-6.612a2 2 0 0 1 2.83.055l6.3 6.557h1.387Z",
      );
      borderPath.setAttribute(
        "fill",
        "var(--p-color-tooltip-tail-up-border, #e3e3e3)",
      );

      const surfacePath = document.createElementNS(svgNamespace, "path");
      surfacePath.setAttribute(
        "d",
        "M17.442 10.171h-16v-2l6.87-6.612a2 2 0 0 1 2.83.055l6.3 6.557v2Z",
      );
      surfacePath.setAttribute(
        "fill",
        "var(--p-color-bg-surface, #ffffff)",
      );

      const content = document.createElement("div");
      content.setAttribute(TOOLTIP_CONTENT_ATTRIBUTE, "");
      tail.append(borderPath, surfacePath);
      tooltip.append(tail, content);
      document.body.append(tooltip);
      return tooltip;
    }

    function scheduleTooltip(button, showImmediately = false) {
      window.clearTimeout(tooltipShowTimer);
      tooltipShowTimer = null;

      if (
        !button.isConnected ||
        button.disabled ||
        !button.dataset.tooltipLabel
      ) {
        return;
      }

      tooltipTarget = button;
      const show = () => {
        if (
          tooltipTarget !== button ||
          !button.isConnected ||
          button.disabled
        ) {
          return;
        }

        showTooltip(button);
      };

      if (showImmediately) {
        show();
        return;
      }

      tooltipShowTimer = window.setTimeout(show, TOOLTIP_SHOW_DELAY_MS);
    }

    function showTooltip(button) {
      const tooltipElement = ensureTooltip();
      if (!tooltipElement) {
        return;
      }

      tooltipTarget = button;
      const content = tooltipElement.querySelector(
        `[${TOOLTIP_CONTENT_ATTRIBUTE}]`,
      );
      if (!(content instanceof HTMLElement)) {
        return;
      }

      content.textContent = button.dataset.tooltipLabel;
      tooltipElement.hidden = false;
      tooltipElement.dataset.visible = "false";
      tooltipElement.style.visibility = "hidden";

      window.requestAnimationFrame(() => {
        if (tooltipTarget !== button || !button.isConnected) {
          hideTooltip();
          return;
        }

        positionTooltip(button, tooltipElement);
        tooltipElement.style.visibility = "visible";
        tooltipElement.dataset.visible = "true";
      });
    }

    function positionVisibleTooltip() {
      if (
        !tooltipTarget ||
        !tooltipTarget.isConnected ||
        !tooltip ||
        tooltip.hidden
      ) {
        if (tooltipTarget && !tooltipTarget.isConnected) {
          hideTooltip();
        }
        return;
      }

      positionTooltip(tooltipTarget, tooltip);
    }

    function positionTooltip(button, tooltipElement) {
      const buttonBounds = button.getBoundingClientRect();
      const tooltipBounds = tooltipElement.getBoundingClientRect();
      const maximumLeft =
        window.innerWidth -
        tooltipBounds.width -
        TOOLTIP_VIEWPORT_MARGIN_PX;
      const idealLeft =
        buttonBounds.left +
        buttonBounds.width / 2 -
        tooltipBounds.width / 2;
      const left = Math.min(
        Math.max(TOOLTIP_VIEWPORT_MARGIN_PX, idealLeft),
        Math.max(TOOLTIP_VIEWPORT_MARGIN_PX, maximumLeft),
      );

      let placement = "bottom";
      let top = buttonBounds.bottom + TOOLTIP_BUTTON_GAP_PX;
      if (
        top + tooltipBounds.height >
        window.innerHeight - TOOLTIP_VIEWPORT_MARGIN_PX
      ) {
        placement = "top";
        top =
          buttonBounds.top -
          tooltipBounds.height -
          TOOLTIP_BUTTON_GAP_PX;
      }

      const tailLeft = Math.min(
        Math.max(
          TOOLTIP_TAIL_HALF_WIDTH_PX,
          buttonBounds.left + buttonBounds.width / 2 - left,
        ),
        tooltipBounds.width - TOOLTIP_TAIL_HALF_WIDTH_PX,
      );

      tooltipElement.dataset.placement = placement;
      tooltipElement.style.setProperty(
        "--checkoutworks-tooltip-tail-left",
        `${tailLeft}px`,
      );
      tooltipElement.style.left = `${Math.round(left)}px`;
      tooltipElement.style.top = `${Math.round(
        Math.max(TOOLTIP_VIEWPORT_MARGIN_PX, top),
      )}px`;
    }

    function hideTooltip() {
      window.clearTimeout(tooltipShowTimer);
      tooltipShowTimer = null;
      tooltipTarget = null;

      if (!tooltip?.isConnected) {
        tooltip = null;
        return;
      }

      tooltip.dataset.visible = "false";
      tooltip.hidden = true;
      tooltip.style.visibility = "";
    }

    function getCurrentReactFiberRoot() {
      const sidekickButton = findSidekickButton();
      if (!sidekickButton) {
        return null;
      }

      const fiberProperty = Reflect.ownKeys(sidekickButton).find(
        (property) =>
          typeof property === "string" &&
          REACT_FIBER_PROPERTY_PREFIXES.some((prefix) =>
            property.startsWith(prefix),
          ),
      );
      if (!fiberProperty) {
        return null;
      }

      let fiber = sidekickButton[fiberProperty];
      if (!fiber || typeof fiber !== "object") {
        return null;
      }

      while (fiber.return && typeof fiber.return === "object") {
        fiber = fiber.return;
      }

      const currentFiber = fiber.stateNode?.current;
      return currentFiber && typeof currentFiber === "object"
        ? currentFiber
        : fiber;
    }

    /**
     * Locates the currently mounted callback behind Shopify's hidden native
     * theme-editor refresh action without depending on localized UI copy.
     *
     * This is deliberately resolved on every confirmed reset. React Fiber
     * references can become stale after reconciliation, template changes, or
     * editor navigation. The traversal is bounded and runs only on user action.
     *
     * The direct action must have the unique structure observed in Shopify's
     * discard-refresh modal: a destructive primary action, no secondary action,
     * and the same function reference for primaryAction.onAction and onClose.
     * It is then correlated with the conflict modal's secondary action by the
     * already-localized action content. Duplicate Fiber wrappers are collapsed
     * by callback identity. Any missing or ambiguous signal fails closed.
     *
     * @returns {{onAction: Function}|{error: string, reason?: string}}
     */
    function inspectHiddenNativeRefreshAction() {
      const root = getCurrentReactFiberRoot();
      if (!root) {
        return {
          error: "Shopify's React editor tree is unavailable",
        };
      }

      const stack = [root];
      const visitedFibers = new Set();
      const visitedProps = new Set();
      const directActionGroups = new Map();
      const secondaryActionCandidates = [];
      let nodesInspected = 0;

      while (stack.length > 0) {
        const fiber = stack.pop();
        if (
          !fiber ||
          typeof fiber !== "object" ||
          visitedFibers.has(fiber)
        ) {
          continue;
        }

        visitedFibers.add(fiber);
        nodesInspected += 1;
        if (nodesInspected > MAX_REACT_FIBER_NODES) {
          return {
            error: "Shopify's React editor tree exceeded the safety limit",
          };
        }

        const propsCandidates = [fiber.memoizedProps, fiber.pendingProps];
        for (const props of propsCandidates) {
          if (
            !props ||
            typeof props !== "object" ||
            visitedProps.has(props) ||
            typeof props.open !== "boolean"
          ) {
            continue;
          }

          visitedProps.add(props);

          const primaryAction = props.primaryAction;
          const secondaryActions = Array.isArray(props.secondaryActions)
            ? props.secondaryActions
            : [];
          const normalizedPrimaryContent = normalizeActionContent(
            primaryAction?.content,
          );

          if (
            props.open === false &&
            primaryAction?.destructive === true &&
            typeof primaryAction.onAction === "function" &&
            primaryAction.onAction === props.onClose &&
            secondaryActions.length === 0 &&
            normalizedPrimaryContent
          ) {
            let group = directActionGroups.get(primaryAction.onAction);
            if (!group) {
              group = {
                contents: new Set(),
                onAction: primaryAction.onAction,
              };
              directActionGroups.set(primaryAction.onAction, group);
            }

            group.contents.add(normalizedPrimaryContent);
          }

          for (const action of secondaryActions) {
            const normalizedContent = normalizeActionContent(
              action?.content,
            );
            if (
              normalizedContent &&
              typeof action.onAction === "function"
            ) {
              secondaryActionCandidates.push({
                content: normalizedContent,
                disabled: action.disabled === true,
                modalOpen: props.open,
              });
            }
          }
        }

        if (fiber.sibling) {
          stack.push(fiber.sibling);
        }
        if (fiber.child) {
          stack.push(fiber.child);
        }
      }

      if (directActionGroups.size !== 1) {
        return {
          error:
            "Shopify's native refresh action was not uniquely identified",
        };
      }

      const [directActionGroup] = directActionGroups.values();
      if (directActionGroup.contents.size !== 1) {
        return {
          error: "Shopify's native refresh action metadata was inconsistent",
        };
      }

      const [directActionContent] = directActionGroup.contents;
      const correlatedConflictActions = secondaryActionCandidates.filter(
        (candidate) => candidate.content === directActionContent,
      );

      if (correlatedConflictActions.length === 0) {
        return {
          error: "Shopify's native refresh action could not be verified",
        };
      }

      if (
        correlatedConflictActions.some(
          (candidate) => candidate.modalOpen === true,
        )
      ) {
        return {
          error: "Use Shopify's open conflict dialog",
        };
      }

      if (
        correlatedConflictActions.every(
          (candidate) => candidate.disabled === true,
        )
      ) {
        return {
          error: "Shopify's native refresh action is currently disabled",
          reason: "no-unsaved-changes",
        };
      }

      return { onAction: directActionGroup.onAction };
    }

    function normalizeActionContent(value) {
      if (typeof value !== "string") {
        return null;
      }

      const normalized = value.normalize("NFKC").trim().replace(/\s+/gu, " ");
      return normalized || null;
    }

    function refreshAndResetEditor() {
      if (
        editorResetActive ||
        activePreviewRefresh ||
        previewState.kind === "cooldown" ||
        editorResetState.kind === "cooldown"
      ) {
        return;
      }

      if (!isEditorRoute()) {
        showEditorResetError("The current page is not a theme editor route");
        return;
      }

      const nativeRefreshAction = inspectHiddenNativeRefreshAction();
      if (!nativeRefreshAction.onAction) {
        if (nativeRefreshAction.reason === "no-unsaved-changes") {
          showNoUnsavedChangesNotice();
          return;
        }

        showEditorResetError(nativeRefreshAction.error);
        return;
      }

      if (!window.confirm(RESET_CONFIRMATION_MESSAGE)) {
        return;
      }

      editorResetActive = true;
      transitionEditorResetState(
        "loading",
        "Calling Shopify's native theme editor refresh",
      );
      applyAllToolbarStates();

      editorResetTimer = window.setTimeout(() => {
        failEditorReset(
          "Shopify's native theme editor refresh did not finish",
        );
      }, EDITOR_RESET_WATCHDOG_MS);

      let nativeRefreshResult;
      try {
        nativeRefreshResult = nativeRefreshAction.onAction();
      } catch {
        failEditorReset("Shopify's native refresh action threw an error");
        return;
      }

      Promise.resolve(nativeRefreshResult).then(
        completeEditorReset,
        () => {
          failEditorReset("Shopify's native refresh action was rejected");
        },
      );
    }

    function showNoUnsavedChangesNotice() {
      const button = getResetButton();
      if (!button) {
        return;
      }

      transitionEditorResetState("idle", NO_UNSAVED_CHANGES_MESSAGE);
      showTooltip(button);

      editorResetStateTimer = window.setTimeout(() => {
        hideTooltip();
        transitionEditorResetState("idle", RESET_LABEL);
      }, NOTICE_STATE_MS);
    }

    function completeEditorReset() {
      if (!editorResetActive) {
        return;
      }

      editorResetActive = false;
      window.clearTimeout(editorResetTimer);
      editorResetTimer = null;
      transitionEditorResetState(
        "cooldown",
        "Theme editor refreshed from Shopify's saved state",
      );
      scheduleEditorResetIdleState(COOLDOWN_MS);
    }

    function failEditorReset(message) {
      if (!editorResetActive) {
        return;
      }

      editorResetActive = false;
      window.clearTimeout(editorResetTimer);
      editorResetTimer = null;
      showEditorResetError(message);
      applyAllToolbarStates();
    }

    function showEditorResetError(message) {
      console.warn(`${CONSOLE_PREFIX} ${message}`);
      transitionEditorResetState("error", message);
      scheduleEditorResetIdleState(ERROR_STATE_MS);
    }

    function scheduleEditorResetIdleState(delay) {
      window.clearTimeout(editorResetStateTimer);
      editorResetStateTimer = window.setTimeout(() => {
        transitionEditorResetState("idle", RESET_LABEL);
      }, delay);
    }

    function transitionEditorResetState(kind, label) {
      window.clearTimeout(editorResetStateTimer);
      editorResetState = { kind, label };
      applyAllToolbarStates();
    }

    function refreshVisiblePreview() {
      if (
        activePreviewRefresh ||
        editorResetActive ||
        previewState.kind === "cooldown"
      ) {
        return;
      }

      const previewFrame = findVisiblePreviewFrame();
      if (!previewFrame) {
        showPreviewError("No active storefront preview was found");
        return;
      }

      const previewUrl = getPreviewUrl(previewFrame);
      if (!previewUrl) {
        showPreviewError("The active preview URL is unavailable");
        return;
      }

      const refresh = {
        acknowledged: false,
        controller: new AbortController(),
        fallbackUsed: false,
        fallbackTimer: null,
        frame: previewFrame,
        loadObserved: false,
        nonce: createNonce(),
        origin: previewUrl.origin,
        timeoutTimer: null,
      };

      const handleAcknowledgement = (event) => {
        if (
          event.source !== refresh.frame.contentWindow ||
          event.origin !== refresh.origin ||
          event.data?.type !== MESSAGE_ACKNOWLEDGEMENT ||
          event.data?.nonce !== refresh.nonce
        ) {
          return;
        }

        refresh.acknowledged = true;
        window.clearTimeout(refresh.fallbackTimer);

        if (refresh.loadObserved) {
          completePreviewRefresh(refresh);
        }
      };

      const handleFrameLoad = () => {
        refresh.loadObserved = true;

        if (!refresh.acknowledged && !refresh.fallbackUsed) {
          return;
        }

        completePreviewRefresh(refresh);
      };

      activePreviewRefresh = refresh;
      transitionPreviewState("loading", "Refreshing storefront preview");

      window.addEventListener("message", handleAcknowledgement, {
        capture: true,
        signal: refresh.controller.signal,
      });
      previewFrame.addEventListener("load", handleFrameLoad, {
        signal: refresh.controller.signal,
      });

      refresh.fallbackTimer = window.setTimeout(() => {
        fallbackToFrameSourceReload(refresh);
      }, ACKNOWLEDGEMENT_TIMEOUT_MS);

      refresh.timeoutTimer = window.setTimeout(() => {
        failPreviewRefresh(
          refresh,
          "The storefront preview did not finish loading",
        );
      }, PREVIEW_REFRESH_TIMEOUT_MS);

      try {
        previewFrame.contentWindow?.postMessage(
          {
            type: MESSAGE_REQUEST,
            nonce: refresh.nonce,
          },
          refresh.origin,
        );
      } catch {
        window.clearTimeout(refresh.fallbackTimer);
        fallbackToFrameSourceReload(refresh);
      }
    }

    function findVisiblePreviewFrame() {
      // Section and block inspectors may create additional frames. Only
      // storefront preview frames are considered, and the visible primary
      // preview wins by title and rendered area.
      const candidates = Array.from(
        document.querySelectorAll('iframe[id^="storefront-iframe-"]'),
      ).filter(
        (frame) => frame instanceof HTMLIFrameElement && isVisible(frame),
      );

      candidates.sort((first, second) => {
        return scorePreviewFrame(second) - scorePreviewFrame(first);
      });

      return candidates[0] || null;
    }

    function isVisible(frame) {
      if (
        !frame.isConnected ||
        frame.getAttribute("tabindex") === "-1" ||
        frame.getAttribute("aria-hidden") === "true"
      ) {
        return false;
      }

      const style = window.getComputedStyle(frame);
      const bounds = frame.getBoundingClientRect();
      return (
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        style.opacity !== "0" &&
        bounds.width > 0 &&
        bounds.height > 0
      );
    }

    function scorePreviewFrame(frame) {
      const bounds = frame.getBoundingClientRect();
      const titleScore =
        frame.title === "Online store preview" ? 1_000_000 : 0;
      return titleScore + bounds.width * bounds.height;
    }

    function getPreviewUrl(frame) {
      const directUrl = getValidatedMyShopifyUrl(frame.src);
      if (directUrl) {
        return directUrl;
      }

      const previewForm = getPreviewLoadForm(frame);
      if (!previewForm) {
        return null;
      }

      return getValidatedMyShopifyUrl(previewForm.action);
    }

    function getValidatedMyShopifyUrl(value) {
      try {
        const url = new URL(value, window.location.href);
        if (
          url.protocol !== "https:" ||
          !url.hostname.endsWith(MYSHOPIFY_SUFFIX)
        ) {
          return null;
        }

        return url;
      } catch {
        return null;
      }
    }

    function getPreviewLoadForm(frame) {
      if (!frame.id || !frame.name) {
        return null;
      }

      const form = document.getElementById(`${frame.id}-form`);
      if (
        !(form instanceof HTMLFormElement) ||
        form.target !== frame.name ||
        !getValidatedMyShopifyUrl(form.action)
      ) {
        return null;
      }

      return form;
    }

    function fallbackToFrameSourceReload(refresh) {
      if (
        activePreviewRefresh !== refresh ||
        refresh.fallbackUsed
      ) {
        return;
      }

      if (!refresh.frame.isConnected) {
        failPreviewRefresh(refresh, "The storefront preview was replaced");
        return;
      }

      // Prefer Shopify's own preview form when the iframe listener did not
      // acknowledge the request. Reassigning the validated iframe URL is the
      // final preview-only fallback; the Admin or editor document is never
      // reloaded here.
      const previewForm = getPreviewLoadForm(refresh.frame);
      if (previewForm) {
        refresh.fallbackUsed = true;

        try {
          HTMLFormElement.prototype.submit.call(previewForm);
        } catch {
          failPreviewRefresh(
            refresh,
            "The storefront preview form could not be submitted",
          );
        }

        return;
      }

      const source = getValidatedMyShopifyUrl(refresh.frame.src);
      if (!source) {
        failPreviewRefresh(
          refresh,
          "The storefront preview cannot be reloaded",
        );
        return;
      }

      refresh.fallbackUsed = true;
      refresh.frame.src = source.href;
    }

    function completePreviewRefresh(refresh) {
      if (activePreviewRefresh !== refresh) {
        return;
      }

      cleanUpPreviewRefresh(refresh);
      transitionPreviewState("cooldown", "Storefront preview refreshed");
      schedulePreviewIdleState(COOLDOWN_MS);
    }

    function failPreviewRefresh(refresh, message) {
      if (activePreviewRefresh !== refresh) {
        return;
      }

      cleanUpPreviewRefresh(refresh);
      showPreviewError(message);
    }

    function cleanUpPreviewRefresh(refresh) {
      refresh.controller.abort();
      window.clearTimeout(refresh.fallbackTimer);
      window.clearTimeout(refresh.timeoutTimer);

      if (activePreviewRefresh === refresh) {
        activePreviewRefresh = null;
      }

      applyAllToolbarStates();
    }

    function createNonce() {
      if (typeof window.crypto?.randomUUID === "function") {
        return window.crypto.randomUUID();
      }

      return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    }

    function showPreviewError(message) {
      console.warn(`${CONSOLE_PREFIX} ${message}`);
      transitionPreviewState("error", message);
      schedulePreviewIdleState(ERROR_STATE_MS);
    }

    function schedulePreviewIdleState(delay) {
      window.clearTimeout(previewStateTimer);
      previewStateTimer = window.setTimeout(() => {
        transitionPreviewState("idle", PREVIEW_LABEL);
      }, delay);
    }

    function transitionPreviewState(kind, label) {
      window.clearTimeout(previewStateTimer);
      previewState = { kind, label };
      applyAllToolbarStates();
    }

    function applyAllToolbarStates() {
      const currentPreviewButton = getPreviewButton();
      if (currentPreviewButton) {
        applyPreviewButtonState(currentPreviewButton);
      }

      const currentResetButton = getResetButton();
      if (currentResetButton) {
        applyResetButtonState(currentResetButton);
      }
    }

    function applyPreviewButtonState(button) {
      const isDisabled =
        editorResetActive ||
        previewState.kind === "loading" ||
        previewState.kind === "cooldown";
      button.dataset.refreshState = previewState.kind;
      button.disabled = isDisabled;
      button.setAttribute("aria-disabled", String(isDisabled));
      button.setAttribute("aria-label", previewState.label);
      button.dataset.tooltipLabel = previewState.label;
    }

    function applyResetButtonState(button) {
      const hasNoUnsavedChanges = editorHasUnsavedChanges === false;
      const isBusy =
        editorResetActive ||
        activePreviewRefresh !== null ||
        previewState.kind === "cooldown" ||
        editorResetState.kind === "cooldown";
      const isUnavailable = hasNoUnsavedChanges || isBusy;
      const label = hasNoUnsavedChanges
        ? NO_UNSAVED_CHANGES_MESSAGE
        : editorResetState.label;

      button.dataset.refreshState = editorResetState.kind;
      button.disabled = isBusy;
      button.setAttribute("aria-disabled", String(isUnavailable));
      button.setAttribute("aria-label", label);
      button.dataset.tooltipLabel = label;

      if (hasNoUnsavedChanges) {
        button.dataset.disabledReason = "clean";
      } else if (isBusy) {
        button.dataset.disabledReason = "busy";
      } else {
        delete button.dataset.disabledReason;
      }
    }
  }
})();
