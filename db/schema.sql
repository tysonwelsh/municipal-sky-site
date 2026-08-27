-- O*NET 29.2 schema
-- Extracted from db_29_2_mysql/ dump files (CREATE TABLE statements only, no data).
-- Source data: https://www.onetcenter.org/database.html
-- Regenerate with the one-liner in db/README.md if O*NET version bumps.

-- ─── 01_content_model_reference.sql ───────────────────────
/*! START TRANSACTION */;
CREATE TABLE content_model_reference (
  element_id CHARACTER VARYING(20) NOT NULL,
  element_name CHARACTER VARYING(150) NOT NULL,
  description CHARACTER VARYING(1500) NOT NULL,
  PRIMARY KEY (element_id));
/*! COMMIT */;
/*! START TRANSACTION */;


-- ─── 02_job_zone_reference.sql ───────────────────────
/*! START TRANSACTION */;
CREATE TABLE job_zone_reference (
  job_zone DECIMAL(1,0) NOT NULL,
  name CHARACTER VARYING(50) NOT NULL,
  experience CHARACTER VARYING(300) NOT NULL,
  education CHARACTER VARYING(500) NOT NULL,
  job_training CHARACTER VARYING(300) NOT NULL,
  examples CHARACTER VARYING(500) NOT NULL,
  svp_range CHARACTER VARYING(25) NOT NULL,
  PRIMARY KEY (job_zone));
/*! COMMIT */;
/*! START TRANSACTION */;


-- ─── 03_occupation_data.sql ───────────────────────
/*! START TRANSACTION */;
CREATE TABLE occupation_data (
  onetsoc_code CHARACTER(10) NOT NULL,
  title CHARACTER VARYING(150) NOT NULL,
  description CHARACTER VARYING(1000) NOT NULL,
  PRIMARY KEY (onetsoc_code));
/*! COMMIT */;
/*! START TRANSACTION */;


-- ─── 04_scales_reference.sql ───────────────────────
/*! START TRANSACTION */;
CREATE TABLE scales_reference (
  scale_id CHARACTER VARYING(3) NOT NULL,
  scale_name CHARACTER VARYING(50) NOT NULL,
  minimum DECIMAL(1,0) NOT NULL,
  maximum DECIMAL(3,0) NOT NULL,
  PRIMARY KEY (scale_id));
/*! COMMIT */;
/*! START TRANSACTION */;


-- ─── 05_ete_categories.sql ───────────────────────
/*! START TRANSACTION */;
CREATE TABLE ete_categories (
  element_id CHARACTER VARYING(20) NOT NULL,
  scale_id CHARACTER VARYING(3) NOT NULL,
  category DECIMAL(3,0) NOT NULL,
  category_description CHARACTER VARYING(1000) NOT NULL,
  PRIMARY KEY (element_id, scale_id, category),
  FOREIGN KEY (element_id) REFERENCES content_model_reference(element_id),
  FOREIGN KEY (scale_id) REFERENCES scales_reference(scale_id));
/*! COMMIT */;
/*! START TRANSACTION */;


-- ─── 06_level_scale_anchors.sql ───────────────────────
/*! START TRANSACTION */;
CREATE TABLE level_scale_anchors (
  element_id CHARACTER VARYING(20) NOT NULL,
  scale_id CHARACTER VARYING(3) NOT NULL,
  anchor_value DECIMAL(3,0) NOT NULL,
  anchor_description CHARACTER VARYING(1000) NOT NULL,
  FOREIGN KEY (element_id) REFERENCES content_model_reference(element_id),
  FOREIGN KEY (scale_id) REFERENCES scales_reference(scale_id));
/*! COMMIT */;
/*! START TRANSACTION */;


-- ─── 07_occupation_level_metadata.sql ───────────────────────
/*! START TRANSACTION */;
CREATE TABLE occupation_level_metadata (
  onetsoc_code CHARACTER(10) NOT NULL,
  item CHARACTER VARYING(150) NOT NULL,
  response CHARACTER VARYING(75),
  n DECIMAL(4,0),
  percent DECIMAL(4,1),
  date_updated DATE NOT NULL,
  FOREIGN KEY (onetsoc_code) REFERENCES occupation_data(onetsoc_code));
