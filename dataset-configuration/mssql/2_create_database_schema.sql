-- ============================================================
-- MIMIC-IV 3.1 — Create Schemas & All Tables
-- Database:  Healthcare-MIMIC-IV  (already created on server)
-- Server:    176.9.16.194,1433
-- Run in SSMS connected to that instance.
-- ============================================================

USE [Healthcare-MIMIC-IV];
GO

-- 2. Create module schemas
IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = 'hosp')
    EXEC('CREATE SCHEMA hosp');
GO
IF NOT EXISTS (SELECT 1 FROM sys.schemas WHERE name = 'icu')
    EXEC('CREATE SCHEMA icu');
GO

-- ============================================================
-- HOSP SCHEMA — 22 tables
-- ============================================================

-- hosp.patients
IF OBJECT_ID('hosp.patients','U') IS NULL
CREATE TABLE hosp.patients (
    subject_id          INT             NOT NULL,
    gender              CHAR(1)         NOT NULL,
    anchor_age          SMALLINT        NOT NULL,
    anchor_year         SMALLINT        NOT NULL,
    anchor_year_group   NVARCHAR(20)    NOT NULL,
    dod                 DATE            NULL,
    CONSTRAINT PK_patients PRIMARY KEY (subject_id)
);
GO

-- hosp.admissions
IF OBJECT_ID('hosp.admissions','U') IS NULL
CREATE TABLE hosp.admissions (
    subject_id              INT             NOT NULL,
    hadm_id                 INT             NOT NULL,
    admittime               DATETIME2(0)    NOT NULL,
    dischtime               DATETIME2(0)    NULL,
    deathtime               DATETIME2(0)    NULL,
    admission_type          NVARCHAR(40)    NOT NULL,
    admit_provider_id       NVARCHAR(10)    NULL,
    admission_location      NVARCHAR(60)    NULL,
    discharge_location      NVARCHAR(60)    NULL,
    insurance               NVARCHAR(30)    NULL,
    language                NVARCHAR(20)    NULL,
    marital_status          NVARCHAR(30)    NULL,
    race                    NVARCHAR(80)    NULL,
    edregtime               DATETIME2(0)    NULL,
    edouttime               DATETIME2(0)    NULL,
    hospital_expire_flag    TINYINT         NOT NULL,
    CONSTRAINT PK_admissions PRIMARY KEY (hadm_id)
);
GO

-- hosp.transfers
IF OBJECT_ID('hosp.transfers','U') IS NULL
CREATE TABLE hosp.transfers (
    subject_id      INT             NOT NULL,
    hadm_id         INT             NULL,
    transfer_id     INT             NOT NULL,
    eventtype       NVARCHAR(20)    NOT NULL,
    careunit        NVARCHAR(60)    NULL,
    intime          DATETIME2(0)    NOT NULL,
    outtime         DATETIME2(0)    NULL,
    CONSTRAINT PK_transfers PRIMARY KEY (transfer_id)
);
GO

-- hosp.services
IF OBJECT_ID('hosp.services','U') IS NULL
CREATE TABLE hosp.services (
    subject_id      INT             NOT NULL,
    hadm_id         INT             NOT NULL,
    transfertime    DATETIME2(0)    NOT NULL,
    prev_service    NVARCHAR(20)    NULL,
    curr_service    NVARCHAR(20)    NOT NULL
);
GO

-- hosp.provider
IF OBJECT_ID('hosp.provider','U') IS NULL
CREATE TABLE hosp.provider (
    provider_id     NVARCHAR(10)    NOT NULL,
    CONSTRAINT PK_provider PRIMARY KEY (provider_id)
);
GO

-- hosp.diagnoses_icd
IF OBJECT_ID('hosp.diagnoses_icd','U') IS NULL
CREATE TABLE hosp.diagnoses_icd (
    subject_id      INT             NOT NULL,
    hadm_id         INT             NOT NULL,
    seq_num         SMALLINT        NOT NULL,
    icd_code        NVARCHAR(10)    NOT NULL,
    icd_version     TINYINT         NOT NULL
);
GO

