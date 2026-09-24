import http.cookiejar, urllib.request, urllib.parse, time, os
from pathlib import Path

cj = http.cookiejar.CookieJar()
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))

def hit(label, url, data=None):
    t0 = time.perf_counter()
    try:
        req = urllib.request.Request(url, data=data, method="POST" if data is not None else "GET")
        if data is not None:
            req.add_header("Content-Type", "application/x-www-form-urlencoded")
        with opener.open(req, timeout=180) as r:
            body = r.read()
            code = r.status
    except Exception as e:
        print(label, "FAIL", round((time.perf_counter() - t0) * 1000), e)
        return None
    print(label, "http", code, "ms", round((time.perf_counter() - t0) * 1000), "size", len(body), "ncookies", len(list(cj)))
    return body

hit("api_health", "http://127.0.0.1:43210/api/health")
hit("glass_before", "http://127.0.0.1:43210/?h=code.glass")
data = urllib.parse.urlencode({"cw_unlock": "1", "codeword": "grepToday"}).encode()
b = hit("unlock_POST", "http://127.0.0.1:43210/?h=code.glass", data)
if b:
    s = b.decode("utf-8", "replace")
    print("post_gate", "cw-gate-form" in s)
    print("post_markers", "dir tree" in s, "compostlook" in s, "codelook" in s, "tag-search" in s)
for i in range(3):
    b = hit("glass_u" + str(i), "http://127.0.0.1:43210/?h=code.glass")
    if b and i == 0:
        s = b.decode("utf-8", "replace")
        print("u0_gate", "cw-gate-form" in s)
        print("u0_dir_tree", s.count("dir tree"), "compostlook", s.count("compostlook"), "codelook", s.count("codelook"))
        print("u0_kb", round(len(s) / 1024, 1))
hit("tags", "http://127.0.0.1:43210/?h=code.tags")
hit("help", "http://127.0.0.1:43210/?h=help")
# deep chip page if present
hit("chip_leaf", "http://127.0.0.1:43210/?h=code.glass&p=OT/008/T01/B002/L03")
hit("chip_bay", "http://127.0.0.1:43210/?h=code.glass&p=OT/008")
