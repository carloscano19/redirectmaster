"""
POST /api/export — Export matching results in various formats.
"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException
from fastapi.responses import Response

from app.models import ExportRequest
from app.logic import export_results, MatchResult, URLEntry, AlgorithmScores, MatchStatus

router = APIRouter()


def _model_to_url_entry(m) -> URLEntry:
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


def _model_to_match_result(m) -> MatchResult:
    return MatchResult(
        id=m.id,
        source=_model_to_url_entry(m.source),
        destination=_model_to_url_entry(m.destination),
        confidence=m.confidence,
        scores=AlgorithmScores(
            levenshtein=m.scores.levenshtein,
            cosine=m.scores.cosine,
            structural=m.scores.structural,
        ),
        status=MatchStatus(m.status),
        is_edited=m.is_edited,
        edited_destination=m.edited_destination,
    )


@router.post("/export")
async def export_redirects(request: ExportRequest):
    """
    Export approved matches as CSV, JSON, Apache .htaccess, or Nginx map block.
    Returns a binary file download.
    """
    try:
        results = [_model_to_match_result(m) for m in request.matches]
        cfg = request.config

        content_bytes, content_type, filename = export_results(
            results=results,
            format=cfg.format,
            status_code=cfg.status_code,
            filename=cfg.filename,
        )

        return Response(
            content=content_bytes,
            media_type=content_type,
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"',
                "Content-Length": str(len(content_bytes)),
            },
        )

    except ValueError as e:
        raise HTTPException(
            status_code=422,
            detail={"code": "EXPORT_ERROR", "message": str(e), "detail": None},
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={"code": "INTERNAL_ERROR", "message": "Export failed", "detail": str(e)},
        )
