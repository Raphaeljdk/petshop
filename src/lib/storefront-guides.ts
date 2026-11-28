type CareGuide = {
  id: string
  category: string
  title: string
  summary: string
  body: string
  guideAction: 'agendamento' | 'produtos'
  imageUrl?: string
}

export const careGuides: CareGuide[] = [
  {
    id: 'guia-primeiro-banho',
    category: 'Banho',
    title: 'O primeiro banho do pet',
    summary: 'O que contar no check-in e o que combinar com a equipe antes de se despedir.',
    body: 'Pense em como seu pet reage à água, ao toque nas patas e ao som do secador. Se você ainda não conhece alguma dessas reações, conte isso também. Uma experiência de casa ajuda a equipe a planejar a recepção.\n\nNa chegada, confirme o serviço escolhido e conte quais cuidados o pet já conhece. Combine como a equipe vai avisar que ele está pronto. Ao buscar seu pet, pergunte quais etapas foram tranquilas e registre o que pode ajudar na próxima visita.',
    guideAction: 'agendamento',
    imageUrl: '/images/vitrine/banho-520.webp',
  },
  {
    id: 'guia-higiene',
    category: 'Higiene',
    title: 'Como organizar os itens de higiene do pet',
    summary: 'Uma rotina para quem divide os cuidados em casa.',
    body: 'Separe os utensílios de cada animal e guarde os produtos na embalagem original. Assim, quem for usar um item consegue ler a indicação, o modo de uso e a validade.\n\nDepois de cada uso, limpe os acessórios conforme as instruções do fabricante. Antes de guardá-los, confira se já estão secos e deixe os frascos fechados fora do alcance do pet. Mantenha uma lista curta dos itens que precisam de reposição.',
    guideAction: 'produtos',
  },
  {
    id: 'guia-alimentacao',
    category: 'Alimentação',
    title: 'O que conferir ao repor o alimento',
    summary: 'Use o rótulo da embalagem atual para reconhecer a variedade que seu pet já consome.',
    body: 'Fotografe a frente e o verso da embalagem que você pretende repor. Na loja, confira a espécie, a fase de vida e a variedade escritas no rótulo. Produtos da mesma marca podem ter nomes e embalagens parecidos.\n\nEm casa, conserve as informações de lote, validade e armazenamento. Se mais de uma pessoa serve as refeições, combinem onde anotar o que já foi oferecido. Assim, todos conseguem acompanhar a rotina.',
    guideAction: 'produtos',
  },
  {
    id: 'guia-comportamento',
    category: 'Comportamento',
    title: 'Como apresentar um brinquedo novo',
    summary: 'Dê tempo para o pet escolher se quer se aproximar e observe o que desperta interesse.',
    body: 'Escolha um momento tranquilo e leia a indicação de espécie e porte na embalagem. Coloque o brinquedo em uma área livre, fique por perto e deixe o pet explorar no próprio ritmo.\n\nObserve se ele prefere farejar, perseguir ou segurar o objeto. Se perder o interesse, guarde o brinquedo para outro momento. Ao terminar, confira se continua inteiro antes de oferecê-lo de novo.',
    guideAction: 'produtos',
  },
]
