# Catálogo estético administrável — aguardando dados da Karine

Implementação em 02/11/2026, preparada enquanto se aguarda confirmação operacional e fiscal.

## Como usar

1. Em **Agenda Matilha Prado → Configurar serviços, preços e duração**, abrir a seção de gestão interna (acesso ADMIN).
2. Cada serviço confirmado na conversa aparece com campos vazios para **preço de referência**, **duração**, **variação por porte/pelagem/raça/modalidade** e **observações**.
3. **Salvar** é permitido mesmo quando faltam dados: são rascunhos. Para marcar como **Confirmado**, é obrigatório informar duração mais preço de referência **ou** regra de cobrança.
4. A informação fica persistida em **ServicoEsteticoConfig**, uma tabela nova e aditiva. Nenhum registro de agendamento, venda, estoque, cliente, produto ou fiscal é modificado.
5. **Confirmação interna não publica preços no site, não ativa agenda automática e não gera notas fiscais**. Integração futura de preços/agendamento depende da tabela oficial e decisões da equipe.

## Segurança

- A API GET/PUT está restrita a ADMIN, a escrita exige verificação de origem e validação estrita de campos.
- Uso de centavos inteiros, duração opcional em minutos e limites de tamanho de campos livres.
- Migração cria tabela vazia, sem informações fictícias nem seed.
- Os dados de serviços não se misturam a NF-e 55, NFC-e 65 ou NFS-e e não autorizam emissão fiscal.

## Ainda depende da Karine

- Preços por serviço, porte/pelagem e modalidades exatas;
- Duração de cada procedimento, profissionais, capacidade e horários;
- Política de agendamento (solicitação ou reserva direta), antecedência e cancelamento;
- Confirmação da contadora sobre ISS/NFS-e, PIS/COFINS, ICMS e demais parâmetros fiscais.

## Testes

- `bun test tests/catalogo-servicos-matilha.test.ts` para lista, chaves, rascunhos, valor ausente e condição de confirmação;
- TypeScript, CI e build antes da integração.
