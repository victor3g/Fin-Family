# 💰 Fin Family: Meu Cofrinho Mágico ✨

O **Fin Family** é uma aplicação web simples e responsiva, projetada para auxiliar pais e filhos na educação financeira de forma lúdica. O projeto foi refatorado de uma estrutura monolítica (Firebase e JS único) para um código modular moderno, utilizando o **Supabase** como backend.

## 🎯 Objetivo do Projeto

Transformar conceitos financeiros complexos (como ganhar, poupar, gastar e metas) em atividades gamificadas para crianças, utilizando um Mascote interativo e um sistema de recompensas (moedas e conquistas).

---

## 🛠️ Tecnologias Utilizadas

| Categoria | Tecnologia | Uso |
| :--- | :--- | :--- |
| **Frontend** | HTML5, JavaScript (ES Modules) | Estrutura e Lógica Modular do Lado do Cliente |
| **Estilização** | Tailwind CSS (CDN), CSS Customizado | Design responsivo e Temas dinâmicos |
| **Backend/DB** | **Supabase** (PostgreSQL, Realtime, RLS) | Banco de Dados, Autenticação e Sincronização em Tempo Real |
| **Ícones** | Font Awesome | Ícones de Perfil e Ações |
| **Integração** | Gemini API (Simulada) | Dicas financeiras e motivacionais após gastos |

---

## 📂 Estrutura Modular do Código

O código foi dividido em módulos para facilitar a manutenção e o desenvolvimento (ES Modules), substituindo o bloco `<script type="module">` único.
/finfamily ├── index.html # Estrutura visual da aplicação e importação do módulo principal ├── styles.css # Estilos globais e customizados (além do Tailwind) └── src/ ├── main.js # Ponto de entrada, gestão de estado global e navegação/autenticação ├── config.js # Constantes, temas e chaves públicas do Supabase (A chave anon é pública) ├── supabase-client.js # Funções de interação com o Supabase (CRUD, Realtime) ├── ui.js # Funções de renderização de interface (Modais, UI da Criança, Loja) ├── game.js # Lógica e motor do Mini-Game (Canvas) └── parent-dashboard.js # Funções específicas para o Painel do Responsável
