# MidSphere — 3-minute demo video script

**Goal:** Judges understand *what / why / how* in under **3:00**, see the product **functioning**, and leave with URLs to try it.

**Target length:** 2:30–2:55 (leave headroom under Devpost’s &lt;3 min rule).

**Primary surface:** [https://midsphere.vercel.app](https://midsphere.vercel.app)  
**Backup:** [https://github.com/adi-IL/MidSphere-datahb](https://github.com/adi-IL/MidSphere-datahb) · API `https://midsphere-api-1053689941073.us-central1.run.app`

---

## 0. Pre-flight (15 min before record)

Do this **before** you press record.

| Check | Action |
| --- | --- |
| Browser | Chrome, one window, **hard refresh** Command Center |
| Zoom | 100% UI, or 110% if text is small on 1080p capture |
| Tabs | Only MidSphere open (close Slack/mail) |
| Cursor | Large enough to see; optional highlight (e.g. Cursor Pro / macOS pointer size) |
| Network | Stable; cold-start scan can take ~20–40s — **do one warm-up Run scan first**, then record the second run |
| Audio | Quiet room, headset mic, level-check “one two MidSphere” |
| Claims | If chip says **GMS offline**, say **advisory / job-local quarantine** — never claim live DataHub tags or global MCP denial |
| Optional | Second monitor with this script in large font |

**Warm-up sequence (not on camera):**

1. Open `https://midsphere.vercel.app`  
2. Click **Run scan** once; wait until stages DONE and Terminal has MBOM CTA  
3. Click **Open MBOM review →** once so you know the path  
4. Optional: open GitHub repo in a second tab (only if you will cut to it in Act 5)

---

## 1. What you will touch (on camera)

Only these controls — no wandering.

| # | Where | What to click / show | Why |
| --- | --- | --- | --- |
| 1 | Top bar | Brand + connection chip + risk | Identity + honesty (API / GMS offline) |
| 2 | Top bar | **Run scan** | Primary action |
| 3 | Left | Stage cards + **Terminal Log** scrolling | Live closed loop |
| 4 | Center | Lineage graph (raw → staging → billing / demographics) | Selective halt story |
| 5 | Center | Click **mart_demographics** (open) | Selective: not blocked |
| 6 | Right | Inspector **Gate** tab | OPEN + selective copy |
| 7 | Center | Click **mart_billing** (impacted) | Blast path |
| 8 | Right | **Findings** then **Gate** | BLOCKED on quarantine set |
| 9 | Left Terminal | **Open MBOM review →** | Attestation path |
| 10 | Right | **MBOM** tab (scroll briefly) | Review file visible |
| 11 | Right | **Fix** tab (optional 5s) | Remediation artifact |
| 12 | Optional | GitHub README (5–8s) | Repo / Apache 2.0 / how to run |

**Do not:**

- Open System filter and read Gemini/Antigravity banners  
- Claim “MCP blocks all agents”  
- Scroll endlessly in Raw JSON  
- Start typing into the browser address bar mid-sentence  

---

## 2. Shot list (screen layout)

**Recommended capture:** 1920×1080, 30 fps, full browser window.

```
┌ TopBar: MidSphere · connection · risk · Run scan ─────────┐
├ Left: Swarm + Terminal Log ─┬ Center: Lineage ─┬ Inspector ┤
```

- **Cursor path:** top Run scan → left terminal → center nodes → right tabs → MBOM CTA  
- **Highlight:** pause 1s on each key state (open vs impacted, OPEN vs BLOCKED)

---

## 3. Timed script (voice + action)

Total ≈ **2:45**. Speak slightly slower than you think.

### Act 1 — Hook (0:00–0:25)

**On screen:** Full Command Center, idle/ready after warm-up (or after previous job visible).

**Say:**

> Agents that read DataHub inherit bad context — quality bugs, schema drift, poisoned marts.  
> Catalogs often only *log* the death.  
> **MidSphere** is a **context circuit-breaker**: audit the graph, score blast radius, **selectively quarantine**, ship a fix artifact, and leave an **MBOM** so the next agent inherits safer context.

**Touch:** Slow pan mouse from title → risk chip → lineage (no click yet).

---

### Act 2 — Run the loop (0:25–1:20)

**On screen:** Click **Run scan**.

**Say:**

> One action: Run scan. The closed loop starts — ContextSentinel, CascadeAnalyzer, CircuitBreaker, FixArchitect, MBOMEngine.  
> Terminal Log streams live stages while the backend job runs on Cloud Run.  
> We’re not inventing MCP tool names — when we write back, it’s real tools like `add_tags` and `save_document`. Today if GMS is offline, quarantine is **advisory on the job** and we label that honestly.

**Touch:**

- Click **Run scan**  
- Leave cursor over Terminal Log while lines prepend  
- Point briefly at stage cards going running → done  
- Wait until risk returns (~61) and gate metrics look blocked  

**If scan is long:** Keep talking (don’t freeze silent):

> Audit detects planted healthcare issues — negative billing, date swaps. Cascade scores selective impact: billing path yes, demographics fork no.

---

### Act 3 — Selective halt (1:20–2:00)

**On screen:** Graph focus.

**Say:**

> Here’s the fork. Source and staging are on the blast path.  
> **mart_billing** is impacted. **mart_demographics** stays open — selective halt, not a panic quarantine of the whole graph.

**Touch:**

1. Click **mart_demographics**  
2. Inspector → **Gate** → show **OPEN** + selective text  
3. Click **mart_billing** (or raw_patients / billing as impacted)  
4. **Findings** — NEGATIVE_BILLING / DATE_SWAP  
5. **Gate** — **BLOCKED** only where quarantine applies (billing set)  

**Say:**

> Consumer Gate is MidSphere policy for MidSphere-aware clients. Tags and properties in DataHub are **advisory**. We don’t claim the whole platform auto-denies every third-party agent.

---

### Act 4 — Fix + MBOM (2:00–2:35)

**On screen:** Terminal MBOM row + Inspector.

**Say:**

> FixArchitect produces a dry-run remediation artifact.  
> MBOMEngine attaches an **audit attestation** — the Model Bill of Materials for this job — so knowledge survives the session.

**Touch:**

1. Terminal: click **Open MBOM review →** (or **Open Fix review →** first for 5s, then MBOM)  
2. Scroll MBOM markdown slowly (summary + findings table)  
3. Optional: click **Fix** tab 3–5s on the diff  

**Say:**

> Judges can open the same example files in the repo under `examples/mboms` and `examples/prs` when offline.

---

### Act 5 — Close (2:35–2:50)

**On screen:** Either Command Center hero frame, or GitHub README.

**Say:**

> MidSphere: Command Center on Vercel, API on Cloud Run, Apache 2.0 on GitHub.  
> Live demo at midsphere.vercel.app.  
> Trip the context circuit — don’t just file the death certificate.

**Touch:** Freeze on logo + URL (or README live table). End.

---

## 4. Exact voiceover (optional full read)

Use if you prefer a teleprompter. Cut lines if you’re over time.

```
[0:00] Agents that read DataHub inherit bad context. Catalogs often only log the death.
[0:08] MidSphere is a context circuit-breaker for DataHub.
[0:14] We audit quality, score selective blast radius, quarantine only what must stop,
[0:22] emit a fix artifact, and publish an MBOM so the next agent inherits safer context.
[0:30] This is the Command Center. Live frontend on Vercel, API on Cloud Run.
[0:38] Run scan — closed loop starts. Terminal streams stages in real time.
[0:50] ContextSentinel finds negative billing and date-swap issues on the healthcare path.
[1:00] CascadeAnalyzer marks selective impact — billing yes, demographics no.
[1:10] CircuitBreaker applies advisory quarantine. Gate policy is MidSphere-enforced for clients that honor it.
[1:22] Watch the fork: mart_demographics stays open. mart_billing is on the blocked path.
[1:40] FixArchitect leaves a dry-run remediation. MBOMEngine attaches the audit attestation.
[1:55] Open MBOM review — full summary, findings, lift criteria.
[2:10] Offline artifacts live in the repo under examples. Online, save_document writes to DataHub when mutations are enabled.
[2:25] Apache 2.0, public GitHub, clear README. Try it at midsphere.vercel.app.
[2:40] MidSphere — trip the context circuit, don't just file the death certificate.
```

---

## 5. How to record (practical)

### Tools (pick one)

| Tool | Use |
| --- | --- |
| **OBS Studio** (free) | Screen + mic, 1080p, record to `.mp4` |
| **macOS** QuickTime | File → New Screen Recording |
| **Windows** Xbox Game Bar / Clipchamp | Simple capture then trim |
| **Loom** | Fast but export to YouTube public link for Devpost |

### OBS quick settings

- Canvas **1920×1080**, FPS **30**  
- Source: **Window Capture** (Chrome only) or Display Capture  
- Audio: mic only (mute system if notifications risk)  
- File: `examples/video/raw/midsphere-demo-raw.mp4` (create folder locally; don’t commit huge binaries)

### Record discipline

1. Warm-up scan **off camera**  
2. Start recording → 1s of silence → speak Act 1  
3. Prefer **one continuous take**; re-record whole acts if needed rather than 20 cuts  
4. If scan lags: keep voiceover going (script Act 2 filler)  
5. Stop when you finish Act 5; don’t overshoot 3:00  

### Edit (10–20 min)

| Step | Do |
| --- | --- |
| Trim | Cut dead air at start/end |
| Cap length | Hard max **2:55** |
| Audio | Normalize; remove loud clicks |
| Titles (optional) | 2s open card “MidSphere · Context Circuit-Breaker” + end card with URL |
| Captions | Optional; English auto-captions on YouTube help judges |
| Export | 1080p H.264, &lt;100 MB if possible for smooth upload |

### Publish (Devpost requirement)

1. Upload to **YouTube** or **Vimeo**  
2. Visibility: **Public** (or Unlisted only if Devpost still accepts — rules prefer public; use **Public**)  
3. Title: `MidSphere — Context Circuit-Breaker for DataHub (Demo)`  
4. Description (paste):

```
MidSphere: autonomous context circuit-breaker for DataHub.
Live: https://midsphere.vercel.app
API: https://midsphere-api-1053689941073.us-central1.run.app
Repo: https://github.com/adi-IL/MidSphere-datahb
Apache 2.0 · Built for Build with DataHub: The Agent Hackathon
```

5. Put the link on the Devpost submission form  

---

## 6. Honesty checklist (watch before upload)

- [ ] Never say “MCP blocks all agents worldwide”  
- [ ] If GMS offline visible: say “advisory / job-local” or “demo graph”  
- [ ] Selective halt is the hero (billing vs demographics)  
- [ ] MBOM is “attestation / inheritance,” not “we reinvented the catalog”  
- [ ] URLs said once clearly at the end  
- [ ] Length **under 3:00**  

---

## 7. B-roll / cutaways (optional)

Only if you have time for a second pass:

| Shot | Duration | Source |
| --- | --- | --- |
| GitHub README table | 5s | repo root |
| `examples/mboms/…` file in editor | 4s | VS Code |
| `examples/prs/…diff` | 3s | VS Code |
| Architecture one-liner on screen | 3s | skip if crowded |

Keep **&gt;80%** of the video on the **live Command Center**.

---

## 8. One-page cheat card (print)

```
0:00  Hook — death certificate vs circuit-breaker
0:25  Run scan — watch Terminal + stages
1:20  Click demographics OPEN → billing BLOCKED / findings
2:00  Open MBOM review → scroll attestation
2:35  URL + GitHub + done
```

**Must show:** Run scan · selective graph · Gate OPEN vs BLOCKED · MBOM open  
**Must say:** selective halt · advisory quarantine · Consumer Gate · midsphere.vercel.app  

---

## 9. Local files (this folder)

| Path | Purpose |
| --- | --- |
| `examples/video/DEMO_VIDEO_SCRIPT.md` | This script |
| `examples/video/raw/` | Put unedited captures here (gitignored recommended) |
| `examples/video/export/` | Final &lt;3 min mp4 before YouTube |

Add to `.gitignore` if not already:

```
examples/video/raw/
examples/video/export/
*.mp4
```

---

*MidSphere demo video — show the circuit trip, not the slide deck.*
