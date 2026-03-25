"""
RedirectMaster AI — Core Matching Engine
=========================================
logic.py — The brain of the application.

Implements a multi-algorithm ensemble for URL similarity scoring:
  1. Levenshtein similarity on normalized path strings
  2. TF-IDF + Cosine similarity on keyword sets extracted from path segments
  3. Structural similarity (depth, segment count)

Author: RedirectMaster AI
Version: 1.0.0
"""

from __future__ import annotations

import re
import time
import logging
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional
from urllib.parse import urlparse, unquote
from concurrent.futures import ThreadPoolExecutor, as_completed

import pandas as pd
import numpy as np
from rapidfuzz import fuzz, process as rfprocess
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

logger = logging.getLogger(__name__)


# ──────────────────────────────────────────────────────────────────────────────
# Constants & Configuration
# ──────────────────────────────────────────────────────────────────────────────

DEFAULT_AUTO_APPROVE_THRESHOLD = 85.0
DEFAULT_WEIGHTS = {
    "levenshtein": 0.35,
    "cosine": 0.40,
    "structural": 0.25,
}
MAX_CANDIDATES_PER_URL = 3
PARALLEL_THRESHOLD = 5_000  # Use threading above this URL count


# ──────────────────────────────────────────────────────────────────────────────
# Data Models
# ──────────────────────────────────────────────────────────────────────────────

class MatchStatus(str, Enum):
    AUTO_APPROVED = "AUTO_APPROVED"
    PENDING_REVIEW = "PENDING_REVIEW"
    MANUALLY_APPROVED = "MANUALLY_APPROVED"
    REJECTED = "REJECTED"
    NO_MATCH = "NO_MATCH"


@dataclass
class URLEntry:
    """Parsed and normalized URL with extracted features."""
    id: str
    raw: str
    normalized: str
    domain: str
    path: str           # e.g., /blog/my-article
    slug: str           # Last segment: "my-article"
    segments: list[str] # ["blog", "my-article"]
    depth: int          # 2
    keywords: str       # "blog my article" (space-joined, for TF-IDF)

    def __repr__(self) -> str:
        return f"URLEntry(path={self.path!r}, depth={self.depth})"


@dataclass
class AlgorithmScores:
    """Individual scores from each algorithm in the ensemble."""
    levenshtein: float  # 0–100
    cosine: float       # 0–100
    structural: float   # 0–100

    def weighted(self, weights: dict[str, float]) -> float:
        return (
            weights["levenshtein"] * self.levenshtein
            + weights["cosine"] * self.cosine
            + weights["structural"] * self.structural
        )


@dataclass
class MatchResult:
    """A single URL match result with confidence scoring."""
    id: str
    source: URLEntry
    destination: URLEntry
    confidence: float     # 0–100, final weighted score
    scores: AlgorithmScores
    status: MatchStatus
    is_edited: bool = False
    edited_destination: Optional[str] = None


@dataclass
class MatchingConfig:
    """Configuration for the matching engine run."""
    auto_approve_threshold: float = DEFAULT_AUTO_APPROVE_THRESHOLD
    max_candidates: int = MAX_CANDIDATES_PER_URL
    weights: dict[str, float] = field(default_factory=lambda: DEFAULT_WEIGHTS.copy())
    use_parallel: bool = True

    def __post_init__(self):
        total = sum(self.weights.values())
        if abs(total - 1.0) > 0.001:
            raise ValueError(f"Algorithm weights must sum to 1.0, got {total:.3f}")


@dataclass
class MatchingStats:
    """Summary statistics for a completed matching run."""
    total_source: int
    total_destination: int
    auto_approved: int
    pending_review: int
    no_match: int
    processing_time_ms: int

    @property
    def match_rate(self) -> float:
        if self.total_source == 0:
            return 0.0
        return (self.auto_approved + self.pending_review) / self.total_source * 100


@dataclass
class MatchingOutput:
    """Complete output from a matching run."""
    results: list[MatchResult]
    stats: MatchingStats


# ──────────────────────────────────────────────────────────────────────────────
# URL Parsing & Normalization
# ──────────────────────────────────────────────────────────────────────────────

