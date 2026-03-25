"""
POST /api/match — URL matching endpoint.
"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException
from app.models import (
    MatchRequest, MatchResponse, MatchResultModel,
    URLEntryModel, AlgorithmScoresModel, MatchingStatsModel,
)
from app.config import settings
from app.logic import (
    run_matching, apply_rules, parse_url_list,
    URLEntry, MatchingConfig, TransformationRule, RuleType,
)

router = APIRouter()


def _model_to_url_entry(m: URLEntryModel) -> URLEntry:
    return URLEntry(
        id=m.id,
        raw=m.raw,
        normalized=m.normalized,
        domain=m.domain,
        path=m.path,
        slug=m.slug,
        segments=m.segments,
        depth=m.depth,
        keywords=m.keywords,
    )


def _model_to_rule(m) -> TransformationRule:
    return TransformationRule(
        id=m.id,
        type=RuleType(m.type),
        enabled=m.enabled,
        order=m.order,
        find=m.params.find,
        replace=m.params.replace,
        prefix=m.params.prefix,
        suffix=m.params.suffix,
        pattern=m.params.pattern,
    )


def _result_to_model(r) -> MatchResultModel:
    return MatchResultModel(
        id=r.id,
        source=URLEntryModel(
            id=r.source.id, raw=r.source.raw, normalized=r.source.normalized,
            domain=r.source.domain, path=r.source.path, slug=r.source.slug,
            segments=r.source.segments, depth=r.source.depth, keywords=r.source.keywords,
        ),
        destination=URLEntryModel(
            id=r.destination.id, raw=r.destination.raw, normalized=r.destination.normalized,
            domain=r.destination.domain, path=r.destination.path, slug=r.destination.slug,
            segments=r.destination.segments, depth=r.destination.depth, keywords=r.destination.keywords,
        ),
        confidence=r.confidence,
        scores=AlgorithmScoresModel(
            levenshtein=r.scores.levenshtein,
            cosine=r.scores.cosine,
            structural=r.scores.structural,
        ),
        status=r.status.value,
        is_edited=r.is_edited,
        edited_destination=r.edited_destination,
    )


@router.post("/match", response_model=MatchResponse)
async def match_urls(request: MatchRequest):
    """
    Run the ensemble URL matching engine.
    Applies rules to urls_b first, then runs the 3-algorithm matcher.
    """
    try:
        if len(request.urls_a) > settings.max_urls_per_request:
            raise HTTPException(
                status_code=422,
                detail={
                    "code": "TOO_MANY_URLS",
                    "message": f"urls_a exceeds max {settings.max_urls_per_request}",
                    "detail": None,
                },
            )

        urls_a = [_model_to_url_entry(u) for u in request.urls_a]
        urls_b_raw = [_model_to_url_entry(u) for u in request.urls_b]
        rules = [_model_to_rule(r) for r in request.rules]

        # Apply transformation rules to Web B URLs
        if rules:
            transformed_b_strings = [apply_rules(u.raw or u.path, rules) for u in urls_b_raw]
            urls_b, _ = parse_url_list(transformed_b_strings)
        else:
            urls_b = urls_b_raw

        # Build weights from config
        cfg = request.config
        weights = {
            "levenshtein": settings.levenshtein_weight,
            "cosine": settings.cosine_weight,
            "structural": settings.structural_weight,
        }

        matching_config = MatchingConfig(
            auto_approve_threshold=cfg.auto_approve_threshold,
            max_candidates=cfg.max_candidates,
            weights=weights,
        )

        output = run_matching(urls_a, urls_b, matching_config)

        stats = MatchingStatsModel(
            total_a=output.stats.total_source,
            total_b=output.stats.total_destination,
            auto_approved=output.stats.auto_approved,
            pending_review=output.stats.pending_review,
            no_match=output.stats.no_match,
            processing_time_ms=output.stats.processing_time_ms,
        )

        return MatchResponse(
            results=[_result_to_model(r) for r in output.results],
            stats=stats,
        )

    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(
            status_code=422,
            detail={"code": "MATCH_ERROR", "message": str(e), "detail": None},
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={"code": "INTERNAL_ERROR", "message": "Matching failed", "detail": str(e)},
        )