-- hosp.d_icd_diagnoses
IF OBJECT_ID('hosp.d_icd_diagnoses','U') IS NULL
CREATE TABLE hosp.d_icd_diagnoses (
    icd_code        NVARCHAR(10)    NOT NULL,
    icd_version     TINYINT         NOT NULL,
    long_title      NVARCHAR(300)   NOT NULL,
    CONSTRAINT PK_d_icd_diagnoses PRIMARY KEY (icd_code, icd_version)
);
GO

-- hosp.procedures_icd
IF OBJECT_ID('hosp.procedures_icd','U') IS NULL
CREATE TABLE hosp.procedures_icd (
    subject_id      INT             NOT NULL,
    hadm_id         INT             NOT NULL,
    seq_num         SMALLINT        NOT NULL,
    chartdate       DATE            NOT NULL,
    icd_code        NVARCHAR(10)    NOT NULL,
    icd_version     TINYINT         NOT NULL
);
GO

-- hosp.d_icd_procedures
IF OBJECT_ID('hosp.d_icd_procedures','U') IS NULL
CREATE TABLE hosp.d_icd_procedures (
    icd_code        NVARCHAR(10)    NOT NULL,
    icd_version     TINYINT         NOT NULL,
    long_title      NVARCHAR(300)   NOT NULL,
    CONSTRAINT PK_d_icd_procedures PRIMARY KEY (icd_code, icd_version)
);
GO

-- hosp.hcpcsevents
IF OBJECT_ID('hosp.hcpcsevents','U') IS NULL
CREATE TABLE hosp.hcpcsevents (
    subject_id          INT             NOT NULL,
    hadm_id             INT             NOT NULL,
    chartdate           DATE            NOT NULL,
    hcpcs_cd            NVARCHAR(10)    NOT NULL,
    seq_num             SMALLINT        NOT NULL,
    short_description   NVARCHAR(200)   NULL
);
GO

-- hosp.d_hcpcs
IF OBJECT_ID('hosp.d_hcpcs','U') IS NULL
CREATE TABLE hosp.d_hcpcs (
    code                NVARCHAR(10)    NOT NULL,
    category            SMALLINT        NULL,
    long_description    NVARCHAR(MAX)   NULL,
    short_description   NVARCHAR(200)   NULL,
    CONSTRAINT PK_d_hcpcs PRIMARY KEY (code)
);
GO

-- hosp.drgcodes
IF OBJECT_ID('hosp.drgcodes','U') IS NULL
CREATE TABLE hosp.drgcodes (
    subject_id      INT             NOT NULL,
    hadm_id         INT             NOT NULL,
    drg_type        NVARCHAR(10)    NOT NULL,
    drg_code        NVARCHAR(10)    NOT NULL,
    description     NVARCHAR(200)   NULL,
    drg_severity    TINYINT         NULL,
    drg_mortality   TINYINT         NULL
);
GO

-- hosp.labevents
IF OBJECT_ID('hosp.labevents','U') IS NULL
CREATE TABLE hosp.labevents (
    labevent_id         BIGINT          NOT NULL,
    subject_id          INT             NOT NULL,
    hadm_id             INT             NULL,
    specimen_id         INT             NOT NULL,
    itemid              INT             NOT NULL,
    order_provider_id   NVARCHAR(10)    NULL,
    charttime           DATETIME2(0)    NOT NULL,
    storetime           DATETIME2(0)    NULL,
    value               NVARCHAR(200)   NULL,
    valuenum            FLOAT           NULL,
    valueuom            NVARCHAR(20)    NULL,
    ref_range_lower     FLOAT           NULL,
    ref_range_upper     FLOAT           NULL,
    flag                NVARCHAR(10)    NULL,
    priority            NVARCHAR(10)    NULL,
    comments            NVARCHAR(MAX)   NULL,
    CONSTRAINT PK_labevents PRIMARY KEY (labevent_id)
);
GO

-- hosp.d_labitems
IF OBJECT_ID('hosp.d_labitems','U') IS NULL
CREATE TABLE hosp.d_labitems (
    itemid      INT             NOT NULL,
    label       NVARCHAR(100)   NOT NULL,
    fluid       NVARCHAR(60)    NOT NULL,
    category    NVARCHAR(60)    NOT NULL,
    CONSTRAINT PK_d_labitems PRIMARY KEY (itemid)
);
GO

