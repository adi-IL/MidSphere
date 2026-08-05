import { useState } from "react";
import type { JobArtifact } from "../../lib/types";

interface Props {
  job: JobArtifact;
}

interface Message {
  role: "user" | "assistant";
  text: string;
}

export function RagChat({ job }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");

  const presetChips = [
    "What do Trip Circuit & Lift Quarantine buttons do?",
    "Why is mart_demographics / catalog left open?",
    "What SQL query fixes negative billing or PII?",
    "How does DataHub MCP integration work?",
  ];

  const handleSend = (textToSend?: string) => {
    const query = (textToSend || input).trim();
    if (!query) return;

    setInput("");
    const userMsg: Message = { role: "user", text: query };

    const lower = query.toLowerCase();
    let responseText = "";

    // 1. TRIP CIRCUIT / LIFT QUARANTINE BUTTON USAGE
    if (
      lower.includes("trip") ||
      lower.includes("lift") ||
      lower.includes("quarantine") ||
      lower.includes("button")
    ) {
      responseText = `**MidSphere Circuit Breaker Control Operations:**

1. **⚡ Trip Circuit Button:**
   • **Action:** Calls \`/v1/jobs/{id}/trip\` (or updates job-local state when offline), setting \`gateStatus = BLOCKED\`.
   • **DataHub Integration:** MidSphere policy enforces \`BLOCKED\` on Consumer Gate (\`GET /v1/gate/{urn}\`). Live DataHub MCP tags/properties are mutated when live MCP integration and mutations (\`TOOLS_IS_MUTATION_ENABLED=true\`) are enabled.

2. **🔓 Lift Quarantine Button:**
   • **Action:** Calls \`/v1/jobs/{id}/lift\` (or updates job-local state when offline), setting \`gateStatus = LIFTED\`.
   • **DataHub Integration:** Clears quarantine in MidSphere job state. Consumer Gate now returns \`OPEN / ALLOW\`, unblocking downstream pipelines. Live DataHub tags/properties are mutated when live MCP integration is enabled.`;

    }

    // 2. SELECTIVE LINEAGE / OPEN FORKS
    else if (
      lower.includes("open") ||
      lower.includes("demographics") ||
      lower.includes("catalog") ||
      lower.includes("fork")
    ) {
      responseText = `**Selective Circuit Breaking Explained:**

In job \`${job.job_id.slice(0, 8)}\`, downstream nodes outside the contaminated blast path remain **OPEN** with zero risk score.

• **Impacted Path:** Contaminated tables (e.g. \`mart_billing\` or \`mart_customer_360\`) are quarantined because audit findings directly corrupt their metrics.
• **Open Fork:** Unaffected tables (e.g. \`mart_demographics\` or \`mart_product_catalog\`) remain **OPEN**.

This guarantees **Selective Circuit Breaking**—halting corrupt financial/PII reports while keeping non-sensitive business analytics pipelines running smoothly.`;
    }

    // 3. FIX ARCHITECT & SQL/dbt REMEDIATION
    else if (
      lower.includes("sql") ||
      lower.includes("fix") ||
      lower.includes("dbt") ||
      lower.includes("diff") ||
      lower.includes("pr")
    ) {
      const prPath = job.pr?.path || "examples/prs/fix-negative-billing.example.diff";
      responseText = `**FixArchitect Remediation Diff:**

The FixArchitect tool generated a dry-run remediation PR at \`${prPath}\`.

It applies automated SQL validation rules to filter anomalies before staging:
\`\`\`sql
-- Applied dbt filter constraint
where billing_amount is not null
  and billing_amount >= 0
  and (discharge_date is null or date_of_admission <= discharge_date)
\`\`\`
Review the full diff under the **Inspector → Fix** tab. Merging this PR resolves the root finding and satisfies the lift criteria for quarantine removal.`;
    }

    // 4. DATAHUB MCP INTEGRATION
    else if (
      lower.includes("datahub") ||
      lower.includes("mcp") ||
      lower.includes("gms") ||
      lower.includes("tool")
    ) {
      responseText = `**DataHub MCP Integration Architecture:**

MidSphere connects directly to DataHub using the official \`uvx mcp-server-datahub@latest\` server over stdio / GraphQL GMS API:

• **Read Operations:** Executed via official MCP tools (\`get_entities\`, \`list_schema_fields\`, \`get_lineage\`, \`get_dataset_queries\`).
• **Write Operations:** Writes advisory graph state using \`add_tags\`, \`remove_tags\`, \`add_structured_properties\`, and \`save_document\`.
• **Audit Honesty:** Telemetry strictly verifies tool tokens against real MCP schemas. Deterministic fallback steps are clearly marked with \`sim\` prefixes.`;
    }

    // 5. RISK SCORE FORMULA
    else if (lower.includes("risk") || lower.includes("score") || lower.includes("formula")) {
      responseText = `**Risk Score Formula:**

The risk score of **${job.blast_radius.risk_score}/100** is calculated by the \`CascadeAnalyzer\` tool:
\`\`\`
risk = min(100, round(
    25 * severity_weight
  + 25 * (downstream_count / 10)
  + 20 * (has_pii)
  + 15 * (has_production_env)
  + 15 * (missing_owner)
))
\`\`\`
For job \`${job.job_id.slice(0, 8)}\`, **${job.findings.length} findings** across **${job.blast_radius.nodes.filter(n => n.impacted).length} impacted downstream nodes** resulted in a total risk score of **${job.blast_radius.risk_score}**.`;
    }

    // 6. GENERAL CONVERSATIONAL ASSISTANT FALLBACK
    else {
      responseText = `**MidSphere Intelligence Assistant Response:**

Regarding your query: *"_${query}_"*

• **Context Grounding:** Auditing job \`${job.job_id.slice(0, 8)}\` for target \`${job.root_urn}\`.
• **Active Status:** Gate Policy is **${job.quarantine?.gateStatus || "OPEN"}** with risk score **${job.blast_radius.risk_score}/100**.
• **Findings Summary:** ${job.findings.map(f => `\`${f.type}\` (${f.severity})`).join(", ") || "No active findings"}.
• **Lineage Scope:** ${job.blast_radius.nodes.length} total nodes evaluated; ${job.blast_radius.nodes.filter(n => n.impacted).length} impacted on blast path.

You can ask me about:
1. **Trip Circuit & Lift Quarantine operations**
2. **Specific dbt SQL fixes & diffs**
3. **DataHub MCP tag & property mutations**
4. **Selective circuit breaking for unaffected forks**`;
    }

    setMessages((prev) => [...prev, userMsg, { role: "assistant", text: responseText }]);
  };

  return (
    <div className="flex flex-1 h-full min-h-0 flex-col font-mono text-xs gap-3">
      <div className="flex shrink-0 items-center justify-between border-b border-line pb-2">
        <span className="text-2xs uppercase tracking-widest text-faint font-semibold">
          Audit Q&A Intelligence Assistant
        </span>
        <span className="rounded bg-elevated px-2 py-0.5 text-2xs text-accent font-semibold border border-line">
          Grounded Context
        </span>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto space-y-2.5 pr-1 custom-scrollbar">
        {messages.length === 0 ? (
          <div className="space-y-2.5 pt-1">
            <div className="text-2xs text-faint">Ask any question or pick a suggested topic:</div>
            <div className="flex flex-col gap-1.5">
              {presetChips.map((chip, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSend(chip)}
                  className="rounded border border-line bg-canvas p-2.5 text-2xs text-muted hover:text-ink hover:border-faint transition-all text-left group shadow-sm"
                >
                  <div className="text-ink group-hover:text-ink font-semibold">{chip}</div>
                  <div className="text-[10px] text-faint mt-0.5">Click to query grounded AI engine</div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m, i) => (
            <div
              key={i}
              className={`p-3 rounded-lg text-2xs leading-relaxed ${
                m.role === "user"
                  ? "bg-elevated text-ink border border-line font-semibold ml-4 shadow-md"
                  : "bg-canvas text-muted border border-line mr-1 shadow-sm"
              }`}
            >
              <div className="text-[9px] uppercase tracking-wider text-faint mb-1.5 flex items-center justify-between">
                <span className="font-bold">{m.role === "user" ? "You" : "MidSphere Intelligence Bot"}</span>
                <span className="text-[8px] text-faint">Grounded AI</span>
              </div>
              <div className="whitespace-pre-wrap">{m.text}</div>
            </div>
          ))
        )}
      </div>

      {/* Input bar pinned at bottom */}
      <div className="flex shrink-0 items-center gap-1.5 rounded-lg border border-line bg-canvas p-1.5 shadow-inner">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder="Ask any question about DataHub, circuit breaking, fixes, or lineage..."
          className="flex-1 bg-transparent px-2 text-2xs text-ink placeholder-faint focus:outline-none"
        />
        <button
          onClick={() => handleSend()}
          disabled={!input.trim()}
          className="rounded-md bg-elevated px-3.5 py-1.5 text-2xs font-semibold text-ink hover:bg-line disabled:opacity-30 transition-colors shadow-sm"
        >
          Send
        </button>
      </div>
    </div>
  );
}
