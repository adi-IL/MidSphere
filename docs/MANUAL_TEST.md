# Manual smoke test (judges + operators)

Use this when you want **human confirmation** without guessing. Automated unit tests cover packs, gate, and lift MCP honesty; this list covers the live Command Center and Cloud Run path.

**Surfaces**

| Surface | URL |
| --- | --- |
| Command Center | https://midsphere.vercel.app |
| API | https://midsphere-api-1053689941073.us-central1.run.app |
| Repo | https://github.com/adi-IL/MidSphere |

Expected scenario roots (must match hop-0 graph names):

| Tab | `root_urn` dataset | Risk | Quarantine | Open fork |
| --- | --- | --- | --- | --- |
| Hospital | `healthcare.raw_patients` | 61 | `mart_billing` | `mart_demographics` |
| Retail | `ecommerce.raw_customers` | 88 | `mart_customer_360` | `mart_product_catalog` |
| Taxi | `nyctaxi.raw_yellow_trips` | 65 | `mart_monthly_revenue` | `mart_trip_distance_stats` |

---

## A. UI honesty (2 min, no Run required)

1. Open Command Center.
2. Top bar should show **GMS** (on) when GMS is up, or **GMS off**.
3. Connection labels:
   - **API · Job** if canvas came from `GET /v1/jobs/latest` or a live Run/Trip.
   - **API · Sample** if you only switched Hospital/Retail/Taxi without Run (demo fixtures).
   - **Offline** if health fails.
4. Click **Retail** without Run: graph hop-0 is **`raw_customers`** (not `raw_orders`); risk **88**.
5. Click **Taxi** without Run: hop-0 is **`raw_yellow_trips`** (not `raw_trips`); risk **65**.
6. Pipeline badge may show **Sample** while TopBar still shows API up — that is intentional.

---

## B. Live closed loop + Trip / Lift (10–15 min when GMS is on)

1. Select **Hospital** → **Run** (⌘↵). Wait until stages complete (can be 30–120s with Antigravity + MCP).
2. Expect:
   - TopBar **API · Job**, **GMS**
   - Metrics gate **BLOCKED** (auto_trip)
   - Graph: `mart_billing` impacted, `mart_demographics` open
3. Open **Telemetry**. Prefer lines containing `official_mcp ok` for real tool names (`get_lineage`, `add_tags`, …) when GMS + mutations are live. Pack findings still drive the graph.
4. Decision → **Gate**: job view shows BLOCKED for quarantine target.
5. Click **Lift** (enabled when gate is BLOCKED).
   - Network: `POST /v1/jobs/{id}/lift` → 200
   - Metrics gate → **LIFTED**
   - Lift button disables (“No active quarantine”)
   - API body (Network tab) should include `remove_tags official_mcp ok` and `mutations_live=True` when mutations are on
6. Click **Trip** again.
   - Network: `POST /v1/jobs/{id}/trip` → 200 (may take ~60s+)
   - New job id, gate **BLOCKED**, `add_tags official_mcp ok` when mutations are on
7. Optional: **Retail** or **Taxi** → **Run** and confirm root_urn matches the table above (root string equals hop-0 name).

**Note:** Terminal one-liners after Lift may only say `quarantine lift submitted…`. Ground truth for live MCP is the job artifact events (`remove_tags official_mcp ok`), not only the short STATUS log.

---

## C. API curl smoke (5 min)

```bash
API=https://midsphere-api-1053689941073.us-central1.run.app

# Health: GMS reachable; official_mcp.probed is false by default (not ok:false)
curl -fsS "$API/v1/health" | python3 -m json.tool | head -40

# Empty instance after cold deploy: 404 fast (no auto-pipeline)
curl -sS -o /dev/null -w "%{http_code} %{time_total}s\n" "$API/v1/jobs/latest"

# Create + trip (Hospital)
curl -fsS -X POST "$API/v1/jobs" -H 'Content-Type: application/json' \
  -d '{"root_urn":"urn:li:dataset:(urn:li:dataPlatform:sqlite,healthcare.raw_patients,PROD)","mode":"full","auto_trip":true}' \
  -o /tmp/job.json
python3 -c "import json;d=json.load(open('/tmp/job.json'));print(d['job_id'], d['quarantine']['gateStatus'], d.get('mutations_applied'))"
JID=$(python3 -c "import json;print(json.load(open('/tmp/job.json'))['job_id'])")

# Lift (live remove_tags when GMS + mutations)
curl -fsS -X POST "$API/v1/jobs/$JID/lift" -H 'Content-Type: application/json' -d '{}' -o /tmp/lift.json
python3 -c "import json;d=json.load(open('/tmp/lift.json'));print(d['quarantine']['gateStatus']);print([e['message'] for e in d['events'] if 'remove_tags' in e['message']])"

# gate-default-blocked is healthcare mart_billing only (OPEN after ecommerce latest is correct)
curl -fsS "$API/v1/gate-default-blocked" | python3 -m json.tool
```

Retail / Taxi roots for POST:

```text
urn:li:dataset:(urn:li:dataPlatform:snowflake,ecommerce.raw_customers,PROD)
urn:li:dataset:(urn:li:dataPlatform:bigquery,nyctaxi.raw_yellow_trips,PROD)
```

---

## D. Local unit tests (1 min)

```bash
cd backend
ANTIGRAVITY_ENABLED=false USE_OFFICIAL_MCP=false python -m pytest tests/ -q

cd ../frontend
npm run build
```

---

## E. After a backend deploy (operator)

1. `GET /v1/health` → `datahub_reachable: true` and `datahub` is **not** `http://localhost:8080`.
2. If GMS is wrong: `./scripts/gce_datahub_schedule.sh start-now` (or re-point env; see [scripts/README.md](../scripts/README.md)).
3. Deploy workflow restores a pre-existing non-localhost `DATAHUB_GMS_URL` after `--env-vars-file` (see [`.github/DEPLOY.md`](../.github/DEPLOY.md)).
4. Confirm `cloudrun-env.yaml` does **not** set `DATAHUB_GMS_URL` to localhost.

---

## F. What “pass” means

| Check | Pass |
| --- | --- |
| Cold `GET /v1/jobs/latest` empty | **404** quickly |
| Retail/Taxi sample + Run roots | `raw_customers` / `raw_yellow_trips` |
| TopBar data honesty | **API · Sample** vs **API · Job** |
| Trip with GMS | gate **BLOCKED**, optional live `add_tags` |
| Lift with GMS | gate **LIFTED**, live `remove_tags` (or honest `sim remove_tags` if GMS/mutations off) |
| Health MCP field | `official_mcp.probed: false` by default (not a false failure) |
| GMS after redeploy | still public GMS URL, reachable |

If GMS is stopped (cost schedule), UI may show **GMS off** and job-local quarantine; that is expected until `start-now`.
