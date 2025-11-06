// Credenciais do Pai (Solicitado pelo usuário)
export const PARENT_CREDENTIALS = { email: 'admin@admin.com', password: 'admin' };

// Constante de duração da recarga do jogo (6 horas)
export const COOLDOWN_DURATION_MS = 6 * 60 * 60 * 1000; 

// --- CONSTANTES DE DADOS ---
export const BADGES = {
    first_earn: { id: 'first_earn', name: "Primeiro Ganho", description: "Concluiu a primeira tarefa ou jogo.", icon: "fa-trophy" },
    first_save: { id: 'first_save', name: "Primeira Poupança", description: "Fez sua primeira contribuição para a meta.", icon: "fa-piggy-bank" },
    generous: { id: 'generous', name: "Coração de Ouro", description: "Fez 5 doações no total.", icon: "fa-hands-clapping" },
    goal_starter: { id: 'goal_starter', name: "Início da Meta", description: "Alcançou 10% da meta.", icon: "fa-bullseye" },
    goal_master: { id: 'goal_master', name: "Mestre da Meta", description: "Completou uma meta de poupança.", icon: "fa-crown" },
};
export const DONATION_TARGET = 5; 

export const SHOP_ICONS = [
    { id: 'mago', type: 'fa-icon', value: 'fa-hat-wizard', label: 'Mago', price: 50 },
    { id: 'moneybag', type: 'emoji', value: '💰', label: 'Saco de Dinheiro', price: 75 },
    { id: 'pirata', type: 'fa-icon', value: 'fa-anchor', label: 'Pirata', price: 60 },
    { id: 'coroa', type: 'emoji', value: '👑', label: 'Coroa', price: 100 },
];

export const SHOP_EMOTIONS = [
    { id: 'happy_star', value: '🤩', label: 'Feliz Estrela', price: 50 },
    { id: 'thinking', value: '🤔', label: 'Pensativo', price: 60 },
    { id: 'pirate', value: '🏴‍☠️', label: 'Aventureiro', price: 75 },
    { id: 'cool', value: '😎', label: 'Legalzão', price: 100 },
];

export const STANDARD_EMOTIONS = [
    { id: 'smile', value: '😊', label: 'Alegre' },
    { id: 'sad', value: '😟', label: 'Triste' },
    { id: 'angry', value: '😡', label: 'Irritado' },
    { id: 'neutral', value: '😐', label: 'Normal' },
];

export const PET_CHARACTERS = [
    { id: 'piggy', value: '🐷', label: 'Porquinho', price: 0 },
    { id: 'cat', value: '🐈', label: 'Gatinho', price: 120 },
    { id: 'dog', value: '🐶', label: 'Cachorrinho', price: 150 },
    { id: 'bear', value: '🐻', label: 'Ursinho', price: 180 },
    { id: 'rabbit', value: '🐰', label: 'Coelhinho', price: 90 },
];

export const DEFAULT_CHILD_DATA = {
    name: "Convidado",
    coins: 0, 
    tasks: [], 
    transactions: [], 
    badges: [], 
    lastInterestDate: Date.now(), 
    donationCount: 0, 
    gameCooldownEndTime: 0, 
    progress: { goal: 500, targetName: "Brinquedo Novo", savedAmount: 0 },
    profileIcon: { type: 'fa-icon', value: 'fa-user-astronaut', shopOwned: [] },
    currentEmotion: { value: '😊', shopOwned: [] },
    currentPet: PET_CHARACTERS[0],
    unlockedPets: ['piggy'], 
    settings: {
        theme: 'padrão',
        themes: {
            padrão: { start: '#99BFFB', end: '#C7F8DC', price: 0, purchased: true }, 
            rosa: { start: '#FFC0CB', end: '#ADD8E6', price: 0, purchased: true }, 
            azul: { start: '#4682B4', end: '#B0E0E6', price: 0, purchased: true },
            espaco: { start: '#00008B', end: '#483D8B', price: 100, purchased: false },
            verde: { start: '#A8DADC', end: '#457B9D', price: 150, purchased: false }, 
            sol: { start: '#FFC72C', end: '#F97316', price: 200, purchased: false }
        },
    },
    actions: { earn: 10, save: 20, spend: 50, donate: 10 }
};

export const DEFAULT_PARENT_DATA = {
    name: "Responsável",
    children: []
};

export const DEFAULT_THEME_COLORS = { start: '#99BFFB', end: '#C7F8DC' };