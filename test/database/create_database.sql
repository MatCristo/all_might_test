CREATE DATABASE ti_applications;

\c ti_applications;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

create table roles (
	id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
	name varchar(64) NOT NULL UNIQUE
);

CREATE TABLE users (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
	name varchar(64) NOT NULL UNIQUE,
    email varchar(64) NOT NULL UNIQUE,
    password varchar(128) NOT NULL,
	id_role uuid,
	foreign key (id_role) references roles(id) 
);

-- Access is granted page by page: one row here per page of the panel.
CREATE TABLE permissions (
    id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    name        varchar(64)  NOT NULL UNIQUE,
    label       varchar(64)  NOT NULL,
    -- What the page lets someone do, in the words of whoever grants it.
    description varchar(160) NOT NULL DEFAULT '',
    sort_order  int          NOT NULL DEFAULT 0
);

-- What this person may open.
CREATE TABLE user_permissions (
    id_user       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    id_permission uuid NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (id_user, id_permission)
);

CREATE INDEX idx_user_permissions_user ON user_permissions (id_user);

INSERT INTO public.roles (id, name) VALUES
    ('f47ac10b-58cc-4372-a567-0e02b2c3d479'::uuid, 'admin'),
    ('a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid, 'support');

-- Users for logging into the panel. davi@ and test2@ use the password
-- `davi1234`; teste.admin@ and teste.support@ use `teste1234`.
INSERT INTO public.users (id, name, email, password, id_role) VALUES
    ('d4f58e30-8b2a-47c2-9c15-aa55bbccdd11'::uuid, 'davi gil', 'davi@telelaudo.com.br', '$2a$14$.rmGLNkfr7w8qskLvZmHC.F4Ouo4jO1M6fY5UpgtghcalpxJPWpEO', 'f47ac10b-58cc-4372-a567-0e02b2c3d479'::uuid),
    ('1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed'::uuid, 'test user 2 suporte', 'test2@telelaudo.com.br', '$2a$14$.rmGLNkfr7w8qskLvZmHC.F4Ouo4jO1M6fY5UpgtghcalpxJPWpEO', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid),
    ('11111111-1111-4111-8111-000000000001'::uuid, 'teste admin', 'teste.admin@telelaudo.com.br', '$2a$14$zrk78blc/rPrG4/fn4S3z.bM7BPJJLsGr56WHvASaiO5.a4Ewd9gu', 'f47ac10b-58cc-4372-a567-0e02b2c3d479'::uuid),
    ('11111111-1111-4111-8111-000000000002'::uuid, 'teste support', 'teste.support@telelaudo.com.br', '$2a$14$zrk78blc/rPrG4/fn4S3z.bM7BPJJLsGr56WHvASaiO5.a4Ewd9gu', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'::uuid);

INSERT INTO public.permissions (name, label, description, sort_order) VALUES
    ('page:integracao', 'Integração', 'Logs de entrega e reenvio de laudos', 1);

-- Every seeded user holds Integração.
INSERT INTO public.user_permissions (id_user, id_permission)
SELECT users.id, permissions.id FROM users, permissions;

-- =============================================================================
-- test: the Clinux tables the Integração screen reads, reduced to the columns
-- the code uses.
-- =============================================================================
CREATE DATABASE test;

\c test;

-- One row per delivery attempt of a signed report to a client's system.
CREATE TABLE log_report_delivery (
    id                    INTEGER,
    facility_id           INTEGER,
    service_desc          TEXT,
    "event"               TEXT,
    cd_atendimento        INTEGER,
    http_status_code      INTEGER,
    http_response         TEXT,
    origin_server         TEXT,
    created_at            TIMESTAMP,
    report_selector_value TEXT
);

CREATE TABLE empresas (
    cd_empresa SERIAL PRIMARY KEY,
    ds_empresa VARCHAR(64)
);

CREATE TABLE exames (
    cd_exame       SERIAL PRIMARY KEY,
    cd_atendimento INTEGER
);

-- A signed report. Clearing dt_integracao is what queues it to be sent again.
CREATE TABLE laudos_assinados (
    cd_laudo      INTEGER PRIMARY KEY,
    dt_assinado   TIMESTAMP,
    dt_integracao TIMESTAMP
);

INSERT INTO empresas (cd_empresa, ds_empresa) VALUES
    (1, 'Clínica Saúde Total'),
    (2, 'Saúde Total - Unidade ABC'),
    (3, 'Dr. Silva Cardiologia'),
    (4, 'Laboratório Análises Clínicas'),
    (5, 'Consultório Odontológico'),
    (1082, 'CRD - HOSPITAL Teste'),
    (2067, 'ANDRO HOSPITAL UROLOGICO TESTE'),
    (12345, 'Empresa Teste Integração');

INSERT INTO exames (cd_exame, cd_atendimento) VALUES
    (16819, 937031),
    (16820, 937032),
    (16821, 937033),
    (16822, 937034),
    (16823, 937035),
    (16824, 937036),
    (16825, 937037),
    (16826, 937038),
    (16827, 937039),
    (16828, 937040),
    (16829, 937041),
    (16830, 937042);

-- Every report starts as already delivered (dt_integracao set).
INSERT INTO laudos_assinados (cd_laudo, dt_assinado, dt_integracao) VALUES
    (16819, '2020-06-03 13:55:04.85', '2020-06-03 14:00:04.85'),
    (16820, '2020-06-03 13:55:04.85', '2020-06-03 14:00:04.85'),
    (16821, '2020-06-03 13:55:04.85', '2020-06-03 14:00:04.85'),
    (16822, '2020-06-03 13:55:04.85', '2020-06-03 14:00:04.85'),
    (16823, '2020-06-03 13:55:04.85', '2020-06-03 14:00:04.85'),
    (16824, '2020-06-03 13:55:04.85', '2020-06-03 14:00:04.85'),
    (16825, '2020-06-03 13:55:04.85', '2020-06-03 14:00:04.85'),
    (16826, '2020-06-03 13:55:04.85', '2020-06-03 14:00:04.85'),
    (16827, '2020-06-03 13:55:04.85', '2020-06-03 14:00:04.85'),
    (16828, '2020-06-03 13:55:04.85', '2020-06-03 14:00:04.85'),
    (16829, '2020-06-03 13:55:04.85', '2020-06-03 14:00:04.85'),
    (16830, '2020-06-03 13:55:04.85', '2020-06-03 14:00:04.85');

INSERT INTO log_report_delivery VALUES
    (1, 5, 'Laboratory Results', 'report_sent', 1001, 200, 'OK', 'lab-server-01', '2023-01-15 08:30:45', 'PAT12345'),
    (2, 1, 'Radiology Report', 'report_sent', 1002, 200, 'OK', 'rad-server-01', '2023-01-15 09:15:22', 'PAT12346'),
    (3, 2, 'Discharge Summary', 'delivery_failed', 1003, 404, 'Not Found', 'ehr-server-02', '2023-01-16 10:05:33', 'PAT12347'),
    (4, 3, 'Medication List', 'report_sent', 1004, 200, 'OK', 'pharm-server-01', '2023-01-16 11:22:18', 'PAT12348'),
    (5, 4, 'Operative Report', 'delivery_attempt', 1005, 502, 'Bad Gateway', 'surg-server-01', '2023-01-17 14:30:00', 'PAT12349'),
    (6, 5, 'Pathology Report', 'report_sent', 1006, 200, 'OK', 'path-server-01', '2023-01-18 16:45:12', 'PAT12350'),
    (7, 2, 'Lab Results', 'delivery_failed', 1007, 403, 'Forbidden', 'lab-server-02', '2023-01-19 08:10:05', 'PAT12351'),
    (8, 2, 'Consult Note', 'report_sent', 1008, 200, 'OK', 'ehr-server-01', '2023-01-19 09:25:40', 'PAT12352'),
    (9, 3, 'Progress Note', 'report_sent', 1009, 200, 'OK', 'ehr-server-03', '2023-01-20 10:40:15', 'PAT12353'),
    (10, 1, 'Imaging Report', 'delivery_attempt', 1010, 504, 'Gateway Timeout', 'rad-server-02', '2023-01-21 13:55:30', 'PAT12354'),
    (11, 4, 'Allergy List', 'report_sent', 1011, 200, 'OK', 'ehr-server-01', '2023-01-22 15:10:45', 'PAT12355'),
    (12, 5, 'Lab Results', 'report_sent', 1012, 200, 'OK', 'lab-server-01', '2023-01-23 08:25:10', 'PAT12356'),
    (13, 2, 'Discharge Summary', 'delivery_failed', 1013, 500, 'Internal Server Error', 'ehr-server-02', '2023-01-24 09:40:35', 'PAT12357'),
    (14, 3, 'Prescription', 'report_sent', 1014, 200, 'OK', 'pharm-server-02', '2023-01-25 11:55:50', 'PAT12358'),
    (15, 3, 'Surgical Report', 'report_sent', 1015, 200, 'OK', 'surg-server-02', '2023-01-26 14:10:05', 'PAT12359'),
    (16, 1, 'Pathology Results', 'delivery_attempt', 1016, 408, 'Request Timeout', 'path-server-01', '2023-01-27 16:25:20', 'PAT12360'),
    (17, 5, 'Lab Panel', 'report_sent', 1017, 200, 'OK', 'lab-server-03', '2023-01-28 08:40:35', 'PAT12361'),
    (18, 5, 'Consultation Note', 'delivery_failed', 1018, 401, 'Unauthorized', 'ehr-server-03', '2023-01-29 09:55:50', 'PAT12362'),
    (19, 5, 'Medication Reconciliation', 'report_sent', 1019, 200, 'OK', 'pharm-server-01', '2023-01-30 12:10:05', 'PAT12363'),
    (20, 3, 'Operative Note', 'report_sent', 1020, 200, 'OK', 'surg-server-01', '2023-01-31 14:25:20', 'PAT12364'),
    (21, 2, 'Blood Test Results', 'report_sent', 1021, 200, 'OK', 'lab-server-04', '2023-02-01 08:15:30', 'PAT12365'),
    (22, 1, 'CT Scan Report', 'delivery_failed', 1022, 404, 'Not Found', 'rad-server-03', '2023-02-01 09:30:45', 'PAT12366'),
    (23, 2, 'Admission Note', 'report_sent', 1023, 200, 'OK', 'ehr-server-04', '2023-02-02 10:45:15', 'PAT12367'),
    (24, 3, 'Vaccination Record', 'delivery_attempt', 1024, 503, 'Service Unavailable', 'pharm-server-03', '2023-02-03 12:00:30', 'PAT12368'),
    (25, 2, 'Biopsy Report', 'report_sent', 1025, 200, 'OK', 'path-server-02', '2023-02-04 14:15:45', 'PAT12369'),
    (26, 3, 'Urinalysis Results', 'delivery_failed', 1026, 403, 'Forbidden', 'lab-server-05', '2023-02-05 08:30:00', 'PAT12370'),
    (27, 1, 'MRI Results', 'report_sent', 1027, 200, 'OK', 'rad-server-04', '2023-02-06 09:45:15', 'PAT12371'),
    (28, 4, 'Transfer Summary', 'report_sent', 1028, 200, 'OK', 'ehr-server-05', '2023-02-07 11:00:30', 'PAT12372'),
    (29, 5, 'Immunization History', 'delivery_attempt', 1029, 504, 'Gateway Timeout', 'pharm-server-04', '2023-02-08 13:15:45', 'PAT12373'),
    (30, 5, 'Cytology Report', 'report_sent', 1030, 200, 'OK', 'path-server-03', '2023-02-09 15:30:00', 'PAT12374'),
    (31, 2, 'Hematology Report', 'report_sent', 1031, 200, 'OK', 'lab-server-06', '2023-02-10 08:45:15', 'PAT12375'),
    (32, 4, 'X-ray Report', 'delivery_failed', 1032, 500, 'Internal Server Error', 'rad-server-05', '2023-02-11 10:00:30', 'PAT12376'),
    (33, 1, 'Emergency Note', 'report_sent', 1033, 200, 'OK', 'ehr-server-06', '2023-02-12 12:15:45', 'PAT12377'),
    (34, 1, 'Medication Orders', 'report_sent', 1034, 200, 'OK', 'pharm-server-05', '2023-02-13 14:30:00', 'PAT12378'),
    (35, 4, 'Histology Report', 'delivery_attempt', 1035, 408, 'Request Timeout', 'path-server-04', '2023-02-14 16:45:15', 'PAT12379'),
    (36, 2, 'Microbiology Results', 'report_sent', 1036, 200, 'OK', 'lab-server-07', '2023-02-15 09:00:30', 'PAT12380'),
    (37, 5, 'Ultrasound Report', 'delivery_failed', 1037, 401, 'Unauthorized', 'rad-server-06', '2023-02-16 11:15:45', 'PAT12381'),
    (38, 4, 'Progress Report', 'report_sent', 1038, 200, 'OK', 'ehr-server-07', '2023-02-17 13:30:00', 'PAT12382'),
    (39, 2, 'Prescription Refill', 'report_sent', 1039, 200, 'OK', 'pharm-server-06', '2023-02-18 15:45:15', 'PAT12383'),
    (40, 1, 'Genetic Test Report', 'delivery_attempt', 1040, 502, 'Bad Gateway', 'path-server-05', '2023-02-19 18:00:30', 'PAT12384'),
    (41, 1, 'Codigo existe', 'resend com sucesso', 937031, 502, 'Teste sucesso', 'test-success', '2023-02-19 18:30:30', 'PATSUCESSO');
