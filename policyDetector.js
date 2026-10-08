(() => {
  "use strict";

  const POLICY_TERMS = {
    privacy: [
      "privacy policy",
      "privacy notice",
      "privacy statement",
      "data privacy",
      "privacy center"
    ],
    terms: [
      "terms and conditions",
      "terms & conditions",
      "terms of service",
      "terms of use",
      "user agreement",
      "legal terms"
    ]
  };
  const SUPPORTING_TERMS = [
    "cookies",
    "information we collect",
    "data retention",
    "your rights",
    "third parties",
    "personal data"
  ];
  const IGNORED_SELECTORS = "script, style, noscript, nav, header, footer, iframe, svg";
  const MIN_CONTENT_LENGTH = 120;

  function normalize(value) {
    return (value || "").replace(/\s+/g, " ").trim().toLowerCase();
  }

  function meaningfulText() {
    if (!document.body) return "";
    const body = document.body.cloneNode(true);
    body.querySelectorAll(`${IGNORED_SELECTORS}, a`).forEach((element) => element.remove());
    return normalize(body.textContent);
  }

  function detectPolicyPage() {
    const url = normalize(window.location.href).replace(/[-_/]+/g, " ");
    const title = normalize(document.title);
    const headings = Array.from(document.querySelectorAll("h1, h2, h3"))
      .filter((heading) => !heading.closest(IGNORED_SELECTORS))
      .map((heading) => normalize(heading.textContent))
      .join(" ");
    const content = meaningfulText();
    const locationText = `${url} ${title} ${headings}`;
    const terms = [...POLICY_TERMS.privacy, ...POLICY_TERMS.terms];
    const policyMatches = terms.filter((term) =>
      `${locationText} ${content}`.includes(term)
    );
    const supportingMatches = SUPPORTING_TERMS.filter((term) => content.includes(term));
    const locatedMatch = terms.some((term) => `${title} ${headings}`.includes(term));
    const urlMatch = terms.some((term) => url.includes(term));
    const enoughContent = content.length >= MIN_CONTENT_LENGTH;

    let confidence = "LOW";
    if (enoughContent && locatedMatch) {
      confidence = "HIGH";
    } else if (
      enoughContent && urlMatch && supportingMatches.length >= 3
    ) {
      confidence = "MEDIUM";
    }

    const identityText = `${title} ${headings} ${url}`;
    const privacyMatch = POLICY_TERMS.privacy.some((term) => identityText.includes(term));
    const termsMatch = POLICY_TERMS.terms.some((term) => identityText.includes(term));

    return {
      isPolicyPage: confidence === "HIGH" || confidence === "MEDIUM",
      type: privacyMatch ? "privacy" : termsMatch ? "terms" : "unknown",
      confidence,
      policyMatches,
      supportingMatches
    };
  }

  globalThis.KnowBeforePolicyDetector = { detectPolicyPage };
})();