def _extract_keywords(segments: list[str]) -> str:
    """
    Convert path segments into a keyword string for TF-IDF.
    Splits on hyphens, underscores, strips extensions.
    
    Example: ["blog", "my-first-post"] → "blog my first post"
    """
    keywords = []
    for segment in segments:
        # Remove file extension
        segment = re.sub(r'\.[a-z0-9]{2,5}$', '', segment, flags=re.IGNORECASE)
        # Split on hyphens, underscores, dots
        parts = re.split(r'[-_.]', segment)
        keywords.extend(p.lower() for p in parts if len(p) > 1)
    return " ".join(keywords) if keywords else "ROOT"


def parse_url(raw: str, entry_id: str) -> URLEntry:
    """
    Parse a raw URL string into a structured URLEntry.
    Handles both full URLs (https://...) and path-only inputs (/path/to/page).
    """
    raw = raw.strip()

    # Normalize: if no scheme, treat as path
    if raw.startswith("/"):
        normalized = raw.rstrip("/").lower()
        domain = ""
        path = normalized or "/"
    else:
        # Full URL
        try:
            parsed = urlparse(raw if "://" in raw else f"https://{raw}")
            domain = parsed.netloc.lower()
            path = unquote(parsed.path).rstrip("/").lower() or "/"
            normalized = f"{domain}{path}"
        except Exception:
            # Fallback: treat entire string as path
            domain = ""
            path = raw.lower()
            normalized = path

    # Extract segments (filter empty strings)
    segments = [s for s in path.strip("/").split("/") if s]
    slug = segments[-1] if segments else ""
    depth = len(segments)
    keywords = _extract_keywords(segments)

    return URLEntry(
        id=entry_id,
        raw=raw,
        normalized=normalized,
        domain=domain,
        path=path,
        slug=slug,
        segments=segments,
        depth=depth,
        keywords=keywords,
    )


def parse_url_list(urls: list[str]) -> tuple[list[URLEntry], list[str]]:
    """
    Parse a list of raw URL strings into URLEntry objects.
    Returns (valid_entries, discarded_reasons).
    
    Handles deduplication and basic validation.
    """
    seen_paths: set[str] = set()
    entries: list[URLEntry] = []
    discarded: list[str] = []

    for idx, raw in enumerate(urls):
        raw = raw.strip()

        if not raw:
            discarded.append(f"Row {idx + 1}: Empty line")
            continue

        entry = parse_url(raw, entry_id=f"url_{idx}")

        # Deduplicate by normalized path
        if entry.path in seen_paths:
            discarded.append(f"Row {idx + 1}: Duplicate path '{entry.path}'")
            continue

        seen_paths.add(entry.path)
        entries.append(entry)

    return entries, discarded


# ──────────────────────────────────────────────────────────────────────────────
# Transformation Rules Engine
# ──────────────────────────────────────────────────────────────────────────────

class RuleType(str, Enum):
    REMOVE_PREFIX = "REMOVE_PREFIX"
    ADD_PREFIX = "ADD_PREFIX"
    REMOVE_SUFFIX = "REMOVE_SUFFIX"
    REPLACE = "REPLACE"
    STRIP_DOMAIN = "STRIP_DOMAIN"
    REGEX = "REGEX"


@dataclass
class TransformationRule:
    id: str
    type: RuleType
    enabled: bool = True
    order: int = 0
    # Rule parameters
    find: Optional[str] = None
    replace: Optional[str] = None
    prefix: Optional[str] = None
    suffix: Optional[str] = None
    pattern: Optional[str] = None  # For REGEX type


def apply_rule(url: str, rule: TransformationRule) -> str:
    """Apply a single transformation rule to a URL string."""
    if not rule.enabled:
        return url

    try:
        match rule.type:
            case RuleType.REMOVE_PREFIX:
                if rule.prefix and url.startswith(rule.prefix):
                    return url[len(rule.prefix):]
            case RuleType.ADD_PREFIX:
                if rule.prefix:
                    # Avoid double slashes
                    return rule.prefix.rstrip("/") + "/" + url.lstrip("/")
            case RuleType.REMOVE_SUFFIX:
                if rule.suffix and url.endswith(rule.suffix):
                    return url[: -len(rule.suffix)]
            case RuleType.REPLACE:
                if rule.find is not None and rule.replace is not None:
                    return url.replace(rule.find, rule.replace)
            case RuleType.STRIP_DOMAIN:
                parsed = urlparse(url if "://" in url else f"https://{url}")
                return parsed.path or "/"
            case RuleType.REGEX:
                if rule.pattern and rule.replace is not None:
                    return re.sub(rule.pattern, rule.replace, url, timeout=1)
    except Exception as e:
        logger.warning(f"Rule {rule.id} failed on '{url}': {e}")

    return url


