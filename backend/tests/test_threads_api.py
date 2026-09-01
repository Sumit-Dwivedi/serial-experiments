"""Live smoke test for the Anonymous Threads API. Run: python backend/tests/test_threads_api.py [base_url]"""
import hashlib
import json
import sys
import urllib.error
import urllib.request

BASE = (sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8001") + "/api"


def call(method, path, body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(
        BASE + path, data=data, method=method,
        headers={"Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status, json.loads(r.read().decode() or "{}")
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode() or "{}")


def leading_zero_bits(digest: bytes) -> int:
    bits = 0
    for byte in digest:
        if byte == 0:
            bits += 8
            continue
        for shift in range(7, -1, -1):
            if byte >> shift:
                return bits + (7 - shift)
    return bits


def solve(kind):
    status, ch = call("GET", f"/threads/challenge?kind={kind}")
    assert status == 200, (status, ch)
    nonce = 0
    while True:
        d = hashlib.sha256(f"{ch['challenge']}{nonce}".encode()).digest()
        if leading_zero_bits(d) >= ch["difficulty"]:
            return ch["challenge"], str(nonce)
        nonce += 1


def main():
    results = []
    owner = "11111111-1111-4111-8111-111111111111"

    c, n = solve("thread")
    s, thread = call("POST", "/threads", {
        "title": "Smoke test thread", "body": "Verifying the API end to end.",
        "owner_token": owner, "challenge": c, "nonce": n, "expires_in_hours": 24,
    })
    results.append(("POST /threads", s == 201 and thread.get("owner_hash"), s))
    if s != 201:
        print("create failed:", s, thread)
        sys.exit(1)
    tid = thread["id"]

    s, lst = call("GET", "/threads")
    results.append(("GET /threads", s == 200 and any(t["id"] == tid for t in lst), s))

    c, n = solve("reply")
    s, reply = call("POST", f"/threads/{tid}/replies", {
        "body": "Top level reply", "participant_token": "22222222-2222-4222-8222-222222222222", "challenge": c, "nonce": n,
    })
    results.append(("POST reply (root)", s == 201 and reply.get("depth") == 0, s))
    rid = reply["id"]

    c, n = solve("reply")
    s, nested = call("POST", f"/threads/{tid}/replies", {
        "body": "Nested reply", "participant_token": owner,
        "parent_reply_id": rid, "challenge": c, "nonce": n,
    })
    results.append(("POST reply (nested, is_op)", s == 201 and nested.get("depth") == 1 and nested.get("is_op") is True, s))

    s, detail = call("GET", f"/threads/{tid}")
    ok = s == 200 and len(detail["replies"]) == 1 and len(detail["replies"][0]["children"]) == 1
    results.append(("GET /threads/{id} tree", ok, s))

    # negative: bad PoW
    s, _ = call("POST", f"/threads/{tid}/replies", {
        "body": "no pow", "participant_token": "22222222-2222-4222-8222-222222222222", "challenge": "deadbeef", "nonce": "0",
    })
    results.append(("reply w/ invalid PoW -> 400", s == 400, s))

    # negative: wrong owner token cannot close
    s, _ = call("PATCH", f"/threads/{tid}/close", {"owner_token": "33333333-3333-4333-8333-333333333333"})
    results.append(("close w/ wrong token -> 403", s == 403, s))

    s, closed = call("PATCH", f"/threads/{tid}/close", {"owner_token": owner})
    results.append(("PATCH close (owner)", s == 200 and closed.get("status") == "closed", s))

    s, _ = call("GET", "/threads/does-not-exist")
    results.append(("GET missing thread -> 404", s == 404, s))

    failed = 0
    for name, ok, code in results:
        print(f"{'PASS' if ok else 'FAIL'}  {name}  (http {code})")
        failed += 0 if ok else 1
    print(f"\n{len(results) - failed}/{len(results)} passed")
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
