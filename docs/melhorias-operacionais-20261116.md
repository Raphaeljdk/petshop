# Matilha Prado — melhorias operacionais para homologação (16/11/2026)

PR #122 · branch feat/matilha-operacao-inteligente-20261116

**Liberação:** revisão em PR; não integrar na main nem publicar até homologação.

## O que foi desenvolvido e o que ainda falta

| Melhoria | Implementado | Limitação |
| --- | --- | --- |
| Catálogo | Diagnóstico de imagens ausentes, marcas, cadastro e anúncios com mesmo SKU + nome; reutiliza filtros existentes | Não exclui anúncios nem substitui imagens |
| Marketplaces | Compara saldos armazenados das fontes vinculadas e mostra última sincronização | Diferença não confirma erro; preço externo requer consulta às APIs |
| Pendências | Central com filtros, indicadores e atalhos na Visão geral | Dados locais, não consulta ao marketplace em tempo real |
| Fiscal | Status, erros e orientações gerais, sem emitir nota | Regras e emissão dependem de homologação e contabilidade |
| Margem | Simulador de resultado por plataforma com todos os custos explicitamente preenchidos | Lucro histórico real depende de CMV, taxas, impostos e estornos efetivos por pedido |
| Agenda | Aponta e bloqueia na API o mesmo profissional no horário exato | Sem duração do serviço, ainda não cobre sobreposição de intervalos nem corrida simultânea |
| Relacionamento | Favoritos, lembretes, aniversariantes e mensagens para copiar e revisar | Sem envios automáticos; verificar consentimento antes do contato |
| Interface | Painel responsivo, filtros e estados de carregamento nas telas existentes | Redesign completo do ERP não realizado |

## Aceite em homologação

1. Entrar como ADMIN na Visão geral e conferir os números; usuário CLIENTE deve ter acesso negado ao endpoint administrativo.
2. Confirmar contagem de produtos sem foto, marcas não identificadas e espelhamento de anúncios; nada deve ser excluído.
3. Conferir divergências com Zetta, Mercado Livre e Amazon antes de interpretar como erro; nenhum saldo deverá ser alterado.
4. Abrir Fiscal e Notas a partir do painel. Verificar mensagens sem transmitir XML ou reservar numeração.
5. Criar um agendamento com profissional e horário; outro pet com o mesmo profissional e horário deve receber HTTP 409; profissional diferente é permitido.
6. Testar margem preenchendo todos os valores, incluindo zero somente se confirmado, e verificando lucro negativo.
7. Copiar mensagem de aniversário e confirmar que não houve envio.
8. Validar desktop, celular, navegação por teclado, erros de rede e atualização.
9. Verificar CI: lint, TypeScript, build, testes operacionais e autenticação.

## Trabalho necessário para concluir integralmente as oito propostas

- Comparação de preço atual por anúncio nas APIs de Mercado Livre/Amazon e reconciliação auditável.
- Persistir custos por item/venda, taxas reais, impostos, frete e estornos para margem efetiva por marketplace.
- Duração e buffers dos serviços, validação de sobreposição e proteção transacional contra concorrência na agenda.
- Consentimento para mensagens, templates aprovados, integração com provedor autorizado e descadastro.
- Revisão contábil e fiscal independente para habilitar NF-e própria.

A central é somente leitura e não altera marketplace, estoque real, XML, mensagens ou pagamentos.
