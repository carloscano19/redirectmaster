"""
POST /api/parse — URL ingestion endpoint.
Accepts raw text or file content (txt, csv, xml sitemap).
"""
from __future__ import annotations

import base64
import io
import csv
from typing import Optional

from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from fastapi.responses import JSONResponse

from app.models import ParseResponse, URLEntryModel, ErrorResponse
from app.logic import parse_url_list

router = APIRouter()


def _parse_xml_sitemap(content: str) -> list[str]:
    """Extract URLs from XML sitemap or sitemap index."""
    from lxml import etree
    try:
        root = etree.fromstring(content.encode("utf-8"))
        ns = {"sm": "http://www.sitemaps.org/schemas/sitemap/0.9"}
        locs = root.xpath("//sm:loc/text()", namespaces=ns)
        return [str(loc).strip() for loc in locs]
    except Exception as e:
        raise ValueError(f"Invalid XML sitemap: {e}")


def _parse_csv_content(content: str, column_hint: Optional[str]) -> list[str]:
    """Auto-detect URL column in CSV and extract values."""
    reader = csv.DictReader(io.StringIO(content))
    headers = reader.fieldnames or []

    url_col = None
    if column_hint and column_hint in headers:
        url_col = column_hint
    else:
        for candidate in ["url", "URL", "address", "Address", "loc", "Loc", "link", "Link"]:
            if candidate in headers:
                url_col = candidate
                break

    if not url_col and headers:
        # First column as fallback
        url_col = headers[0]

    if not url_col:
        raise ValueError("Could not detect a URL column in the CSV")

    return [row[url_col].strip() for row in reader if row.get(url_col, "").strip()]


def _entries_to_model(entries) -> list[URLEntryModel]:
    return [
        URLEntryModel(
            id=e.id,
            raw=e.raw,
            normalized=e.normalized,
            domain=e.domain,
            path=e.path,
            slug=e.slug,
            segments=e.segments,
            depth=e.depth,
            keywords=e.keywords,
        )
        for e in entries
    ]


@router.post("/parse", response_model=ParseResponse)
async def parse_urls(
    source: str = Form(...),
    source_type: str = Form("text"),
    column_hint: Optional[str] = Form(None),
):
    """
    Parse URLs from raw text, CSV, or XML sitemap content.
    """
    try:
        content = source

        if source_type == "csv":
            raw_urls = _parse_csv_content(content, column_hint)
        elif source_type == "xml":
            raw_urls = _parse_xml_sitemap(content)
        else:
            # Plain text — one URL per line
            raw_urls = [line.strip() for line in content.splitlines() if line.strip()]

        entries, discarded_reasons = parse_url_list(raw_urls)

        return ParseResponse(
            count=len(entries),
            urls=_entries_to_model(entries),
            discarded=len(discarded_reasons),
            discarded_reasons=discarded_reasons,
        )

    except ValueError as e:
        raise HTTPException(
            status_code=422,
            detail={"code": "PARSE_ERROR", "message": str(e), "detail": None},
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={"code": "INTERNAL_ERROR", "message": "Parsing failed", "detail": str(e)},
        )


@router.post("/parse/file", response_model=ParseResponse)
async def parse_urls_file(
    file: UploadFile = File(...),
    column_hint: Optional[str] = Form(None),
):
    """Parse URLs from an uploaded file (.txt, .csv, or .xml)."""
    filename = file.filename or ""
    content_bytes = await file.read()

    try:
        content = content_bytes.decode("utf-8", errors="replace")
    except Exception:
        raise HTTPException(status_code=400, detail={"code": "DECODE_ERROR", "message": "Cannot decode file", "detail": None})

    if filename.endswith(".xml"):
        source_type = "xml"
    elif filename.endswith(".csv"):
        source_type = "csv"
    else:
        source_type = "text"

    try:
        if source_type == "csv":
            raw_urls = _parse_csv_content(content, column_hint)
        elif source_type == "xml":
            raw_urls = _parse_xml_sitemap(content)
        else:
            raw_urls = [line.strip() for line in content.splitlines() if line.strip()]

        entries, discarded_reasons = parse_url_list(raw_urls)

        return ParseResponse(
            count=len(entries),
            urls=_entries_to_model(entries),
            discarded=len(discarded_reasons),
            discarded_reasons=discarded_reasons,
        )

    except ValueError as e:
        raise HTTPException(
            status_code=422,
            detail={"code": "PARSE_ERROR", "message": str(e), "detail": None},
        )