/*! COMMIT */;
/*! START TRANSACTION */;


-- ─── 08_survey_booklet_locations.sql ───────────────────────
/*! START TRANSACTION */;
CREATE TABLE survey_booklet_locations (
  element_id CHARACTER VARYING(20) NOT NULL,
  survey_item_number CHARACTER VARYING(5) NOT NULL,
  scale_id CHARACTER VARYING(3) NOT NULL,
  FOREIGN KEY (element_id) REFERENCES content_model_reference(element_id),
  FOREIGN KEY (scale_id) REFERENCES scales_reference(scale_id));
/*! COMMIT */;
/*! START TRANSACTION */;


-- ─── 09_task_categories.sql ───────────────────────
/*! START TRANSACTION */;
CREATE TABLE task_categories (
  scale_id CHARACTER VARYING(3) NOT NULL,
  category DECIMAL(3,0) NOT NULL,
  category_description CHARACTER VARYING(1000) NOT NULL,
  PRIMARY KEY (scale_id, category),
  FOREIGN KEY (scale_id) REFERENCES scales_reference(scale_id));
/*! COMMIT */;
/*! START TRANSACTION */;


-- ─── 10_work_context_categories.sql ───────────────────────
/*! START TRANSACTION */;
CREATE TABLE work_context_categories (
  element_id CHARACTER VARYING(20) NOT NULL,
  scale_id CHARACTER VARYING(3) NOT NULL,
  category DECIMAL(3,0) NOT NULL,
  category_description CHARACTER VARYING(1000) NOT NULL,
  PRIMARY KEY (element_id, scale_id, category),
  FOREIGN KEY (element_id) REFERENCES content_model_reference(element_id),
  FOREIGN KEY (scale_id) REFERENCES scales_reference(scale_id));
/*! COMMIT */;
/*! START TRANSACTION */;


-- ─── 11_abilities.sql ───────────────────────
/*! START TRANSACTION */;
CREATE TABLE abilities (
  onetsoc_code CHARACTER(10) NOT NULL,
  element_id CHARACTER VARYING(20) NOT NULL,
  scale_id CHARACTER VARYING(3) NOT NULL,
  data_value DECIMAL(5,2) NOT NULL,
  n DECIMAL(4,0),
  standard_error DECIMAL(7,4),
  lower_ci_bound DECIMAL(7,4),
  upper_ci_bound DECIMAL(7,4),
  recommend_suppress CHARACTER(1),
  not_relevant CHARACTER(1),
  date_updated DATE NOT NULL,
  domain_source CHARACTER VARYING(30) NOT NULL,
  FOREIGN KEY (onetsoc_code) REFERENCES occupation_data(onetsoc_code),
  FOREIGN KEY (element_id) REFERENCES content_model_reference(element_id),
  FOREIGN KEY (scale_id) REFERENCES scales_reference(scale_id));
/*! COMMIT */;
/*! START TRANSACTION */;


-- ─── 12_education_training_experience.sql ───────────────────────
/*! START TRANSACTION */;
CREATE TABLE education_training_experience (
  onetsoc_code CHARACTER(10) NOT NULL,
  element_id CHARACTER VARYING(20) NOT NULL,
  scale_id CHARACTER VARYING(3) NOT NULL,
  category DECIMAL(3,0),
  data_value DECIMAL(5,2) NOT NULL,
  n DECIMAL(4,0),
  standard_error DECIMAL(7,4),
  lower_ci_bound DECIMAL(7,4),
  upper_ci_bound DECIMAL(7,4),
  recommend_suppress CHARACTER(1),
  date_updated DATE NOT NULL,
  domain_source CHARACTER VARYING(30) NOT NULL,
  FOREIGN KEY (onetsoc_code) REFERENCES occupation_data(onetsoc_code),
  FOREIGN KEY (element_id) REFERENCES content_model_reference(element_id),
  FOREIGN KEY (scale_id) REFERENCES scales_reference(scale_id),
  FOREIGN KEY (element_id, scale_id, category) REFERENCES ete_categories(element_id, scale_id, category));