-- hosp.microbiologyevents
IF OBJECT_ID('hosp.microbiologyevents','U') IS NULL
CREATE TABLE hosp.microbiologyevents (
    microevent_id           BIGINT          NOT NULL,
    subject_id              INT             NOT NULL,
    hadm_id                 INT             NULL,
    micro_specimen_id       INT             NOT NULL,
    order_provider_id       NVARCHAR(10)    NULL,
    chartdate               DATE            NOT NULL,
    charttime               DATETIME2(0)    NULL,
    spec_itemid             INT             NOT NULL,
    spec_type_desc          NVARCHAR(100)   NOT NULL,
    test_seq                SMALLINT        NOT NULL,
    storedate               DATE            NULL,
    storetime               DATETIME2(0)    NULL,
    test_itemid             INT             NULL,
    test_name               NVARCHAR(100)   NULL,
    org_itemid              INT             NULL,
    org_name                NVARCHAR(100)   NULL,
    isolate_num             TINYINT         NULL,
    quantity                NVARCHAR(10)    NULL,
    ab_itemid               INT             NULL,
    ab_name                 NVARCHAR(60)    NULL,
    dilution_text           NVARCHAR(10)    NULL,
    dilution_comparison     NVARCHAR(4)     NULL,
    dilution_value          FLOAT           NULL,
    interpretation          NVARCHAR(6)     NULL,
    comments                NVARCHAR(MAX)   NULL,
    CONSTRAINT PK_microbiologyevents PRIMARY KEY (microevent_id)
);
GO

-- hosp.omr
IF OBJECT_ID('hosp.omr','U') IS NULL
CREATE TABLE hosp.omr (
    subject_id      INT             NOT NULL,
    chartdate       DATE            NOT NULL,
    seq_num         SMALLINT        NOT NULL,
    result_name     NVARCHAR(100)   NOT NULL,
    result_value    NVARCHAR(200)   NOT NULL
);
GO

-- hosp.poe
IF OBJECT_ID('hosp.poe','U') IS NULL
CREATE TABLE hosp.poe (
    poe_id                  NVARCHAR(25)    NOT NULL,
    poe_seq                 INT             NOT NULL,
    subject_id              INT             NOT NULL,
    hadm_id                 INT             NULL,
    ordertime               DATETIME2(0)    NOT NULL,
    order_type              NVARCHAR(30)    NOT NULL,
    order_subtype           NVARCHAR(60)    NULL,
    transaction_type        NVARCHAR(20)    NULL,
    discontinue_of_poe_id   NVARCHAR(25)    NULL,
    discontinued_by_poe_id  NVARCHAR(25)    NULL,
    order_provider_id       NVARCHAR(10)    NULL,
    order_status            NVARCHAR(20)    NULL,
    CONSTRAINT PK_poe PRIMARY KEY (poe_id, poe_seq)
);
GO

-- hosp.poe_detail
IF OBJECT_ID('hosp.poe_detail','U') IS NULL
CREATE TABLE hosp.poe_detail (
    poe_id          NVARCHAR(25)    NOT NULL,
    poe_seq         INT             NOT NULL,
    subject_id      INT             NOT NULL,
    field_name      NVARCHAR(100)   NOT NULL,
    field_value     NVARCHAR(MAX)   NULL
);
GO

-- hosp.prescriptions
IF OBJECT_ID('hosp.prescriptions','U') IS NULL
CREATE TABLE hosp.prescriptions (
    subject_id          INT             NOT NULL,
    hadm_id             INT             NOT NULL,
    pharmacy_id         INT             NOT NULL,
    poe_id              NVARCHAR(25)    NULL,
    poe_seq             INT             NULL,
    order_provider_id   NVARCHAR(10)    NULL,
    starttime           DATETIME2(0)    NULL,
    stoptime            DATETIME2(0)    NULL,
    drug_type           NVARCHAR(20)    NOT NULL,
    drug                NVARCHAR(200)   NOT NULL,
    formulary_drug_cd   NVARCHAR(20)    NULL,
    gsn                 NVARCHAR(200)   NULL,
    ndc                 NVARCHAR(20)    NULL,
    prod_strength       NVARCHAR(200)   NULL,
    form_rx             NVARCHAR(30)    NULL,
    dose_val_rx         NVARCHAR(100)   NULL,
    dose_unit_rx        NVARCHAR(60)    NULL,
    form_val_disp       NVARCHAR(100)   NULL,
    form_unit_disp      NVARCHAR(60)    NULL,
    doses_per_24_hrs    FLOAT           NULL,
    route               NVARCHAR(30)    NULL
);
GO

