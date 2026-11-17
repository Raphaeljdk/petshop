# Atendimento móvel e vale-presente por telefone

## Balão do WhatsApp no portal do cliente

- Aparece apenas em telas com largura inferior a 768 px; o botão fixo de desktop foi retirado.
- É um link real para o número oficial da Matilha Prado, com abertura por toque normal. Arrastar com o dedo não abre o WhatsApp.
- Arrastar reposiciona dentro das bordas visíveis, sem ultrapassar o topo da navegação mobile inferior.
- Ao soltar, encaixa na borda esquerda ou direita mais próxima.
- A posição e a lateral ficam salvas no `localStorage` do aparelho/navegador.
- Após o primeiro arraste aparece um pequeno botão **Restaurar posição** que retorna ao canto inferior direito seguro.
- Em mudanças de viewport, a posição é ajustada ao espaço disponível; sem armazenamento, o uso segue normal.
- Não altera menu mobile, vendas, login, fluxos de agenda ou o contato oficial.

## Vale-presente digital

- Formulário em `ClientCareHub`: nome do presenteado, **telefone obrigatório** com DDD, valor e mensagem opcional. Não apresenta e-mail.
- API `POST /api/cliente/portal` exige `recipientPhone` válido e rejeita o campo antigo `recipientEmail` em solicitações novas.
- Banco: migração aditiva `PortalGiftRequest.recipientPhone`; armazena `55 + DDD + número`, somente dígitos.
- Campo `recipientEmail` permanece opcional **somente para registros legados**; nenhum vale histórico é apagado.
- A conferência administrativa exibe o telefone do presenteado.
- Resgate: para novos vales, telefone da conta autenticada deve corresponder ao destinatário; vales antigos com e-mail continuam usando o vínculo original. Não há liberação automática de pagamento ou de vales.
- Continua exigida conferência de pagamento pela equipe e a proteção por `PORTAL_GIFT_REDEMPTION_ENABLED`.

## Validação

- `bun test tests/mobile-whatsapp-position.test.ts`
- `bun test tests/portal-gift-phone.test.ts`
- `bun test tests/portal-gift-credit-phone.test.ts`
- `bun run typecheck`; `bun run lint`; build da Vercel.
- Validação visual em celular: trocar de aba, arrastar ao lado oposto, soltar, recarregar, tocar, restaurar, ajustar tamanho da tela e confirmar que a barra inferior não fica coberta.
- Validação de vale: telefone ausente/inválido, solicitação válida, persistência, exibição administrativa, resgate por conta com telefone igual e bloqueio para conta de telefone diferente. Integração com banco isolado em `tests/portal-financeiro.integration.test.ts`.
