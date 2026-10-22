-- seed/producao.sql — GERADO por scripts/gerar-seed-teste.ts (não editar à mão).
-- Só o padrão da oficina, tudo PROVISÓRIO (a confirmar com o dono em Ajustes): expediente, semáforo, capacidade,
-- checklist de entrada, tipos de reparo, categorias financeiras e pagadores. Nenhum dado de exemplo.
-- Idempotente: rodar de novo não duplica nem sobrescreve o que o dono já mudou.
select set_config('ddoctor.sem_auditoria', 'on', false);

insert into public.oficina (id, nome, fuso, ultimo_numero_os) values
  ('d5281115-1eca-5a77-9846-a4c88e173cf9', 'D doctor', 'America/Sao_Paulo', 0)
on conflict (id) do nothing;

insert into public.config_oficina (oficina_id, expediente, semaforo, capacidade_padrao, alerta_carro, checklist, provisorio, confirmado) values
  ('d5281115-1eca-5a77-9846-a4c88e173cf9', '{"diasSemana":[1,2,3,4,5,6],"inicio":"08:00","fim":"18:00","sabadoFim":"12:00"}'::jsonb, '{"laranjaAntesHoras":8,"vermelhoBloqueioHoras":4,"laranjaFracao":0.8}'::jsonb, '{"vagasEntrada":4,"carrosSimultaneos":12,"pecasDia":10}'::jsonb, '{"laranjaDiasAntes":1,"vermelhoSemEtapaDiasAntes":1,"piscarAtrasado":true,"prazoPadraoDiasUteis":10}'::jsonb, '[{"id":"doc_crlv","grupo":"Documentos e chaves","nome":"Documento do veículo (CRLV)","ativo":true},{"id":"chave_principal","grupo":"Documentos e chaves","nome":"Chave principal","ativo":true},{"id":"chave_reserva","grupo":"Documentos e chaves","nome":"Chave reserva","ativo":true},{"id":"manual","grupo":"Documentos e chaves","nome":"Manual do proprietário","ativo":true},{"id":"controle_alarme","grupo":"Documentos e chaves","nome":"Controle de alarme ou portão","ativo":true},{"id":"estepe","grupo":"Itens de série","nome":"Estepe","ativo":true},{"id":"macaco","grupo":"Itens de série","nome":"Macaco","ativo":true},{"id":"chave_roda","grupo":"Itens de série","nome":"Chave de roda","ativo":true},{"id":"triangulo","grupo":"Itens de série","nome":"Triângulo","ativo":true},{"id":"tapetes","grupo":"Itens de série","nome":"Tapetes","ativo":true},{"id":"antena","grupo":"Itens de série","nome":"Antena","ativo":true},{"id":"farois","grupo":"Funcionamento","nome":"Faróis e lanternas","ativo":true},{"id":"setas_freio","grupo":"Funcionamento","nome":"Setas e luz de freio","ativo":true},{"id":"vidros_travas","grupo":"Funcionamento","nome":"Vidros e travas elétricas","ativo":true},{"id":"ar_condicionado","grupo":"Funcionamento","nome":"Ar-condicionado","ativo":true},{"id":"painel_alertas","grupo":"Funcionamento","nome":"Painel sem luz de advertência","ativo":true},{"id":"parabrisa","grupo":"Conservação","nome":"Para-brisa sem trinca","ativo":true},{"id":"retrovisores","grupo":"Conservação","nome":"Retrovisores inteiros","ativo":true},{"id":"rodas_pneus","grupo":"Conservação","nome":"Rodas e pneus","ativo":true},{"id":"interior","grupo":"Conservação","nome":"Interior sem danos","ativo":true},{"id":"objetos_valor","grupo":"Conservação","nome":"Sem objetos de valor no veículo","ativo":true}]'::jsonb, true, '{}'::jsonb)
on conflict (oficina_id) do nothing;

