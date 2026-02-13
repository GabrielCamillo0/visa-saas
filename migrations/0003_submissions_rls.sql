-- OPCIONAL — RLS (Row Level Security) em submissions.
-- A aplicação já restringe por user_id nas APIs; esta migration reforça no banco.
--
-- ATENÇÃO: Não execute esta migration ainda, a menos que a aplicação defina
-- app.current_user_id em cada requisição (na mesma conexão usada nas queries).
-- Caso contrário, todas as queries em submissions retornarão 0 linhas.
--
-- Para ativar no futuro: em cada request que acessa submissions, use uma conexão
-- dedicada e execute: SET LOCAL app.current_user_id = '<user_id>';

ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;

-- Política SELECT: só vê as próprias submissões
CREATE POLICY submissions_select_own
  ON submissions
  FOR SELECT
  USING (user_id = current_setting('app.current_user_id', true));

-- Política INSERT: só pode inserir com user_id = usuário atual
CREATE POLICY submissions_insert_own
  ON submissions
  FOR INSERT
  WITH CHECK (user_id = current_setting('app.current_user_id', true));

-- Política UPDATE: só atualiza as próprias submissões
CREATE POLICY submissions_update_own
  ON submissions
  FOR UPDATE
  USING (user_id = current_setting('app.current_user_id', true));

-- Política DELETE: só remove as próprias submissões
CREATE POLICY submissions_delete_own
  ON submissions
  FOR DELETE
  USING (user_id = current_setting('app.current_user_id', true));