/*! COMMIT */;
/*! START TRANSACTION */;


-- ─── 13_interests.sql ───────────────────────
/*! START TRANSACTION */;
CREATE TABLE interests (
  onetsoc_code CHARACTER(10) NOT NULL,
  element_id CHARACTER VARYING(20) NOT NULL,
  scale_id CHARACTER VARYING(3) NOT NULL,
  data_value DECIMAL(5,2) NOT NULL,
  date_updated DATE NOT NULL,
  domain_source CHARACTER VARYING(30) NOT NULL,
  FOREIGN KEY (onetsoc_code) REFERENCES occupation_data(onetsoc_code),
  FOREIGN KEY (element_id) REFERENCES content_model_reference(element_id),
  FOREIGN KEY (scale_id) REFERENCES scales_reference(scale_id));
/*! COMMIT */;
/*! START TRANSACTION */;


-- ─── 14_job_zones.sql ───────────────────────
/*! START TRANSACTION */;
CREATE TABLE job_zones (
  onetsoc_code CHARACTER(10) NOT NULL,
  job_zone DECIMAL(1,0) NOT NULL,
  date_updated DATE NOT NULL,
  domain_source CHARACTER VARYING(30) NOT NULL,
  FOREIGN KEY (onetsoc_code) REFERENCES occupation_data(onetsoc_code),
  FOREIGN KEY (job_zone) REFERENCES job_zone_reference(job_zone));
/*! COMMIT */;
/*! START TRANSACTION */;


-- ─── 15_knowledge.sql ───────────────────────
/*! START TRANSACTION */;
CREATE TABLE knowledge (
  onetsoc_code CHARACTER(10) NOT NULL,
  element_id CHARACTER VARYING(20) NOT NULL,
  scale_id CHARACTER VARYING(3) NOT NULL,
  data_value DECIMAL(5,2) NOT NULL,
  n DECIMAL(4,0),
  standard_error DECIMAL(7,4),
  lower_ci_bound DECIMAL(7,4),
  upper_ci_bound DECIMAL(7,4),
  recommend_suppress CHARACTER(1),
  not_relevant CHARACTER(1),
  date_updated DATE NOT NULL,
  domain_source CHARACTER VARYING(30) NOT NULL,
  FOREIGN KEY (onetsoc_code) REFERENCES occupation_data(onetsoc_code),
  FOREIGN KEY (element_id) REFERENCES content_model_reference(element_id),
  FOREIGN KEY (scale_id) REFERENCES scales_reference(scale_id));
/*! COMMIT */;
/*! START TRANSACTION */;


-- ─── 16_skills.sql ───────────────────────
/*! START TRANSACTION */;
CREATE TABLE skills (
  onetsoc_code CHARACTER(10) NOT NULL,
  element_id CHARACTER VARYING(20) NOT NULL,
  scale_id CHARACTER VARYING(3) NOT NULL,
  data_value DECIMAL(5,2) NOT NULL,
  n DECIMAL(4,0),
  standard_error DECIMAL(7,4),
  lower_ci_bound DECIMAL(7,4),
  upper_ci_bound DECIMAL(7,4),
  recommend_suppress CHARACTER(1),
  not_relevant CHARACTER(1),
  date_updated DATE NOT NULL,
  domain_source CHARACTER VARYING(30) NOT NULL,
  FOREIGN KEY (onetsoc_code) REFERENCES occupation_data(onetsoc_code),
  FOREIGN KEY (element_id) REFERENCES content_model_reference(element_id),
  FOREIGN KEY (scale_id) REFERENCES scales_reference(scale_id));
/*! COMMIT */;
/*! START TRANSACTION */;


-- ─── 17_task_statements.sql ───────────────────────
/*! START TRANSACTION */;
CREATE TABLE task_statements (
  onetsoc_code CHARACTER(10) NOT NULL,
  task_id DECIMAL(8,0) NOT NULL,
  task CHARACTER VARYING(1000) NOT NULL,
  task_type CHARACTER VARYING(12),
  incumbents_responding DECIMAL(4,0),
  date_updated DATE NOT NULL,
  domain_source CHARACTER VARYING(30) NOT NULL,
  PRIMARY KEY (task_id),
  FOREIGN KEY (onetsoc_code) REFERENCES occupation_data(onetsoc_code));