insert into public.tipo_reparo (id, oficina_id, nome, etapas, provisorio, ativo, ordem) values
  ('97853a57-0e67-5b3d-8898-34f383f7ebb3', 'd5281115-1eca-5a77-9846-a4c88e173cf9', 'Martelinho', '[{"ordem":1,"nome":"Desmontagem","prazoPadraoHoras":2,"dispensavel":true,"exigeFoto":false,"exigeContagemPecas":false},{"ordem":2,"nome":"Martelinho","prazoPadraoHoras":4,"dispensavel":false,"exigeFoto":true,"exigeContagemPecas":true},{"ordem":3,"nome":"Polimento","prazoPadraoHoras":2,"dispensavel":false,"exigeFoto":false,"exigeContagemPecas":false},{"ordem":4,"nome":"Montagem e revisão","prazoPadraoHoras":2,"dispensavel":false,"exigeFoto":true,"exigeContagemPecas":false}]'::jsonb, true, true, 1),
  ('8d1e7ed9-1681-5678-9d9b-37db4d7cb7de', 'd5281115-1eca-5a77-9846-a4c88e173cf9', 'Funilaria e pintura', '[{"ordem":1,"nome":"Desmontagem","prazoPadraoHoras":2,"dispensavel":false,"exigeFoto":false,"exigeContagemPecas":false},{"ordem":2,"nome":"Funilaria","prazoPadraoHoras":4,"dispensavel":true,"exigeFoto":true,"exigeContagemPecas":true},{"ordem":3,"nome":"Preparação","prazoPadraoHoras":4,"dispensavel":false,"exigeFoto":false,"exigeContagemPecas":false},{"ordem":4,"nome":"Pintura","prazoPadraoHoras":8,"dispensavel":false,"exigeFoto":true,"exigeContagemPecas":true},{"ordem":5,"nome":"Polimento","prazoPadraoHoras":2,"dispensavel":false,"exigeFoto":false,"exigeContagemPecas":false},{"ordem":6,"nome":"Montagem","prazoPadraoHoras":2,"dispensavel":false,"exigeFoto":true,"exigeContagemPecas":false}]'::jsonb, true, true, 2),
  ('4cd89c38-a9ce-5715-936f-ed01d04d4ea6', 'd5281115-1eca-5a77-9846-a4c88e173cf9', 'Pintura', '[{"ordem":1,"nome":"Desmontagem","prazoPadraoHoras":2,"dispensavel":false,"exigeFoto":false,"exigeContagemPecas":false},{"ordem":2,"nome":"Preparação","prazoPadraoHoras":4,"dispensavel":false,"exigeFoto":false,"exigeContagemPecas":false},{"ordem":3,"nome":"Pintura","prazoPadraoHoras":8,"dispensavel":false,"exigeFoto":true,"exigeContagemPecas":true},{"ordem":4,"nome":"Polimento","prazoPadraoHoras":2,"dispensavel":false,"exigeFoto":false,"exigeContagemPecas":false},{"ordem":5,"nome":"Montagem","prazoPadraoHoras":2,"dispensavel":false,"exigeFoto":true,"exigeContagemPecas":false}]'::jsonb, true, true, 3),
  ('7c716cb3-db4e-503b-b720-4631c35119a1', 'd5281115-1eca-5a77-9846-a4c88e173cf9', 'SRA (arranhões)', '[{"ordem":1,"nome":"Preparação","prazoPadraoHoras":2,"dispensavel":false,"exigeFoto":false,"exigeContagemPecas":false},{"ordem":2,"nome":"Pintura localizada","prazoPadraoHoras":4,"dispensavel":false,"exigeFoto":true,"exigeContagemPecas":true},{"ordem":3,"nome":"Polimento","prazoPadraoHoras":2,"dispensavel":false,"exigeFoto":true,"exigeContagemPecas":false}]'::jsonb, true, true, 4),
  ('f5d5ba1c-4cb6-548d-ab36-90c50655890e', 'd5281115-1eca-5a77-9846-a4c88e173cf9', 'Polimento e higienização', '[{"ordem":1,"nome":"Polimento","prazoPadraoHoras":4,"dispensavel":true,"exigeFoto":false,"exigeContagemPecas":false},{"ordem":2,"nome":"Higienização","prazoPadraoHoras":3,"dispensavel":true,"exigeFoto":true,"exigeContagemPecas":false}]'::jsonb, true, true, 5)
