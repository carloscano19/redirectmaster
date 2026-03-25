# Software Requirements Specification
# RedirectMaster AI — Production-Grade SEO Migration Tool
**Version:** 1.0.0  
**Date:** 2026-03-23  
**Author:** Senior Full Stack Engineer & Solutions Architect  
**Status:** Draft for Review

---

## Table of Contents

1. [Introduction & Vision](#1-introduction--vision)
2. [System Overview](#2-system-overview)
3. [Technology Stack](#3-technology-stack)
4. [Functional Requirements](#4-functional-requirements)
5. [Non-Functional Requirements](#5-non-functional-requirements)
6. [User Stories & Acceptance Criteria](#6-user-stories--acceptance-criteria)
7. [System Architecture](#7-system-architecture)
8. [Data Models](#8-data-models)
9. [API Specification](#9-api-specification)
10. [UI/UX Design System](#10-uiux-design-system)
11. [File Structure & Implementation Guide](#11-file-structure--implementation-guide)
12. [Matching Engine Specification](#12-matching-engine-specification)
13. [Export Formats](#13-export-formats)
14. [Security & Performance](#14-security--performance)
15. [Deployment & DevOps](#15-deployment--devops)

---

## 1. Introduction & Vision

### 1.1 Purpose

RedirectMaster AI is a production-grade web application designed to solve one of the most error-prone and time-consuming tasks in SEO migrations: mapping old URLs (Web A / Origin) to new URLs (Web B / Destination) and generating redirect rule files.

Traditional migrations involve spreadsheets, manual effort, and high human-error rates. RedirectMaster AI automates 70–90% of this work using intelligent string similarity algorithms, structural analysis, and user-defined transformation rules.

### 1.2 Problem Statement

- SEO migrations involve hundreds to tens of thousands of URL mappings.
- Manual matching is slow, expensive, and error-prone.
- Existing tools are either too generic (Excel) or too narrow (single-format exporters).
- There is no open, self-hosted, privacy-first tool that combines an AI-assisted matching engine with a professional validation workflow.

### 1.3 Goals

| Goal | Metric |
|------|--------|
| Automate URL matching | ≥ 80% auto-match accuracy for clean URL structures |
| Reduce migration time | From days to hours for 10,000 URL datasets |
| Export flexibility | Support CSV, JSON, Apache `.htaccess`, Nginx `map` block |
| Self-hosted privacy | No URL data leaves the user's infrastructure |
| Production readiness | Containerized, stateless, horizontally scalable |

### 1.4 Scope

**In Scope:**
- URL ingestion (paste, file upload: .txt, .csv, .xml sitemap)
- Preprocessing / transformation rules engine
- Intelligent matching engine (multi-algorithm)
- Interactive validation table (approve / edit / reject)
- Export in 4 formats
- Dark/light mode UI
- Docker deployment

**Out of Scope (v1.0):**
- Live website crawling (future feature)
- User authentication / multi-tenancy
- Database persistence across sessions
- Google Search Console integration

---

## 2. System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        RedirectMaster AI                         │
│                                                                  │
│  ┌──────────────┐   ┌──────────────────┐   ┌────────────────┐  │
│  │   Web A      │   │  Matching Engine  │   │    Web B       │  │
│  │  (Origin)    │──▶│  ┌────────────┐  │◀──│  (Destination) │  │
│  │  URL Loader  │   │  │ Preprocess │  │   │  URL Loader    │  │
│  └──────────────┘   │  │  + Rules   │  │   └────────────────┘  │
│                     │  └────────────┘  │                        │
│                     │  ┌────────────┐  │                        │
│                     │  │ Similarity │  │                        │
│                     │  │ Algorithms │  │                        │
│                     │  └────────────┘  │                        │
│                     │  ┌────────────┐  │                        │
│                     │  │ Confidence │  │                        │
│                     │  │  Scoring   │  │                        │
│                     │  └────────────┘  │                        │
│                     └──────────────────┘                        │
│                              │                                   │
│                    ┌─────────▼──────────┐                        │
│                    │  Validation Table  │                        │
│                    │  (Approve/Edit/    │                        │
│                    │   Reject)          │                        │
│                    └─────────┬──────────┘                        │
│                              │                                   │
│                    ┌─────────▼──────────┐                        │
│                    │   Export Engine    │                        │
│                    │  CSV/JSON/Apache/  │                        │
│                    │  Nginx             │                        │
│                    └────────────────────┘                        │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. Technology Stack

### 3.1 Backend

| Component | Technology | Rationale |
|-----------|-----------|-----------|
| Runtime | Python 3.11+ | Ecosystem for NLP/text processing |
| Framework | FastAPI 0.110+ | Async, OpenAPI docs auto-generated, fast |
| Data Processing | Pandas 2.x | Vectorized URL parsing & batch operations |
| String Similarity | `rapidfuzz` (Levenshtein), `scikit-learn` (TF-IDF + Cosine) | Dual-algorithm ensemble |
| URL Parsing | `urllib.parse` (stdlib) | Reliable slug/path extraction |
| XML Sitemap | `lxml` | Parse sitemap.xml files for URL ingestion |
| Export | `openpyxl`, `csv` (stdlib), `json` (stdlib) | Multi-format export |
| Validation | `pydantic` v2 | Request/response schema validation |
| ASGI Server | `uvicorn` | Production ASGI server |

### 3.2 Frontend

| Component | Technology | Rationale |
|-----------|-----------|-----------|
| Framework | Next.js 14 (App Router) | SSR/SSG capabilities, file-based routing |
| Language | TypeScript 5+ | Type safety for complex data models |
| Styling | Tailwind CSS v3 + CSS Variables | Utility-first + theming |
| State Management | Zustand | Lightweight, no boilerplate |
| Table | TanStack Table v8 | Virtualized, sortable, editable |
| File Upload | `react-dropzone` | Drag & drop UX |
| HTTP Client | `axios` + `react-query` | Caching, loading states |
| Icons | `lucide-react` | Consistent icon set |
| Notifications | `sonner` | Toast notifications |
| Theme | `next-themes` | Dark/light mode |

### 3.3 Infrastructure

| Component | Technology |
|-----------|-----------|
| Containerization | Docker + Docker Compose |
| Reverse Proxy | Nginx (production) |
| CI/CD | GitHub Actions (optional) |
| Environment | `.env` files with validation |

---

## 4. Functional Requirements

### FR-01: URL Ingestion — Web A (Origin)

- **FR-01.1** The system shall accept URLs via direct text input (one URL per line).
- **FR-01.2** The system shall accept `.txt` files (one URL per line).
- **FR-01.3** The system shall accept `.csv` files with auto-detected URL column.
- **FR-01.4** The system shall accept XML sitemaps (`sitemap.xml` / `sitemap_index.xml`).
- **FR-01.5** The system shall display a count of parsed URLs with validation feedback.
- **FR-01.6** The system shall strip whitespace, duplicates, and invalid entries, reporting discards.

### FR-02: URL Ingestion — Web B (Destination)

- Same requirements as FR-01.1 through FR-01.6.

### FR-03: Preprocessing Rules Engine (Web B)

- **FR-03.1** Users shall be able to add multiple transformation rules applied to Web B URLs before matching.
- **FR-03.2** Rule types supported:
  - `REMOVE_PREFIX`: Remove a string prefix from the URL path (e.g., remove `/pre-prod`).
  - `ADD_PREFIX`: Add a string prefix to the URL path (e.g., add `/blog`).
  - `REMOVE_SUFFIX`: Remove a string suffix from the URL path.
  - `REPLACE`: Find and replace a substring in the URL.
  - `STRIP_DOMAIN`: Remove the domain, keeping only the path.
  - `REGEX`: Apply a custom regular expression transformation.
- **FR-03.3** Rules shall be applied in user-defined order (drag to reorder).
- **FR-03.4** A live preview shall show the transformation result on a sample URL.
- **FR-03.5** Rules shall be exportable/importable as JSON for reuse.

### FR-04: Matching Engine

- **FR-04.1** The engine shall compare Web A slugs against preprocessed Web B slugs.
- **FR-04.2** The engine shall produce one or more candidate matches per Web A URL, ranked by confidence score (0–100%).
- **FR-04.3** Confidence score shall be derived from a weighted ensemble of:
  - Levenshtein similarity on full slug (weight: 0.35)
  - TF-IDF cosine similarity on keywords extracted from path segments (weight: 0.40)
  - Structural similarity (folder depth, path segment count match) (weight: 0.25)
- **FR-04.4** Matches above a configurable threshold (default: 85%) shall be auto-approved.
- **FR-04.5** Matches between threshold and 50% shall be flagged for manual review.
- **FR-04.6** Matches below 50% shall be marked as "No Match Found".
- **FR-04.7** The engine shall process up to 50,000 URL pairs within 60 seconds.

### FR-05: Validation Interface

- **FR-05.1** All matches shall be displayed in a sortable, filterable table.
- **FR-05.2** Columns: `Source URL`, `Destination URL`, `Confidence %`, `Status`, `Actions`.
- **FR-05.3** Status values: `Auto-Approved`, `Pending Review`, `Manually Approved`, `Rejected`, `No Match`.
- **FR-05.4** Users shall be able to edit the destination URL inline.
- **FR-05.5** Users shall be able to approve or reject any match row.
- **FR-05.6** Users shall be able to bulk-select and bulk-approve/reject.
- **FR-05.7** Users shall be able to search/filter by URL, status, or confidence range.
- **FR-05.8** The table shall support virtual scrolling for datasets > 1,000 rows.

### FR-06: Export Engine

- **FR-06.1** Export shall include only Approved (auto + manual) matches.
- **FR-06.2** Supported formats:
  - **CSV**: `source_url,destination_url,status_code` (301 default, editable)
  - **JSON**: Array of `{from, to, type}` objects
  - **Apache `.htaccess`**: `Redirect 301 /old-path https://newsite.com/new-path`
  - **Nginx**: `map` block with `$request_uri $redirect_uri` entries
- **FR-06.3** Users shall be able to configure the HTTP status code (301, 302, 307, 308).
- **FR-06.4** Export shall trigger an immediate file download.

---

## 5. Non-Functional Requirements

### 5.1 Performance

| Metric | Target |
|--------|--------|
| Matching latency (1,000 URLs) | < 3 seconds |
| Matching latency (10,000 URLs) | < 20 seconds |
| Matching latency (50,000 URLs) | < 60 seconds |
| Frontend initial load (LCP) | < 2 seconds |
| Table render (10,000 rows) | < 500ms (virtual scroll) |

### 5.2 Scalability

- The backend shall be stateless; all session data held in frontend state.
- Matching shall be cancellable (background task with polling or SSE progress).

### 5.3 Reliability

- All API endpoints shall return structured error responses with `code`, `message`, `detail`.
- The matching engine shall not crash on malformed URLs; they shall be flagged and skipped.

### 5.4 Privacy

- No URL data shall be logged or persisted beyond the request lifecycle.
- No third-party analytics or tracking in the production build.

### 5.5 Accessibility

- WCAG 2.1 AA compliance.
- Full keyboard navigation in the validation table.
- Screen-reader labels for all interactive elements.

---

## 6. User Stories & Acceptance Criteria

### Epic 1: Data Ingestion

**US-01** — *As an SEO specialist, I want to paste a list of old URLs so that I can start the migration mapping quickly.*

**Acceptance Criteria:**
- Given I paste 500 URLs in the Web A textarea, when I click "Parse", then I see "500 URLs loaded" and a scrollable preview list.
- Given I upload a `sitemap.xml`, when parsing completes, then all `<loc>` entries are extracted and deduplicated.
- Given I paste URLs with trailing spaces or empty lines, then those are silently cleaned.

---

**US-02** — *As a developer, I want to upload a CSV with a URL column so that I don't need to manually extract the URLs.*

**Acceptance Criteria:**
- Given I upload a CSV with multiple columns, when the system detects a column named `url`, `URL`, `address`, or `loc`, then it auto-selects that column.
- Given no column is auto-detected, then I am shown a column picker dropdown.

---

### Epic 2: Rules Engine

**US-03** — *As an SEO specialist, I want to define a rule to strip a staging subdomain from Web B URLs so that the destination URLs are clean production paths.*

**Acceptance Criteria:**
- Given I add a `REPLACE` rule with find `https://staging.example.com` and replace `https://example.com`, then the preview shows the correct transformation.
- Given I have 3 rules, I can drag to reorder them and the preview updates in real time.

---

### Epic 3: Matching

**US-04** — *As an SEO specialist, I want the system to automatically match URLs and show me a confidence score so that I can focus my review on uncertain matches.*

**Acceptance Criteria:**
- Given 1,000 URLs in Web A and 1,200 in Web B, when I click "Run Matching", then results appear within 10 seconds.
- Given a match with 92% confidence, then its status is "Auto-Approved" and highlighted green.
- Given a match with 65% confidence, then its status is "Pending Review" and highlighted amber.

---

### Epic 4: Validation

**US-05** — *As an SEO specialist, I want to edit incorrect destination URLs inline so that I can correct the AI's mistakes without leaving the app.*

**Acceptance Criteria:**
- Given I click on a destination URL cell, then it becomes an editable input.
- Given I press Enter, then the edit is saved and the status changes to "Manually Approved".
- Given I press Escape, then the edit is discarded.

---

### Epic 5: Export

**US-06** — *As a developer, I want to export an Nginx map block so that I can paste it directly into my server config.*

**Acceptance Criteria:**
- Given 200 approved matches, when I select Nginx format and click Export, then I download a `.conf` file with a valid `map $request_uri $redirect_uri { ... }` block.
- Given I select 302 as the redirect type, then the export reflects this (where format supports it).

---

## 7. System Architecture

### 7.1 Component Diagram

```
┌─────────────────┐         ┌─────────────────────────────────────┐
│   Next.js App   │  HTTP   │           FastAPI Backend            │
│                 │◀───────▶│                                      │
│  ┌───────────┐  │         │  ┌──────────┐  ┌─────────────────┐  │
│  │ URLLoader │  │         │  │  /parse  │  │    /match       │  │
│  │ Component │  │         │  │ endpoint │  │    endpoint     │  │
│  └───────────┘  │         │  └──────────┘  └─────────────────┘  │
│  ┌───────────┐  │         │  ┌──────────┐  ┌─────────────────┐  │
│  │  Rules    │  │         │  │  /rules  │  │   /export       │  │
│  │  Builder  │  │         │  │ endpoint │  │   endpoint      │  │
│  └───────────┘  │         │  └──────────┘  └─────────────────┘  │
│  ┌───────────┐  │         │                                      │
│  │Validation │  │         │  ┌──────────────────────────────┐   │
│  │  Table    │  │         │  │       logic.py               │   │
│  └───────────┘  │         │  │  ┌──────────┐ ┌──────────┐  │   │
│  ┌───────────┐  │         │  │  │URLParser │ │RulesEng. │  │   │
│  │  Export   │  │         │  │  └──────────┘ └──────────┘  │   │
│  │  Panel    │  │         │  │  ┌──────────┐ ┌──────────┐  │   │
│  └───────────┘  │         │  │  │ Matcher  │ │Exporter  │  │   │
└─────────────────┘         │  │  └──────────┘ └──────────┘  │   │
                            │  └──────────────────────────────┘   │
                            └─────────────────────────────────────┘
```

### 7.2 Data Flow

```
1. User loads URLs (Web A + Web B) via UI
2. Frontend sends raw URL lists to POST /api/parse
3. Backend validates + deduplicates, returns structured URL objects
4. User configures preprocessing rules
5. Frontend sends rules + Web B URLs to POST /api/rules/preview
6. Backend applies rules, returns transformed URLs for preview
7. User clicks "Run Matching"
8. Frontend sends POST /api/match with {urls_a, urls_b, rules, config}
9. Backend runs ensemble matching, returns MatchResult[]
10. Frontend renders results in validation table
11. User approves/edits/rejects matches (state managed in frontend)
12. User clicks "Export"
13. Frontend sends POST /api/export with approved matches + format
14. Backend generates file, returns as binary download
```

---

## 8. Data Models

### 8.1 URLEntry

```typescript
interface URLEntry {
  id: string;           // UUID
  raw: string;          // Original URL as ingested
  normalized: string;   // Lowercase, trailing-slash stripped
  domain: string;       // e.g., "example.com"
  path: string;         // e.g., "/blog/my-article"
  slug: string;         // Last path segment: "my-article"
  segments: string[];   // ["blog", "my-article"]
  depth: number;        // 2
}
```

### 8.2 TransformationRule

```typescript
interface TransformationRule {
  id: string;
  type: 'REMOVE_PREFIX' | 'ADD_PREFIX' | 'REMOVE_SUFFIX' | 'REPLACE' | 'STRIP_DOMAIN' | 'REGEX';
  enabled: boolean;
  order: number;
  params: {
    find?: string;
    replace?: string;
    prefix?: string;
    suffix?: string;
    pattern?: string;  // for REGEX
  };
}
```

### 8.3 MatchResult

```typescript
interface MatchResult {
  id: string;
  source: URLEntry;           // Web A URL
  destination: URLEntry;      // Web B URL (post-rules)
  confidence: number;         // 0–100
  scores: {
    levenshtein: number;
    cosine: number;
    structural: number;
  };
  status: MatchStatus;
  isEdited: boolean;
  editedDestination?: string;
}

type MatchStatus = 
  | 'AUTO_APPROVED'    // confidence >= threshold
  | 'PENDING_REVIEW'   // 50% <= confidence < threshold
  | 'MANUALLY_APPROVED'
  | 'REJECTED'
  | 'NO_MATCH';        // confidence < 50%
```

### 8.4 ExportConfig

```typescript
interface ExportConfig {
  format: 'csv' | 'json' | 'apache' | 'nginx';
  statusCode: 301 | 302 | 307 | 308;
  includeRejected: boolean;
  filename: string;
}
```

---

## 9. API Specification

### POST /api/parse

**Request:**
```json
{
  "source": "string (raw text) or base64 encoded file",
  "source_type": "text | csv | xml",
  "column_hint": "optional column name for CSV"
}
```

**Response:**
```json
{
  "count": 542,
  "urls": [URLEntry],
  "discarded": 3,
  "discarded_reasons": ["Empty line", "Invalid URL format", "Duplicate"]
}
```

---

### POST /api/rules/preview

**Request:**
```json
{
  "sample_url": "https://staging.site.com/pre-prod/blog/my-post",
  "rules": [TransformationRule]
}
```

**Response:**
```json
{
  "result": "https://site.com/blog/my-post",
  "steps": [
    {"rule_id": "r1", "input": "...", "output": "...", "changed": true}
  ]
}
```

---

### POST /api/match

**Request:**
```json
{
  "urls_a": [URLEntry],
  "urls_b": [URLEntry],
  "rules": [TransformationRule],
  "config": {
    "auto_approve_threshold": 85,
    "max_candidates": 3,
    "algorithms": ["levenshtein", "cosine", "structural"]
  }
}
```

**Response:**
```json
{
  "results": [MatchResult],
  "stats": {
    "total_a": 542,
    "auto_approved": 401,
    "pending_review": 89,
    "no_match": 52,
    "processing_time_ms": 4230
  }
}
```

---

### POST /api/export

**Request:**
```json
{
  "matches": [MatchResult],
  "config": ExportConfig
}
```

**Response:** Binary file download with appropriate Content-Type and Content-Disposition headers.

---

## 10. UI/UX Design System

### 10.1 Design Philosophy

**"Terminal Precision"** — The aesthetic draws from developer tools and terminal UIs: monospaced accents, clean data-dense tables, surgical color usage. The interface feels like a professional instrument, not a marketing page.

### 10.2 Color Palette

```css
/* Dark Mode (default) */
--bg-base:        #0A0A0F;   /* Near-black with blue tint */
--bg-surface:     #111118;   /* Card backgrounds */
--bg-elevated:    #1A1A24;   /* Elevated panels */
--border:         #2A2A38;   /* Subtle borders */
--text-primary:   #E8E8F0;   /* Main text */
--text-secondary: #8888A8;   /* Muted labels */
--accent-blue:    #4D9EFF;   /* Primary actions */
--accent-green:   #2ECC7A;   /* Approved status */
--accent-amber:   #F0A429;   /* Review status */
--accent-red:     #FF4D6A;   /* Rejected status */
--accent-purple:  #9B7FFF;   /* Confidence scores */

/* Light Mode */
--bg-base:        #F5F5FA;
--bg-surface:     #FFFFFF;
--bg-elevated:    #EEEEF5;
--border:         #D8D8E8;
--text-primary:   #1A1A2E;
--text-secondary: #6666AA;
```

### 10.3 Typography

- **Display / Headers:** `DM Mono` — Technical, distinctive, conveys precision
- **Body / UI:** `IBM Plex Sans` — Professional, legible at small sizes
- **Code / URLs:** `JetBrains Mono` — Perfect URL readability

### 10.4 Layout

```
┌─────────────────────────────────────────────────────────────┐
│ HEADER: Logo | Step Indicator | Theme Toggle | Help         │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  STEP 1: LOAD          STEP 2: RULES       STEP 3: REVIEW   │
│                                                              │
│ ┌──────────────┐  ┌──────────────────┐  ┌──────────────┐   │
│ │   WEB A      │  │ RULES ENGINE     │  │    WEB B     │   │
│ │  URL Loader  │  │ + Preview        │  │  URL Loader  │   │
│ └──────────────┘  └──────────────────┘  └──────────────┘   │
│                                                              │
│  [RUN MATCHING ▶]                                            │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│  VALIDATION TABLE                                            │
│  Filters: [All ▼] [Status ▼] [Confidence ▼] [Search...]    │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Source URL  │ Destination URL │ Score │ Status │ Act │   │
│  ├──────────────────────────────────────────────────────┤   │
│  │ /old/page   │ /new/page       │  94%  │  ✅    │ ··· │   │
│  │ /old/blog   │ /blog/old       │  67%  │  ⚠️   │ ··· │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  EXPORT: [CSV] [JSON] [Apache] [Nginx]    [Download ↓]      │
└──────────────────────────────────────────────────────────────┘
```

### 10.5 Component States

Each table row has clear visual states:
- **Auto-Approved (green left border):** Confidence ≥ threshold
- **Pending Review (amber left border):** Needs human decision
- **Manually Approved (blue left border):** Human-confirmed
- **Rejected (red, dimmed):** Excluded from export
- **No Match (gray, strikethrough source):** No destination found

---

## 11. File Structure & Implementation Guide

```
redirectmaster-ai/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py              # FastAPI app factory
│   │   ├── config.py            # Pydantic settings
│   │   ├── logic.py             # 🔑 Core matching engine
│   │   ├── models.py            # Pydantic data models
│   │   ├── routes/
│   │   │   ├── __init__.py
│   │   │   ├── parse.py         # /api/parse endpoint
│   │   │   ├── rules.py         # /api/rules endpoint
│   │   │   ├── match.py         # /api/match endpoint
│   │   │   └── export.py        # /api/export endpoint
│   │   └── utils/
│   │       ├── url_parser.py    # URL normalization utilities
│   │       ├── rules_engine.py  # Transformation rules
│   │       └── exporters.py     # Format exporters
│   ├── tests/
│   │   ├── test_logic.py
│   │   ├── test_routes.py
│   │   └── fixtures/
│   ├── requirements.txt
│   └── Dockerfile
│
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx         # Main dashboard
│   │   │   └── globals.css
│   │   ├── components/
│   │   │   ├── URLLoader/
│   │   │   │   ├── URLLoader.tsx
│   │   │   │   └── URLPreview.tsx
│   │   │   ├── RulesEngine/
│   │   │   │   ├── RulesBuilder.tsx
│   │   │   │   ├── RuleCard.tsx
│   │   │   │   └── RulePreview.tsx
│   │   │   ├── MatchTable/
│   │   │   │   ├── MatchTable.tsx    # 🔑 Main validation table
│   │   │   │   ├── MatchRow.tsx
│   │   │   │   ├── StatusBadge.tsx
│   │   │   │   └── ConfidenceBar.tsx
│   │   │   ├── ExportPanel/
│   │   │   │   └── ExportPanel.tsx
│   │   │   └── ui/               # Shared primitives
│   │   ├── hooks/
│   │   │   ├── useMatching.ts
│   │   │   └── useExport.ts
│   │   ├── store/
│   │   │   └── appStore.ts       # Zustand store
│   │   ├── types/
│   │   │   └── index.ts          # Shared TypeScript types
│   │   └── lib/
│   │       └── api.ts            # API client
│   ├── package.json
│   ├── tailwind.config.ts
│   ├── next.config.ts
│   └── Dockerfile
│
├── nginx/
│   └── nginx.conf
├── docker-compose.yml
└── README.md
```

---

## 12. Matching Engine Specification

### 12.1 Algorithm Pipeline

```
Input: URL_A (normalized path), URL_B[] (transformed paths)

Step 1: Feature Extraction
  - Extract slug (last segment)
  - Extract keywords (split by -, _, /)
  - Compute depth (number of path segments)
  - Normalize (lowercase, remove extensions)

Step 2: Candidate Filtering (Performance Optimization)
  - If depth(A) == depth(B): boost score by 0.1
  - Pre-filter candidates where keyword overlap > 0 (TF-IDF matrix)
  - Limit candidates to top 50 before full scoring

Step 3: Ensemble Scoring
  score = (
    levenshtein_weight  * levenshtein_similarity(A.path, B.path)   +
    cosine_weight       * cosine_similarity(A.keywords, B.keywords) +
    structural_weight   * structural_similarity(A, B)
  ) * 100

Step 4: Ranking
  - Sort candidates by score DESC
  - Return top N candidates per URL_A

Step 5: Thresholding
  - score >= auto_approve_threshold → AUTO_APPROVED
  - 50 <= score < auto_approve_threshold → PENDING_REVIEW
  - score < 50 → NO_MATCH
```

### 12.2 Performance Strategy

- Vectorize TF-IDF matrix for entire URL_B set once (O(n) not O(n²))
- Use sparse matrix operations via `scikit-learn`
- Use `rapidfuzz.process.cdist` for batch Levenshtein (C-extension, very fast)
- Parallelize with `concurrent.futures.ThreadPoolExecutor` for >5,000 URLs

---

## 13. Export Formats

### CSV
```
source_url,destination_url,redirect_type
/old/page,https://newsite.com/new/page,301
```

### JSON
```json
[
  {"from": "/old/page", "to": "https://newsite.com/new/page", "type": 301}
]
```

### Apache .htaccess
```apache
# Generated by RedirectMaster AI — 2026-03-23
# Total redirects: 421
Redirect 301 /old/page https://newsite.com/new/page
Redirect 301 /old/blog https://newsite.com/blog
```

### Nginx map block
```nginx
# Generated by RedirectMaster AI — 2026-03-23
map $request_uri $redirect_uri {
    /old/page   https://newsite.com/new/page;
    /old/blog   https://newsite.com/blog;
}
server {
    if ($redirect_uri) {
        return 301 $redirect_uri;
    }
}
```

---

## 14. Security & Performance

### 14.1 Input Validation
- Maximum URL list size: 100,000 entries per request
- Maximum file upload size: 50MB
- URL format validation via RFC 3986
- Regex rules validated and sandboxed (timeout: 1s per rule per URL)

### 14.2 Rate Limiting
- `/api/match`: 10 requests/minute per IP
- `/api/parse`: 60 requests/minute per IP

### 14.3 CORS
- Configurable allowed origins via environment variable

---

## 15. Deployment & DevOps

### docker-compose.yml Structure
```yaml
version: '3.9'
services:
  backend:
    build: ./backend
    ports: ["8000:8000"]
    environment:
      - AUTO_APPROVE_THRESHOLD=85
      - MAX_UPLOAD_SIZE_MB=50
      - CORS_ORIGINS=http://localhost:3000
  
  frontend:
    build: ./frontend
    ports: ["3000:3000"]
    environment:
      - NEXT_PUBLIC_API_URL=http://backend:8000
  
  nginx:
    image: nginx:alpine
    ports: ["80:80", "443:443"]
    depends_on: [frontend, backend]
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `AUTO_APPROVE_THRESHOLD` | `85` | Confidence % for auto-approval |
| `MAX_URLS_PER_REQUEST` | `100000` | Hard limit per matching request |
| `LEVENSHTEIN_WEIGHT` | `0.35` | Algorithm ensemble weight |
| `COSINE_WEIGHT` | `0.40` | Algorithm ensemble weight |
| `STRUCTURAL_WEIGHT` | `0.25` | Algorithm ensemble weight |
| `CORS_ORIGINS` | `*` | Allowed CORS origins |

---

*End of SRS — RedirectMaster AI v1.0.0*
