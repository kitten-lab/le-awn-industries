"""Hermes parcel travel.

A mailed instance is a remint (new local uid). Marks, cites, stamps, and dress
travel with the paper. Mail.* routing scars append; they do not replace the
instance prop. Never send isMarked: false — normalize_leaf_prop would then
drop Mark.* as "clean paper".
"""

from __future__ import annotations

from typing import Any

_MAIL = "Mail."


def traveling_prop(raw: Any) -> dict[str, Any]:
    """Copy instance prop for a parcel. Drop routing; keep marks / cites."""
    out: dict[str, Any] = {}
    if not isinstance(raw, dict):
        return out
    for k, v in raw.items():
        if v is None or v == "":
            continue
        ks = str(k)
        if ks.startswith(_MAIL):
            continue
        out[ks] = v
    if any(str(k).startswith("Mark.") for k in out):
        out["isMarked"] = True
    if any(str(k).startswith("Cite.") for k in out):
        out["isCited"] = True
    return out


def traveling_dressup(raw: Any, new_id: str = "") -> dict[str, Any]:
    out = dict(raw) if isinstance(raw, dict) else {}
    if new_id:
        out["id"] = new_id
    return out


def append_mail_travel(
    base: dict[str, Any] | None,
    *,
    inbox: str = "",
    address: str = "",
    from_auth: str = "",
    sent_at: Any = None,
    origin: str = "",
    ship: str = "instance",
) -> dict[str, Any]:
    """Overlay Mail.* onto existing prop. Never force unmarked."""
    out = dict(base) if isinstance(base, dict) else {}
    out.pop("Mail.off_desk", None)
    travel = {
        "Mail.inbox": inbox,
        "Mail.address": address,
        "Mail.from": from_auth,
        "Mail.sent_at": sent_at,
        "Mail.origin": origin,
        "Mail.instance_of": origin,
        "Mail.ship": ship,
    }
    for k, v in travel.items():
        if v is None or v == "":
            continue
        out[k] = v
    if "isMarkable" not in out:
        out["isMarkable"] = True
    if any(str(k).startswith("Mark.") for k in out):
        out["isMarked"] = True
    return out


def stamps_of(obj: Any) -> list[Any]:
    s = obj.get("stamps") if isinstance(obj, dict) else None
    return list(s) if isinstance(s, list) else []


def cites_of(obj: Any) -> list[str]:
    c = obj.get("cites") if isinstance(obj, dict) else None
    if not isinstance(c, list):
        return []
    return [str(x).strip() for x in c if str(x).strip()]


def parcel_instance(full: Any, cfg: Any) -> dict[str, Any]:
    """Stamps / cites from the chip; marks + dress from the instance cfg."""
    cfg = cfg if isinstance(cfg, dict) else {}
    full = full if isinstance(full, dict) else {}
    return {
        "stamps": stamps_of(full),
        "cites": cites_of(full),
        "prop": traveling_prop(cfg.get("prop")),
        "dressup": traveling_dressup(cfg.get("dressup")),
    }