/*! COMMIT */;
/*! START TRANSACTION */;


-- ─── 18_task_ratings.sql ───────────────────────
/*! START TRANSACTION */;
CREATE TABLE task_ratings (
  onetsoc_code CHARACTER(10) NOT NULL,
  task_id DECIMAL(8,0) NOT NULL,
  scale_id CHARACTER VARYING(3) NOT NULL,
  category DECIMAL(3,0),
  data_value DECIMAL(5,2) NOT NULL,
  n DECIMAL(4,0),
  standard_error DECIMAL(7,4),
  lower_ci_bound DECIMAL(7,4),
  upper_ci_bound DECIMAL(7,4),
  recommend_suppress CHARACTER(1),
  date_updated DATE NOT NULL,
  domain_source CHARACTER VARYING(30) NOT NULL,
  FOREIGN KEY (onetsoc_code) REFERENCES occupation_data(onetsoc_code),
  FOREIGN KEY (task_id) REFERENCES task_statements(task_id),
  FOREIGN KEY (scale_id) REFERENCES scales_reference(scale_id),
  FOREIGN KEY (scale_id, category) REFERENCES task_categories(scale_id, category));
/*! COMMIT */;
/*! START TRANSACTION */;


-- ─── 19_work_activities.sql ───────────────────────
/*! START TRANSACTION */;
CREATE TABLE work_activities (
  onetsoc_code CHARACTER(10) NOT NULL,
  element_id CHARACTER VARYING(20) NOT NULL,
  scale_id CHARACTER VARYING(3) NOT NULL,
  data_value DECIMAL(5,2) NOT NULL,
  n DECIMAL(4,0),
  standard_error DECIMAL(7,4),
  lower_ci_bound DECIMAL(7,4),
  upper_ci_bound DECIMAL(7,4),
  recommend_suppress CHARACTER(1),
  not_relevant CHARACTER(1),
  date_updated DATE NOT NULL,
  domain_source CHARACTER VARYING(30) NOT NULL,
  FOREIGN KEY (onetsoc_code) REFERENCES occupation_data(onetsoc_code),
  FOREIGN KEY (element_id) REFERENCES content_model_reference(element_id),
  FOREIGN KEY (scale_id) REFERENCES scales_reference(scale_id));
/*! COMMIT */;
/*! START TRANSACTION */;


-- ─── 20_work_context.sql ───────────────────────
/*! START TRANSACTION */;
CREATE TABLE work_context (
  onetsoc_code CHARACTER(10) NOT NULL,
  element_id CHARACTER VARYING(20) NOT NULL,
  scale_id CHARACTER VARYING(3) NOT NULL,
  category DECIMAL(3,0),
  data_value DECIMAL(5,2) NOT NULL,
  n DECIMAL(4,0),
  standard_error DECIMAL(7,4),
  lower_ci_bound DECIMAL(7,4),
  upper_ci_bound DECIMAL(7,4),
  recommend_suppress CHARACTER(1),
  not_relevant CHARACTER(1),
  date_updated DATE NOT NULL,
  domain_source CHARACTER VARYING(30) NOT NULL,
  FOREIGN KEY (onetsoc_code) REFERENCES occupation_data(onetsoc_code),
  FOREIGN KEY (element_id) REFERENCES content_model_reference(element_id),
  FOREIGN KEY (scale_id) REFERENCES scales_reference(scale_id),
  FOREIGN KEY (element_id, scale_id, category) REFERENCES work_context_categories(element_id, scale_id, category));
/*! COMMIT */;
/*! START TRANSACTION */;


