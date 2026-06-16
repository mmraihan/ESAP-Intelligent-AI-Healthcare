-- ═══════════════════════════════════════════════════════════════
-- MIMIC-IV v3.1 — Typed PostgreSQL Schema
-- Run AFTER load_mimic_to_postgres.py finishes loading data
-- Database: Healthcare-Dataset  (Esap-Remote  176.9.16.194:5434)
-- ═══════════════════════════════════════════════════════════════
-- This recreates tables with proper column types.
-- Tables are loaded as TEXT first for speed/reliability,
-- then this script rebuilds them with correct types.
-- ═══════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────
-- HOSP MODULE
-- ───────────────────────────────────────────────────────────────

-- patients
DROP TABLE IF EXISTS mimic_hosp.patients_typed;
CREATE TABLE mimic_hosp.patients_typed AS
SELECT
    subject_id::INTEGER,
    gender::VARCHAR(1),
    anchor_age::SMALLINT,
    anchor_year::SMALLINT,
    anchor_year_group::VARCHAR(20),
    NULLIF(dod, '')::DATE AS dod
FROM mimic_hosp.patients;

-- admissions
DROP TABLE IF EXISTS mimic_hosp.admissions_typed;
CREATE TABLE mimic_hosp.admissions_typed AS
SELECT
    subject_id::INTEGER,
    hadm_id::INTEGER,
    admittime::TIMESTAMP,
    dischtime::TIMESTAMP,
    NULLIF(deathtime, '')::TIMESTAMP AS deathtime,
    admission_type::VARCHAR(50),
    admit_provider_id::VARCHAR(20),
    admission_location::VARCHAR(60),
    discharge_location::VARCHAR(60),
    insurance::VARCHAR(30),
    language::VARCHAR(20),
    marital_status::VARCHAR(30),
    race::VARCHAR(80),
    NULLIF(edregtime, '')::TIMESTAMP AS edregtime,
    NULLIF(edouttime, '')::TIMESTAMP AS edouttime,
    hospital_expire_flag::SMALLINT
FROM mimic_hosp.admissions;

-- transfers
DROP TABLE IF EXISTS mimic_hosp.transfers_typed;
CREATE TABLE mimic_hosp.transfers_typed AS
SELECT
    subject_id::INTEGER,
    hadm_id::INTEGER,
    transfer_id::INTEGER,
    eventtype::VARCHAR(20),
    careunit::VARCHAR(60),
    NULLIF(intime, '')::TIMESTAMP AS intime,
    NULLIF(outtime, '')::TIMESTAMP AS outtime
FROM mimic_hosp.transfers;

-- diagnoses_icd
DROP TABLE IF EXISTS mimic_hosp.diagnoses_icd_typed;
CREATE TABLE mimic_hosp.diagnoses_icd_typed AS
SELECT
    subject_id::INTEGER,
    hadm_id::INTEGER,
    seq_num::SMALLINT,
    icd_code::VARCHAR(10),
    icd_version::SMALLINT
FROM mimic_hosp.diagnoses_icd;

-- procedures_icd
DROP TABLE IF EXISTS mimic_hosp.procedures_icd_typed;
CREATE TABLE mimic_hosp.procedures_icd_typed AS
SELECT
    subject_id::INTEGER,
    hadm_id::INTEGER,
    seq_num::SMALLINT,
    chartdate::DATE,
    icd_code::VARCHAR(10),
    icd_version::SMALLINT
FROM mimic_hosp.procedures_icd;

-- d_icd_diagnoses
DROP TABLE IF EXISTS mimic_hosp.d_icd_diagnoses_typed;
CREATE TABLE mimic_hosp.d_icd_diagnoses_typed AS
SELECT
    icd_code::VARCHAR(10),
    icd_version::SMALLINT,
    long_title::TEXT
FROM mimic_hosp.d_icd_diagnoses;

-- d_icd_procedures
DROP TABLE IF EXISTS mimic_hosp.d_icd_procedures_typed;
CREATE TABLE mimic_hosp.d_icd_procedures_typed AS
SELECT
    icd_code::VARCHAR(10),
    icd_version::SMALLINT,
    long_title::TEXT
FROM mimic_hosp.d_icd_procedures;

-- d_labitems
DROP TABLE IF EXISTS mimic_hosp.d_labitems_typed;
CREATE TABLE mimic_hosp.d_labitems_typed AS
SELECT
    itemid::INTEGER,
    label::VARCHAR(100),
    fluid::VARCHAR(50),
    category::VARCHAR(50)
FROM mimic_hosp.d_labitems;