on conflict (id) do nothing;

insert into public.categoria_financeira (id, oficina_id, nome, tipo, ativa) values
  ('0286659e-68a4-52f3-99ff-f6ce3eb68aaf', 'd5281115-1eca-5a77-9846-a4c88e173cf9', 'Serviços particulares', 'receita', true),
  ('8823526a-7db2-5660-9cc0-c06990573094', 'd5281115-1eca-5a77-9846-a4c88e173cf9', 'Assistência / seguradora', 'receita', true),
  ('d66fe1f7-6b1b-5dbc-8589-0cd7fb6e5f29', 'd5281115-1eca-5a77-9846-a4c88e173cf9', 'Franquias', 'receita', true),
  ('0ad28bcf-63d1-56cb-9799-515e72097724', 'd5281115-1eca-5a77-9846-a4c88e173cf9', 'Outras receitas', 'receita', true),
  ('ac438d77-5e42-57ea-a3cf-030ca611857d', 'd5281115-1eca-5a77-9846-a4c88e173cf9', 'Aluguel', 'despesa', true),
  ('69b4194d-cb82-5610-a120-558985945174', 'd5281115-1eca-5a77-9846-a4c88e173cf9', 'Energia e água', 'despesa', true),
  ('d67f2293-136a-5928-aeb6-be235d0dc15f', 'd5281115-1eca-5a77-9846-a4c88e173cf9', 'Material de pintura', 'despesa', true),
  ('3cddcc6a-ad76-5f0e-b560-7f4e58911413', 'd5281115-1eca-5a77-9846-a4c88e173cf9', 'Material de polimento', 'despesa', true),
  ('9aa3e481-ab5a-5164-a9ed-24c59e7310a3', 'd5281115-1eca-5a77-9846-a4c88e173cf9', 'Ferramentas', 'despesa', true),
  ('80efdf7b-abee-5abb-bca6-bfdacae7bfcc', 'd5281115-1eca-5a77-9846-a4c88e173cf9', 'Salários e pró-labore', 'despesa', true),
  ('e3b22dd5-7994-5e6d-a67c-54ac92f0a712', 'd5281115-1eca-5a77-9846-a4c88e173cf9', 'Comissões', 'despesa', true),
  ('3ca6f065-ae88-5f43-ad84-0c0d0c5194a1', 'd5281115-1eca-5a77-9846-a4c88e173cf9', 'Serviços de terceiros', 'despesa', true),
  ('5011d4be-def2-56d6-a0c9-a6dec3c25238', 'd5281115-1eca-5a77-9846-a4c88e173cf9', 'Marketing', 'despesa', true),
  ('32c5508c-46cf-5224-9d4c-3887f26a280f', 'd5281115-1eca-5a77-9846-a4c88e173cf9', 'Impostos', 'despesa', true),
  ('02e11b67-d7fe-5dba-a587-8042a24be8c3', 'd5281115-1eca-5a77-9846-a4c88e173cf9', 'Manutenção', 'despesa', true),
  ('96570c63-776f-5194-b668-3a343814d8b6', 'd5281115-1eca-5a77-9846-a4c88e173cf9', 'Outras despesas', 'despesa', true)
on conflict (id) do nothing;

insert into public.pagador (id, oficina_id, nome, tipo, prazo_dias, prazo_base, prazo_dias_uteis, prazo_provisorio, desconta_franquia) values
  ('96895259-c74d-5b37-903f-758305090abc', 'd5281115-1eca-5a77-9846-a4c88e173cf9', 'Maxpar', 'maxpar', 30, 'servico_realizado', false, true, null),
  ('f098e482-0ec8-557e-9d9c-ac710fdc0071', 'd5281115-1eca-5a77-9846-a4c88e173cf9', 'Cliente (particular / franquia)', 'cliente', 0, 'entrega', false, true, null),
  ('979c5c4b-62aa-5b66-bef0-11fc93d10829', 'd5281115-1eca-5a77-9846-a4c88e173cf9', 'Seguradora direta', 'seguradora', 3, 'nf', true, true, null)
on conflict (id) do nothing;

select set_config('ddoctor.sem_auditoria', 'off', false);
