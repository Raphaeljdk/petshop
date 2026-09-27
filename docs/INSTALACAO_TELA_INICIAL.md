# Instalação da Matilha Prado

A página pública, o início do portal do cliente e o dashboard administrativo incluem um cartão para adicionar a Matilha Prado à tela inicial. O aplicativo instalado abre `/`, mantendo a autenticação e a seleção de perfil existentes.

- O convite aparece após 3,5 segundos na página inicial, depois da leitura da sessão. Não interrompe formulários em edição, menus, outros diálogos ou abas inativas.
- “Agora não”, fechar o diálogo ou dispensar o aviso nativo adia o convite automático por sete dias. O cartão continua disponível para tentar novamente.
- O aviso automático aparece no máximo uma vez por sessão do navegador. Falhas de localStorage/sessionStorage não impedem o uso do sistema.
- Em modo standalone, o aviso e o cartão ficam ocultos. O evento `appinstalled` também atualiza a interface.
- Quando `beforeinstallprompt` está disponível, “Instalar agora” abre a confirmação nativa após o clique. Sem esse evento, aparece um passo a passo para iPhone/iPad, Android, Safari no macOS ou Chrome/Edge no computador.
- A instalação depende de HTTPS (ou localhost nos testes) e das opções oferecidas pelo navegador. Navegadores dentro de outros aplicativos podem exigir abrir o site no Safari/Chrome.

`src/app/manifest.ts` configura nome, identidade estável `/`, escopo, cores, ícones e abertura em janela própria. Os arquivos de `public/icons` derivam da logo original, incluindo 192 e 512 px, ícone maskable com margem, Apple Touch Icon de 180 px e favicon de 32 px.

A instalação oferece acesso pelo ícone. Não adiciona cache offline de páginas, pedidos, dados pessoais ou respostas de API. Não exige migração do banco, nova variável de ambiente ou permissão para notificações.

## Conferência manual após publicação

1. Em uma sessão nova no celular, abrir a página inicial e verificar o convite com a logo.
2. Tocar em “Agora não”, recarregar e verificar que o convite não reaparece. Abrir novamente pelo cartão.
3. No Chrome/Edge elegível, confirmar a instalação; abrir pelo ícone e verificar que o aviso está oculto.
4. No iPhone/iPad, seguir Compartilhar → Adicionar à Tela de Início → Adicionar. Abrir pela logo.
5. Confirmar o cartão no portal do cliente e no dashboard administrativo antes da instalação.
6. Conferir `/manifest.webmanifest` e os ícones referenciados, todos com resposta HTTP 200.

A confirmação final do ícone na tela inicial deve ser feita em um dispositivo real; eventos simulados em testes de navegador verificam o fluxo da interface, não a instalação pelo sistema operacional.