-- ─── 21_work_styles.sql ───────────────────────
/*! START TRANSACTION */;
CREATE TABLE work_styles (
  onetsoc_code CHARACTER(10) NOT NULL,
  element_id CHARACTER VARYING(20) NOT NULL,
  scale_id CHARACTER VARYING(3) NOT NULL,
  data_value DECIMAL(5,2) NOT NULL,
  n DECIMAL(4,0),
  standard_error DECIMAL(7,4),
  lower_ci_bound DECIMAL(7,4),
  upper_ci_bound DECIMAL(7,4),
  recommend_suppress CHARACTER(1),
  date_updated DATE NOT NULL,
  domain_source CHARACTER VARYING(30) NOT NULL,
  FOREIGN KEY (onetsoc_code) REFERENCES occupation_data(onetsoc_code),
  FOREIGN KEY (element_id) REFERENCES content_model_reference(element_id),
  FOREIGN KEY (scale_id) REFERENCES scales_reference(scale_id));
/*! COMMIT */;
/*! START TRANSACTION */;


-- ─── 22_work_values.sql ───────────────────────
/*! START TRANSACTION */;
CREATE TABLE work_values (
  onetsoc_code CHARACTER(10) NOT NULL,
  element_id CHARACTER VARYING(20) NOT NULL,
  scale_id CHARACTER VARYING(3) NOT NULL,
  data_value DECIMAL(5,2) NOT NULL,
  date_updated DATE NOT NULL,
  domain_source CHARACTER VARYING(30) NOT NULL,
  FOREIGN KEY (onetsoc_code) REFERENCES occupation_data(onetsoc_code),
  FOREIGN KEY (element_id) REFERENCES content_model_reference(element_id),
  FOREIGN KEY (scale_id) REFERENCES scales_reference(scale_id));
/*! COMMIT */;
/*! START TRANSACTION */;


-- ─── 23_iwa_reference.sql ───────────────────────
/*! START TRANSACTION */;
CREATE TABLE iwa_reference (
  element_id CHARACTER VARYING(20) NOT NULL,
  iwa_id CHARACTER VARYING(20) NOT NULL,
  iwa_title CHARACTER VARYING(150) NOT NULL,
  PRIMARY KEY (iwa_id),
  FOREIGN KEY (element_id) REFERENCES content_model_reference(element_id));
/*! COMMIT */;
/*! START TRANSACTION */;


-- ─── 24_dwa_reference.sql ───────────────────────
/*! START TRANSACTION */;
CREATE TABLE dwa_reference (
  element_id CHARACTER VARYING(20) NOT NULL,
  iwa_id CHARACTER VARYING(20) NOT NULL,
  dwa_id CHARACTER VARYING(20) NOT NULL,
  dwa_title CHARACTER VARYING(150) NOT NULL,
  PRIMARY KEY (dwa_id),
  FOREIGN KEY (element_id) REFERENCES content_model_reference(element_id),
  FOREIGN KEY (iwa_id) REFERENCES iwa_reference(iwa_id));
/*! COMMIT */;
/*! START TRANSACTION */;


-- ─── 25_tasks_to_dwas.sql ───────────────────────
/*! START TRANSACTION */;
CREATE TABLE tasks_to_dwas (
  onetsoc_code CHARACTER(10) NOT NULL,
  task_id DECIMAL(8,0) NOT NULL,
  dwa_id CHARACTER VARYING(20) NOT NULL,
  date_updated DATE NOT NULL,
  domain_source CHARACTER VARYING(30) NOT NULL,
  FOREIGN KEY (onetsoc_code) REFERENCES occupation_data(onetsoc_code),
  FOREIGN KEY (task_id) REFERENCES task_statements(task_id),
  FOREIGN KEY (dwa_id) REFERENCES dwa_reference(dwa_id));
/*! COMMIT */;
/*! START TRANSACTION */;


-- ─── 26_emerging_tasks.sql ───────────────────────
/*! START TRANSACTION */;
CREATE TABLE emerging_tasks (
  onetsoc_code CHARACTER(10) NOT NULL,
  task CHARACTER VARYING(1000) NOT NULL,
  category CHARACTER VARYING(8) NOT NULL,
  original_task_id DECIMAL(8,0),
  date_updated DATE NOT NULL,
  domain_source CHARACTER VARYING(30) NOT NULL,
  FOREIGN KEY (onetsoc_code) REFERENCES occupation_data(onetsoc_code),
  FOREIGN KEY (original_task_id) REFERENCES task_statements(task_id));
