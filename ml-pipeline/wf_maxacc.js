export const meta = {
  name: 'mimic-max-accuracy-all-data',
  description: 'Engineers + researchers design the MAXIMUM-accuracy concurrent-comorbidity system using ALL available data (structured + notes + Qwen LLM + graph), debate, leakage-audit, synthesize',
  phases: [
    { title: 'Independent Analysis', detail: '3 ML/NLP eng + 2 data eng + 3 researchers' },
    { title: 'Cross-Examination Debate', detail: 'disciplines challenge each other' },
    { title: 'QA Verification', detail: 'leakage auditor + feasibility auditor' },
    { title: 'Synthesis', detail: 'final architecture + roadmap + honest accuracy ceiling' },
  ],
}

const GROUND = [
  "PROJECT STATE (verified 2026-06-20). Goal: MAXIMUM accuracy using ALL available data.",
  "FRAME (locked): concurrent comorbidity inference — predict CCSR condition categories present in an index admission from leakage-safe intake-style inputs. Clinician-facing (calibration + fairness). Output = ranked differential of ~502 CCSR groups.",
  "DATA AVAILABLE:",
  "1. Full MIMIC-IV v3.x on PostgreSQL (mimic_hosp + mimic_icu). 364,627 patients; 546,028 admissions. Base tables TEXT with _typed siblings.",
  "   diagnoses_icd 6.36M (ICD-9 2.91M + ICD-10 3.46M); prescriptions 20.3M; pharmacy 17.8M; emar 40.4M; poe 48.8M; omr 7.75M (BMI/BP/wt/ht); labevents 158M; microbiologyevents 3.99M; procedures_icd 0.86M; drgcodes 0.76M.",
  "   mimic_icu: chartevents 433M; inputevents 11M; outputevents 5.4M; ingredientevents 14M; procedureevents 0.8M; icustays 94k.",
  "2. NEW — MIMIC-IV-Note v2.2 loading into schema mimic_note (FREE TEXT): discharge (~331k discharge summaries; cols note_id, subject_id, hadm_id, note_type, note_seq, charttime, storetime, text); radiology (~2.3M reports); plus _detail tables. Linked by hadm_id.",
  "   CRITICAL LEAKAGE: discharge summaries are written AT/AFTER discharge and the text EXPLICITLY contains final/discharge diagnoses, hospital course, outcomes. Using a discharge note to predict the SAME admission's diagnoses is catastrophic leakage. BUT notes have dated SECTIONS: Chief Complaint / History of Present Illness / Past Medical History / Medications on Admission describe ARRIVAL; Discharge Diagnosis / Brief Hospital Course / Discharge Medications are post-hoc. No mimic_ed schema — chief complaint exists ONLY inside note text now.",
  "3. SELF-HOSTED LLM: Qwen3.5-9B via vLLM, OpenAI-compatible, 32k ctx, reasoning toggle. GENERATIVE (good for extraction/relation-mining/RAG/synthetic labels). NOT an embedding model — dense embeddings need a separate clinical encoder. A GPU host exists (serves Qwen) = potential training compute.",
  "4. ALREADY BUILT (schema ml): cohort_spine (546k); labels (CCSR multi-label, 502 cats, 99.2% coverage, FAC*/SYM* excluded as targets); feat_prior_dx (prior-admission CCSR history, leakage-safe); feat_vitals; feat_meds (top-500 drugs); split (subject-level 70/15/15). Sparse logistic-regression baseline is the current floor.",
  "OPEN PROBLEMS toward MAX accuracy: (a) use NOTES for max signal WITHOUT leakage; (b) incorporate labevents 158M / chartevents 433M that v1 skipped — accuracy-per-cost; (c) best model family/ensemble (coded-sequence transformers Med-BERT/BEHRT/CEHR-BERT; clinical text encoders ClinicalBERT/GatorTron/Clinical-Longformer; heterogeneous GNN over a KG; fine-tuned LLM) and how to FUSE them; (d) concrete role of Qwen (generative, not embeddings); (e) honest accuracy ceiling — published full-diagnosis SOTA Recall@20 ~0.4-0.5.",
].join("\n");

const ANTIBIAS = "You are ONE independent expert who has NOT seen the others' opinions. Be rigorous, evidence-based, bias-free. Cite specific tables/columns. If something is infeasible or leaky, say so. Optimize for MAXIMUM accuracy but be honest about cost and the ceiling. Do not invent data.";

const FIND = { type: "object", additionalProperties: false,
  required: ["role","recommended_approach","how_to_use_notes_safely","data_to_add","modeling_and_fusion","llm_role","accuracy_estimate","risks","open_questions"],
  properties: {
    role: { type: "string" },
    recommended_approach: { type: "string" },
    how_to_use_notes_safely: { type: "string" },
    data_to_add: { type: "array", items: { type: "string" } },
    modeling_and_fusion: { type: "string" },
    llm_role: { type: "string" },
    accuracy_estimate: { type: "string" },
    risks: { type: "array", items: { type: "string" } },
    open_questions: { type: "array", items: { type: "string" } },
  } };