-- hosp.pharmacy
IF OBJECT_ID('hosp.pharmacy','U') IS NULL
CREATE TABLE hosp.pharmacy (
    subject_id          INT             NOT NULL,
    hadm_id             INT             NOT NULL,
    pharmacy_id         INT             NOT NULL,
    poe_id              NVARCHAR(25)    NULL,
    starttime           DATETIME2(0)    NULL,
    stoptime            DATETIME2(0)    NULL,
    medication          NVARCHAR(200)   NULL,
    proc_type           NVARCHAR(60)    NOT NULL,
    status              NVARCHAR(20)    NOT NULL,
    entertime           DATETIME2(0)    NOT NULL,
    verifiedtime        DATETIME2(0)    NULL,
    route               NVARCHAR(30)    NULL,
    frequency           NVARCHAR(60)    NULL,
    disp_sched          NVARCHAR(MAX)   NULL,
    infusion_type       NVARCHAR(10)    NULL,
    sliding_scale       NVARCHAR(1)     NULL,
    lockout_interval    NVARCHAR(30)    NULL,
    basal_rate          FLOAT           NULL,
    one_hr_max          NVARCHAR(20)    NULL,
    doses_per_24_hrs    FLOAT           NULL,
    duration            FLOAT           NULL,
    duration_interval   NVARCHAR(20)    NULL,
    expiration_value    FLOAT           NULL,
    expiration_unit     NVARCHAR(20)    NULL,
    expirationdate      DATETIME2(0)    NULL,
    dispensation        NVARCHAR(40)    NULL,
    fill_quantity       NVARCHAR(20)    NULL,
    CONSTRAINT PK_pharmacy PRIMARY KEY (pharmacy_id)
);
GO

-- hosp.emar
IF OBJECT_ID('hosp.emar','U') IS NULL
CREATE TABLE hosp.emar (
    subject_id          INT             NOT NULL,
    hadm_id             INT             NULL,
    emar_id             NVARCHAR(25)    NOT NULL,
    emar_seq            INT             NOT NULL,
    poe_id              NVARCHAR(25)    NULL,
    pharmacy_id         INT             NULL,
    enter_provider_id   NVARCHAR(10)    NULL,
    charttime           DATETIME2(0)    NOT NULL,
    medication          NVARCHAR(200)   NULL,
    event_txt           NVARCHAR(100)   NULL,
    scheduletime        DATETIME2(0)    NULL,
    storetime           DATETIME2(0)    NOT NULL,
    CONSTRAINT PK_emar PRIMARY KEY (emar_id, emar_seq)
);
GO

-- hosp.emar_detail
IF OBJECT_ID('hosp.emar_detail','U') IS NULL
CREATE TABLE hosp.emar_detail (
    subject_id                          INT             NOT NULL,
    emar_id                             NVARCHAR(25)    NOT NULL,
    emar_seq                            INT             NOT NULL,
    parent_field_ordinal                NVARCHAR(10)    NULL,
    administration_type                 NVARCHAR(50)    NULL,
    pharmacy_id                         INT             NULL,
    barcode_type                        NVARCHAR(10)    NULL,
    reason_for_no_barcode               NVARCHAR(200)   NULL,
    complete_dose_not_given             NVARCHAR(1)     NULL,
    dose_due                            NVARCHAR(100)   NULL,
    dose_due_unit                       NVARCHAR(50)    NULL,
    dose_given                          NVARCHAR(100)   NULL,
    dose_given_unit                     NVARCHAR(50)    NULL,
    will_ongoing_dose                   NVARCHAR(1)     NULL,
    product_amount_given                NVARCHAR(50)    NULL,
    product_unit                        NVARCHAR(50)    NULL,
    product_code                        NVARCHAR(30)    NULL,
    product_description                 NVARCHAR(200)   NULL,
    product_description_other          NVARCHAR(200)   NULL,
    prior_infusion_rate                 NVARCHAR(50)    NULL,
    infusion_rate                       NVARCHAR(50)    NULL,
    infusion_rate_adjustment            NVARCHAR(50)    NULL,
    infusion_rate_adjustment_amount     NVARCHAR(50)    NULL,
    infusion_rate_unit                  NVARCHAR(50)    NULL,
    route                               NVARCHAR(30)    NULL,
    infusion_complete                   NVARCHAR(1)     NULL,
    completion_interval                 NVARCHAR(50)    NULL,
    new_iv_bag_hung                     NVARCHAR(1)     NULL,
    continued_infusion_in_other_location NVARCHAR(1)    NULL,
    restart_interval                    NVARCHAR(50)    NULL,
    side                                NVARCHAR(10)    NULL,
    site                                NVARCHAR(60)    NULL,
    non_formulary_visual_verification   NVARCHAR(1)     NULL,
    insurance_type                      NVARCHAR(20)    NULL,
    formula_order_qty                   NVARCHAR(30)    NULL,
    formula_order_unit                  NVARCHAR(30)    NULL,
    refills_remaining                   NVARCHAR(10)    NULL,
    correlation_id                      NVARCHAR(25)    NULL
);
GO

