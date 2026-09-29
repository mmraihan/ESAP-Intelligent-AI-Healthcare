"""Predictor selection.

`MODEL_MODE=stub` (default) serves `stub.py`. `MODEL_MODE=real` serves
`real.py`, which loads the DUA-restricted bundles. Both expose the same five
callables, so nothing above this package knows which is running — the mode
shows up only in `ModelOutcome.status` and `/readyz`.
"""

from __future__ import annotations

from ..config import settings


def backend():
    if settings().model_mode == "real":
        from . import real

        return real
    from . import stub

    return stub


def mode() -> str:
    return settings().model_mode
