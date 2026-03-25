"""
POST /api/rules/preview — Rules preview endpoint.
"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException
from app.models import RulesPreviewRequest, RulesPreviewResponse, RuleStepModel
from app.logic import preview_rules, TransformationRule, RuleType

router = APIRouter()


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


@router.post("/rules/preview", response_model=RulesPreviewResponse)
async def preview_transformation_rules(request: RulesPreviewRequest):
    """
    Apply transformation rules step-by-step on a sample URL.
    Returns the final result and a trace of each rule application.
    """
    try:
        rules = [_model_to_rule(r) for r in request.rules]
        result = preview_rules(request.sample_url, rules)
        steps = [
            RuleStepModel(
                rule_id=s["rule_id"],
                rule_type=str(s["rule_type"]),
                input=s["input"],
                output=s["output"],
                changed=s["changed"],
            )
            for s in result["steps"]
        ]
        return RulesPreviewResponse(result=result["result"], steps=steps)

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={"code": "RULES_ERROR", "message": "Rule preview failed", "detail": str(e)},
        )
