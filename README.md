# KNOWBEFORE

A dependency-free Google Chrome Manifest V3 extension that detects likely privacy and terms pages, extracts useful policy text locally, analyzes policy topics with deterministic phrase matching, and displays the results in a Shadow DOM overlay.

## Load in Chrome

1. Open `chrome://extensions`.
2. Turn on **Developer mode**.
3. Click **Load unpacked**.
4. Select this project folder: `d:\know_before`.
5. Open or refresh a Privacy Policy or Terms & Conditions page.

The overlay appears in the top-right when the page has enough matching policy signals. Close it with the `X` button. Reload the page to show it again.