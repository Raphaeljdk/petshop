# Catálogo estético administrável — aguardando dados da Karine

Implementação em 02/11/2026, preparada enquanto se aguarda confirmação operacional e fiscal.

## Como usar

1. Em **Agenda Matilha Prado → Configurar serviços, preços e duração**, abrir a seção de gestão interna (acesso ADMIN).
2. Cada serviço confirmado na conversa aparece com campos para **preço de referência**, **duração**, **preços por raça**, **variação por porte/pelagem/raça/modalidade** e **observações**. O botão **Adicionar raça** permite cadastrar várias linhas com nome da raça e valor em reais. Cada linha pode ser alterada ou removida antes de salvar.
3. **Salvar** é permitido mesmo quando faltam dados: são rascunhos. Para marcar como **Confirmado**, é obrigatório informar duração mais preço de referência, preço por raça **ou** regra de cobrança. Ao adicionar uma linha de raça, é obrigatório completar nome e preço antes de salvar; não são permitidas raças repetidas no mesmo serviço.
4. A informação fica persistida em **ServicoEsteticoConfig**. Os valores por raça são um array JSONB em **precosPorRaca**, acrescido por migração aditiva com padrão vazio; o preço antigo e as regras textuais são preservados. Nenhum registro de agendamento, venda, estoque, cliente, produto ou fiscal é modificado.
5. **Confirmação interna não publica preços no site, não ativa agenda automática e não gera notas fiscais**. Integração futura de preços/agendamento depende da tabela oficial e decisões da equipe.

## Segurança

- A API GET/PUT está restrita a ADMIN, a escrita exige verificação de origem e validação estrita de campos.
- Uso de centavos inteiros, duração opcional em minutos e limites de tamanho de campos livres. São permitidas até 80 raças por serviço, cada uma com preço entre R$ 0,00 e R$ 100.000,00. Raças duplicadas são bloqueadas independentemente de maiúsculas, acentos e espaços repetidos.
- Migração cria tabela vazia, sem informações fictícias nem seed.
- Os dados de serviços não se misturam a NF-e 55, NFC-e 65 ou NFS-e e não autorizam emissão fiscal.

## Ainda depende da Karine

- Preços por serviço, porte/pelagem e modalidades exatas;
- Duração de cada procedimento, profissionais, capacidade e horários;
- Política de agendamento (solicitação ou reserva direta), antecedência e cancelamento;
- Confirmação da contadora sobre ISS/NFS-e, PIS/COFINS, ICMS e demais parâmetros fiscais.

## Testes

- `bun test tests/catalogo-servicos-matilha.test.ts` para lista, chaves, rascunhos, valores múltiplos, raça duplicada, valor inválido e condição de confirmação;
- TypeScript, CI e build antes da integração.