/*! COMMIT */;
/*! START TRANSACTION */;


-- ─── 27_related_occupations.sql ───────────────────────
/*! START TRANSACTION */;
CREATE TABLE related_occupations (
  onetsoc_code CHARACTER(10) NOT NULL,
  related_onetsoc_code CHARACTER(10) NOT NULL,
  relatedness_tier CHARACTER VARYING(50) NOT NULL,
  related_index DECIMAL(3,0) NOT NULL,
  FOREIGN KEY (onetsoc_code) REFERENCES occupation_data(onetsoc_code),
  FOREIGN KEY (related_onetsoc_code) REFERENCES occupation_data(onetsoc_code));
/*! COMMIT */;
/*! START TRANSACTION */;


-- ─── 28_unspsc_reference.sql ───────────────────────
/*! START TRANSACTION */;
CREATE TABLE unspsc_reference (
  commodity_code DECIMAL(8,0) NOT NULL,
  commodity_title CHARACTER VARYING(150) NOT NULL,
  class_code DECIMAL(8,0) NOT NULL,
  class_title CHARACTER VARYING(150) NOT NULL,
  family_code DECIMAL(8,0) NOT NULL,
  family_title CHARACTER VARYING(150) NOT NULL,
  segment_code DECIMAL(8,0) NOT NULL,
  segment_title CHARACTER VARYING(150) NOT NULL,
  PRIMARY KEY (commodity_code));
/*! COMMIT */;
/*! START TRANSACTION */;


-- ─── 29_alternate_titles.sql ───────────────────────
/*! START TRANSACTION */;
CREATE TABLE alternate_titles (
  onetsoc_code CHARACTER(10) NOT NULL,
  alternate_title CHARACTER VARYING(250) NOT NULL,
  short_title CHARACTER VARYING(150),
  sources CHARACTER VARYING(50) NOT NULL,
  FOREIGN KEY (onetsoc_code) REFERENCES occupation_data(onetsoc_code));
/*! COMMIT */;
/*! START TRANSACTION */;


-- ─── 30_sample_of_reported_titles.sql ───────────────────────
/*! START TRANSACTION */;
CREATE TABLE sample_of_reported_titles (
  onetsoc_code CHARACTER(10) NOT NULL,
  reported_job_title CHARACTER VARYING(150) NOT NULL,
  shown_in_my_next_move CHARACTER(1) NOT NULL,
  FOREIGN KEY (onetsoc_code) REFERENCES occupation_data(onetsoc_code));
/*! COMMIT */;
/*! START TRANSACTION */;


-- ─── 31_technology_skills.sql ───────────────────────
/*! START TRANSACTION */;
CREATE TABLE technology_skills (
  onetsoc_code CHARACTER(10) NOT NULL,
  example CHARACTER VARYING(150) NOT NULL,
  commodity_code DECIMAL(8,0) NOT NULL,
  hot_technology CHARACTER(1) NOT NULL,
  in_demand CHARACTER(1) NOT NULL,
  FOREIGN KEY (onetsoc_code) REFERENCES occupation_data(onetsoc_code),
  FOREIGN KEY (commodity_code) REFERENCES unspsc_reference(commodity_code));
/*! COMMIT */;
/*! START TRANSACTION */;


-- ─── 32_tools_used.sql ───────────────────────
/*! START TRANSACTION */;
CREATE TABLE tools_used (
  onetsoc_code CHARACTER(10) NOT NULL,
  example CHARACTER VARYING(150) NOT NULL,
  commodity_code DECIMAL(8,0) NOT NULL,
  FOREIGN KEY (onetsoc_code) REFERENCES occupation_data(onetsoc_code),
  FOREIGN KEY (commodity_code) REFERENCES unspsc_reference(commodity_code));
/*! COMMIT */;
/*! START TRANSACTION */;