-- labevents (large — ~100M rows — takes time)
DROP TABLE IF EXISTS mimic_hosp.labevents_typed;
CREATE TABLE mimic_hosp.labevents_typed AS
SELECT
    labevent_id::BIGINT,
    subject_id::INTEGER,
    hadm_id::INTEGER,
    specimen_id::INTEGER,
    itemid::INTEGER,
    NULLIF(charttime, '')::TIMESTAMP  AS charttime,
    NULLIF(storetime, '')::TIMESTAMP  AS storetime,
    value::TEXT,
    NULLIF(valuenum, '')::NUMERIC     AS valuenum,
    valueuom::VARCHAR(20),
    ref_range_lower::TEXT,
    ref_range_upper::TEXT,
    flag::VARCHAR(20),
    priority::VARCHAR(20),
    comments::TEXT
FROM mimic_hosp.labevents;

-- prescriptions
DROP TABLE IF EXISTS mimic_hosp.prescriptions_typed;
CREATE TABLE mimic_hosp.prescriptions_typed AS
SELECT
    subject_id::INTEGER,
    hadm_id::INTEGER,
    pharmacy_id::INTEGER,
    poe_id::VARCHAR(25),
    poe_seq::INTEGER,
    NULLIF(starttime, '')::TIMESTAMP AS starttime,
    NULLIF(stoptime, '')::TIMESTAMP  AS stoptime,
    drug_type::VARCHAR(20),
    drug::VARCHAR(200),
    formulary_drug_cd::VARCHAR(20),
    gsn::VARCHAR(200),
    ndc::VARCHAR(25),
    prod_strength::VARCHAR(120),
    form_rx::VARCHAR(25),
    dose_val_rx::VARCHAR(25),
    dose_unit_rx::VARCHAR(25),
    form_val_disp::VARCHAR(25),
    form_unit_disp::VARCHAR(60),
    doses_per_24_hrs::NUMERIC,
    route::VARCHAR(25)
FROM mimic_hosp.prescriptions;

-- pharmacy
DROP TABLE IF EXISTS mimic_hosp.pharmacy_typed;
CREATE TABLE mimic_hosp.pharmacy_typed AS
SELECT
    subject_id::INTEGER,
    hadm_id::INTEGER,
    pharmacy_id::INTEGER,
    poe_id::VARCHAR(25),
    NULLIF(starttime, '')::TIMESTAMP AS starttime,
    NULLIF(stoptime, '')::TIMESTAMP  AS stoptime,
    medication::TEXT,
    proc_type::VARCHAR(50),
    status::VARCHAR(20),
    entertime::TIMESTAMP,
    verifiedtime::TIMESTAMP,
    route::VARCHAR(50),
    frequency::VARCHAR(50),
    disp_sched::VARCHAR(200),
    infusion_type::VARCHAR(20),
    sliding_scale::VARCHAR(1),
    lockout_interval::VARCHAR(50),
    basal_rate::NUMERIC,
    one_hr_max::VARCHAR(20),
    doses_per_24_hrs::NUMERIC,
    duration::NUMERIC,
    duration_interval::VARCHAR(20),
    expiration_value::INTEGER,
    expiration_unit::VARCHAR(20),
    expirationdate::TIMESTAMP,
    dispensation::VARCHAR(50),
    fill_quantity::VARCHAR(50)
FROM mimic_hosp.pharmacy;

-- microbiologyevents
DROP TABLE IF EXISTS mimic_hosp.microbiologyevents_typed;
CREATE TABLE mimic_hosp.microbiologyevents_typed AS
SELECT
    microevent_id::INTEGER,
    subject_id::INTEGER,
    hadm_id::INTEGER,
    micro_specimen_id::INTEGER,
    order_provider_id::VARCHAR(20),
    NULLIF(chartdate, '')::DATE      AS chartdate,
    NULLIF(charttime, '')::TIMESTAMP AS charttime,
    spec_itemid::INTEGER,
    spec_type_desc::VARCHAR(100),
    test_seq::INTEGER,
    storedate::DATE,
    storetime::TIMESTAMP,
    test_itemid::INTEGER,
    test_name::VARCHAR(100),
    org_itemid::INTEGER,
    org_name::VARCHAR(100),
    isolate_num::SMALLINT,
    quantity::VARCHAR(50),
    ab_itemid::INTEGER,
    ab_name::VARCHAR(60),
    dilution_text::VARCHAR(10),
    dilution_comparison::VARCHAR(5),
    NULLIF(dilution_value, '')::NUMERIC AS dilution_value,
    interpretation::VARCHAR(5),
    comments::TEXT
FROM mimic_hosp.microbiologyevents;

-- services
DROP TABLE IF EXISTS mimic_hosp.services_typed;
CREATE TABLE mimic_hosp.services_typed AS
SELECT
    subject_id::INTEGER,
    hadm_id::INTEGER,
    transfertime::TIMESTAMP,
    prev_service::VARCHAR(10),
    curr_service::VARCHAR(10)
