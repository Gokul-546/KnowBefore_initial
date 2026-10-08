(() => {
  "use strict";

  const MAX_EVIDENCE_ITEMS = 2;
  const MAX_EVIDENCE_LENGTH = 300;
  const MIN_PREFERRED_LENGTH = 80;
  const CATEGORY_NAMES = [
    "dataCollection",
    "dataUsage",
    "dataSharing",
    "dataRetention",
    "cookies",
    "userRights",
    "security",
    "internationalTransfers",
    "accountDeletion"
  ];

  function trimmedRange(text, start, end) {
    while (start < end && /\s/.test(text[start])) start += 1;
    while (end > start && /\s/.test(text[end - 1])) end -= 1;
    return { start, end };
  }

  function sentenceRanges(text) {
    const ranges = [];
    let start = 0;

    for (let index = 0; index < text.length; index += 1) {
      if (text[index] === "\n") {
        const range = trimmedRange(text, start, index);
        if (range.start < range.end) ranges.push(range);
        start = index + 1;
        continue;
      }

      if (!".!?".includes(text[index])) continue;
      let boundary = index + 1;
      while (boundary < text.length && /[\"'”’)}\]]/.test(text[boundary])) boundary += 1;
      if (boundary < text.length && !/\s/.test(text[boundary])) continue;

      const range = trimmedRange(text, start, boundary);
      if (range.start < range.end) ranges.push(range);
      start = boundary;
      while (start < text.length && /\s/.test(text[start])) start += 1;
      index = start - 1;
    }

    const finalRange = trimmedRange(text, start, text.length);
    if (finalRange.start < finalRange.end) ranges.push(finalRange);
    return ranges;
  }

  function clauseRanges(text, sentence) {
    const ranges = [];
    let start = sentence.start;

    for (let index = sentence.start; index < sentence.end; index += 1) {
      if (!",;:".includes(text[index])) continue;
      const boundary = index + 1;
      const range = trimmedRange(text, start, boundary);
      if (range.start < range.end) ranges.push(range);
      start = boundary;
      while (start < sentence.end && /\s/.test(text[start])) start += 1;
    }

    const finalRange = trimmedRange(text, start, sentence.end);
    if (finalRange.start < finalRange.end) ranges.push(finalRange);
    return ranges.length ? ranges : [sentence];
  }

  function findOccurrences(text, terms) {
    const occurrences = [];
    terms.forEach((term) => {
      if (typeof term !== "string" || !term.trim()) return;
      const normalizedTerm = term.trim();
      const escapedTerm = normalizedTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const matcher = new RegExp(escapedTerm, "gi");
      let match;
      while ((match = matcher.exec(text)) !== null) {
        occurrences.push({ term: normalizedTerm, start: match.index, end: match.index + match[0].length });
        if (match[0].length === 0) matcher.lastIndex += 1;
      }
    });
    return occurrences.sort((left, right) => left.start - right.start);
  }

  function relevantMatches(range, occurrences) {
    return occurrences.filter((occurrence) => occurrence.start >= range.start && occurrence.end <= range.end);
  }

  function chooseClause(text, sentence, occurrences) {
    const clauses = clauseRanges(text, sentence);
    const scored = clauses
      .map((range) => ({ range, matches: relevantMatches(range, occurrences) }))
      .filter((candidate) => candidate.matches.length > 0)
      .sort((left, right) => {
        const matchDifference = right.matches.length - left.matches.length;
        if (matchDifference !== 0) return matchDifference;
        return Math.abs(left.range.end - left.range.start - 180) -
          Math.abs(right.range.end - right.range.start - 180);
      });

    if (!scored.length) return sentence;
    let selected = scored[0].range;
    let selectedLength = selected.end - selected.start;

    if (selectedLength < MIN_PREFERRED_LENGTH) {
      const selectedIndex = clauses.findIndex((range) => range.start === selected.start && range.end === selected.end);
      const neighbor = clauses[selectedIndex - 1] || clauses[selectedIndex + 1];
      if (neighbor) {
        const combined = trimmedRange(text, Math.min(selected.start, neighbor.start), Math.max(selected.end, neighbor.end));
        if (combined.end - combined.start <= MAX_EVIDENCE_LENGTH) selected = combined;
      }
    }

    selectedLength = selected.end - selected.start;
    if (selectedLength <= MAX_EVIDENCE_LENGTH) return selected;

    const focus = relevantMatches(selected, occurrences)[0];
    let start = Math.max(selected.start, focus.start - 100);
    let end = Math.min(selected.end, start + MAX_EVIDENCE_LENGTH);
    while (start > selected.start && !/\s/.test(text[start - 1])) start -= 1;
    while (end < selected.end && !/\s/.test(text[end])) end -= 1;
    return trimmedRange(text, start, end);
  }

  function makeEvidence(text, range, occurrences) {
    const actualMatches = relevantMatches(range, occurrences);
    const matchedTerms = [...new Set(actualMatches.map((occurrence) => occurrence.term))];
    if (!matchedTerms.length) return null;

    return {
      text: text.slice(range.start, range.end),
      matchedTerms,
      position: range.start
    };
  }

  function extractPolicyEvidence(policyText, analysisResult) {
    const text = typeof policyText === "string" ? policyText : "";
    const categories = analysisResult && analysisResult.categories || {};
    const keywordMatches = analysisResult && analysisResult.keywordMatches || {};
    const evidence = {};

    CATEGORY_NAMES.forEach((category) => {
      evidence[category] = [];
      if (!categories[category]) return;

      const terms = Array.isArray(keywordMatches[category]) ? keywordMatches[category] : [];
      const occurrences = findOccurrences(text, terms);
      if (!occurrences.length) return;

      const candidates = [];
      sentenceRanges(text).forEach((sentence) => {
        const sentenceMatches = relevantMatches(sentence, occurrences);
        if (!sentenceMatches.length) return;

        const range = sentence.end - sentence.start <= MAX_EVIDENCE_LENGTH
          ? sentence
          : chooseClause(text, sentence, occurrences);
        const item = makeEvidence(text, range, occurrences);
        if (item) candidates.push(item);
      });

      const uniqueCandidates = [];
      const seenText = new Set();
      candidates.forEach((candidate) => {
        const key = candidate.text.toLowerCase();
        if (seenText.has(key)) return;
        seenText.add(key);
        uniqueCandidates.push(candidate);
      });

      uniqueCandidates.sort((left, right) => {
        const matchDifference = right.matchedTerms.length - left.matchedTerms.length;
        if (matchDifference !== 0) return matchDifference;
        const leftLength = left.text.length;
        const rightLength = right.text.length;
        const leftPenalty = leftLength < MIN_PREFERRED_LENGTH ? MIN_PREFERRED_LENGTH - leftLength : 0;
        const rightPenalty = rightLength < MIN_PREFERRED_LENGTH ? MIN_PREFERRED_LENGTH - rightLength : 0;
        return leftPenalty - rightPenalty;
      });
      evidence[category] = uniqueCandidates.slice(0, MAX_EVIDENCE_ITEMS);
    });

    return evidence;
  }

  globalThis.KnowBeforePolicyEvidence = { extractPolicyEvidence };
})();
