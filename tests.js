"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const detectorSource = fs.readFileSync("policyDetector.js", "utf8");
const extractorSource = fs.readFileSync("policyExtractor.js", "utf8");
const analyzerSource = fs.readFileSync("policyAnalyzer.js", "utf8");
const evidenceSource = fs.readFileSync("policyEvidence.js", "utf8");
const overlaySource = fs.readFileSync("content.js", "utf8");
const context = vm.createContext({});

function makeTextNode(text, filteredText = text) {
  let currentText = text;
  return {
    cloneNode() {
      const clone = {
        get textContent() {
          return currentText;
        },
        querySelectorAll() {
          return filteredText === text
            ? []
            : [{ remove() { currentText = filteredText; } }];
        }
      };
      return clone;
    }
  };
}

function setDetectorPage({ url, title, headings, bodyText, filteredBodyText }) {
  context.window = { location: { href: url } };
  context.document = {
    title,
    body: makeTextNode(bodyText, filteredBodyText ?? bodyText),
    querySelectorAll(selector) {
      if (selector !== "h1, h2, h3") return [];
      return headings.map(({ text, excluded = false }) => ({
        textContent: text,
        closest: () => excluded ? { tagName: "FOOTER" } : null
      }));
    }
  };
  vm.runInContext(detectorSource, context);
  return context.KnowBeforePolicyDetector.detectPolicyPage();
}

function setExtractorPage({ sources = {}, bodyText = "", filteredBodyText } = {}) {
  context.document = {
    body: makeTextNode(bodyText, filteredBodyText ?? bodyText),
    querySelectorAll(selector) {
      return sources[selector] || [];
    }
  };
  vm.runInContext(extractorSource, context);
  return context.KnowBeforePolicyExtractor.extractPolicyContent();
}

function analyzeText(text, headings = []) {
  context.document = {
    querySelectorAll(selector) {
      if (selector !== "h1, h2, h3") return [];
      return headings.map(({ textContent, excluded = false }) => ({
        textContent,
        closest: () => excluded ? { tagName: "FOOTER" } : null
      }));
    }
  };
  vm.runInContext(analyzerSource, context);
  return context.KnowBeforePolicyAnalyzer.analyzePolicyContent(text);
}

function extractEvidence(text, analysis) {
  vm.runInContext(evidenceSource, context);
  return context.KnowBeforePolicyEvidence.extractPolicyEvidence(text, analysis);
}

function policyText(label, repeat = 8) {
  return `${label}. Information we collect includes personal data. Cookies, data retention, your rights, and third parties. ${"We explain how information is used and retained. ".repeat(repeat)}`;
}

let result = setDetectorPage({
  url: "https://example.test/privacy-policy",
  title: "Privacy Policy",
  headings: [{ text: "Privacy Policy" }],
  bodyText: policyText("Privacy Policy")
});
assert.equal(result.isPolicyPage, true, "Test 1: privacy policy page is detected");
assert.equal(result.type, "privacy");
assert.equal(result.confidence, "HIGH");
const privacyAnalysis = analyzeText(
  "Privacy Policy. Information we collect. How we use your information. We share your information with third parties and service providers. Data retention period. Cookies. Your rights. Security measures. International transfers. Delete your account.",
  [
    { textContent: "Privacy Policy" },
    { textContent: "Information We Collect" },
    { textContent: "Sharing With Service Providers" },
    { textContent: "Cookies" },
    { textContent: "Footer Privacy Policy", excluded: true }
  ]
);
assert.equal(privacyAnalysis.categories.dataCollection, true);
assert.equal(privacyAnalysis.categories.dataUsage, true);
assert.equal(privacyAnalysis.categories.dataSharing, true);
assert.equal(privacyAnalysis.categories.dataRetention, true);
assert.equal(privacyAnalysis.categories.cookies, true);
assert.ok(privacyAnalysis.sections.includes("Information We Collect"));
assert.ok(!privacyAnalysis.sections.includes("Footer Privacy Policy"));

result = setDetectorPage({
  url: "https://example.test/legal",
  title: "Terms of Service",
  headings: [{ text: "Terms of Service" }],
  bodyText: policyText("Terms of Service")
});
assert.equal(result.isPolicyPage, true, "Test 2: terms of service page is detected");
assert.equal(result.type, "terms");