FROM mimic_hosp.services;

-- ───────────────────────────────────────────────────────────────
-- ICU MODULE
-- ───────────────────────────────────────────────────────────────

-- icustays
DROP TABLE IF EXISTS mimic_icu.icustays_typed;
CREATE TABLE mimic_icu.icustays_typed AS
SELECT
    subject_id::INTEGER,
    hadm_id::INTEGER,
    stay_id::INTEGER,
    first_careunit::VARCHAR(60),
    last_careunit::VARCHAR(60),
    intime::TIMESTAMP,
    outtime::TIMESTAMP,
    NULLIF(los, '')::NUMERIC AS los
FROM mimic_icu.icustays;

-- d_items
DROP TABLE IF EXISTS mimic_icu.d_items_typed;
CREATE TABLE mimic_icu.d_items_typed AS
SELECT
    itemid::INTEGER,
    label::VARCHAR(200),
    abbreviation::VARCHAR(100),
    linksto::VARCHAR(30),
    category::VARCHAR(50),
    unitname::VARCHAR(50),
    param_type::VARCHAR(30),
    lownormalvalue::NUMERIC,
    highnormalvalue::NUMERIC
FROM mimic_icu.d_items;

-- chartevents (LARGEST — 40 GB, ~330M rows — will take longest)
DROP TABLE IF EXISTS mimic_icu.chartevents_typed;
CREATE TABLE mimic_icu.chartevents_typed AS
SELECT
    subject_id::INTEGER,
    hadm_id::INTEGER,
    stay_id::INTEGER,
    caregiver_id::INTEGER,
    charttime::TIMESTAMP,
    storetime::TIMESTAMP,
    itemid::INTEGER,
    value::TEXT,
    NULLIF(valuenum, '')::NUMERIC AS valuenum,
    valueuom::VARCHAR(50),
    warning::SMALLINT
FROM mimic_icu.chartevents;

-- inputevents
DROP TABLE IF EXISTS mimic_icu.inputevents_typed;
CREATE TABLE mimic_icu.inputevents_typed AS
SELECT
    subject_id::INTEGER,
    hadm_id::INTEGER,
    stay_id::INTEGER,
    caregiver_id::INTEGER,
    starttime::TIMESTAMP,
    endtime::TIMESTAMP,
    storetime::TIMESTAMP,
    itemid::INTEGER,
    amount::NUMERIC,
    amountuom::VARCHAR(30),
    rate::NUMERIC,
    rateuom::VARCHAR(30),
    orderid::INTEGER,
    linkorderid::INTEGER,
    ordercategoryname::VARCHAR(100),
    secondaryordercategoryname::VARCHAR(100),
    ordercomponenttypedescription::VARCHAR(200),
    ordercategorydescription::VARCHAR(50),
    patientweight::NUMERIC,
    totalamount::NUMERIC,
    totalamountuom::VARCHAR(50),
    isopenbag::SMALLINT,
    continueinnextdept::SMALLINT,
    statusdescription::VARCHAR(30),
    originalamount::NUMERIC,
    originalrate::NUMERIC
FROM mimic_icu.inputevents;

-- outputevents
DROP TABLE IF EXISTS mimic_icu.outputevents_typed;
CREATE TABLE mimic_icu.outputevents_typed AS
SELECT
    subject_id::INTEGER,
    hadm_id::INTEGER,
    stay_id::INTEGER,
    caregiver_id::INTEGER,
    charttime::TIMESTAMP,
    storetime::TIMESTAMP,
    itemid::INTEGER,
    value::NUMERIC,
    valueuom::VARCHAR(30)
FROM mimic_icu.outputevents;

-- datetimeevents
DROP TABLE IF EXISTS mimic_icu.datetimeevents_typed;
CREATE TABLE mimic_icu.datetimeevents_typed AS
SELECT
    subject_id::INTEGER,
    hadm_id::INTEGER,
    stay_id::INTEGER,
    caregiver_id::INTEGER,
    charttime::TIMESTAMP,
    storetime::TIMESTAMP,
    itemid::INTEGER,
    value::TIMESTAMP,
    valueuom::VARCHAR(50),
    warning::SMALLINT
FROM mimic_icu.datetimeevents;