def apply_rules(url: str, rules: list[TransformationRule]) -> str:
    """Apply an ordered list of transformation rules to a URL."""
    sorted_rules = sorted(rules, key=lambda r: r.order)
    for rule in sorted_rules:
        url = apply_rule(url, rule)
    return url


def preview_rules(sample_url: str, rules: list[TransformationRule]) -> dict:
    """
    Apply rules step-by-step and return a trace for UI preview.
    Returns {result, steps: [{rule_id, input, output, changed}]}
    """
    steps = []
    current = sample_url
    sorted_rules = sorted(rules, key=lambda r: r.order)

    for rule in sorted_rules:
        if not rule.enabled:
            continue
        before = current
        current = apply_rule(current, rule)
        steps.append({
            "rule_id": rule.id,
            "rule_type": rule.type,
            "input": before,
            "output": current,
            "changed": before != current,
        })

    return {"result": current, "steps": steps}


# ──────────────────────────────────────────────────────────────────────────────
# Algorithm 1: Levenshtein Similarity
# ──────────────────────────────────────────────────────────────────────────────

def levenshtein_similarity(path_a: str, path_b: str) -> float:
    """
    Compute normalized Levenshtein similarity between two URL paths.
    Uses rapidfuzz for C-extension performance.
    Returns score 0–100.
    """
    return fuzz.token_sort_ratio(path_a, path_b)


# ──────────────────────────────────────────────────────────────────────────────
# Algorithm 2: TF-IDF + Cosine Similarity
# ──────────────────────────────────────────────────────────────────────────────

class TFIDFIndex:
    """
    Pre-computed TF-IDF index over a corpus of URL keyword strings.
    Build once for Web B, then query many times for Web A URLs.
    """

    def __init__(self, entries: list[URLEntry]):
        self.entries = entries
        corpus = [e.keywords for e in entries]

        if not corpus:
            self._matrix = None
            self._vectorizer = None
            return

        self._vectorizer = TfidfVectorizer(
            analyzer="word",
            ngram_range=(1, 2),  # Unigrams + bigrams for better coverage
            min_df=1,
            sublinear_tf=True,   # Apply sublinear TF scaling
        )
        self._matrix = self._vectorizer.fit_transform(corpus)
        logger.debug(f"TF-IDF index built: {len(entries)} URLs, "
                     f"vocab size={len(self._vectorizer.vocabulary_)}")

    def query(self, keywords: str, top_n: int = 10) -> list[tuple[int, float]]:
        """
        Query the index with a keyword string.
        Returns list of (index_in_entries, cosine_score_0_to_100).
        """
        if self._matrix is None or not keywords.strip():
            return []

        query_vec = self._vectorizer.transform([keywords])
        scores = cosine_similarity(query_vec, self._matrix).flatten()

        # Get top_n indices sorted by score descending
        top_indices = np.argsort(scores)[::-1][:top_n]
        return [(int(idx), float(scores[idx]) * 100) for idx in top_indices
                if scores[idx] > 0.01]  # Filter near-zero matches


# ──────────────────────────────────────────────────────────────────────────────
# Algorithm 3: Structural Similarity
# ──────────────────────────────────────────────────────────────────────────────

def structural_similarity(entry_a: URLEntry, entry_b: URLEntry) -> float:
    """
    Compute structural similarity based on:
    - Path depth match (same depth = higher score)
    - Segment count overlap
    - Slug similarity bonus
    
    Returns score 0–100.
    """
    score = 0.0

    # Depth comparison (max 40 points)
    depth_diff = abs(entry_a.depth - entry_b.depth)
    if depth_diff == 0:
        score += 40.0
    elif depth_diff == 1:
        score += 25.0
    elif depth_diff == 2:
        score += 10.0
    # depth_diff > 2 → 0 points

    # Slug match (max 40 points)
    if entry_a.slug and entry_b.slug:
        slug_score = fuzz.ratio(entry_a.slug, entry_b.slug)
        score += 0.40 * slug_score

    # Common segment prefixes (max 20 points)
    common = 0
    for seg_a, seg_b in zip(entry_a.segments, entry_b.segments):
        if seg_a == seg_b:
            common += 1
        else:
            break  # Stop at first mismatch

    max_depth = max(entry_a.depth, entry_b.depth) or 1
    score += 20.0 * (common / max_depth)

    return min(score, 100.0)


