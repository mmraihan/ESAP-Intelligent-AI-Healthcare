"""
Client for the self-hosted Qwen3.5-9B (vLLM, OpenAI-compatible) endpoint.

Notes learned from probing the server:
  - It is a reasoning model. With thinking ON, the answer goes to message.reasoning
    and `content` may be null; reasoning is VERY token-hungry (burns 1000+ tokens on
    trivial tasks). So for bulk extraction we default thinking OFF.
  - Thinking is toggled via chat_template_kwargs={"enable_thinking": false}.
  - The endpoint uses a self-signed cert -> verify=False.

Usage:
    from llm import chat, extract_json
    txt  = chat("Summarize: ...")                 # fast, no thinking
    data = extract_json("Return JSON {...}: ...")  # parsed dict, no thinking
    hard = chat("...", think=True, max_tokens=4000) # reasoning on, big budget
"""
import os, json, time, urllib3, requests
from dotenv import dotenv_values

urllib3.disable_warnings()  # self-signed cert
_cfg = dotenv_values(os.path.join(os.path.dirname(__file__), ".env"))
BASE  = _cfg["LLM_BASE_URL"]
KEY   = _cfg["LLM_API_KEY"]
MODEL = _cfg["LLM_MODEL"]


def chat(prompt, system=None, think=False, max_tokens=512, temperature=0.0,
         retries=3, timeout=120):
    """Return the assistant's text. think=False (default) disables reasoning."""
    msgs = ([{"role": "system", "content": system}] if system else []) + \
           [{"role": "user", "content": prompt}]
    body = {
        "model": MODEL, "messages": msgs,
        "max_tokens": max_tokens, "temperature": temperature,
    }
    if not think:
        body["chat_template_kwargs"] = {"enable_thinking": False}
    last = None
    for attempt in range(retries):
        try:
            r = requests.post(f"{BASE}/chat/completions",
                              headers={"Authorization": f"Bearer {KEY}"},
                              json=body, verify=False, timeout=timeout)
            r.raise_for_status()
            m = r.json()["choices"][0]["message"]
            return m.get("content") or m.get("reasoning") or ""
        except Exception as e:               # noqa: BLE001
            last = e
            time.sleep(1.5 * (attempt + 1))
    raise RuntimeError(f"LLM call failed after {retries} tries: {last}")


def extract_json(prompt, system=None, max_tokens=512, **kw):
    """chat() + tolerant JSON parse (strips ```json fences / surrounding prose)."""
    txt = chat(prompt, system=system, max_tokens=max_tokens, **kw)
    s = txt.strip()
    if "```" in s:
        s = s.split("```")[1].lstrip("json").strip() if s.count("```") >= 2 else s
    i, j = s.find("{"), s.rfind("}")
    if i != -1 and j != -1:
        s = s[i:j + 1]
    return json.loads(s)


if __name__ == "__main__":
    print("text:", chat("Reply with exactly one word: OK"))
    print("json:", extract_json(
        'Normalize to generic ingredient. Return ONLY JSON '
        '{"ingredient": "..."}. Drug: "Furosemide 40mg/4mL Injection"'))
