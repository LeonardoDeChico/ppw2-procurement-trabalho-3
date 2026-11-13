// Teste de ponta a ponta da API. Suba o backend antes (npm run start:dev) e rode: npm run test:api
// Atencao: cria requisicoes de teste no banco (use npm run db:reset depois, se quiser limpar).
const API = (process.env.API_URL ?? 'http://localhost:8000') + '/procurement';
let falhas = 0;

async function req(metodo, rota, usuario, corpo) {
  const r = await fetch(API + rota, {
    method: metodo,
    headers: { 'Content-Type': 'application/json', ...(usuario ? { 'x-usuario-id': String(usuario) } : {}) },
    body: corpo ? JSON.stringify(corpo) : undefined,
  });
  return { status: r.status, corpo: await r.json().catch(() => null) };
}

function esperar(nome, r, status) {
  const ok = r.status === status;
  if (!ok) falhas++;
  console.log(`${ok ? 'OK ' : 'FALHOU'} ${nome}: ${r.status}${ok ? '' : ' (esperado ' + status + ')'} ${r.corpo?.message ?? r.corpo?.status ?? ''}`);
  return r.corpo;
}

const ANA = 1, BRUNO = 2, CARLA = 3, DIEGO = 4, ELISA = 5;

// --- requisicao grande (> 5000): 2 aprovacoes de gestores diferentes
let r = esperar('criar sem usuario', await req('POST', '/requisicoes', null, { titulo: 'x' }), 401);
r = esperar('criar invalida', await req('POST', '/requisicoes', ANA, { titulo: '', item: 'a', quantidade: 1, centroCusto: 'c', prioridade: 'ALTA' }), 400);
r = esperar('criar', await req('POST', '/requisicoes', ANA, { titulo: 'Notebooks', item: 'Notebook', quantidade: 3, centroCusto: 'CC-10', prioridade: 'ALTA' }), 201);
const id = r.id;
esperar('enviar sem cotacoes', await req('POST', `/requisicoes/${id}/enviar`, BRUNO), 422);
esperar('solicitante cota (RBAC)', await req('POST', `/requisicoes/${id}/cotacoes`, ANA, { fornecedor: 'A', valorUnitario: 10, prazoDias: 1 }), 403);
esperar('cotacao 1', await req('POST', `/requisicoes/${id}/cotacoes`, BRUNO, { fornecedor: 'Dell', valorUnitario: 4000, prazoDias: 5 }), 201);
esperar('cotacao duplicada', await req('POST', `/requisicoes/${id}/cotacoes`, BRUNO, { fornecedor: 'Dell', valorUnitario: 3900, prazoDias: 5 }), 409);
esperar('cotacao 2', await req('POST', `/requisicoes/${id}/cotacoes`, BRUNO, { fornecedor: 'Lenovo', valorUnitario: 3500, prazoDias: 7 }), 201);
esperar('cotacao 3', await req('POST', `/requisicoes/${id}/cotacoes`, BRUNO, { fornecedor: 'HP', valorUnitario: 3800, prazoDias: 3 }), 201);
esperar('cotacao 4 (limite)', await req('POST', `/requisicoes/${id}/cotacoes`, BRUNO, { fornecedor: 'Acer', valorUnitario: 3000, prazoDias: 3 }), 422);
esperar('aprovar antes de enviar', await req('POST', `/requisicoes/${id}/aprovar`, CARLA), 409);
r = esperar('enviar', await req('POST', `/requisicoes/${id}/enviar`, BRUNO), 201);
console.log('   valorTotal', r.valorTotal, 'alcada', JSON.stringify(r.alcada));
esperar('editar em aprovacao', await req('PUT', `/requisicoes/${id}`, ANA, { titulo: 'x', item: 'x', quantidade: 1, centroCusto: 'x', prioridade: 'BAIXA' }), 409);
esperar('comprador aprova (RBAC)', await req('POST', `/requisicoes/${id}/aprovar`, BRUNO), 403);
r = esperar('Carla aprova (1/2)', await req('POST', `/requisicoes/${id}/aprovar`, CARLA, { justificativa: 'ok' }), 201);
console.log('   status apos 1a aprovacao:', r.status);
esperar('Carla aprova de novo', await req('POST', `/requisicoes/${id}/aprovar`, CARLA), 422);
esperar('rejeitar sem justificativa', await req('POST', `/requisicoes/${id}/rejeitar`, DIEGO), 400);
r = esperar('Diego aprova (2/2)', await req('POST', `/requisicoes/${id}/aprovar`, DIEGO), 201);
console.log('   status apos 2a aprovacao:', r.status);
r = esperar('emitir OC', await req('POST', `/requisicoes/${id}/ordem-compra`, BRUNO), 201);
console.log('   OC', JSON.stringify(r.ordemCompra));
esperar('emitir OC de novo', await req('POST', `/requisicoes/${id}/ordem-compra`, BRUNO), 409);
esperar('cancelar ordenada', await req('POST', `/requisicoes/${id}/cancelar`, CARLA, { justificativa: 'x' }), 409);
r = esperar('detalhe', await req('GET', `/requisicoes/${id}`, ANA), 200);
console.log('   historico:', r.historico.map((h) => `${h.estadoAnterior}->${h.novoEstado} (${h.acao}, ${h.autor})`).join(' | '));