# ──────────────────────────────────────────────────────────────────────────────
# Ensemble Matching Engine
# ──────────────────────────────────────────────────────────────────────────────

def _compute_match_for_url(
    entry_a: URLEntry,
    entries_b: list[URLEntry],
    tfidf_index: TFIDFIndex,
    config: MatchingConfig,
) -> MatchResult:
    """
    Compute the best match for a single Web A URL against all Web B URLs.
    
    Pipeline:
    1. Fast candidate pre-selection via TF-IDF cosine similarity
    2. Full ensemble scoring on top candidates
    3. Return best match with confidence score
    """
    # Step 1: TF-IDF pre-filter — get top candidates fast
    cosine_candidates = tfidf_index.query(entry_a.keywords, top_n=50)
    candidate_indices = {idx for idx, _ in cosine_candidates}
    cosine_lookup = {idx: score for idx, score in cosine_candidates}

    # Always ensure we have at least some candidates (fallback to all)
    if not candidate_indices:
        candidate_indices = set(range(len(entries_b)))

    # Step 2: Full ensemble scoring on candidates
    best_score = 0.0
    best_entry_b: Optional[URLEntry] = None
    best_algo_scores: Optional[AlgorithmScores] = None

    for idx in candidate_indices:
        entry_b = entries_b[idx]

        lev_score = levenshtein_similarity(entry_a.path, entry_b.path)
        cos_score = cosine_lookup.get(idx, 0.0)
        str_score = structural_similarity(entry_a, entry_b)

        algo_scores = AlgorithmScores(
            levenshtein=lev_score,
            cosine=cos_score,
            structural=str_score,
        )
        weighted = algo_scores.weighted(config.weights)

        if weighted > best_score:
            best_score = weighted
            best_entry_b = entry_b
            best_algo_scores = algo_scores

    # Step 3: Determine status
    if best_entry_b is None or best_score < 50.0:
        # No meaningful match found — create a placeholder
        status = MatchStatus.NO_MATCH
        # Use empty destination for no-match
        destination = URLEntry(
            id="no_match",
            raw="",
            normalized="",
            domain="",
            path="",
            slug="",
            segments=[],
            depth=0,
            keywords="",
        )
        algo_scores_final = AlgorithmScores(0.0, 0.0, 0.0)
        confidence = 0.0
    else:
        destination = best_entry_b
        algo_scores_final = best_algo_scores
        confidence = round(best_score, 2)
        if confidence >= config.auto_approve_threshold:
            status = MatchStatus.AUTO_APPROVED
        else:
            status = MatchStatus.PENDING_REVIEW

    return MatchResult(
        id=f"match_{entry_a.id}",
        source=entry_a,
        destination=destination,
        confidence=confidence,
        scores=algo_scores_final,
        status=status,
    )


