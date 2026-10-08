# KNOWBEFORE

A dependency-free Google Chrome Manifest V3 extension that detects likely privacy and terms pages, extracts useful policy text locally, analyzes policy topics with deterministic phrase matching, and displays the results in a Shadow DOM overlay.

## Load in Chrome

1. Open `chrome://extensions`.
2. Turn on **Developer mode**.
3. Click **Load unpacked**.
4. Select this project folder: `d:\know_before`.
5. Open or refresh a Privacy Policy or Terms & Conditions page.

The overlay appears in the top-right when the page has enough matching policy signals. Close it with the `X` button. Reload the page to show it again.

## Local tests

Run the framework-free test suite with Node.js:

```sh
node tests.js
```

The suite covers privacy and terms detection, hyphenated terms URLs, footer false positives, prioritized policy extraction, empty/non-policy content, local topic analysis and evidence, overlay safeguards, and manifest script order.

## Day-4 boundaries

- Detection uses URL, title, headings, and meaningful page content; footer, navigation, and header content do not qualify as strong evidence.
- Extraction checks `main`, `article`, `section`, then `body`, skips boilerplate elements, and returns normalized source text without summarizing it.
- The local analyzer identifies policy topics and matching phrases for collection, usage, sharing, retention, cookies, user rights, security, international transfers, and account deletion.
- The overlay displays the detected policy type, confidence, source, character count, detected topics, and scrollable raw extracted text.
- Analysis is deterministic and stays on this device. There are no network requests, external libraries, AI features, backend, or database.
