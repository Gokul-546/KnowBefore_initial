(() => {
  "use strict";

  const HOST_ID = "knowbefore-overlay-host";
  const PREVIEW_LINE_LIMIT = 8;
  const PREVIEW_LINE_WIDTH = 52;

  function createTextElement(tagName, className, text) {
    const element = document.createElement(tagName);
    element.className = className;
    element.textContent = text;
    return element;
  }

  function policyPreview(text) {
    const paragraphs = (text || "").split(/\n+/).map((line) => line.trim()).filter(Boolean);
    const lines = [];

    paragraphs.forEach((paragraph) => {
      let line = "";
      paragraph.split(/\s+/).forEach((word) => {
        if (line && line.length + word.length + 1 > PREVIEW_LINE_WIDTH) {
          lines.push(line);
          line = word;
        } else {
          line = line ? `${line} ${word}` : word;
        }
      });
      if (line) lines.push(line);
    });

    let hasMore = lines.length > PREVIEW_LINE_LIMIT;
    const previewLines = lines.slice(0, PREVIEW_LINE_LIMIT);
    let preview = previewLines.join("\n");
    const normalizedPolicy = (text || "").replace(/\s+/g, " ").trim();

    if (!hasMore && preview.replace(/\s+/g, " ").trim() === normalizedPolicy && preview) {
      const lastLineIndex = previewLines.length - 1;
      const lastLineWords = previewLines[lastLineIndex].split(/\s+/);
      if (lastLineWords.length > 1) {
        lastLineWords.pop();
        previewLines[lastLineIndex] = lastLineWords.join(" ");
      } else {
        previewLines[lastLineIndex] = previewLines[lastLineIndex].slice(0, -1);
      }
      preview = previewLines.join("\n").trimEnd();
      hasMore = true;
    }

    return hasMore ? `${preview}${preview ? "\n" : ""}...` : preview;
  }

  function showOverlay({ policyContent, analysis, evidence, type, confidence }) {
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
      .knowbefore-topics, .knowbefore-topic, .knowbefore-preview { margin: 0; }
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
      .knowbefore-section-title {
        color: #66746a;
        font: 700 10px/1.4 "Trebuchet MS", sans-serif;
        letter-spacing: 1.2px;
        margin: 12px 0 6px;
        text-transform: uppercase;
      }
      .knowbefore-topics {
        display: grid;
        gap: 6px;
        margin-bottom: 10px;
      }
      .knowbefore-topic {
        border-left: 2px solid #78917c;
        padding: 3px 0 3px 8px;
      }
      .knowbefore-topic-name {
        color: #203e2b;
        font: 700 12px/1.4 "Trebuchet MS", sans-serif;
        margin: 0;
      }
      .knowbefore-evidence-label {
        color: #66746a;
        font: 10px/1.4 "Trebuchet MS", sans-serif;
        margin: 2px 0 0;
      }
      .knowbefore-evidence {
        color: #26372c;
        font: 12px/1.4 Georgia, "Times New Roman", serif;
        margin: 1px 0 0;
        overflow-wrap: anywhere;
      }
      .knowbefore-preview {
        background: #eeece3;
        border-left: 2px solid #c0c9bd;
        color: #26372c;
        font: 12px/1.4 Georgia, "Times New Roman", serif;
        max-height: calc(1.4em * 9);
        overflow: hidden;
        padding: 7px 9px;
        white-space: pre-wrap;
        overflow-wrap: anywhere;
      }
      .knowbefore-topics-empty {
        color: #26372c;
        font: 12px/1.5 "Trebuchet MS", sans-serif;
        margin: 0;
      }
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
      `Characters: ${policyContent.characterCount} | Source: ${policyContent.source}`
    );
    const topicLabels = {
      dataCollection: "Data collection",
      dataUsage: "Data usage",
      dataSharing: "Data sharing",
      dataRetention: "Data retention",
      cookies: "Cookies",
      userRights: "User rights",
      security: "Security",
      internationalTransfers: "International transfers",
      accountDeletion: "Account deletion"
    };
    const topics = document.createElement("div");
    topics.className = "knowbefore-topics";
    Object.keys(topicLabels).forEach((category) => {
      if (!analysis.categories[category]) return;
      const topic = document.createElement("div");
      topic.className = "knowbefore-topic";
      topic.append(createTextElement("p", "knowbefore-topic-name", `✓ ${topicLabels[category]}`));
      const categoryEvidence = evidence[category] || [];
      if (categoryEvidence.length === 0) {
        topic.append(
          createTextElement("p", "knowbefore-evidence-label", "Evidence"),
          createTextElement("p", "knowbefore-evidence", "Evidence unavailable.")
        );
      } else {
        categoryEvidence.forEach((item) => {
          topic.append(
            createTextElement("p", "knowbefore-evidence-label", "Evidence"),
            createTextElement("p", "knowbefore-evidence", `"${item.text}"`),
            createTextElement("p", "knowbefore-evidence-label", `Matched: ${item.matchedTerms.join(" • ")}`)
          );
        });
      }
      topics.append(topic);
    });
    if (topics.children.length === 0) {
      topics.append(createTextElement("p", "knowbefore-topics-empty", "No policy topics detected."));
    }
    const preview = createTextElement("pre", "knowbefore-preview", policyPreview(policyContent.text));
    const divider = document.createElement("div");
    divider.className = "knowbefore-divider";
    container.append(
      header,
      divider,
      details,
      createTextElement("p", "knowbefore-section-title", "Detected Topics"),
      topics,
      createTextElement("p", "knowbefore-section-title", "Policy Preview"),
      preview
    );

    shadowRoot.append(style, container);
    document.documentElement.append(host);
  }

  const detection = globalThis.KnowBeforePolicyDetector.detectPolicyPage();
  if (detection.isPolicyPage) {
    const policyContent = globalThis.KnowBeforePolicyExtractor.extractPolicyContent();
    if (policyContent.text) {
      const analysis = globalThis.KnowBeforePolicyAnalyzer.analyzePolicyContent(policyContent.text);
      const evidence = globalThis.KnowBeforePolicyEvidence.extractPolicyEvidence(policyContent.text, analysis);
      showOverlay({ policyContent, analysis, evidence, type: detection.type, confidence: detection.confidence });
    }
  }
})();