phase('Independent Analysis');

const prompts = [
  ANTIBIAS + "\nYou are a CLINICAL NLP engineer.\n" + GROUND + "\nFocus: maximum leakage-safe signal from NOTES. Which discharge-summary SECTIONS are admission-time-safe (Chief Complaint/HPI/PMH/Meds-on-Admission) vs post-hoc (Discharge Dx/Hospital Course); how to parse them at ~331k-note scale; which clinical text encoder; how notes become features or a transferable model; radiology too.",
  ANTIBIAS + "\nYou are a SEQUENCE/representation-learning engineer.\n" + GROUND + "\nFocus: coded-event transformers (Med-BERT/BEHRT/CEHR-BERT) over longitudinal coded history for concurrent-comorbidity prediction. Tokenizing MIMIC events, the ICD-9/10 mix, 158M labs, pretraining vs supervised, where this beats/loses to text/graph.",
  ANTIBIAS + "\nYou are a GRAPH ML + MULTIMODAL FUSION engineer.\n" + GROUND + "\nFocus: a heterogeneous KG (patients/admissions/diseases(CCSR)/drugs/labs + LLM-extracted symptom/finding edges from notes) with a GNN, AND how to FUSE graph + coded-sequence + text encoder + tabular into one max-accuracy system (stacking/late/joint). Be explicit about what fusion actually buys.",
  ANTIBIAS + "\nYou are a DATA ENGINEER (scale).\n" + GROUND + "\nFocus: actually USING all data — labevents 158M, chartevents 433M, emar 40M, notes — on this Postgres + one GPU host without intractability. Feature store, accuracy-per-cost per stream, sampling vs full, materialization, realistic compute plan.",
  ANTIBIAS + "\nYou are a DATA ENGINEER (leakage & temporal correctness).\n" + GROUND + "\nFocus: the leakage-safe point-in-time pipeline once notes + labs + chartevents are added. Exact temporal cut for every source (note charttime/storetime vs admittime; labs/vitals before admit; prior-admission notes). Every place adding notes/labs could leak.",
  ANTIBIAS + "\nYou are a RESEARCHER. Use web search.\n" + GROUND + "\nSurvey SOTA on MIMIC-IV diagnosis/comorbidity/phenotype prediction USING CLINICAL NOTES and/or MULTIMODAL fusion. Concrete methods (ClinicalBERT, GatorTron, Clinical-Longformer, MedFuse, fusion papers) and metric ranges; what wins.",
  ANTIBIAS + "\nYou are a RESEARCHER. Use web search.\n" + GROUND + "\nSurvey using LLMs to BUILD medical KNOWLEDGE GRAPHS from clinical text (relation extraction, entity linking to UMLS/SNOMED), GNNs for diagnosis (GRAM, GraphCare, KAT-GNN), and retrieval-augmented LLM diagnosis. What works vs hype; is a self-hosted 9B generative model enough for extraction.",
  ANTIBIAS + "\nYou are a RESEARCHER. Use web search.\n" + GROUND + "\nSurvey clinical LEAKAGE pitfalls with discharge summaries + coded data on MIMIC (why naive note usage inflates metrics) and accepted SECTION-based / admission-time-only protocols. Concrete practices and realistic leakage-corrected numbers.",
];
const flabels = ["nlp-notes","seq-model","graph-fusion","data-scale","data-leakage","research-multimodal","research-kg-gnn","research-leakage"];

const analyses = (await parallel(prompts.map(function (p, i) {
  return function () { return agent(p, { label: flabels[i], phase: 'Independent Analysis', schema: FIND }); };
}))).filter(Boolean);

const brief = analyses.map(function (a, i) {
  return "--- EXPERT " + (i + 1) + " [" + a.role + "] ---\n"
    + "approach: " + a.recommended_approach + "\n"
    + "notes_safely: " + a.how_to_use_notes_safely + "\n"
    + "data_to_add: " + (a.data_to_add || []).join(' | ') + "\n"
    + "modeling_fusion: " + a.modeling_and_fusion + "\n"
    + "llm_role: " + a.llm_role + "\n"
    + "accuracy: " + a.accuracy_estimate + "\n"
    + "risks: " + (a.risks || []).join(' | ');
}).join("\n\n");

log("Collected " + analyses.length + "/8 analyses. Debating.");
phase('Cross-Examination Debate');

const DEB = { type: "object", additionalProperties: false,
  required: ["discipline","agreements","disagreements","refined_position"],
  properties: { discipline: { type: "string" }, agreements: { type: "array", items: { type: "string" } },
    disagreements: { type: "array", items: { type: "string" } }, refined_position: { type: "string" } } };

