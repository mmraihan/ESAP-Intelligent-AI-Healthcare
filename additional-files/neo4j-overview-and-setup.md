# Neo4j Graph Database — Overview, Purpose & Windows Server 2022 Setup Guide

**Context:** ESAP Intelligent AI Healthcare Platform
**Requested by:** AI Engineer
**Target server:** Windows Server 2022 (same host running SQL Server + PostgreSQL)
**Date:** June 2026

---

## Table of Contents

1. [What is Neo4j](#1-what-is-neo4j)
2. [Why an AI Engineer Wants This](#2-why-an-ai-engineer-wants-this)
3. [How It Fits Into ESAP's Existing Architecture](#3-how-it-fits-into-esaps-existing-architecture)
4. [Use Cases Specific to ESAP Healthcare](#4-use-cases-specific-to-esap-healthcare)
5. [Editions & Licensing](#5-editions--licensing)
6. [System Requirements](#6-system-requirements)
7. [Installation Guide — Windows Server 2022](#7-installation-guide--windows-server-2022)
8. [Post-Install Configuration](#8-post-install-configuration)
9. [Connecting from .NET / Python](#9-connecting-from-net--python)
10. [Security Checklist](#10-security-checklist)
11. [Questions to Ask Before Installing](#11-questions-to-ask-before-installing)

---

## 1. What is Neo4j

Neo4j is a **graph database management system**. Instead of storing data in tables (SQL Server, PostgreSQL) it stores data as:

| Concept | Example |
|---|---|
| **Node** | A `Patient`, a `Drug`, a `Diagnosis`, a `Doctor` |
| **Relationship** | `(Patient)-[PRESCRIBED]->(Drug)`, `(Drug)-[INTERACTS_WITH]->(Drug)` |
| **Property** | Attributes on nodes/relationships — e.g. `Patient.age`, `PRESCRIBED.dosage` |

Query language: **Cypher** — purpose-built for traversing relationships (very different syntax from SQL, but conceptually similar to "pattern matching").

```cypher
// Example: find all drugs that interact with a patient's current medications
MATCH (p:Patient {patient_id: "ESAP-X92J4K"})-[:PRESCRIBED]->(d1:Drug)
MATCH (d1)-[:INTERACTS_WITH]->(d2:Drug)
RETURN d1.name, d2.name
```

This kind of "find connected things, N hops away" query is what graph databases are built for — it's slow and awkward in SQL (`JOIN` chains), fast and natural in Neo4j.

---

## 2. Why an AI Engineer Wants This

Your platform already has:
- **SQL Server** (`Healthcare-MIMIC-IV`) — structured clinical records
- **PostgreSQL** (`Healthcare-Dataset`) — migrated MIMIC-IV dataset, ~100GB, 31 tables
- **Qdrant** — vector database for RAG (semantic search over documents)

Neo4j fills a **different gap**: explicit relationships between clinical entities, which neither SQL tables nor vector embeddings represent well.

### The big trend: GraphRAG

"GraphRAG" (Graph + Retrieval-Augmented Generation) is one of the most significant improvements to LLM-based clinical AI in 2024-2026. Instead of an LLM retrieving only semantically *similar* text chunks (what Qdrant does), it also retrieves *explicitly connected* facts from a knowledge graph.

**Example difference:**

| Plain RAG (Qdrant only) | GraphRAG (Qdrant + Neo4j) |
|---|---|
| "Patient mentioned chest pain" → retrieves similar-sounding notes | "Patient mentioned chest pain" → retrieves notes **AND** traverses: chest pain → linked diagnoses → linked medications → known drug interactions → family history of cardiac conditions |
| Misses non-obvious but clinically connected information | Surfaces connected risk factors a doctor would want flagged |

This directly supports the `AIAnalysisResults` and `flags` system already in your roadmap ([backend-roadmap.md](backend-roadmap.md) §3) — better-connected context → better risk flags.

---

## 3. How It Fits Into ESAP's Existing Architecture

```
╔══════════════════════════════════════════════════════════════════╗
║                  AI Orchestrator Service (Python)                 ║
╚════╤══════════════════╤═══════════════════╤═══════════════════════╝
     │                   │                   │
╔════▼═══════╗   ╔═══════▼═══════╗   ╔═══════▼════════╗
║ PostgreSQL ║   ║    Qdrant     ║   ║     Neo4j      ║  ← NEW
║ Healthcare-║   ║  Vector DB    ║   ║ Knowledge Graph║
║  Dataset   ║   ║   (RAG docs)  ║   ║ (relationships)║
╚════════════╝   ╚═══════════════╝   ╚════════════════╝
  structured         semantic            explicit
  records            similarity          connections
```

Neo4j does **not replace** PostgreSQL or Qdrant — it's additive. Source-of-truth clinical records stay in PostgreSQL/SQL Server; Neo4j stores derived relationship graphs built from that data (e.g., drug interaction networks built once from RxNorm + patient prescriptions).

---

## 4. Use Cases Specific to ESAP Healthcare

| Use Case | Why Graph Fits |
|---|---|
| **Drug interaction networks** | Your roadmap already calls RxNorm API per-patient ([backend-roadmap.md](backend-roadmap.md) §5.3 `DrugInteractionService`). Neo4j can pre-build the full interaction graph once, then query instantly instead of hitting an external API per request |
| **Comorbidity / disease networks** | MIMIC-IV's `diagnoses_icd_typed` table (millions of rows, ICD codes) naturally forms a graph — "patients with diabetes who also have X" becomes a graph traversal |
| **Patient care pathways** | Model `Visit → Diagnosis → Treatment → Outcome` as a traversable path for the doctor dashboard |
| **Family history / genetic risk chains** | `(Patient)-[FAMILY_HISTORY]->(Condition)` relationships are graph-native, awkward as JSON blobs (current schema stores this as `NVARCHAR(MAX)` JSON in `FamilyHistory` table) |
| **RLHF feedback graph** | Track which AI flags doctors consistently accept/reject, linked across similar patient profiles — graph pattern detection for prompt improvement (ties into Phase 5 of your roadmap) |

---

## 5. Editions & Licensing

| Edition | Cost | Limits |
|---|---|---|
| **Community** | Free (GPLv3) | Single instance, no clustering, no hot backups, no advanced security (RBAC) |
| **Enterprise** | Paid (contact Neo4j for pricing) | Clustering, hot backups, RBAC, multi-database |
| **AuraDB** | Managed cloud (pay-as-you-go) | Neo4j-hosted, no server management — not applicable since you want on-prem Windows Server |

**For ESAP's current stage (single server, development/early production):** Community Edition is sufficient. Revisit Enterprise only if you need clustering or formal RBAC for HIPAA-grade access control later.

---

## 6. System Requirements

| Resource | Minimum (dev/test) | Recommended (production, your scale) |
|---|---|---|
| RAM | 2 GB | 8–16 GB dedicated to Neo4j (heap + page cache) |
| CPU | 2 cores | 4+ cores |
| Disk | 10 GB | Depends on graph size — drug/diagnosis graphs are typically small (MB-GB), patient-relationship graphs at MIMIC-IV scale could reach 10-50 GB |
| Java | Bundled with Neo4j 5.x installer (Java 17/21) | Same |
| OS | Windows Server 2016+ | Windows Server 2022 ✅ supported |

**Important — check total RAM budget on the server.** This machine already runs:
- SQL Server (`Healthcare-MIMIC-IV`)
- PostgreSQL (`Healthcare-Dataset`, 100+ GB, tuned with `shared_buffers=4GB`, `maintenance_work_mem=2GB`)

Adding Neo4j with 8-16GB recommended means you need to confirm the server has enough free RAM for all three to coexist without starving each other. Run this on the server first:

```powershell
Get-CimInstance Win32_PhysicalMemory | Measure-Object -Property Capacity -Sum | ForEach-Object { "{0:N2} GB Total RAM" -f ($_.Sum / 1GB) }
Get-Counter '\Memory\Available MBytes'
```

---

## 7. Installation Guide — Windows Server 2022

### Step 1 — Download Neo4j Community Edition

Go to the official Neo4j download page and select **Neo4j Community Server** for Windows (`.zip` distribution, not Neo4j Desktop — Desktop is for local dev machines, not servers).

### Step 2 — Verify/Install Java

Neo4j 5.x bundles its own JDK in some distributions, but verify:

```powershell
java -version
```

If missing, Neo4j 5.x requires Java 17 or 21 (OpenJDK).

### Step 3 — Extract and Configure

```powershell
# Extract to a permanent location
Expand-Archive neo4j-community-5.x.x-windows.zip -DestinationPath "D:\Neo4j\"

# Edit the config file
notepad D:\Neo4j\neo4j-community-5.x.x\conf\neo4j.conf
```

Key settings to review in `neo4j.conf`:

```ini
# Memory — set based on available server RAM
server.memory.heap.initial_size=2g
server.memory.heap.max_size=4g
server.memory.pagecache.size=2g

# Network — bind to all interfaces if remote access needed (be careful — see security checklist)
server.default_listen_address=0.0.0.0

# Ports (defaults)
server.bolt.listen_address=:7687     # Bolt protocol (app connections)
server.http.listen_address=:7474     # Browser UI / REST
```

### Step 4 — Install as a Windows Service

```powershell
cd D:\Neo4j\neo4j-community-5.x.x\bin
.\neo4j.bat install-service
.\neo4j.bat start
```

### Step 5 — Set Initial Password

Browse to `http://<server-ip>:7474` (or `http://localhost:7474` if on the server itself) and log in with default credentials (`neo4j` / `neo4j`) — you'll be forced to set a new password on first login.

### Step 6 — Open Firewall Ports (if remote access needed)

```powershell
New-NetFirewallRule -DisplayName "Neo4j Bolt" -Direction Inbound -Protocol TCP -LocalPort 7687 -Action Allow
New-NetFirewallRule -DisplayName "Neo4j HTTP" -Direction Inbound -Protocol TCP -LocalPort 7474 -Action Allow
```

> Same consideration as your PostgreSQL port 5434 — only open these if the AI engineer needs to connect from outside the server. If the Python AI service runs on the same machine, keep it bound to `localhost` instead.

---

## 8. Post-Install Configuration

```cypher
// Verify install — run in Neo4j Browser (http://server-ip:7474)
CALL dbms.components() YIELD name, versions, edition
RETURN name, versions, edition;
```

Create the initial schema constraints (recommended before loading data):

```cypher
CREATE CONSTRAINT patient_id_unique IF NOT EXISTS
FOR (p:Patient) REQUIRE p.patient_id IS UNIQUE;

CREATE CONSTRAINT drug_name_unique IF NOT EXISTS
FOR (d:Drug) REQUIRE d.name IS UNIQUE;
```

---

## 9. Connecting from .NET / Python

### .NET (matches your existing connection string pattern)

```powershell
dotnet add package Neo4j.Driver
```

```json
"ConnectionStrings": {
  "Neo4jConnection": "bolt://176.9.16.194:7687",
  "Neo4jUser": "neo4j",
  "Neo4jPassword": "SET_VIA_ENVIRONMENT_VARIABLE"
}
```

```csharp
using Neo4j.Driver;

var driver = GraphDatabase.Driver(
    builder.Configuration["ConnectionStrings:Neo4jConnection"],
    AuthTokens.Basic("neo4j", builder.Configuration["ConnectionStrings:Neo4jPassword"]));
```

### Python (for the AI Orchestrator service)

```bash
pip install neo4j
```

```python
from neo4j import GraphDatabase

driver = GraphDatabase.driver(
    "bolt://176.9.16.194:7687",
    auth=("neo4j", "your_password")
)
```

---

## 10. Security Checklist

- [ ] Change default password immediately after install
- [ ] Bind to `localhost` only unless remote access is genuinely required
- [ ] If remote access needed, restrict firewall rule to specific source IPs, not `Any`
- [ ] Store credentials in environment variables / secrets manager — never hardcode (same standard you're already using for `AnthropicApiKey` in [backend-roadmap.md](backend-roadmap.md) §2.2)
- [ ] Enable TLS for Bolt connections if Neo4j and the app server are on different machines (`server.bolt.tls_level=REQUIRED`)
- [ ] Since this involves patient-linked data (HIPAA-relevant), confirm whether Neo4j needs to be in scope for your existing audit logging (`AuditLog` table) — log graph queries that touch patient nodes the same way you log SQL queries

---

## 11. Questions to Ask Before Installing

Before greenlighting the install, get clarity from the AI engineer on:

1. **Scope** — Is this for GraphRAG (additive, alongside Qdrant) or intended to replace something? These are very different amounts of work.
2. **Data source** — Will the graph be built from PostgreSQL/SQL Server data (ETL pipeline needed) or from a public ontology (e.g., RxNorm, UMLS) independent of patient data?
3. **Patient-identifiable data** — Will any nodes contain PHI (patient-identifiable health information)? If yes, the HIPAA/audit considerations in §10 become mandatory, not optional.
4. **Who maintains it** — Graph databases need schema/ontology design ("what's a node vs a relationship vs a property" is a real design decision) — confirm the AI engineer owns this, not just the install.
5. **Server capacity** — Confirm with the actual RAM/CPU numbers from §6 before installing, since this server already runs two other databases.