-- ─── 33_abilities_to_work_activities.sql ───────────────────────
/*! START TRANSACTION */;
CREATE TABLE abilities_to_work_activities (
  abilities_element_id CHARACTER VARYING(20) NOT NULL,
  work_activities_element_id CHARACTER VARYING(20) NOT NULL,
  FOREIGN KEY (abilities_element_id) REFERENCES content_model_reference(element_id),
  FOREIGN KEY (work_activities_element_id) REFERENCES content_model_reference(element_id));
/*! COMMIT */;
/*! START TRANSACTION */;


-- ─── 34_abilities_to_work_context.sql ───────────────────────
/*! START TRANSACTION */;
CREATE TABLE abilities_to_work_context (
  abilities_element_id CHARACTER VARYING(20) NOT NULL,
  work_context_element_id CHARACTER VARYING(20) NOT NULL,
  FOREIGN KEY (abilities_element_id) REFERENCES content_model_reference(element_id),
  FOREIGN KEY (work_context_element_id) REFERENCES content_model_reference(element_id));
/*! COMMIT */;
/*! START TRANSACTION */;


-- ─── 35_skills_to_work_activities.sql ───────────────────────
/*! START TRANSACTION */;
CREATE TABLE skills_to_work_activities (
  skills_element_id CHARACTER VARYING(20) NOT NULL,
  work_activities_element_id CHARACTER VARYING(20) NOT NULL,
  FOREIGN KEY (skills_element_id) REFERENCES content_model_reference(element_id),
  FOREIGN KEY (work_activities_element_id) REFERENCES content_model_reference(element_id));
/*! COMMIT */;
/*! START TRANSACTION */;


-- ─── 36_skills_to_work_context.sql ───────────────────────
/*! START TRANSACTION */;
CREATE TABLE skills_to_work_context (
  skills_element_id CHARACTER VARYING(20) NOT NULL,
  work_context_element_id CHARACTER VARYING(20) NOT NULL,
  FOREIGN KEY (skills_element_id) REFERENCES content_model_reference(element_id),
  FOREIGN KEY (work_context_element_id) REFERENCES content_model_reference(element_id));
/*! COMMIT */;
/*! START TRANSACTION */;


-- ─── 37_riasec_keywords.sql ───────────────────────
/*! START TRANSACTION */;
CREATE TABLE riasec_keywords (
  element_id CHARACTER VARYING(20) NOT NULL,
  keyword CHARACTER VARYING(150) NOT NULL,
  keyword_type CHARACTER VARYING(20) NOT NULL,
  FOREIGN KEY (element_id) REFERENCES content_model_reference(element_id));
/*! COMMIT */;
/*! START TRANSACTION */;


-- ─── 38_basic_interests_to_riasec.sql ───────────────────────
/*! START TRANSACTION */;
CREATE TABLE basic_interests_to_riasec (
  basic_interests_element_id CHARACTER VARYING(20) NOT NULL,
  riasec_element_id CHARACTER VARYING(20) NOT NULL,
  FOREIGN KEY (basic_interests_element_id) REFERENCES content_model_reference(element_id),
  FOREIGN KEY (riasec_element_id) REFERENCES content_model_reference(element_id));
/*! COMMIT */;
/*! START TRANSACTION */;


-- ─── 39_interests_illus_activities.sql ───────────────────────
/*! START TRANSACTION */;
CREATE TABLE interests_illus_activities (
  element_id CHARACTER VARYING(20) NOT NULL,
  interest_type CHARACTER VARYING(20) NOT NULL,
  activity CHARACTER VARYING(150) NOT NULL,
  FOREIGN KEY (element_id) REFERENCES content_model_reference(element_id));
/*! COMMIT */;
/*! START TRANSACTION */;


-- ─── 40_interests_illus_occupations.sql ───────────────────────
/*! START TRANSACTION */;
CREATE TABLE interests_illus_occupations (
  element_id CHARACTER VARYING(20) NOT NULL,
  interest_type CHARACTER VARYING(20) NOT NULL,
  onetsoc_code CHARACTER(10) NOT NULL,
  FOREIGN KEY (element_id) REFERENCES content_model_reference(element_id),
  FOREIGN KEY (onetsoc_code) REFERENCES occupation_data(onetsoc_code));
/*! COMMIT */;
/*! START TRANSACTION */;


