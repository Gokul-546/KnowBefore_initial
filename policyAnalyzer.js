(() => {
  "use strict";

  const IGNORED_SELECTORS = "script, style, noscript, nav, header, footer, iframe, svg";
  const CATEGORY_KEYWORDS = {
    dataCollection: [
      "information we collect",
      "data we collect",
      "personal information",
      "personal data",
      "collect your information",
      "categories of personal information"
    ],
    dataUsage: [
      "how we use",
      "use of information",
      "use your information",
      "process your data",
      "purposes of processing",
      "purpose of processing"
    ],
    dataSharing: [
      "third parties",
      "service providers",
      "share your information",
      "sharing of information",
      "disclose your information",
      "business partners"
    ],
    dataRetention: [
      "data retention",
      "retain your information",
      "retention period",
      "how long we keep",
      "store your information"
    ],
    cookies: ["cookies", "cookie"],
    userRights: [
      "your rights",
      "privacy rights",
      "right to access",
      "access your data",
      "right to erasure",
      "delete your data",
      "opt out"
    ],
    security: [
      "security",
      "protect your information",
      "security measures",
      "appropriate safeguards",
      "encryption"
    ],
    internationalTransfers: [
      "international transfers",
      "transfer your data internationally",
      "cross-border transfers",
      "transferred outside your country",
      "transferred to other countries"
    ],
    accountDeletion: [
      "account deletion",
      "delete your account",
      "close your account",
      "deletion of your account",
      "terminate your account"
    ]
  };
  const USEFUL_HEADING_PATTERN = /privacy|data|information|collect|use|sharing|third part|provider|retention|cookie|rights|security|transfer|delet|account|consent|choice|purpose/i;

  function normalize(value) {
    return (value || "").replace(/\s+/g, " ").trim();
  }

  function findPolicyHeadings() {
    if (typeof document === "undefined" || !document.querySelectorAll) return [];

    const headings = Array.from(document.querySelectorAll("h1, h2, h3"));
    const sections = [];

    headings.forEach((heading) => {
      if (heading.closest && heading.closest(IGNORED_SELECTORS)) return;
      const text = normalize(heading.textContent);
      if (text && USEFUL_HEADING_PATTERN.test(text) && !sections.includes(text)) {
        sections.push(text);
      }
    });

    return sections;
  }

  function analyzePolicyContent(text) {
    const policyText = typeof text === "string" ? text : "";
    const normalizedText = policyText.toLowerCase();
    const categories = {
      dataCollection: false,
      dataUsage: false,
      dataSharing: false,
      dataRetention: false,
      cookies: false,
      userRights: false,
      security: false,
      internationalTransfers: false,
      accountDeletion: false
    };
    const keywordMatches = {};

    Object.entries(CATEGORY_KEYWORDS).forEach(([category, phrases]) => {
      const matches = phrases.filter((phrase) => normalizedText.includes(phrase));
      if (matches.length > 0) {
        categories[category] = true;
        keywordMatches[category] = matches;
      }
    });

    const sections = findPolicyHeadings();
    return {
      sections,
      sectionCount: sections.length,
      categories,
      keywordMatches,
      analyzedCharacterCount: policyText.length
    };
  }

  globalThis.KnowBeforePolicyAnalyzer = { analyzePolicyContent };
})();