def run_matching(
    urls_a: list[URLEntry],
    urls_b: list[URLEntry],
    config: Optional[MatchingConfig] = None,
) -> MatchingOutput:
    """
    Main entry point for the matching engine.
    
    Args:
        urls_a: Parsed Web A (source) URL entries
        urls_b: Parsed and pre-processed Web B (destination) URL entries
        config: Matching configuration (thresholds, weights, etc.)
    
    Returns:
        MatchingOutput with all results and statistics
    """
    if config is None:
        config = MatchingConfig()

    start_time = time.monotonic()
    logger.info(f"Starting matching: {len(urls_a)} source URLs × {len(urls_b)} destination URLs")

    if not urls_a or not urls_b:
        raise ValueError("Both URL lists must be non-empty")

    # Build TF-IDF index once over all Web B URLs
    tfidf_index = TFIDFIndex(urls_b)

    results: list[MatchResult] = []

    # Choose serial vs parallel execution
    use_parallel = config.use_parallel and len(urls_a) >= PARALLEL_THRESHOLD

    if use_parallel:
        logger.info(f"Using parallel execution (threshold={PARALLEL_THRESHOLD})")
        with ThreadPoolExecutor(max_workers=4) as executor:
            futures = {
                executor.submit(
                    _compute_match_for_url,
                    entry_a, urls_b, tfidf_index, config
                ): entry_a
                for entry_a in urls_a
            }
            for future in as_completed(futures):
                try:
                    results.append(future.result())
                except Exception as e:
                    entry_a = futures[future]
                    logger.error(f"Match failed for {entry_a.path}: {e}")
    else:
        for entry_a in urls_a:
            result = _compute_match_for_url(entry_a, urls_b, tfidf_index, config)
            results.append(result)

    # Sort results: Auto-approved first, then by confidence desc
    results.sort(key=lambda r: (-int(r.status == MatchStatus.AUTO_APPROVED), -r.confidence))

    elapsed_ms = int((time.monotonic() - start_time) * 1000)

    # Compute statistics
    auto_approved = sum(1 for r in results if r.status == MatchStatus.AUTO_APPROVED)
    pending = sum(1 for r in results if r.status == MatchStatus.PENDING_REVIEW)
    no_match = sum(1 for r in results if r.status == MatchStatus.NO_MATCH)

    stats = MatchingStats(
        total_source=len(urls_a),
        total_destination=len(urls_b),
        auto_approved=auto_approved,
        pending_review=pending,
        no_match=no_match,
        processing_time_ms=elapsed_ms,
    )

    logger.info(
        f"Matching complete in {elapsed_ms}ms | "
        f"Auto: {auto_approved} | Pending: {pending} | No match: {no_match}"
    )

    return MatchingOutput(results=results, stats=stats)


# ──────────────────────────────────────────────────────────────────────────────
# Export Engine
# ──────────────────────────────────────────────────────────────────────────────

def export_results(
    results: list[MatchResult],
    format: str,
    status_code: int = 301,
    filename: str = "redirects",
) -> tuple[bytes, str, str]:
    """
    Export approved matches to the specified format.
    
    Args:
        results: List of MatchResult objects
        format: One of 'csv', 'json', 'apache', 'nginx'
        status_code: HTTP redirect code (301, 302, 307, 308)
        filename: Base filename for download
    
    Returns:
        (content_bytes, content_type, filename_with_extension)
    """
    from datetime import datetime
    import json as json_lib

    # Filter to only approved matches
    approved = [
        r for r in results
        if r.status in (MatchStatus.AUTO_APPROVED, MatchStatus.MANUALLY_APPROVED)
    ]

    # Get effective destination URL
    def get_dest(r: MatchResult) -> str:
        return r.edited_destination or r.destination.raw or r.destination.path

    timestamp = datetime.utcnow().strftime("%Y-%m-%d")

    match format.lower():
        case "csv":
            lines = ["source_url,destination_url,redirect_type"]
            for r in approved:
                lines.append(f"{r.source.path},{get_dest(r)},{status_code}")
            content = "\n".join(lines).encode("utf-8")
            return content, "text/csv", f"{filename}.csv"

        case "json":
            data = [
                {"from": r.source.path, "to": get_dest(r), "type": status_code}
                for r in approved
            ]
            content = json_lib.dumps(data, indent=2, ensure_ascii=False).encode("utf-8")
            return content, "application/json", f"{filename}.json"

        case "apache":
            lines = [
                f"# Generated by RedirectMaster AI — {timestamp}",
                f"# Total redirects: {len(approved)}",
                "",
            ]
            for r in approved:
                lines.append(f"Redirect {status_code} {r.source.path} {get_dest(r)}")
            content = "\n".join(lines).encode("utf-8")
            return content, "text/plain", f"{filename}.htaccess"

        case "nginx":
            lines = [
                f"# Generated by RedirectMaster AI — {timestamp}",
                f"# Total redirects: {len(approved)}",
                "",
                "map $request_uri $redirect_uri {",
                "    default '';",
            ]
            for r in approved:
                lines.append(f"    {r.source.path:<60} {get_dest(r)};")
            lines.extend([
                "}",
                "",
                "server {",
                "    # Add this block inside your server {} context",
                "    if ($redirect_uri) {",
                f"        return {status_code} $redirect_uri;",
                "    }",
                "}",
            ])
            content = "\n".join(lines).encode("utf-8")
            return content, "text/plain", f"{filename}.conf"

        case _:
            raise ValueError(f"Unknown export format: {format!r}")