const debatePairs = [
  ["NLP/TEXT", "Defend max-signal-from-notes; attack any leaky note usage and any plan ignoring section/temporal safety."],
  ["MODELING/FUSION", "Defend the model+fusion choice for peak accuracy; attack over-engineering that won't move the metric and unjustified compute."],
  ["RESEARCH/EVIDENCE", "Adjudicate with published, leakage-corrected evidence; attack inflated accuracy claims and hype."],
];
const debate = (await parallel(debatePairs.map(function (pair) {
  return function () {
    return agent(pair[0] + " panel.\n" + GROUND + "\nStance: " + pair[1]
      + "\nAll independent analyses:\n" + brief
      + "\n\nWhere is real consensus, where are genuine conflicts, what is your refined position? Cite tables.",
      { label: "debate:" + pair[0].split('/')[0], phase: 'Cross-Examination Debate', schema: DEB });
  };
}))).filter(Boolean);

const debateText = debate.map(function (d) {
  return "### " + d.discipline + "\nagree: " + (d.agreements || []).join(' | ')
    + "\ndisagree: " + (d.disagreements || []).join(' | ') + "\nrefined: " + d.refined_position;
}).join("\n\n");

log("Debate done (" + debate.length + "/3). QA verification.");
phase('QA Verification');

const QA = { type: "object", additionalProperties: false,
  required: ["verdicts","leakage_findings","must_fix"],
  properties: { verdicts: { type: "array", items: { type: "string" } },
    leakage_findings: { type: "array", items: { type: "string" } },
    must_fix: { type: "array", items: { type: "string" } } } };

const qaPrompts = [
  "INDEPENDENT QA — LEAKAGE AUDITOR.\n" + GROUND + "\nYou did not participate. Adversarially hunt EVERY way the plan could leak the label, especially via discharge-note sections, note charttime/storetime vs admittime, same-admission labs/meds, prior-vs-current note confusion. Analyses:\n" + brief + "\n\nDebate:\n" + debateText + "\n\nDefault to flagging leaky when uncertain. List must-fix.",
  "INDEPENDENT QA — FEASIBILITY/SCHEMA AUDITOR.\n" + GROUND + "\nVerify claims vs the real schema, scale (158M/433M rows), one GPU host, and that Qwen is generative-not-embedding. Flag intractable/schema-wrong claims and over-optimistic accuracy. Analyses:\n" + brief + "\n\nDebate:\n" + debateText + "\n\nList must-fix.",
];
const qa = (await parallel(qaPrompts.map(function (p, i) {
  return function () { return agent(p, { label: "qa-" + (i + 1), phase: 'QA Verification', schema: QA }); };
}))).filter(Boolean);

const qaText = qa.map(function (q, i) {
  return "### QA " + (i + 1) + "\nverdicts: " + (q.verdicts || []).join(' | ')
    + "\nleakage: " + (q.leakage_findings || []).join(' | ') + "\nmust_fix: " + (q.must_fix || []).join(' | ');
}).join("\n\n");

log("QA done (" + qa.length + "/2). Synthesizing.");
phase('Synthesis');

const SYNTH = { type: "object", additionalProperties: false,
  required: ["executive_summary","target_architecture","notes_usage_protocol","data_layers","models_and_fusion","llm_pipeline","graph_design","compute_plan","leakage_safeguards","accuracy_expectation","roadmap","questions_for_user"],
  properties: {
    executive_summary: { type: "string" },
    target_architecture: { type: "string" },
    notes_usage_protocol: { type: "string" },
    data_layers: { type: "array", items: { type: "string" } },
    models_and_fusion: { type: "string" },
    llm_pipeline: { type: "string" },
    graph_design: { type: "string" },
    compute_plan: { type: "string" },
    leakage_safeguards: { type: "array", items: { type: "string" } },
    accuracy_expectation: { type: "string" },
    roadmap: { type: "array", items: { type: "object", additionalProperties: false,
      required: ["phase","goal","deliverable"],
      properties: { phase: { type: "string" }, goal: { type: "string" }, deliverable: { type: "string" } } } },
    questions_for_user: { type: "array", items: { type: "string" } },
  } };

const synthesis = await agent(
  "You are the LEAD ML ARCHITECT.\n" + GROUND
  + "\nIntegrate (A) analyses, (B) debate, (C) QA verdicts (binding) into the final MAXIMUM-ACCURACY, all-data architecture. Be concrete, leakage-safe, honest about ceiling and compute.\n\n(A) ANALYSES:\n"
  + brief + "\n\n(B) DEBATE:\n" + debateText + "\n\n(C) QA (binding):\n" + qaText + "\n\nProduce the final plan.",
  { label: 'lead-architect', phase: 'Synthesis', schema: SYNTH, effort: 'high' });

return { synthesis: synthesis, qa: qa, n: analyses.length };
