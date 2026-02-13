-- Nome completo e telefone do candidato para identificar submissões
ALTER TABLE submissions
  ADD COLUMN IF NOT EXISTS applicant_name TEXT,
  ADD COLUMN IF NOT EXISTS applicant_phone TEXT;

COMMENT ON COLUMN submissions.applicant_name IS 'Nome completo do candidato';
COMMENT ON COLUMN submissions.applicant_phone IS 'Telefone do candidato';