# ──────────────────────────────────────────────────────────────────────────────
# Quick self-test / demo
# ──────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)

    # Sample Web A (Origin)
    web_a_raw = [
        "https://old-site.com/blog/how-to-do-seo",
        "https://old-site.com/blog/technical-seo-guide",
        "https://old-site.com/services/web-design",
        "https://old-site.com/services/seo-audit",
        "https://old-site.com/about-us",
        "https://old-site.com/contact",
        "https://old-site.com/products/widget-pro",
        "https://old-site.com/resources/case-studies",
    ]

    # Sample Web B (Destination) — with staging prefix to strip
    web_b_raw = [
        "https://staging.new-site.com/pre-prod/insights/how-to-do-seo-in-2024",
        "https://staging.new-site.com/pre-prod/insights/technical-seo-complete-guide",
        "https://staging.new-site.com/pre-prod/solutions/web-design-services",
        "https://staging.new-site.com/pre-prod/solutions/seo-audit-service",
        "https://staging.new-site.com/pre-prod/company/about",
        "https://staging.new-site.com/pre-prod/company/contact-us",
        "https://staging.new-site.com/pre-prod/shop/widget-pro-v2",
        "https://staging.new-site.com/pre-prod/resources/case-studies",
    ]

    # Define preprocessing rules for Web B
    rules = [
        TransformationRule(
            id="r1",
            type=RuleType.STRIP_DOMAIN,
            enabled=True,
            order=1,
        ),
        TransformationRule(
            id="r2",
            type=RuleType.REMOVE_PREFIX,
            enabled=True,
            order=2,
            prefix="/pre-prod",
        ),
    ]

    # Parse URLs
    entries_a, discarded_a = parse_url_list(web_a_raw)
    entries_b_raw, discarded_b = parse_url_list(web_b_raw)

    # Apply preprocessing rules to Web B
    transformed_b_urls = [apply_rules(e.raw, rules) for e in entries_b_raw]
    entries_b, _ = parse_url_list(transformed_b_urls)

    print(f"\n{'='*60}")
    print("RedirectMaster AI — Matching Engine Demo")
    print(f"{'='*60}")
    print(f"Web A: {len(entries_a)} URLs loaded")
    print(f"Web B: {len(entries_b)} URLs loaded (after rules)")

    # Preview rules
    sample = web_b_raw[0]
    preview = preview_rules(sample, rules)
    print(f"\nRule preview on: {sample}")
    for step in preview["steps"]:
        changed_marker = "✓" if step["changed"] else "-"
        print(f"  [{changed_marker}] {step['rule_type']}: {step['input']} → {step['output']}")
    print(f"  Final: {preview['result']}")

    # Run matching
    config = MatchingConfig(
        auto_approve_threshold=80.0,
        weights={"levenshtein": 0.35, "cosine": 0.40, "structural": 0.25},
    )
    output = run_matching(entries_a, entries_b, config)

    print(f"\n{'='*60}")
    print("Matching Results")
    print(f"{'='*60}")
    print(f"Processing time: {output.stats.processing_time_ms}ms")
    print(f"Match rate: {output.stats.match_rate:.1f}%")
    print(f"Auto-approved: {output.stats.auto_approved}")
    print(f"Pending review: {output.stats.pending_review}")
    print(f"No match: {output.stats.no_match}\n")

    for result in output.results:
        status_emoji = {
            MatchStatus.AUTO_APPROVED: "✅",
            MatchStatus.PENDING_REVIEW: "⚠️ ",
            MatchStatus.NO_MATCH: "❌",
        }.get(result.status, "?")

        print(f"{status_emoji} {result.confidence:5.1f}%  "
              f"{result.source.path:<40} → {result.destination.path}")
        print(f"          Lev:{result.scores.levenshtein:.0f}  "
              f"Cos:{result.scores.cosine:.0f}  "
              f"Str:{result.scores.structural:.0f}")

    # Test export
    print(f"\n{'='*60}")
    print("Export Preview (Apache format)")
    print(f"{'='*60}")
    # Approve all for demo
    for r in output.results:
        if r.status == MatchStatus.PENDING_REVIEW:
            r.status = MatchStatus.MANUALLY_APPROVED

    content, mime, fname = export_results(output.results, "apache")
    print(content.decode("utf-8"))