-- ============================================================
-- ICU SCHEMA — 9 tables
-- ============================================================

-- icu.caregiver
IF OBJECT_ID('icu.caregiver','U') IS NULL
CREATE TABLE icu.caregiver (
    caregiver_id    INT     NOT NULL,
    CONSTRAINT PK_caregiver PRIMARY KEY (caregiver_id)
);
GO

-- icu.icustays
IF OBJECT_ID('icu.icustays','U') IS NULL
CREATE TABLE icu.icustays (
    subject_id      INT             NOT NULL,
    hadm_id         INT             NOT NULL,
    stay_id         INT             NOT NULL,
    first_careunit  NVARCHAR(60)    NOT NULL,
    last_careunit   NVARCHAR(60)    NOT NULL,
    intime          DATETIME2(0)    NOT NULL,
    outtime         DATETIME2(0)    NOT NULL,
    los             FLOAT           NOT NULL,
    CONSTRAINT PK_icustays PRIMARY KEY (stay_id)
);
GO

-- icu.d_items
IF OBJECT_ID('icu.d_items','U') IS NULL
CREATE TABLE icu.d_items (
    itemid              INT             NOT NULL,
    label               NVARCHAR(200)   NOT NULL,
    abbreviation        NVARCHAR(100)   NOT NULL,
    linksto             NVARCHAR(30)    NOT NULL,
    category            NVARCHAR(100)   NOT NULL,
    unitname            NVARCHAR(60)    NULL,
    param_type          NVARCHAR(20)    NOT NULL,
    lownormalvalue      FLOAT           NULL,
    highnormalvalue     FLOAT           NULL,
    CONSTRAINT PK_d_items PRIMARY KEY (itemid)
);
GO

-- icu.chartevents
IF OBJECT_ID('icu.chartevents','U') IS NULL
CREATE TABLE icu.chartevents (
    subject_id      INT             NOT NULL,
    hadm_id         INT             NOT NULL,
    stay_id         INT             NOT NULL,
    caregiver_id    INT             NULL,
    charttime       DATETIME2(0)    NOT NULL,
    storetime       DATETIME2(0)    NOT NULL,
    itemid          INT             NOT NULL,
    value           NVARCHAR(200)   NULL,
    valuenum        FLOAT           NULL,
    valueuom        NVARCHAR(20)    NULL,
    warning         TINYINT         NOT NULL
);
GO

-- icu.datetimeevents
IF OBJECT_ID('icu.datetimeevents','U') IS NULL
CREATE TABLE icu.datetimeevents (
    subject_id      INT             NOT NULL,
    hadm_id         INT             NOT NULL,
    stay_id         INT             NOT NULL,
    caregiver_id    INT             NULL,
    charttime       DATETIME2(0)    NOT NULL,
    storetime       DATETIME2(0)    NOT NULL,
    itemid          INT             NOT NULL,
    value           DATETIME2(0)    NOT NULL,
    valueuom        NVARCHAR(20)    NOT NULL,
    warning         TINYINT         NOT NULL
);
GO

