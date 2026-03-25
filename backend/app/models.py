"""
RedirectMaster AI — Pydantic v2 Request/Response Models
"""
from __future__ import annotations
from typing import Optional, Literal
from pydantic import BaseModel, Field


# ──────────────────────────────────────────────────────────────────────────────
# Shared Models
# ──────────────────────────────────────────────────────────────────────────────

class URLEntryModel(BaseModel):
    id: str
    raw: str
    normalized: str
    domain: str
    path: str
    slug: str
    segments: list[str]
    depth: int
    keywords: str


class AlgorithmScoresModel(BaseModel):
    levenshtein: float
    cosine: float
    structural: float


class MatchStatusEnum(str):
    AUTO_APPROVED = "AUTO_APPROVED"
    PENDING_REVIEW = "PENDING_REVIEW"
    MANUALLY_APPROVED = "MANUALLY_APPROVED"
    REJECTED = "REJECTED"
    NO_MATCH = "NO_MATCH"


class MatchResultModel(BaseModel):
    id: str
    source: URLEntryModel
    destination: URLEntryModel
    confidence: float
    scores: AlgorithmScoresModel
    status: str
    is_edited: bool = False
    edited_destination: Optional[str] = None


# ──────────────────────────────────────────────────────────────────────────────
# Parse Endpoint
# ──────────────────────────────────────────────────────────────────────────────

class ParseRequest(BaseModel):
    source: str = Field(..., description="Raw text or base64 encoded file content")
    source_type: Literal["text", "csv", "xml"] = "text"
    column_hint: Optional[str] = None


class ParseResponse(BaseModel):
    count: int
    urls: list[URLEntryModel]
    discarded: int
    discarded_reasons: list[str]


# ──────────────────────────────────────────────────────────────────────────────
# Rules Endpoint
# ──────────────────────────────────────────────────────────────────────────────

class RuleParamsModel(BaseModel):
    find: Optional[str] = None
    replace: Optional[str] = None
    prefix: Optional[str] = None
    suffix: Optional[str] = None
    pattern: Optional[str] = None


class TransformationRuleModel(BaseModel):
    id: str
    type: Literal["REMOVE_PREFIX", "ADD_PREFIX", "REMOVE_SUFFIX", "REPLACE", "STRIP_DOMAIN", "REGEX"]
    enabled: bool = True
    order: int = 0
    params: RuleParamsModel = Field(default_factory=RuleParamsModel)


class RulesPreviewRequest(BaseModel):
    sample_url: str
    rules: list[TransformationRuleModel]


class RuleStepModel(BaseModel):
    rule_id: str
    rule_type: str
    input: str
    output: str
    changed: bool


class RulesPreviewResponse(BaseModel):
    result: str
    steps: list[RuleStepModel]


# ──────────────────────────────────────────────────────────────────────────────
# Match Endpoint
# ──────────────────────────────────────────────────────────────────────────────

class MatchingConfigModel(BaseModel):
    auto_approve_threshold: float = 85.0
    max_candidates: int = 3
    algorithms: list[str] = Field(default_factory=lambda: ["levenshtein", "cosine", "structural"])


class MatchRequest(BaseModel):
    urls_a: list[URLEntryModel]
    urls_b: list[URLEntryModel]
    rules: list[TransformationRuleModel] = Field(default_factory=list)
    config: MatchingConfigModel = Field(default_factory=MatchingConfigModel)


class MatchingStatsModel(BaseModel):
    total_a: int
    total_b: int
    auto_approved: int
    pending_review: int
    no_match: int
    processing_time_ms: int


class MatchResponse(BaseModel):
    results: list[MatchResultModel]
    stats: MatchingStatsModel


# ──────────────────────────────────────────────────────────────────────────────
# Export Endpoint
# ──────────────────────────────────────────────────────────────────────────────

class ExportConfigModel(BaseModel):
    format: Literal["csv", "json", "apache", "nginx"] = "csv"
    status_code: Literal[301, 302, 307, 308] = 301
    include_rejected: bool = False
    filename: str = "redirects"


class ExportRequest(BaseModel):
    matches: list[MatchResultModel]
    config: ExportConfigModel = Field(default_factory=ExportConfigModel)


# ──────────────────────────────────────────────────────────────────────────────
# Error Model
# ──────────────────────────────────────────────────────────────────────────────

class ErrorResponse(BaseModel):
    code: str
    message: str
    detail: Optional[str] = None