result = setDetectorPage({
  url: "https://example.test/terms-of-service",
  title: "Example",
  headings: [{ text: "Legal information" }],
  bodyText: policyText("Our legal terms")
});
assert.equal(result.isPolicyPage, true, "Test 3: hyphenated terms URL is detected");
assert.equal(result.confidence, "MEDIUM");

result = setDetectorPage({
  url: "https://example.test/recipes/chocolate-cake",
  title: "Chocolate Cake Recipe",
  headings: [
    { text: "Chocolate Cake Recipe" },
    { text: "Privacy Policy", excluded: true }
  ],
  bodyText: `${"This recipe uses cocoa and flour to make a cake. ".repeat(8)} Privacy Policy Cookies may be used by third parties.`,
  filteredBodyText: `${"This recipe uses cocoa and flour to make a cake. ".repeat(8)}`
});
assert.equal(result.isPolicyPage, false, "Test 4: footer policy link on a recipe page is ignored");
assert.equal(result.confidence, "LOW");

const selectedPolicy = policyText("Privacy Policy", 10).replace(/\s+/g, " ").trim();
const longerPolicy = policyText("Privacy Notice", 14).replace(/\s+/g, " ").trim();
const mainContent = setExtractorPage({
  sources: {
    main: [makeTextNode("Privacy Policy"), makeTextNode(selectedPolicy), makeTextNode(longerPolicy)],
    article: [makeTextNode(policyText("Terms of Use", 12))]
  },
  bodyText: "Body fallback"
});
assert.deepEqual(JSON.parse(JSON.stringify(mainContent)), {
  text: longerPolicy,
  characterCount: longerPolicy.length,
  source: "main"
}, "Test 5: the strongest useful main policy container is extracted before article");

const noUsefulContent = setExtractorPage({
  sources: {},
  bodyText: "Privacy Policy Cookies third parties",
  filteredBodyText: ""
});
assert.deepEqual(JSON.parse(JSON.stringify(noUsefulContent)), {
  text: "",
  characterCount: 0,
  source: "none"
}, "Test 6: navigation/footer-only content is ignored");

const emptyContent = setExtractorPage();
assert.deepEqual(JSON.parse(JSON.stringify(emptyContent)), {
  text: "",
  characterCount: 0,
  source: "none"
}, "Test 7: an empty page returns the empty result");

const emptyAnalysis = analyzeText("");
assert.deepEqual(JSON.parse(JSON.stringify(emptyAnalysis)), {
  sections: [],
  sectionCount: 0,
  categories: {
    dataCollection: false,
    dataUsage: false,
    dataSharing: false,
    dataRetention: false,
    cookies: false,
    userRights: false,
    security: false,
    internationalTransfers: false,
    accountDeletion: false
  },
  keywordMatches: {},
  analyzedCharacterCount: 0
}, "Test 8: empty input returns an empty analysis");

const rightsAnalysis = analyzeText("Your privacy rights include the right to access your data and opt out.");
assert.equal(rightsAnalysis.categories.userRights, true, "Test 9: user rights are detected");

const securityAnalysis = analyzeText("We use appropriate safeguards, encryption, and other security measures.");
assert.equal(securityAnalysis.categories.security, true, "Test 10: security is detected");

const transferAnalysis = analyzeText("International transfers may occur, including cross-border transfers.");
assert.equal(
  transferAnalysis.categories.internationalTransfers,
  true,
  "Test 11: international transfers are detected"
);

const sharingAnalysis = analyzeText("We may share your information with third parties and service providers.");
assert.equal(sharingAnalysis.categories.dataSharing, true);
assert.deepEqual(
  JSON.parse(JSON.stringify(sharingAnalysis.keywordMatches.dataSharing)),
  ["third parties", "service providers", "share your information"],
  "Test 12: data-sharing keyword evidence is returned"
);

