(() => {
  "use strict";

  const HOST_ID = "knowbefore-overlay-host";

  function createTextElement(tagName, className, text) {
    const element = document.createElement(tagName);
    element.className = className;
    element.textContent = text;
    return element;
  }

  function showOverlay({ policyContent, type, confidence }) {
    if (document.getElementById(HOST_ID)) {
      return;
    }

    const host = document.createElement("div");
    host.id = HOST_ID;
    const shadowRoot = host.attachShadow({ mode: "closed" });
    const style = document.createElement("style");
    style.textContent = `
      :host { all: initial; }
      .knowbefore-card {
        all: initial;
        display: block;
        box-sizing: border-box;
        width: 100%;
        max-height: calc(100vh - 112px);
        overflow: auto;
        padding: 18px;
        color: #17211b;
        background: #f7f4ec;
        border: 2px solid #26382c;
        border-radius: 8px;
        box-shadow: 0 12px 32px rgba(20, 31, 23, 0.34);
        font-family: Georgia, "Times New Roman", serif;
        animation: knowbefore-enter 180ms ease-out;
      }
      .knowbefore-card * { box-sizing: border-box; }
      .knowbefore-header {
        align-items: flex-start;
        display: flex;
        gap: 16px;
        justify-content: space-between;
      }
      .knowbefore-brand, .knowbefore-status, .knowbefore-label,
      .knowbefore-confidence, .knowbefore-details, .knowbefore-label,
      .knowbefore-policy-text, .knowbefore-local { margin: 0; }
      .knowbefore-brand {
        color: #203e2b;
        font-family: "Trebuchet MS", sans-serif;
        font-size: 13px;
        font-weight: 700;
        letter-spacing: 1.8px;
      }
      .knowbefore-status {
        color: #17211b;
        font-size: 16px;
        font-weight: 700;
        line-height: 1.3;
        margin-top: 4px;
      }
      .knowbefore-confidence {
        color: #496052;
        font: 12px/1.4 "Trebuchet MS", sans-serif;
        margin-top: 4px;
      }
      .knowbefore-close {
        align-items: center;
        background: transparent;
        border: 0;
        color: #496052;
        cursor: pointer;
        display: flex;
        font: 24px/1 Arial, sans-serif;
        height: 28px;
        justify-content: center;
        margin: -5px -5px 0 0;
        padding: 0;
        width: 28px;
      }
      .knowbefore-close:hover, .knowbefore-close:focus-visible {
        color: #17211b;
        outline: 2px solid #d08b43;
        outline-offset: 2px;
      }
      .knowbefore-divider { background: #cbd1c7; height: 1px; margin: 14px 0 12px; }
      .knowbefore-label, .knowbefore-local {
        color: #66746a;
        font-family: "Trebuchet MS", sans-serif;
        font-size: 10px;
      }
      .knowbefore-label { font-weight: 700; letter-spacing: 1.2px; text-transform: uppercase; }
      .knowbefore-details {
        color: #496052;
        font: 11px/1.5 "Trebuchet MS", sans-serif;
        margin: 10px 0;
      }
      .knowbefore-policy-text {
        color: #26372c;
        font: 13px/1.5 Georgia, "Times New Roman", serif;
        max-height: min(42vh, 360px);
        min-height: 48px;
        overflow: auto;
        padding-right: 6px;
        overflow-wrap: anywhere;
        white-space: pre-wrap;
      }
      .knowbefore-local { margin-top: 12px; }
      @keyframes knowbefore-enter { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
    `;
    const container = document.createElement("section");
    container.className = "knowbefore-card";
    container.setAttribute("role", "status");
    container.setAttribute("aria-label", "KnowBefore policy page detection");

    const matchLabel = type === "terms" ? "Terms & Conditions" : "Privacy Policy";
    const header = document.createElement("div");
    header.className = "knowbefore-header";
    const heading = document.createElement("div");
    heading.append(
      createTextElement("p", "knowbefore-brand", "KNOWBEFORE"),
      createTextElement("p", "knowbefore-status", `${matchLabel} detected`),
      createTextElement("p", "knowbefore-confidence", `Confidence: ${confidence}`)
    );
    const closeButton = createTextElement("button", "knowbefore-close", "X");
    closeButton.type = "button";
    closeButton.setAttribute("aria-label", "Close KnowBefore overlay");
    closeButton.addEventListener("click", () => host.remove());
    header.append(heading, closeButton);

    const details = createTextElement(
      "p",
      "knowbefore-details",
      `Source: ${policyContent.source} | Characters: ${policyContent.characterCount}`
    );
    const policyText = createTextElement("pre", "knowbefore-policy-text", policyContent.text);
    const divider = document.createElement("div");
    divider.className = "knowbefore-divider";
    container.append(
      header,
      divider,
      details,
      createTextElement("p", "knowbefore-label", "Extracted policy text"),
      policyText,
      createTextElement("p", "knowbefore-local", "Stays on this device")
    );

    shadowRoot.append(style, container);
    document.documentElement.append(host);
  }

  const detection = globalThis.KnowBeforePolicyDetector.detectPolicyPage();
  if (detection.isPolicyPage) {
    const policyContent = globalThis.KnowBeforePolicyExtractor.extractPolicyContent();
    if (policyContent.text) {
      showOverlay({ policyContent, type: detection.type, confidence: detection.confidence });
    }
  }
})();
