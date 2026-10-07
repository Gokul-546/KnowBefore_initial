(() => {
  "use strict";

  const IGNORED_SELECTORS = "script, style, noscript, nav, header, footer, iframe, svg";
  const CONTENT_SOURCES = ["main", "article", "section", "body"];
  const POLICY_TERMS = [
    "privacy policy",
    "privacy notice",
    "privacy statement",
    "data privacy",
    "privacy center",
    "terms and conditions",
    "terms & conditions",
    "terms of service",
    "terms of use",
    "user agreement",
    "legal terms"
  ];
  const SUPPORTING_TERMS = [
    "cookies",
    "information we collect",
    "data retention",
    "your rights",
    "third parties",
    "personal data"
  ];
  const MIN_CHARACTER_COUNT = 120;

  function scorePolicyText(text) {
    const normalized = text.toLowerCase();
    const policyMatches = POLICY_TERMS.filter((term) => normalized.includes(term)).length;
    const supportingMatches = SUPPORTING_TERMS.filter((term) => normalized.includes(term)).length;

    if (text.length < MIN_CHARACTER_COUNT || (policyMatches === 0 && supportingMatches < 2)) {
      return -1;
    }

    return policyMatches * 10 + supportingMatches * 2 + Math.min(text.length / 1000, 5);
  }

  function extractPolicyContent() {
    for (const source of CONTENT_SOURCES) {
      const elements = source === "body"
        ? (document.body ? [document.body] : [])
        : Array.from(document.querySelectorAll(source));

      let bestCandidate = null;

      for (const element of elements) {
        const copy = element.cloneNode(true);
        copy.querySelectorAll(IGNORED_SELECTORS).forEach((ignored) => ignored.remove());
        const text = (copy.textContent || "").replace(/\s+/g, " ").trim();
        const score = scorePolicyText(text);

        if (score >= 0 && (!bestCandidate || score > bestCandidate.score)) {
          bestCandidate = { text, score };
        }
      }

      if (bestCandidate) {
        return {
          text: bestCandidate.text,
          characterCount: bestCandidate.text.length,
          source
        };
      }
    }

    return { text: "", characterCount: 0, source: "none" };
  }

  globalThis.KnowBeforePolicyExtractor = { extractPolicyContent };
})();