const evidenceText = [
  "Introductory text.",
  "We collect your information when you register for an account.",
  "We may share your information with third parties and service providers.",
  "We may share your information with third parties and service providers.",
  "We may share your information with third parties and service providers.",
  "We also disclose your information to business partners.",
  "We share account details with business partners and service providers."
].join(" ");
const evidenceAnalysis = analyzeText(evidenceText);
const extractedEvidence = extractEvidence(evidenceText, evidenceAnalysis);
const collectionEvidence = extractedEvidence.dataCollection[0];
assert.equal(
  collectionEvidence.text,
  "We collect your information when you register for an account.",
  "Evidence keeps the complete original sentence"
);
assert.equal(collectionEvidence.position, evidenceText.indexOf(collectionEvidence.text));
assert.deepEqual(JSON.parse(JSON.stringify(collectionEvidence.matchedTerms)), ["collect your information"]);
assert.equal(extractedEvidence.dataSharing.length, 2, "evidence is capped at two distinct sentences");
assert.equal(new Set(extractedEvidence.dataSharing.map((item) => item.text)).size, 2);
extractedEvidence.dataSharing.forEach((item) => {
  assert.equal(evidenceText.slice(item.position, item.position + item.text.length), item.text);
  item.matchedTerms.forEach((term) => {
    assert.ok(item.text.toLowerCase().includes(term.toLowerCase()), "matched term occurs in its evidence text");
  });
});
assert.deepEqual(
  JSON.parse(JSON.stringify(extractedEvidence.dataSharing[0].matchedTerms)),
  ["share your information", "third parties", "service providers"]
);

const longEvidenceText = "We may share your information with third parties and service providers; " +
  `${"These service providers must comply with applicable laws and maintain security, privacy and data retention policies, ".repeat(5)} ` +
  "They must also protect user information.";
const longEvidence = extractEvidence(longEvidenceText, analyzeText(longEvidenceText)).dataSharing[0];
assert.ok(longEvidence.text.length <= 300, "long evidence is bounded");
assert.equal(longEvidenceText.slice(longEvidence.position, longEvidence.position + longEvidence.text.length), longEvidence.text);
assert.ok(longEvidence.text.includes("We may share your information with third parties"));
assert.ok(!/^\.\.\./.test(longEvidence.text), "long evidence does not begin with an arbitrary window");

class MockElement {
  constructor(tagName) {
    this.tagName = tagName;
    this.children = [];
    this.attributes = {};
    this.listeners = {};
    this.textContent = "";
  }

  setAttribute(name, value) {
    this.attributes[name] = value;
  }

  addEventListener(name, callback) {
    this.listeners[name] = callback;
  }

  append(...elements) {
    this.children.push(...elements);
  }

  attachShadow({ mode }) {
    this.shadowMode = mode;
    this.shadowRoot = new MockElement("shadow-root");
    return this.shadowRoot;
  }

  remove() {
    const index = overlayHosts.indexOf(this);
    if (index >= 0) overlayHosts.splice(index, 1);
  }
}

function findClass(element, className) {
  if (element.className === className) return element;
  for (const child of element.children || []) {
    const match = findClass(child, className);
    if (match) return match;
  }
  return null;
}

function findClasses(element, className, matches = []) {
  if (element.className === className) matches.push(element);
  for (const child of element.children || []) findClasses(child, className, matches);
  return matches;
}

const overlayHosts = [];
const overlayPolicyText = `${selectedPolicy} Security measures protect your information.`;
context.document = {
  getElementById(id) {
    return overlayHosts.find((element) => element.id === id) || null;
  },
  createElement(tagName) {
    return new MockElement(tagName);
  },
  documentElement: {
    append(...elements) {
      overlayHosts.push(...elements);
    }
  }
};
context.KnowBeforePolicyDetector = {
  detectPolicyPage: () => ({ isPolicyPage: true, type: "privacy", confidence: "HIGH" })
};
context.KnowBeforePolicyExtractor = {
  extractPolicyContent: () => ({
    text: overlayPolicyText,
    characterCount: overlayPolicyText.length,
    source: "main"
  })
};
context.KnowBeforePolicyAnalyzer = {
  analyzePolicyContent: () => ({
    categories: {
      dataCollection: true,
      dataUsage: false,
      dataSharing: true,
      dataRetention: false,
      cookies: false,
      userRights: false,
      security: true,
      internationalTransfers: false,
      accountDeletion: false
    },
    keywordMatches: {
      dataCollection: ["information we collect"],
      dataSharing: ["third parties"],
      security: ["security"]
    }
  })
};
context.KnowBeforePolicyEvidence = {
  extractPolicyEvidence: (text) => ({
    dataCollection: [{
      text: "Information we collect includes personal data.",
      matchedTerms: ["information we collect"],
      position: text.indexOf("Information we collect")
    }],
    dataSharing: [{
      text: "Cookies, data retention, your rights, and third parties.",
      matchedTerms: ["third parties"],
      position: text.indexOf("Cookies")
    }],
    security: [{
      text: "Security measures protect your information.",
      matchedTerms: ["security"],
      position: text.indexOf("Security measures")
    }]
  })
};
vm.runInContext(overlaySource, context);
assert.equal(overlayHosts.length, 1, "overlay is mounted once");
assert.equal(overlayHosts[0].shadowMode, "closed", "overlay uses a closed Shadow DOM");
const overlayShadow = overlayHosts[0].shadowRoot;
assert.equal(findClass(overlayShadow, "knowbefore-confidence").textContent, "Confidence: HIGH");
assert.equal(
  findClass(overlayShadow, "knowbefore-details").textContent,
  `Characters: ${overlayPolicyText.length} | Source: main`
);
const renderedPreview = findClass(overlayShadow, "knowbefore-preview").textContent;
assert.notEqual(renderedPreview, overlayPolicyText, "the full extracted policy is not displayed");
assert.ok(renderedPreview.startsWith("Privacy Policy."), "preview begins with the extracted policy");
assert.ok(renderedPreview.endsWith("..."), "truncated preview indicates additional text");
assert.ok(renderedPreview.split("\n").length <= 9, "preview is limited to eight lines plus ellipsis");
assert.match(findClass(overlayShadow, "knowbefore-evidence").textContent, /information we collect/i);
assert.ok(findClasses(overlayShadow, "knowbefore-evidence-label")
  .some((label) => /Matched: information we collect/.test(label.textContent)));
