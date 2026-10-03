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

A última orientação formal da Zettabrasil informou que a criação direta de agendamento está fora do escopo atual da integração. Por isso:

- o cliente continua enviando uma solicitação de horário pelo Hub;
- a equipe da Matilha Prado registra/confirma o atendimento no Siggma;
- o Hub lê a agenda oficial por `GET /api/animais-historicos`;
- o código da rota direta permanece preparado, mas fica bloqueado por `SIGGMA_AGENDAMENTO_DIRETO_ENABLED=false`.

Somente ativar a rota direta no futuro após liberação formal da Zettabrasil e recebimento do ID real do expediente e dos IDs reais de serviços. Não usar `expediente=1` ou `servicoId=3` dos exemplos técnicos como valores de produção.

## 6. Cadastros Siggma

**Clientes: concluído.** O OpenAPI oficial documenta `POST /api/clientes/importar` para criar ou atualizar clientes. O painel administrativo agora permite criar e editar clientes diretamente no Siggma/Zetta, enviando `dataAtualizacao` no formato exigido e preservando os campos existentes do ERP.

**Pets: pendente da Zettabrasil.** O OpenAPI recebido expõe somente leitura para `/api/animais`, `/api/animais/all` e `/api/animais/{id}`. Não há rota oficial documentada para criar/alterar pets. Enquanto isso, contas vinculadas ao Siggma não gravam pets locais como se fossem oficiais; o cadastro/alteração deve ser feito pela equipe no ERP.


## 7. Convites por e-mail / Resend

O fluxo de convite, ativação e primeiro login está coberto pelos testes automatizados do projeto.

Na verificação de produção de 02/10/2026, o domínio `matilhaprado.com.br` ainda estava em validação no Resend. Antes do teste real de recebimento, confirmar que os registros DKIM/SPF exibidos pelo Resend estão com status **verified**.

Não considerar o teste de convite concluído apenas porque o código passou no CI: o teste final precisa enviar um convite para uma conta controlada, abrir o link, definir a senha e realizar o primeiro login.

## 8. Validação final de produção / Vercel

O código pode ser validado pelo GitHub Actions, mas a validação de variáveis, logs e deployment de produção depende de acesso ao projeto correto na Vercel.

Checar antes da entrega:

- migrations de produção concluídas no build;
- `INTEGRATION_BRIDGE_URL` e `INTEGRATION_BRIDGE_SECRET`;
- credenciais Siggma/Zetta;
- credenciais Mercado Livre e Amazon;
- credenciais de pagamento quando o gateway for reativado;
- `RESEND_API_KEY`, `INVITATION_EMAIL_FROM` e `APP_URL`;
- domínio `www.matilhaprado.com.br` apontando para o deployment final;
- ausência de erros 5xx relevantes nos logs após o deploy.

## 9. Compra controlada de ponta a ponta

O teste final de uma compra deve usar um produto real vinculado ao Zetta e uma forma de pagamento real/controlada. O modo de pagamento simulado valida o Hub, mas não serve para provar a gravação final no ERP.

Checklist:

1. registrar preço e estoque do item no Zetta antes do checkout;
2. criar o carrinho no portal;
3. confirmar que checkout usa preço/estoque revalidados no ERP;
4. aprovar o pagamento controlado;
5. confirmar `siggmaImportStatus=imported` no Hub;
6. confirmar o pedido em `ecommerce_vendas` no Siggma;
7. sincronizar novamente produtos;
8. confirmar a nova quantidade oficial do Zetta no Hub.