// --- teto: gestor que solicitou nao aprova entre 1000 e 5000, mas aprova < 1000
async function montar(usuario, valor) {
  const c = await req('POST', '/requisicoes', usuario, { titulo: 'Teste', item: 'Cadeira', quantidade: 1, centroCusto: 'CC', prioridade: 'BAIXA' });
  const rid = c.corpo.id;
  for (const [i, f] of ['F1', 'F2', 'F3'].entries()) await req('POST', `/requisicoes/${rid}/cotacoes`, BRUNO, { fornecedor: f, valorUnitario: valor + i, prazoDias: 2 });
  await req('POST', `/requisicoes/${rid}/enviar`, BRUNO);
  return rid;
}
const media = await montar(CARLA, 2000);
esperar('Carla aprova a propria (2000) - teto', await req('POST', `/requisicoes/${media}/aprovar`, CARLA), 403);
r = esperar('Elisa aprova (2000) 1/1', await req('POST', `/requisicoes/${media}/aprovar`, ELISA), 201);
console.log('   status:', r.status);

const pequena = await montar(CARLA, 500);
r = esperar('Carla aprova a propria (500)', await req('POST', `/requisicoes/${pequena}/aprovar`, CARLA), 201);
console.log('   status:', r.status);

// --- ajuste e cancelamento
const ajuste = await montar(ANA, 6000);
await req('POST', `/requisicoes/${ajuste}/aprovar`, CARLA);
r = esperar('solicitar ajuste', await req('POST', `/requisicoes/${ajuste}/solicitar-ajuste`, DIEGO, { justificativa: 'Rever qtd' }), 201);
console.log('   status:', r.status, 'aprovacoes ativas:', r.aprovacoes.length);
esperar('Bob? usuario inexistente', await req('POST', `/requisicoes/${ajuste}/enviar`, 99), 401);
esperar('outro solicitante edita? (Carla nao e dona)', await req('PUT', `/requisicoes/${ajuste}`, CARLA, { titulo: 'x', item: 'x', quantidade: 1, centroCusto: 'x', prioridade: 'BAIXA' }), 403);
esperar('Ana edita', await req('PUT', `/requisicoes/${ajuste}`, ANA, { titulo: 'Ajustada', item: 'x', quantidade: 2, centroCusto: 'x', prioridade: 'BAIXA' }), 200);
esperar('reenviar', await req('POST', `/requisicoes/${ajuste}/enviar`, BRUNO), 201);
r = esperar('Carla aprova de novo (nova rodada)', await req('POST', `/requisicoes/${ajuste}/aprovar`, CARLA), 201);
r = esperar('cancelar', await req('POST', `/requisicoes/${ajuste}/cancelar`, ANA, { justificativa: 'Não precisa mais' }), 201);
console.log('   status:', r.status, 'aprovacoes ativas:', r.aprovacoes.length);
esperar('404', await req('GET', `/requisicoes/9999`, ANA), 404);
esperar('lista', await req('GET', `/requisicoes`), 200);

console.log(falhas === 0 ? '\nTODOS OS TESTES PASSARAM' : `\n${falhas} FALHA(S)`);
