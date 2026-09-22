# Matilha Prado — dados externos ainda necessários para entrega

Este checklist contém apenas itens que dependem do cliente ou de contas de terceiros.
Infraestrutura da Oracle VM não está incluída aqui.

## 1. Google Maps / avaliações

Necessário para exibir avaliações reais do Google na landing page:

- Google Maps Platform API Key com acesso ao serviço de Places/Place Details usado pelo projeto.
- Faturamento ativo no projeto Google Cloud associado à chave.
- Restrição da chave para as APIs necessárias e para o uso do projeto Matilha Prado.

O Place ID da Matilha Prado já está configurado no projeto. Não é necessário pedir novamente, salvo se o cadastro da empresa no Google mudar.

Variável utilizada pelo Hub:

- `GOOGLE_PLACES_API_KEY`

## 2. Correios

Necessário somente para habilitar entrega nacional por Correios. Até lá, o Hub mantém retirada na loja e motoboy conforme a regra atual.

Solicitar ao cliente:

- CNPJ vinculado ao Meu Correios;
- confirmação de conta PJ ativa no Meu Correios;
- número do contrato comercial dos Correios;
- número da DR/Superintendência do contrato, quando aplicável;
- número do cartão de postagem;
- código/chave de acesso às APIs dos Correios (CWS) ou mecanismo oficial equivalente disponibilizado para a conta;
- serviços contratados que deverão aparecer no checkout (ex.: PAC e SEDEX);
- CEP de origem da loja;
- nome/razão social do remetente;
- endereço completo do remetente;
- telefone e e-mail do remetente.

Também confirmar no Siggma que os produtos possuem corretamente:

- peso;
- altura;
- largura;
- comprimento.

Essas medidas serão usadas no cálculo real de frete.

Não solicitar a senha pessoal/principal do Meu Correios se houver código ou chave própria de integração.

## 3. Mercado Pago — confirmar antes da entrada em produção

Se as credenciais de produção ainda não tiverem sido entregues/configuradas, solicitar:

- Access Token de produção;
- Public Key de produção;
- configuração do webhook de pagamentos;
- secret/assinatura do webhook gerada pelo Mercado Pago.

Variáveis do Hub:

- `MERCADO_PAGO_ACCESS_TOKEN`
- `NEXT_PUBLIC_MERCADO_PAGO_PUBLIC_KEY`
- `MERCADO_PAGO_WEBHOOK_SECRET`
- `MERCADO_PAGO_ENABLED=true`

Não solicitar login ou senha da conta Mercado Pago.

## 4. WhatsApp — somente se desejarem automação

Os links e botões de WhatsApp já funcionam sem API.

Somente solicitar credenciais adicionais se o cliente quiser automação de mensagens pelo WhatsApp Business/Cloud API.

## 5. Agendamentos Siggma

Nenhum dado adicional precisa ser solicitado à Matilha Prado neste momento.

A Zettabrasil confirmou oficialmente que:

- `GET /api/animais-historicos` retorna a agenda consolidada da unidade;
- `cliente` e `animal` são filtros opcionais;
- o Hub pode consultar a agenda futura usando `dataInicial`;
- registros com `excluido=true` devem ser ignorados;
- nomes de animal e tutor são cruzados com `/api/animais` e `/api/clientes`;
- não existe atualmente API oficial para criar agendamentos por sistema externo;
- a solicitação de criação pelo Hub foi encaminhada pela Zetta para avaliação da equipe de produto.

Portanto, até nova posição da Zetta, a agenda no Hub é somente leitura e os novos horários são registrados diretamente no Siggma/atendimento da Matilha Prado.