const renderedTopicLabels = findClass(overlayShadow, "knowbefore-topics")
  .children.map((topic) => topic.children[0].textContent.replace(/^✓ /, "")).join(", ");
assert.match(renderedTopicLabels, /Data collection, Data sharing, Security/);
assert.equal(findClass(overlayShadow, "knowbefore-close").textContent, "X");
assert.match(overlayShadow.children[0].textContent, /max-height: calc\(1\.4em \* 9\)/);
vm.runInContext(overlaySource, context);
assert.equal(overlayHosts.length, 1, "a repeated content script does not duplicate the overlay");
findClass(overlayShadow, "knowbefore-close").listeners.click();
assert.equal(overlayHosts.length, 0, "close button removes the overlay");

const shortPolicy = "Privacy Policy";
context.KnowBeforePolicyExtractor.extractPolicyContent = () => ({
  text: shortPolicy,
  characterCount: shortPolicy.length,
  source: "main"
});
context.KnowBeforePolicyAnalyzer.analyzePolicyContent = () => ({
  categories: { dataCollection: true },
  keywordMatches: { dataCollection: ["privacy policy"] }
});
context.KnowBeforePolicyEvidence.extractPolicyEvidence = (text) => ({
  dataCollection: [{ text, matchedTerms: ["privacy policy"], position: 0 }]
});
vm.runInContext(overlaySource, context);
const shortPreview = findClass(overlayHosts[0].shadowRoot, "knowbefore-preview").textContent;
assert.notEqual(shortPreview, shortPolicy, "short policy text is not displayed in full");
assert.ok(shortPreview.endsWith("..."), "short policy preview marks hidden text");

assert.match(overlaySource, /attachShadow\(\{ mode: "closed" \}\)/, "overlay remains in a closed Shadow DOM");
assert.match(overlaySource, /getElementById\(HOST_ID\)/, "duplicate overlays are prevented");
assert.match(overlaySource, /element\.textContent = text/);
assert.match(overlaySource, /"knowbefore-preview", policyPreview\(policyContent\.text\)/);
assert.match(overlaySource, /"knowbefore-evidence", `"\$\{item\.text\}"`/);
assert.match(overlaySource, /item\.matchedTerms\.join\(" • "\)/);
assert.match(overlaySource, /max-height: calc\(1\.4em \* 9\)/);
assert.doesNotMatch(overlaySource, /innerHTML/);
assert.doesNotMatch(
  `${detectorSource}\n${extractorSource}\n${analyzerSource}\n${evidenceSource}\n${overlaySource}`,
  /\b(fetch|XMLHttpRequest|WebSocket)\s*\(/
);

const manifest = JSON.parse(fs.readFileSync("manifest.json", "utf8"));
assert.deepEqual(manifest.content_scripts[0].js, [
  "policyDetector.js",
  "policyExtractor.js",
  "policyAnalyzer.js",
  "policyEvidence.js",
  "content.js"
]);

console.log("Detection, extraction, analysis, evidence, overlay, and manifest tests passed.");