-- icu.inputevents
IF OBJECT_ID('icu.inputevents','U') IS NULL
CREATE TABLE icu.inputevents (
    subject_id                      INT             NOT NULL,
    hadm_id                         INT             NOT NULL,
    stay_id                         INT             NOT NULL,
    caregiver_id                    INT             NULL,
    starttime                       DATETIME2(0)    NOT NULL,
    endtime                         DATETIME2(0)    NOT NULL,
    storetime                       DATETIME2(0)    NOT NULL,
    itemid                          INT             NOT NULL,
    amount                          FLOAT           NOT NULL,
    amountuom                       NVARCHAR(20)    NOT NULL,
    rate                            FLOAT           NULL,
    rateuom                         NVARCHAR(20)    NULL,
    orderid                         BIGINT          NOT NULL,
    linkorderid                     BIGINT          NOT NULL,
    ordercategoryname               NVARCHAR(60)    NOT NULL,
    secondaryordercategoryname      NVARCHAR(60)    NULL,
    ordercategorydescription        NVARCHAR(30)    NOT NULL,
    patientweight                   FLOAT           NOT NULL,
    totalamount                     FLOAT           NULL,
    totalamountuom                  NVARCHAR(20)    NULL,
    isopenbag                       TINYINT         NOT NULL,
    continueinnextdept              TINYINT         NOT NULL,
    statusdescription               NVARCHAR(20)    NOT NULL,
    originalamount                  FLOAT           NOT NULL,
    originalrate                    FLOAT           NOT NULL
);
GO

-- icu.outputevents
IF OBJECT_ID('icu.outputevents','U') IS NULL
CREATE TABLE icu.outputevents (
    subject_id      INT             NOT NULL,
    hadm_id         INT             NOT NULL,
    stay_id         INT             NOT NULL,
    caregiver_id    INT             NULL,
    charttime       DATETIME2(0)    NOT NULL,
    storetime       DATETIME2(0)    NOT NULL,
    itemid          INT             NOT NULL,
    value           FLOAT           NOT NULL,
    valueuom        NVARCHAR(20)    NULL
);
GO

-- icu.procedureevents
IF OBJECT_ID('icu.procedureevents','U') IS NULL
CREATE TABLE icu.procedureevents (
    subject_id                  INT             NOT NULL,
    hadm_id                     INT             NOT NULL,
    stay_id                     INT             NOT NULL,
    caregiver_id                INT             NULL,
    starttime                   DATETIME2(0)    NOT NULL,
    endtime                     DATETIME2(0)    NULL,
    storetime                   DATETIME2(0)    NOT NULL,
    itemid                      INT             NOT NULL,
    value                       FLOAT           NOT NULL,
    valueuom                    NVARCHAR(20)    NOT NULL,
    location                    NVARCHAR(100)   NULL,
    locationcategory            NVARCHAR(50)    NULL,
    orderid                     BIGINT          NOT NULL,
    linkorderid                 BIGINT          NOT NULL,
    ordercategoryname           NVARCHAR(60)    NOT NULL,
    ordercategorydescription    NVARCHAR(30)    NOT NULL,
    patientweight               FLOAT           NULL,
    isopenbag                   TINYINT         NOT NULL,
    continueinnextdept          TINYINT         NOT NULL,
    statusdescription           NVARCHAR(20)    NOT NULL,
    originalamount              FLOAT           NOT NULL,
    originalrate                FLOAT           NOT NULL
);
GO

-- icu.ingredientevents
IF OBJECT_ID('icu.ingredientevents','U') IS NULL
CREATE TABLE icu.ingredientevents (
    subject_id          INT             NOT NULL,
    hadm_id             INT             NOT NULL,
    stay_id             INT             NOT NULL,
    caregiver_id        INT             NULL,
    starttime           DATETIME2(0)    NOT NULL,
    endtime             DATETIME2(0)    NOT NULL,
    storetime           DATETIME2(0)    NOT NULL,
    itemid              INT             NOT NULL,
    amount              FLOAT           NOT NULL,
    amountuom           NVARCHAR(20)    NOT NULL,
    rate                FLOAT           NULL,
    rateuom             NVARCHAR(20)    NULL,
    orderid             BIGINT          NOT NULL,
    linkorderid         BIGINT          NOT NULL,
    statusdescription   NVARCHAR(20)    NOT NULL,
    originalamount      FLOAT           NOT NULL,
    originalrate        FLOAT           NOT NULL
);
GO

PRINT 'All schemas and tables created successfully in database Healthcare-MIMIC-IV.';
GO
