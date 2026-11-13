-- =====================================================================
-- Procurement - Trabalho 3
-- Banco relacional SQLite. Este arquivo roda toda vez que o servidor sobe
-- (CREATE TABLE IF NOT EXISTS / INSERT OR IGNORE), entao e seguro repetir.
-- Para recriar do zero: apague server/data/procurement.db (npm run db:reset).
-- =====================================================================

PRAGMA foreign_keys = ON;

-- Usuarios do sistema e seu PAPEL (usado pelo RBAC da maquina de estados)
CREATE TABLE IF NOT EXISTS usuarios (
  id    INTEGER PRIMARY KEY AUTOINCREMENT,
  nome  TEXT    NOT NULL,
  papel TEXT    NOT NULL CHECK (papel IN ('SOLICITANTE', 'COMPRADOR', 'GESTOR', 'DIRETOR'))
);

-- Alcadas de aprovacao CONFIGURAVEIS (nenhum id de usuario fica fixo no codigo).
-- A faixa usada e a de MAIOR valor_minimo que seja <= valor total da compra.
CREATE TABLE IF NOT EXISTS alcadas (
  id                       INTEGER PRIMARY KEY AUTOINCREMENT,
  valor_minimo             REAL    NOT NULL UNIQUE CHECK (valor_minimo >= 0),
  aprovacoes_necessarias   INTEGER NOT NULL CHECK (aprovacoes_necessarias >= 1),
  solicitante_pode_aprovar INTEGER NOT NULL DEFAULT 0 CHECK (solicitante_pode_aprovar IN (0, 1))
);

-- Requisicao de compra (entidade principal da maquina de estados)
CREATE TABLE IF NOT EXISTS requisicoes (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  titulo         TEXT    NOT NULL CHECK (length(trim(titulo)) > 0),
  item           TEXT    NOT NULL CHECK (length(trim(item)) > 0),
  quantidade     INTEGER NOT NULL CHECK (quantidade > 0),
  centro_custo   TEXT    NOT NULL,
  prioridade     TEXT    NOT NULL CHECK (prioridade IN ('BAIXA', 'MEDIA', 'ALTA')),
  justificativa  TEXT,
  status         TEXT    NOT NULL DEFAULT 'ABERTA' CHECK (status IN (
                   'ABERTA', 'AGUARDANDO_APROVACAO', 'EM_AJUSTE', 'APROVADA',
                   'REJEITADA', 'ORDENADA', 'CANCELADA')),
  solicitante_id INTEGER NOT NULL REFERENCES usuarios (id),
  criada_em      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  atualizada_em  TEXT
);

-- Cotacoes (1 requisicao -> N cotacoes). O mesmo fornecedor nao pode cotar 2 vezes.
CREATE TABLE IF NOT EXISTS cotacoes (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  requisicao_id  INTEGER NOT NULL REFERENCES requisicoes (id),
  fornecedor     TEXT    NOT NULL,
  valor_unitario REAL    NOT NULL CHECK (valor_unitario > 0),
  prazo_dias     INTEGER NOT NULL CHECK (prazo_dias >= 1),
  observacao     TEXT,
  registrada_em  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  UNIQUE (requisicao_id, fornecedor)
);

-- Aprovacoes dadas pelos gestores. "ativa = 0" quando a rodada foi invalidada
-- (pedido de ajuste ou cancelamento) - nada e apagado.
CREATE TABLE IF NOT EXISTS aprovacoes (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  requisicao_id INTEGER NOT NULL REFERENCES requisicoes (id),
  aprovador_id  INTEGER NOT NULL REFERENCES usuarios (id),
  justificativa TEXT,
  ativa         INTEGER NOT NULL DEFAULT 1 CHECK (ativa IN (0, 1)),
  aprovada_em   TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

-- Garante no BANCO que o mesmo gestor nao aprova 2x a mesma rodada
-- (alcada de 2 niveis = 2 gestores DIFERENTES).
CREATE UNIQUE INDEX IF NOT EXISTS ux_aprovacao_ativa
  ON aprovacoes (requisicao_id, aprovador_id) WHERE ativa = 1;

-- Ordem de compra (1 requisicao -> no maximo 1 ordem)
CREATE TABLE IF NOT EXISTS ordens_compra (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  numero        TEXT    NOT NULL UNIQUE,
  requisicao_id INTEGER NOT NULL UNIQUE REFERENCES requisicoes (id),
  cotacao_id    INTEGER NOT NULL REFERENCES cotacoes (id),
  valor_total   REAL    NOT NULL CHECK (valor_total > 0),
  emitida_em    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

-- Trilha de auditoria: toda transicao de status gera uma linha aqui,
-- na MESMA transacao do UPDATE do status.
CREATE TABLE IF NOT EXISTS historico_status (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  requisicao_id   INTEGER NOT NULL REFERENCES requisicoes (id),
  estado_anterior TEXT,
  novo_estado     TEXT    NOT NULL,
  acao            TEXT    NOT NULL,
  autor_id        INTEGER NOT NULL REFERENCES usuarios (id),
  justificativa   TEXT,
  criado_em       TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

-- O historico e imutavel: o proprio banco bloqueia UPDATE e DELETE.
CREATE TRIGGER IF NOT EXISTS historico_sem_update
  BEFORE UPDATE ON historico_status
BEGIN
  SELECT RAISE(ABORT, 'O historico de status e imutavel.');
END;

CREATE TRIGGER IF NOT EXISTS historico_sem_delete
  BEFORE DELETE ON historico_status
BEGIN
  SELECT RAISE(ABORT, 'O historico de status e imutavel.');
END;

CREATE INDEX IF NOT EXISTS ix_cotacoes_requisicao  ON cotacoes (requisicao_id);
CREATE INDEX IF NOT EXISTS ix_historico_requisicao ON historico_status (requisicao_id);

-- ---------------------------------------------------------------------
-- Dados iniciais
-- ---------------------------------------------------------------------
INSERT OR IGNORE INTO usuarios (id, nome, papel) VALUES
  (1, 'Ana Souza',    'SOLICITANTE'),
  (2, 'Bruno Lima',   'COMPRADOR'),
  (3, 'Carla Mendes', 'GESTOR'),
  (4, 'Diego Rocha',  'GESTOR'),
  (5, 'Elisa Prado',  'DIRETOR');

-- Alcadas (regra do enunciado):
--   abaixo de R$ 1.000      -> 1 aprovacao (o proprio solicitante gestor pode aprovar)
--   R$ 1.000 a R$ 5.000     -> 1 aprovacao (quem solicitou NAO pode aprovar = teto)
--   acima de R$ 5.000       -> 2 aprovacoes de gestores diferentes
INSERT OR IGNORE INTO alcadas (id, valor_minimo, aprovacoes_necessarias, solicitante_pode_aprovar) VALUES
  (1, 0,       1, 1),
  (2, 1000,    1, 0),
  (3, 5000.01, 2, 0);
