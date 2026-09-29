"""Provider-agnostic LLM client — the one place the chat assistant talks to a model.

Any OpenAI-compatible endpoint works by setting three env vars; no code change:

    LLM_BASE_URL   e.g. https://llm.arahim.dev/v1  (self-hosted vLLM/Qwen), or OpenAI, OpenRouter, ...
    LLM_MODEL      e.g. qwen
    LLM_API_KEY    the key, or "none" for an unauthenticated self-hosted endpoint

Design:
* Reasoning/thinking is OFF by default (Qwen is a reasoning model; hidden reasoning
  eats the token budget and returns empty content). Both switches are sent so any
  provider reads the one it knows: OpenRouter's `reasoning` and vLLM's
  `chat_template_kwargs.enable_thinking`.
* It FAILS GRACEFULLY. `available()` says whether a key/URL is configured; a call
  that times out or errors raises LLMError, and the chat route falls back to its
  deterministic path so "chat to enter data" keeps working when the model is down.
* The key is server-side only; it is never returned to the browser.
"""

from __future__ import annotations

import json
import os
from functools import lru_cache
from typing import Any

import httpx


class LLMError(RuntimeError):
    """Any failure talking to the LLM (not configured, timeout, bad shape)."""


def _cfg() -> dict:
    return {
        "base_url": (os.environ.get("LLM_BASE_URL") or "").rstrip("/"),
        "model": os.environ.get("LLM_MODEL") or "qwen",
        "api_key": os.environ.get("LLM_API_KEY") or "none",
        "timeout": float(os.environ.get("LLM_TIMEOUT_S") or "30"),
        "max_tokens": int(os.environ.get("LLM_MAX_TOKENS") or "800"),
        "reasoning": (os.environ.get("LLM_REASONING") or "false").lower() in {"1", "true", "yes"},
        "enabled": (os.environ.get("LLM_ENABLED") or "true").lower() in {"1", "true", "yes"},
    }


def available() -> bool:
    c = _cfg()
    return bool(c["enabled"] and c["base_url"])


def chat(messages: list[dict], *, temperature: float = 0.2, response_json: bool = False) -> str:
    """Return the assistant's text for a list of {role, content} messages."""
    c = _cfg()
    if not c["base_url"]:
        raise LLMError("LLM not configured (set LLM_BASE_URL).")
    payload: dict[str, Any] = {
        "model": c["model"], "messages": messages,
        "max_tokens": c["max_tokens"], "temperature": temperature,
    }
    if not c["reasoning"]:
        payload["reasoning"] = {"enabled": False}
        payload["chat_template_kwargs"] = {"enable_thinking": False}
    if response_json:
        payload["response_format"] = {"type": "json_object"}
    headers = {"Authorization": f"Bearer {c['api_key']}", "Content-Type": "application/json"}
    try:
        resp = httpx.post(f"{c['base_url']}/chat/completions", json=payload,
                          headers=headers, timeout=c["timeout"])
    except httpx.HTTPError as exc:
        raise LLMError(f"LLM request failed: {exc}") from exc
    if resp.status_code >= 400:
        raise LLMError(f"LLM returned {resp.status_code}: {resp.text[:200]}")
    try:
        return resp.json()["choices"][0]["message"]["content"] or ""
    except (KeyError, IndexError, ValueError) as exc:
        raise LLMError(f"unexpected LLM response: {resp.text[:200]}") from exc


def extract_json(text: str, *, instructions: str, schema_hint: dict | None = None) -> dict:
    """Ask the model for a single JSON object and parse it robustly."""
    system = ("You extract structured clinical intake data. "
              "Respond with ONLY one valid JSON object, no prose, no code fences.")
    parts = [instructions.strip()]
    if schema_hint is not None:
        parts.append("JSON shape:\n" + json.dumps(schema_hint, indent=1))
    parts.append("Text:\n" + text.strip())
    out = chat([{"role": "system", "content": system},
                {"role": "user", "content": "\n\n".join(parts)}],
               response_json=True)
    return _loads(out)


def _loads(s: str) -> dict:
    s = (s or "").strip()
    if s.startswith("```"):
        s = s.strip("`")
        if s[:4].lower() == "json":
            s = s[4:]
    try:
        return json.loads(s)
    except json.JSONDecodeError:
        i, j = s.find("{"), s.rfind("}")
        if i != -1 and j > i:
            try:
                return json.loads(s[i:j + 1])
            except json.JSONDecodeError:
                pass
    raise LLMError(f"LLM did not return JSON: {s[:160]}")


@lru_cache(maxsize=1)
def _warmup_marker() -> bool:  # placeholder to keep import side-effect-free
    return True
