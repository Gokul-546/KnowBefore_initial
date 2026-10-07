"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const detectorSource = fs.readFileSync("policyDetector.js", "utf8");
const extractorSource = fs.readFileSync("policyExtractor.js", "utf8");
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

const overlayHosts = [];
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
    text: selectedPolicy,
    characterCount: selectedPolicy.length,
    source: "main"
  })
};
vm.runInContext(overlaySource, context);
assert.equal(overlayHosts.length, 1, "overlay is mounted once");
assert.equal(overlayHosts[0].shadowMode, "closed", "overlay uses a closed Shadow DOM");
const overlayShadow = overlayHosts[0].shadowRoot;
assert.equal(findClass(overlayShadow, "knowbefore-confidence").textContent, "Confidence: HIGH");
assert.equal(
  findClass(overlayShadow, "knowbefore-details").textContent,
  `Source: main | Characters: ${selectedPolicy.length}`
);
assert.equal(findClass(overlayShadow, "knowbefore-policy-text").textContent, selectedPolicy);
assert.equal(findClass(overlayShadow, "knowbefore-close").textContent, "X");
assert.match(overlayShadow.children[0].textContent, /max-height: min\(42vh, 360px\)/);
vm.runInContext(overlaySource, context);
assert.equal(overlayHosts.length, 1, "a repeated content script does not duplicate the overlay");

assert.match(overlaySource, /attachShadow\(\{ mode: "closed" \}\)/, "overlay remains in a closed Shadow DOM");
assert.match(overlaySource, /getElementById\(HOST_ID\)/, "duplicate overlays are prevented");
assert.match(overlaySource, /element\.textContent = text/);
assert.match(overlaySource, /"knowbefore-policy-text", policyContent\.text/);
assert.match(overlaySource, /max-height: min\(42vh, 360px\)/);
assert.doesNotMatch(overlaySource, /innerHTML/);
assert.doesNotMatch(`${detectorSource}\n${extractorSource}\n${overlaySource}`, /\b(fetch|XMLHttpRequest|WebSocket)\s*\(/);

const manifest = JSON.parse(fs.readFileSync("manifest.json", "utf8"));
assert.deepEqual(manifest.content_scripts[0].js, [
  "policyDetector.js",
  "policyExtractor.js",
  "content.js"
]);

console.log("All 7 detector/extractor tests and overlay/manifest checks passed.");
