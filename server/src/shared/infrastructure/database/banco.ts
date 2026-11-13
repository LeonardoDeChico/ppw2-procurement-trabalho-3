import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { DatabaseSync, SQLInputValue } from 'node:sqlite';

/**
 * Conexao unica com o SQLite (modulo nativo "node:sqlite" do Node 22.5+).
 * - Ao subir, executa database/schema.sql (cria tabelas e dados iniciais).
 * - Toda query passa por aqui e e impressa no terminal com o prefixo [SQL],
 *   para enxergar exatamente o que roda em cada requisicao HTTP.
 */
@Injectable()
export class Banco {
  private readonly db: DatabaseSync;

  constructor() {
    const arquivo = process.env.DB_PATH ?? path.join(process.cwd(), 'data', 'procurement.db');
    fs.mkdirSync(path.dirname(arquivo), { recursive: true });

    this.db = new DatabaseSync(arquivo);
    this.db.exec('PRAGMA foreign_keys = ON;');

    const schema = fs.readFileSync(path.join(process.cwd(), 'database', 'schema.sql'), 'utf-8');
    this.db.exec(schema);
  }

  /** INSERT / UPDATE / DELETE. Devolve o id inserido e quantas linhas mudaram. */
  executar(sql: string, parametros: unknown[] = []): { id: number; linhasAfetadas: number } {
    this.log(sql, parametros);
    const resultado = this.db.prepare(sql).run(...this.normalizar(parametros));

    return { id: Number(resultado.lastInsertRowid), linhasAfetadas: Number(resultado.changes) };
  }

  /** SELECT que devolve uma linha (ou undefined). */
  buscarUm<T>(sql: string, parametros: unknown[] = []): T | undefined {
    this.log(sql, parametros);
    return this.db.prepare(sql).get(...this.normalizar(parametros)) as T | undefined;
  }

  /** SELECT que devolve varias linhas. */
  buscarTodos<T>(sql: string, parametros: unknown[] = []): T[] {
    this.log(sql, parametros);
    return this.db.prepare(sql).all(...this.normalizar(parametros)) as T[];
  }

  /**
   * Transacao ACID: ou tudo dentro de "operacao" e gravado (COMMIT),
   * ou nada e gravado (ROLLBACK) se qualquer erro for lancado.
   * BEGIN IMMEDIATE ja pega o lock de escrita, entao duas transacoes
   * nunca alteram a mesma requisicao ao mesmo tempo.
   */
  transacao<T>(operacao: () => T): T {
    this.log('BEGIN IMMEDIATE');
    this.db.exec('BEGIN IMMEDIATE');

    try {
      const resultado = operacao();
      this.log('COMMIT');
      this.db.exec('COMMIT');
      return resultado;
    } catch (erro) {
      this.log('ROLLBACK');
      this.db.exec('ROLLBACK');
      throw erro;
    }
  }

  // SQLite nao aceita undefined nem boolean como parametro
  private normalizar(parametros: unknown[]): SQLInputValue[] {
    return parametros.map((valor) => {
      if (valor === undefined) return null;
      if (typeof valor === 'boolean') return valor ? 1 : 0;
      return valor as SQLInputValue;
    });
  }

  private log(sql: string, parametros: unknown[] = []): void {
    if (process.env.LOG_SQL === 'false') return;

    const linha = sql.replace(/\s+/g, ' ').trim();
    console.log(`[SQL] ${linha}${parametros.length ? '  ' + JSON.stringify(parametros) : ''}`);
  }
}