-- procedureevents
DROP TABLE IF EXISTS mimic_icu.procedureevents_typed;
CREATE TABLE mimic_icu.procedureevents_typed AS
SELECT
    subject_id::INTEGER,
    hadm_id::INTEGER,
    stay_id::INTEGER,
    caregiver_id::INTEGER,
    starttime::TIMESTAMP,
    endtime::TIMESTAMP,
    storetime::TIMESTAMP,
    itemid::INTEGER,
    value::NUMERIC,
    valueuom::VARCHAR(30),
    location::VARCHAR(100),
    locationcategory::VARCHAR(50),
    orderid::INTEGER,
    linkorderid::INTEGER,
    ordercategoryname::VARCHAR(100),
    ordercategorydescription::VARCHAR(50),
    patientweight::NUMERIC,
    isopenbag::SMALLINT,
    continueinnextdept::SMALLINT,
    statusdescription::VARCHAR(30),
    originalamount::NUMERIC,
    originalrate::NUMERIC
FROM mimic_icu.procedureevents;

-- ingredientevents
DROP TABLE IF EXISTS mimic_icu.ingredientevents_typed;
CREATE TABLE mimic_icu.ingredientevents_typed AS
SELECT
    subject_id::INTEGER,
    hadm_id::INTEGER,
    stay_id::INTEGER,
    caregiver_id::INTEGER,
    starttime::TIMESTAMP,
    endtime::TIMESTAMP,
    storetime::TIMESTAMP,
    itemid::INTEGER,
    amount::NUMERIC,
    amountuom::VARCHAR(30),
    rate::NUMERIC,
    rateuom::VARCHAR(30),
    orderid::INTEGER,
    linkorderid::INTEGER,
    statusdescription::VARCHAR(30),
    originalamount::NUMERIC,
    originalrate::NUMERIC
FROM mimic_icu.ingredientevents;

-- caregiver
DROP TABLE IF EXISTS mimic_icu.caregiver_typed;
CREATE TABLE mimic_icu.caregiver_typed AS
SELECT
    caregiver_id::INTEGER
FROM mimic_icu.caregiver;

-- ═══════════════════════════════════════════════════════════════
-- PRIMARY KEYS & INDEXES (run after typed tables are created)
-- ═══════════════════════════════════════════════════════════════

-- patients
ALTER TABLE mimic_hosp.patients_typed ADD PRIMARY KEY (subject_id);

-- admissions
ALTER TABLE mimic_hosp.admissions_typed ADD PRIMARY KEY (hadm_id);
CREATE INDEX idx_admissions_subject  ON mimic_hosp.admissions_typed (subject_id);
CREATE INDEX idx_admissions_admittime ON mimic_hosp.admissions_typed (admittime);

-- diagnoses
CREATE INDEX idx_diagnoses_subject ON mimic_hosp.diagnoses_icd_typed (subject_id);
CREATE INDEX idx_diagnoses_icd     ON mimic_hosp.diagnoses_icd_typed (icd_code);
CREATE INDEX idx_diagnoses_hadm    ON mimic_hosp.diagnoses_icd_typed (hadm_id);

-- labevents
CREATE INDEX idx_labevents_subject   ON mimic_hosp.labevents_typed (subject_id);
CREATE INDEX idx_labevents_itemid    ON mimic_hosp.labevents_typed (itemid);
CREATE INDEX idx_labevents_charttime ON mimic_hosp.labevents_typed (charttime);

-- prescriptions
CREATE INDEX idx_rx_subject ON mimic_hosp.prescriptions_typed (subject_id);
CREATE INDEX idx_rx_drug    ON mimic_hosp.prescriptions_typed (drug);

-- icustays
ALTER TABLE mimic_icu.icustays_typed ADD PRIMARY KEY (stay_id);
CREATE INDEX idx_icustays_subject ON mimic_icu.icustays_typed (subject_id);
CREATE INDEX idx_icustays_hadm    ON mimic_icu.icustays_typed (hadm_id);

-- chartevents (build last — biggest table)
CREATE INDEX idx_chartevents_subject   ON mimic_icu.chartevents_typed (subject_id);
CREATE INDEX idx_chartevents_stay      ON mimic_icu.chartevents_typed (stay_id);
CREATE INDEX idx_chartevents_itemid    ON mimic_icu.chartevents_typed (itemid);
CREATE INDEX idx_chartevents_charttime ON mimic_icu.chartevents_typed (charttime);

-- d_items
ALTER TABLE mimic_icu.d_items_typed ADD PRIMARY KEY (itemid);

-- d_labitems
ALTER TABLE mimic_hosp.d_labitems_typed ADD PRIMARY KEY (itemid);

-- ANALYZE to update query planner statistics
ANALYZE mimic_hosp.patients_typed;
ANALYZE mimic_hosp.admissions_typed;
ANALYZE mimic_hosp.labevents_typed;
ANALYZE mimic_hosp.diagnoses_icd_typed;
ANALYZE mimic_icu.icustays_typed;
ANALYZE mimic_icu.chartevents_typed;
