#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
XuanCe - Render one-click deploy (free plan)
Usage:
  python scripts/deploy_render.py <GITHUB_PAT> <RENDER_API_KEY>
Notes:
  - Uses python urllib (OpenSSL) because this machine's schannel TLS is broken.
  - Tokens are used in memory only; revoke them after the deploy.
"""
import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.request

API_BASE = "https://api.render.com/v1"
REPO = "XewTon/IP-ACG-"
BRANCH = "main"
SERVICE_NAME = "xuance"


def api(path, method="GET", token=None, body=None):
    url = API_BASE + path
    headers = {"Authorization": "Bearer " + token, "Accept": "application/json"}
    data = None
    if body is not None:
        headers["Content-Type"] = "application/json"
        data = json.dumps(body).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            raw = resp.read().decode("utf-8", "replace")
            return resp.status, (json.loads(raw) if raw.strip() else None)
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", "replace")


def main():
    args = sys.argv[1:]
    skip_push = "--skip-push" in args
    args = [a for a in args if a != "--skip-push"]
    if len(args) >= 2:
        pat, rkey = args[0], args[1]
    else:
        pat = os.environ.get("GITHUB_PAT", "")
        rkey = os.environ.get("RENDER_API_KEY", "")
    if not pat or not rkey:
        print("usage: python scripts/deploy_render.py <GITHUB_PAT> <RENDER_API_KEY> [--skip-push]")
        sys.exit(2)

    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

    if skip_push:
        print("[1/4] skip push (--skip-push)")
    else:
        print("[1/4] push code to GitHub ...")
        push_url = "https://x-access-token:%s@github.com/%s.git" % (pat, REPO)
        r = subprocess.run(
            ["git", "-c", "http.sslBackend=openssl", "-c", "credential.helper=",
             "push", push_url, "HEAD:" + BRANCH],
            cwd=root,
        )
        if r.returncode != 0:
            print("git push failed, exit", r.returncode)
            sys.exit(1)
        print("  pushed")

    print("[2/4] get Render workspace ...")
    code, owners = api("/owners", token=rkey)
    if code != 200:
        print("GET /owners failed:", code, owners)
        sys.exit(1)
    owner = None
    for item in owners or []:
        o = item.get("owner") or {}
        if o.get("type") in ("user", "team"):
            owner = o
            break
    if not owner:
        print("no usable owner found:", json.dumps(owners, ensure_ascii=False))
        sys.exit(1)
    owner_id = owner["id"]
    print("  workspace:", owner.get("name"), owner_id)

    print("[3/4] create web service (docker, free) ...")
    body = {
        "type": "web_service",
        "name": SERVICE_NAME,
        "ownerId": owner_id,
        "repo": "https://github.com/" + REPO,
        "branch": BRANCH,
        "autoDeploy": "yes",
        "envVars": [
            {"key": "DASHSCOPE_MODEL", "value": "qwen-turbo"},
        ],
        "serviceDetails": {
            "runtime": "docker",
            "envSpecificDetails": {
                "dockerfilePath": "./Dockerfile",
                "dockerContext": ".",
            },
            "healthCheckPath": "/api/health",
            "plan": "free",
            "numInstances": 1,
        },
    }
    code, result = api("/services", method="POST", token=rkey, body=body)
    if code != 201:
        print("create service failed:", code)
        print(result)
        print("hint: if repo access is missing, install the Render GitHub App on this repo first")
        sys.exit(1)
    svc = result["service"]
    service_id = svc["id"]
    deploy_id = result.get("deployId", "")
    details = svc.get("serviceDetails") or {}
    url = details.get("url") or ("https://" + SERVICE_NAME + ".onrender.com")
    dash = svc.get("dashboardUrl", "")
    print("  serviceId =", service_id)
    print("  deployId  =", deploy_id)
    print("  URL       =", url)
    print("  console   =", dash)

    print("[4/4] poll deploy status (first Docker build 5-15 min) ...")
    status = "created"
    for i in range(1, 91):
        time.sleep(20)
        code, d = api("/services/%s/deploys/%s" % (service_id, deploy_id), token=rkey)
        status = d.get("status", "poll-error") if code == 200 else "poll-error"
        print("  [%d] %s" % (i, status), flush=True)
        if status in ("live", "build_failed", "update_failed", "canceled", "deactivated"):
            break
    print("final status:", status)
    if status == "live":
        print("=" * 50)
        print("  DEPLOYED! open:", url)
        print("=" * 50)
    else:
        print("deploy not live yet, check logs:", dash)


if __name__ == "__main__":
    main()
