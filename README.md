# COMANDO GLOBAL — Guerra pelo Planeta

Jogo de estratégia de guerra em tempo real para navegador, em português. Construa uma base militar isométrica, evolua edifícios, treine exércitos, pesquise tecnologias, recrute comandantes e conquiste setores no mapa do planeta.

Inspirado nos clássicos jogos de construção de base e conquista territorial para dispositivos móveis, mas feito para rodar direto no navegador — sem instalação, sem build e sem assets externos de jogo.

## Recursos

- **Base isométrica procedural** com 14 construções: quartel-general, petróleo, fazenda, aço, energia, quartel, fábrica, armazém, laboratório, mercado, radar, base aérea, hospital e muralha.
- **Economia em tempo real** com produção por hora, capacidade de armazenamento, coleta manual, custos e fila de obras.
- **Exército com 5 classes** — infantaria, tanques, artilharia, helicópteros e unidades de elite — com treino em fila e capacidade de tropas.
- **Pesquisa bélica** com 8 tecnologias em ramos econômico e militar.
- **3 comandantes (heróis)** com habilidades, níveis, pontos e bônus de combate.
- **Campanha com 8 missões**, recompensas e objetivos progressivos.
- **Mapa-múndi com 18 setores**, facções, níveis de ameaça, probabilidade de vitória, marchas e conquista permanente.
- **Batalhas animadas** em canvas, com unidades, disparos, explosões, resultado, perdas, saque e relatórios.
- **Aliança** com membros, ranking e chat funcional.
- **Salvamento local** automático, produção offline (até 6 horas), filas persistentes e retomada de batalhas pendentes.
- **Interface responsiva** para desktop, tablet e celular, com painel contextual em bottom sheet no mobile.
- **Áudio procedural** via Web Audio API (efeitos e ambiente), sem arquivos de áudio.
- **Arte 100% procedural** em canvas, com fontes locais para funcionar offline.

## Como jogar

1. **Base** — clique/tap em um edifício para abrir o painel de comando. Evolua o quartel-general para liberar níveis maiores; construa e evolua os demais edifícios para aumentar produção, capacidade e poder.
2. **Exército** — treine unidades no painel do exército. Cada classe tem custo, tempo e poder diferentes. Use **MAX** para preencher a capacidade disponível.
3. **Pesquisa** — invista recursos no laboratório para obter bônus permanentes de economia e combate.
4. **Mundo** — escolha um setor inimigo, confira a defesa e a probabilidade de vitória, monte a força de ataque e envie a marcha. Ao chegar, a batalha começa automaticamente.
5. **Heróis** — selecione o comandante ativo e distribua pontos de habilidade ganhos em batalhas.
6. **Campanha e aliança** — no desktop, use os botões da barra lateral. No celular, toque em **MAIS** para acessar campanha, aliança, relatórios e configurações.
7. **Relatórios** — o ícone de correio no topo mostra batalhas, perdas, saques e recompensas.

### Controles

- **Mouse / toque:** selecionar edifícios, setores, unidades e ações.
- **Teclas 1–7:** alternar entre Base, Mundo, Exército, Pesquisa, Herói, Campanha e Aliança.
- **Esc:** fechar modal/painel ou voltar ao mapa da base.
- **Botões + / − / centralizar:** controlar o zoom e a posição do mapa-múndi.

## Executar localmente

O projeto é estático e usa ES Modules. Não há etapa de build.

```bash
python3 -m http.server 8000
```

Abra `http://localhost:8000`.

Também é possível usar o script de inicialização do ambiente:

```bash
./start.sh
```

Para entrar direto no jogo (útil para demonstrações e capturas automatizadas), acrescente `?autostart=1` à URL.

## Estrutura

```text
index.html          # shell da interface e sprite SVG de ícones
css/style.css       # layout desktop/mobile, tema e animações
js/data.js          # definições de edifícios, unidades, tecnologias, heróis e setores
js/state.js         # estado do jogo, regras, economia, filas, marchas, salvamento
js/iso.js           # renderização isométrica da base
js/world.js         # mapa-múndi e marcadores de setores
js/battle.js        # cena de batalha animada em canvas
js/ui.js            # HUD, painéis, modais, contexto móvel, chat e relatórios
js/audio.js         # efeitos e ambiente procedural via Web Audio
js/main.js          # tela-título, inicialização, ticker e atalhos
assets/fonts/       # Barlow Condensed e Rajdhani (offline)
```

## Persistência

O progresso é salvo no `localStorage` sob a chave `comando-global-save-v3`. O jogo aplica produção offline ao reabrir e retoma batalhas que chegaram enquanto a aba estava fechada. Para apagar o progresso, use **Configurações → Reiniciar operação**.

## Créditos

- Código, arte procedural e áudio: projeto original.
- Fontes: Barlow Condensed e Rajdhani (SIL Open Font License).
- Inspiração de gênero: jogos de estratégia de base e conquista global. Este é um projeto independente, sem afiliação com marcas ou estúdios citados.

---

<!-- omgithub:readme:start -->
## 🚀 Build, play, and remix with OMGithub

**Remixed using [OMGithub.com](https://omgithub.com).**

[![OMGithub](https://img.shields.io/badge/OMGithub-Open%20project-orange?style=for-the-badge)](https://omgithub.com/petyzika/Batalha)
[![GitHub](https://img.shields.io/badge/GitHub-Source-181717?logo=github&style=for-the-badge)](https://github.com/petyzika/Batalha)

- 🎮 [Open the project](https://omgithub.com/petyzika/Batalha).
- ✨ [Remix this project](https://omgithub.com/?remix=petyzika%2FBatalha).
- 💻 [Explore the source](https://github.com/petyzika/Batalha).
- 🛠️ [Check build runs](https://github.com/petyzika/Batalha/actions).
- 🐛 [Report an issue](https://github.com/petyzika/Batalha/issues).
- 👤 [Explore the creator's projects](https://omgithub.com/petyzika).
- 🌍 [Create with OMGithub](https://omgithub.com).
- 🧬 [Explore the remix source](https://omgithub.com/petyzika%2FBatalha).
<!-- omgithub:readme:end -->
