// Importações do Firebase/Configurações
import { 
    db, 
    auth, 
    appId, 
    initialAuthToken,
    signInAnonymously, 
    signInWithCustomToken, 
    onAuthStateChanged, 
    signOut,
    doc, 
    setDoc, 
    getDoc, 
    onSnapshot, 
    deleteDoc 
} from "./firebase-config.js";

let parentId = null; 
let currentUserId = null; // UID do usuário logado (pai ou criança, anônimo)
let currentChildId = null; // Usado no dashboard do pai para focar na criança
let userType = 'Guest'; // 'Parent', 'Child', 'Guest'
let childParentId = null; // O ID do pai que possui os dados da criança logada

// Credenciais do Pai (Solicitado pelo usuário)
const PARENT_CREDENTIALS = { email: 'admin@admin.com', password: 'admin' };

// NOVO: Constante de duração da recarga do jogo (6 horas)
const COOLDOWN_DURATION_MS = 6 * 60 * 60 * 1000; 

// --- CONSTANTES ---
const BADGES = {
    first_earn: { id: 'first_earn', name: "Primeiro Ganho", description: "Concluiu a primeira tarefa ou jogo.", icon: "fa-trophy" },
    first_save: { id: 'first_save', name: "Primeira Poupança", description: "Fez sua primeira contribuição para a meta.", icon: "fa-piggy-bank" },
    generous: { id: 'generous', name: "Coração de Ouro", description: "Fez 5 doações no total.", icon: "fa-hands-clapping" },
    goal_starter: { id: 'goal_starter', name: "Início da Meta", description: "Alcançou 10% da meta.", icon: "fa-bullseye" },
    goal_master: { id: 'goal_master', name: "Mestre da Meta", description: "Completou uma meta de poupança.", icon: "fa-crown" },
};
const DONATION_TARGET = 5; 

// Listas de itens compráveis
const SHOP_ICONS = [
    { id: 'mago', type: 'fa-icon', value: 'fa-hat-wizard', label: 'Mago', price: 50 },
    { id: 'moneybag', type: 'emoji', value: '💰', label: 'Saco de Dinheiro', price: 75 },
    { id: 'pirata', type: 'fa-icon', value: 'fa-anchor', label: 'Pirata', price: 60 },
    { id: 'coroa', type: 'emoji', value: '👑', label: 'Coroa', price: 100 },
];

const SHOP_EMOTIONS = [
    { id: 'happy_star', value: '🤩', label: 'Feliz Estrela', price: 50 },
    { id: 'thinking', value: '🤔', label: 'Pensativo', price: 60 },
    { id: 'pirate', value: '🏴‍☠️', label: 'Aventureiro', price: 75 },
    { id: 'cool', value: '😎', label: 'Legalzão', price: 100 },
];

const STANDARD_EMOTIONS = [
    { id: 'smile', value: '😊', label: 'Alegre' },
    { id: 'sad', value: '😟', label: 'Triste' },
    { id: 'angry', value: '😡', label: 'Irritado' },
    { id: 'neutral', value: '😐', label: 'Normal' },
];

const PET_CHARACTERS = [
    { id: 'piggy', value: '🐷', label: 'Porquinho', price: 0 },
    { id: 'cat', value: '🐈', label: 'Gatinho', price: 120 },
    { id: 'dog', value: '🐶', label: 'Cachorrinho', price: 150 },
    { id: 'bear', value: '🐻', label: 'Ursinho', price: 180 },
    { id: 'rabbit', value: '🐰', label: 'Coelhinho', price: 90 },
];

// --- ESTRUTURA DE DADOS INICIAL E DEFAULT ---
let userData = {}; // Objeto de dados dinâmico da criança atual

const DEFAULT_CHILD_DATA = {
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

// --- ESTRUTURA DE DADOS (Pai) ---
let parentData = {
    name: "Responsável",
    children: [] // [{ uid: 'childUID', name: 'Child Name', code: '1234' }]
};

const DEFAULT_THEME_COLORS = { start: '#99BFFB', end: '#C7F8DC' };


// --- FIREBASE PATHING ---

// Document Reference para o controle principal do pai (6 segmentos: Col/Doc/Col/Doc/Col/Doc)
const PARENT_CONTROL_DOC_REF = (uid) => doc(db, 'artifacts', appId, 'users', uid, 'parent_control', 'control_data');

// Document Reference para o perfil da criança (6 segmentos: Col/Doc/Col/Doc/Col/Doc)
const CHILD_PROFILE_DOC_REF = (parentUid, childUid) => doc(db, 'artifacts', appId, 'users', parentUid, 'child_profiles', childUid);


// --- Elementos do DOM (Cache) ---
const userNameEl = document.getElementById('user-name');
const coinCountEl = document.getElementById('coin-count');
const tasksDoneEl = document.getElementById('tasks-done');
const tasksTotalEl = document.getElementById('tasks-total');
const progressBarEl = document.getElementById('progress-bar');
const coinGoalEl = document.getElementById('coin-goal');
const modalEl = document.getElementById('main-modal');
const modalTitleEl = document.getElementById('modal-title');
const modalBodyEl = document.getElementById('modal-body');
const sidebarEl = document.getElementById('sidebar');
const profileIconContainer = document.getElementById('profile-icon-container');
const piggyCharEl = document.getElementById('piggy-character');
const piggyGreetingEl = document.getElementById('piggy-greeting');
const piggyContainerEl = document.getElementById('animated-piggy-container');


// --- Inicialização do Firebase e Auth ---
function initFirebase() {
    try {
        onAuthStateChanged(auth, async (user) => {
            if (user) {
                currentUserId = user.uid;
                // Tenta carregar o estado atual e mostrar a vista correta
                showLoginView();
            } else {
                // Tenta autenticação inicial anônima
                if (initialAuthToken) {
                    await signInWithCustomToken(auth, initialAuthToken);
                } else {
                    await signInAnonymously(auth);
                }
            }
        });
        
        // --- Eventos de UI estáticos (Ligados após a inicialização) ---
        document.getElementById('tasks-edit-section')?.addEventListener('click', () => {
             if (userType === 'Child') renderTaskManagementModal();
        });
        
        // NOVO: Adiciona listener para a seção de Meta (Progresso)
        document.getElementById('goal-section')?.addEventListener('click', () => {
             if (userType === 'Child') renderGoalSettingModal();
        });
        
        // Setup dos botões da sidebar (Mantidos para a versão do Pai, mas sem serem usados na navegação da criança)
        document.getElementById('menu-profile')?.addEventListener('click', () => {
            sidebarEl?.classList.add('-translate-x-full');
            renderProfileSettingsModal();
        });
        document.getElementById('menu-shop')?.addEventListener('click', () => {
            sidebarEl?.classList.add('-translate-x-full');
            renderShopModal();
        });
        document.getElementById('emotion-display-container')?.addEventListener('click', renderEmotionSelectionModal);
        if (piggyContainerEl) {
            piggyContainerEl.addEventListener('click', triggerReaction);
        }
        
        // --- NOVO MAPEMANETO DE BOTÕES DE AÇÃO (CRIANÇA) ---
        document.getElementById('action-ganhar')?.addEventListener('click', launchGame);

        // 1. POUPAR (Permite escolher o valor)
        document.getElementById('action-poupar')?.addEventListener('click', renderSaveInputModal); 

        // 2. GASTAR (Mapeado para Loja Mágica)
        document.getElementById('action-gastar')?.addEventListener('click', renderShopModal);
        
        // 3. DOAR (Mapeado para Conquistas)
        document.getElementById('action-doar')?.addEventListener('click', renderBadgesModal); 
    } catch (error) {
        console.error("Erro ao inicializar Firebase:", error);
        showModal("Erro de Inicialização", "Não foi possível conectar ao banco de dados. Tente recarregar.");
    }
}

// --- FUNÇÕES DE NAVEGAÇÃO / ROTAS ---
function setView(viewId) {
    document.getElementById('login-view').classList.add('hidden');
    document.getElementById('child-app-view').classList.add('hidden');
    document.getElementById('parent-dashboard-view').classList.add('hidden');
    
    // NOVAS VISTAS DE LOGIN
    document.getElementById('signup-view').classList.add('hidden');
    document.getElementById('forgot-password-view').classList.add('hidden');

    document.getElementById(viewId).classList.remove('hidden');
}

// NOVO: Navegação para Cadastro
window.showSignupView = function() {
    document.getElementById('signup-message').textContent = '';
    setView('signup-view');
}

// NOVO: Navegação para Esqueceu Senha
window.showForgotPasswordView = function() {
    document.getElementById('reset-message').textContent = '';
    setView('forgot-password-view');
}


// CORREÇÃO: Garante que a vista de login use o tema padrão
window.showLoginView = function() {
    userType = 'Guest';
    applyTheme('padrão', DEFAULT_THEME_COLORS); // Tema padrão
    setView('login-view');
}

async function showChildApp(uid, parentUid) { // Adicionado parentUid
    userType = 'Child';
    currentUserId = uid;
    childParentId = parentUid; // Salva o ID do pai que possui os dados
    
    // Garantir que a sidebar não interfira no app
    sidebarEl?.classList.add('-translate-x-full'); 
    
    await loadOrCreateUserData(currentUserId, DEFAULT_CHILD_DATA);
    setupRealtimeListener(currentUserId);
    setView('child-app-view');
    // Recarrega o timer do jogo para mostrar o tempo restante corretamente
    setInterval(() => {
        if (isGameOnCooldown()) updateUI();
    }, 60000);
    
    // Novo: Adiciona listener para o botão de logout da criança
    document.getElementById('child-logout-btn')?.addEventListener('click', childLogout);
}

// CORREÇÃO: Garante que o dashboard do pai use o tema padrão
async function showParentDashboard(uid) {
    userType = 'Parent';
    parentId = uid;
    applyTheme('padrão', DEFAULT_THEME_COLORS); // Tema padrão
    await loadParentData();
    window.showParentHome(); // CORREÇÃO: Chamada exposta
    setupParentRealtimeListener(parentId);
    setView('parent-dashboard-view');
}

// CORREÇÃO: Função parentLogout exposta para ser chamada diretamente no 'onclick' do HTML
window.parentLogout = function() {
    userType = 'Guest';
    parentId = null;
    currentChildId = null;
    childParentId = null;
    showLoginView();
}

// NOVO: Função de Logout para a Criança (chamada do botão superior direito)
window.childLogout = async function() {
     userType = 'Guest';
     currentUserId = null;
     childParentId = null;
     await signOut(auth);
     showLoginView();
}

// NOVO: Mudar para a Home do Pai (Tela 1) - EXPOSTO GLOBALMENTE
window.showParentHome = function() {
    currentChildId = null; // Desseleciona a criança
    
    const homeView = document.getElementById('parent-home-view');
    const managementView = document.getElementById('child-management-view');

    if (homeView) homeView.classList.remove('hidden');
    if (managementView) managementView.classList.add('hidden');
    
    renderParentDashboard(); // Renderiza a lista de crianças
}

// NOVO: Mudar para o Gerenciamento da Criança (Tela 2) - EXPOSTO GLOBALMENTE
window.showChildManagementView = async function(childUid) {
    currentChildId = childUid;
    const childData = await getChildDataSnapshot(childUid);
    if (childData) {
        renderChildManagement(childData);
        document.getElementById('parent-home-view').classList.add('hidden');
        document.getElementById('child-management-view').classList.remove('hidden');
    } else {
        showModal("Erro", "Não foi possível carregar o perfil da criança.");
        window.showParentHome();
    }
}


// --- LÓGICA DE AUTENTICAÇÃO E LOGIN ---
document.getElementById('login-type-toggle').addEventListener('click', (e) => {
    const isParent = e.target.checked;
    
    // Elementos do pai/comuns
    const parentEmailDiv = document.getElementById('parent-email-input-div');
    const parentPasswordDiv = document.getElementById('parent-password-input-div');
    const childCodeInput = document.getElementById('login-child-code-input');
    const createAccountBtn = document.getElementById('create-account-btn');
    const forgotPasswordLink = document.getElementById('forgot-password-link');
    
    // Inputs reais (para required)
    const emailInput = document.getElementById('login-email-input');
    const passwordInput = document.getElementById('login-password-input');

    document.getElementById('login-title-type').textContent = isParent ? 'Pai' : 'Criança';

    // Toggle visibilidade
    parentEmailDiv?.classList.toggle('hidden', !isParent);
    parentPasswordDiv?.classList.toggle('hidden', !isParent);
    childCodeInput.classList.toggle('hidden', isParent);
    
    // NOVO: Esconde elementos desnecessários para a Criança (simplificação)
    createAccountBtn?.classList.toggle('hidden', !isParent);
    forgotPasswordLink?.classList.toggle('hidden', !isParent);

    // Toggle required fields
    if (emailInput) emailInput.required = isParent;
    if (passwordInput) passwordInput.required = isParent;
    childCodeInput.required = !isParent;
});

document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const isParent = document.getElementById('login-type-toggle').checked;
    
    if (isParent) {
        parentLogin();
    } else {
        const code = document.getElementById('login-child-code-input').value;
        childLogin(code);
    }
});

function parentLogin() {
    const email = document.getElementById('login-email-input').value;
    const password = document.getElementById('login-password-input').value;

    // CORREÇÃO: Removido o 'PA' duplicado na constante de credenciais
    if (email === PARENT_CREDENTIALS.email && password === PARENT_CREDENTIALS.password) {
        showParentDashboard(currentUserId);
        document.getElementById('login-message').textContent = '';
    } else {
        document.getElementById('login-message').textContent = 'Credenciais incorretas.';
    }
}

async function childLogin(code) {
    document.getElementById('login-message').textContent = 'Buscando perfil...';
    
    // Assume-se que o código da criança está armazenado no documento do pai
    // Usamos currentUserId como o ID do pai para buscar o documento
    const parentDocRef = PARENT_CONTROL_DOC_REF(currentUserId);
    const docSnap = await getDoc(parentDocRef);
    
    let childFound = false;
    
    if (docSnap.exists()) {
        const children = docSnap.data().children || [];
        const child = children.find(c => c.code === code);
        
        if (child) {
            childFound = true;
            // Passa o UID da criança e o UID do pai (currentUserId)
            showChildApp(child.uid, currentUserId); 
            return;
        }
    }

    if (!childFound) {
         document.getElementById('login-message').textContent = 'Código de acesso inválido ou não encontrado.';
    }
}

// --- NOVO: LÓGICA DE CADASTRO E RECUPERAÇÃO (SIMULAÇÃO FUNCIONAL) ---

document.getElementById('signup-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('signup-email-input').value;
    const name = document.getElementById('signup-name-input').value;
    const password = document.getElementById('signup-password-input').value;
    const confirmPassword = document.getElementById('signup-confirm-password-input').value;
    const messageEl = document.getElementById('signup-message');

    if (password !== confirmPassword) {
        messageEl.textContent = "Erro: As senhas não coincidem.";
        return;
    }
    
    // Simulação de Cadastro BEM-SUCEDIDO
    messageEl.textContent = `Conta criada para ${email}! (Simulação). Use esta tela para Login.`;
    messageEl.classList.remove('text-red-500');
    messageEl.classList.add('text-green-600');
    
    // Em um app real, faríamos:
    // await createUserWithEmailAndPassword(auth, email, password);
    // E iniciaríamos o dashboard do pai.
    
    // Após a simulação, volta para o login principal
    setTimeout(() => {
        showLoginView();
        // Opcional: pré-preencher o email de login aqui
    }, 2000);
});

document.getElementById('forgot-password-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('reset-email-input').value;
    const messageEl = document.getElementById('reset-message');
    
    // Simulação de Recuperação BEM-SUCEDIDA
    messageEl.textContent = `Link de redefinição enviado para ${email}! (Simulação)`;
    messageEl.classList.remove('text-red-500');
    messageEl.classList.add('text-green-600');
    
    // Em um app real, faríamos:
    // await sendPasswordResetEmail(auth, email);
    
    // Após a simulação, volta para o login principal
    setTimeout(() => {
         showLoginView();
    }, 2000);
});


// --- Persistência de Dados (Geral) ---
async function loadOrCreateUserData(uid, defaultData) {
    // Usa childParentId para encontrar os dados da criança no caminho do pai
    const parentUidToUse = userType === 'Child' ? childParentId : parentId;
    if (!parentUidToUse) {
        console.error("Parent ID não definido para carregar dados da criança.");
        userData = { ...defaultData };
        return;
    }

    const docRef = CHILD_PROFILE_DOC_REF(parentUidToUse, uid);
    
    try {
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            userData = { ...defaultData, ...docSnap.data() };
            // Mescla o objeto de temas, garantindo que o default exista se algo não for salvo
            userData.settings.themes = { ...defaultData.settings.themes, ...docSnap.data().settings?.themes };
            userData.currentPet = { ...PET_CHARACTERS.find(p => p.id === docSnap.data().currentPet?.id), ...docSnap.data().currentPet }; // Garante que o PET tenha o objeto completo
        } else {
            userData = defaultData;
            // Define o nome da criança se estiver sendo criada após o login do pai
            const parentChild = parentData.children.find(c => c.uid === uid);
            if (parentChild) {
                 userData.name = parentChild.name;
            }
            await setDoc(docRef, userData);
        }
        
        if (userType === 'Child') {
            calculateInterest();
            applyTheme(userData.settings.theme); 
            showGreeting();
        }
    } catch (e) {
        console.error("Erro ao carregar/criar dados do usuário:", e);
        showModal("Erro de Dados", "Não foi possível carregar o progresso. (Verifique permissões)");
        userData = { ...defaultData };
    }
}

// --- Persistência de Dados (Pai) ---
async function loadParentData() {
    if (!parentId || typeof parentId !== 'string') { // CORREÇÃO: ADDED NULL/TYPE CHECK
        console.error("loadParentData: parentId é inválido.");
        parentData = { name: "Responsável", children: [] };
        return;
    }

    const docRef = PARENT_CONTROL_DOC_REF(parentId);
    try {
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            parentData = { ...parentData, ...docSnap.data() };
        } else {
            await setDoc(docRef, parentData);
        }
    } catch (e) {
        console.error("Erro ao carregar dados do pai:", e);
        showModal("Erro de Dados", "Não foi possível carregar o dashboard. (Verifique permissões)");
        parentData = { name: "Responsável", children: [] };
    }
}

function setupRealtimeListener(uid) {
    if (!childParentId) return; // Precisa do ID do pai para ouvir os dados

    const docRef = CHILD_PROFILE_DOC_REF(childParentId, uid);
    onSnapshot(docRef, (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            userData = { ...DEFAULT_CHILD_DATA, ...data };
            userData.settings.themes = { ...DEFAULT_CHILD_DATA.settings.themes, ...data.settings?.themes };
            userData.currentPet = { ...PET_CHARACTERS.find(p => p.id === data.currentPet?.id), ...data.currentPet }; 

            applyTheme(userData.settings.theme); 
            updateUI();
        }
    }, (error) => {
        console.error("Erro no listener em tempo real (Criança):", error);
    });
}

function setupParentRealtimeListener(uid) {
    if (!uid || typeof uid !== 'string') { // CORREÇÃO: ADDED NULL/TYPE CHECK
        console.error("setupParentRealtimeListener: UID é inválido.");
        return; 
    }
    const docRef = PARENT_CONTROL_DOC_REF(uid);
     onSnapshot(docRef, (docSnap) => {
        if (docSnap.exists()) {
            parentData = { ...parentData, ...docSnap.data() };
            renderParentDashboard();
        }
    }, (error) => {
        console.error("Erro no listener em tempo real (Pai):", error);
    });
}


async function saveUserData(uid = currentUserId) {
    // Determina o UID do pai que deve ser usado no caminho de salvamento
    const parentUidToUse = userType === 'Child' ? childParentId : parentId;
    if (!uid || !parentUidToUse || userType === 'Guest') return;

    try {
        const dataToSave = { ...userData };
        delete dataToSave.game;
        // Salva no documento da criança sob a coleção do pai
        await setDoc(CHILD_PROFILE_DOC_REF(parentUidToUse, uid), dataToSave, { merge: true });
    } catch (e) {
        console.error("Erro ao salvar dados da criança:", e);
    }
}

async function saveParentData() {
    if (!parentId || userType !== 'Parent') return;
    try {
        await setDoc(PARENT_CONTROL_DOC_REF(parentId), parentData, { merge: true });
    } catch (e) {
        console.error("Erro ao salvar dados do pai:", e);
    }
}

// Função utilitária para pegar um snapshot de dados da criança (usada pelo pai)
async function getChildDataSnapshot(uid) {
     if (!parentId) return null; // O pai deve estar logado
     
     // Busca os dados da criança sob o caminho do pai
     const docRef = CHILD_PROFILE_DOC_REF(parentId, uid); 
     try {
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
             const data = docSnap.data();
             // Garantindo que a estrutura é completa e segura
             return { 
                 ...DEFAULT_CHILD_DATA, 
                 ...data,
                 tasks: data.tasks || [], 
                 transactions: data.transactions || [],
                 currentPet: { ...PET_CHARACTERS.find(p => p.id === data.currentPet?.id), ...data.currentPet } 
            };
        }
     } catch (e) {
         console.error("Erro ao carregar snapshot da criança:", e);
     }
     return null;
}


// --- UI/UX & MASCOTE LÓGICA ---
let greetingTimeout;
let reactionTimeout;

function showGreeting() {
    clearTimeout(greetingTimeout);
    if (piggyGreetingEl && userType === 'Child') {
        piggyGreetingEl.textContent = `👋 Olá, ${userData.name}!`;
        piggyGreetingEl.classList.remove('opacity-0');
        
        greetingTimeout = setTimeout(() => {
            piggyGreetingEl.classList.add('opacity-0');
        }, 4000);
    }
}

const REACTION_MESSAGES = [
    "Opa! Fui tocado!",
    "Eba! Mais moedas!",
    "Toca de novo! ✨",
    "Pronto para poupar?",
    "Uau! 😊",
];

function triggerReaction() {
    if (!piggyCharEl || userType !== 'Child') return;
    
    piggyCharEl.classList.remove('piggy-reacting');
    void piggyCharEl.offsetWidth; 
    piggyCharEl.classList.add('piggy-reacting');

    clearTimeout(reactionTimeout);
    const randomMsg = REACTION_MESSAGES[Math.floor(Math.random() * REACTION_MESSAGES.length)];
    piggyGreetingEl.textContent = randomMsg;
    piggyGreetingEl.classList.remove('opacity-0');

    reactionTimeout = setTimeout(() => {
        piggyGreetingEl.classList.add('opacity-0');
    }, 2000);
}

function isGameOnCooldown() {
    return userData.gameCooldownEndTime > Date.now();
}

function getRemainingCooldownTime() {
     const remainingMs = userData.gameCooldownEndTime - Date.now();
    if (remainingMs <= 0) return null;

    const hours = Math.floor(remainingMs / (1000 * 60 * 60));
    const minutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((remainingMs % (1000 * 60)) / 1000);

    let parts = [];
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}min`);
    if (hours === 0 && minutes === 0 || parts.length === 0) {
        parts.push(`${seconds}s`);
    }

    return parts.join(' ');
}

// CORREÇÃO DE TEMA: Aplicar tema (e garantir que o tema seja o padrão se não for a criança)
function applyTheme(themeName, fallbackColors = DEFAULT_THEME_COLORS) {
    // CORREÇÃO: Uso de encadeamento opcional para evitar TypeError
    let theme = userData.settings?.themes?.[themeName];
    
    if (userType !== 'Child' || !theme) {
        theme = fallbackColors; // Usa o tema padrão se não for a criança ou se o tema for inválido
    }

    document.body.style.setProperty('--color-start', theme.start);
    document.body.style.setProperty('--color-end', theme.end);
    
    // NOVO: Garantir que o body use o gradiente (apenas na vista Child)
    const bodyEl = document.body;
    if (userType === 'Child' || userType === 'Parent') { // Pai também usa o gradiente agora
         bodyEl.classList.add('app-gradient');
         bodyEl.classList.remove('bg-[#EDEFF2]');
    } else {
         bodyEl.classList.remove('app-gradient');
         bodyEl.classList.add('bg-[#EDEFF2]');
    }
}

// NOVO: Função para gerar o HTML do ícone de perfil
function getIconHtml(iconData, sizeClass = 'text-3xl', containerSize = 'w-10 h-10') {
    if (!iconData || !iconData.value) {
        iconData = DEFAULT_CHILD_DATA.profileIcon;
    }

    const placeholder = `<div class="${containerSize} rounded-full overflow-hidden flex items-center justify-center bg-gray-300 text-white"><i class="fa-solid fa-user"></i></div>`;

    let content;
    if (iconData.type === 'fa-icon') {
        content = `<i class="fa-solid ${iconData.value} ${sizeClass} text-gray-500"></i>`;
    } else if (iconData.type === 'emoji') {
        content = `<span class="${sizeClass}">${iconData.value}</span>`;
    } else if (iconData.type === 'image-data') {
        content = `<img src="${iconData.value}" alt="Perfil" class="w-full h-full object-cover">`;
        return `<div class="${containerSize} rounded-full overflow-hidden profile-placeholder flex items-center justify-center">${content}</div>`;
    } else {
        return placeholder;
    }
    
    // Default container for icons/emojis
    return `<div class="${containerSize} rounded-full overflow-hidden profile-placeholder flex items-center justify-center">${content}</div>`;
}

function updateUI() {
    if (userType !== 'Child') return;

    // ** CORREÇÃO NOME: Garante que o nome real da criança seja usado **
    userNameEl.textContent = userData.name;
    coinCountEl.textContent = userData.coins;
    
    // Atualiza Ícones, Emoção e Mascote
    // A lógica de renderização do ícone na tela da criança está aqui
    const { type, value } = userData.profileIcon;
    profileIconContainer.innerHTML = '';
    profileIconContainer.innerHTML = getIconHtml(userData.profileIcon, 'text-4xl', 'w-16 h-16');

    // ** CORREÇÃO BICHINHO/MASCOTE **
    if (piggyCharEl) {
         piggyCharEl.textContent = userData.currentPet?.value || '🐷'; 
    }
    document.getElementById('emotion-display-container').textContent = userData.currentEmotion.value;

    // Progresso
    const totalTasks = userData.tasks.length;
    const completedTasks = userData.tasks.filter(t => t.completed).length;
    tasksTotalEl.textContent = totalTasks;
    tasksDoneEl.textContent = completedTasks;
    const savedAmount = userData.progress.savedAmount || 0;
    const progressGoal = userData.progress.goal || 0;
    
    const progressPercent = progressGoal > 0
        ? Math.min(100, (savedAmount / progressGoal) * 100)
        : 0;
        
    progressBarEl.style.width = `${progressPercent}%`;
    document.getElementById('progress-percent').textContent = `${Math.floor(progressPercent)}%`;
    
    // NOVO: Exibe o nome e valor da meta no cartão de perfil
    document.getElementById('goal-name-display').textContent = userData.progress.targetName;
    document.getElementById('goal-amount-display').textContent = `${savedAmount}/${progressGoal} moedas`;


    // Ações (Os valores estão corretos, o que faltava eram os listeners)
    document.getElementById('save-amount').textContent = `Mudar`; // Atualizado para texto (agora modal de input)
    document.getElementById('spend-amount').textContent = `Comprar`; // Atualizado para texto (agora loja)
    document.getElementById('donate-amount').textContent = `Ver`; // Atualizado para texto (agora conquistas)

    // Cooldown Jogo
    const ganharBtn = document.getElementById('action-ganhar');
    const ganharAmount = document.getElementById('earn-amount');
    const isCooldown = isGameOnCooldown();

    if (isCooldown) {
        ganharBtn.classList.remove('bg-[#32CD32]', 'hover:bg-green-600');
        ganharBtn.classList.add('bg-gray-400', 'cursor-not-allowed');
        ganharBtn.disabled = true;
        ganharAmount.textContent = getRemainingCooldownTime();
        document.getElementById('earn-text').textContent = 'Recarga'; 
    } else {
        ganharBtn.classList.remove('bg-gray-400', 'cursor-not-allowed');
        ganharBtn.classList.add('bg-[#32CD32]', 'hover:bg-green-600');
        ganharBtn.disabled = false;
        ganharAmount.textContent = `+${userData.actions.earn}`;
        document.getElementById('earn-text').textContent = 'Ganhar'; 
    }
    
    // ** CORREÇÃO TAREFAS: Renderiza a lista de tarefas da criança **
    renderTasks(document.getElementById('tasks-list'), false);
}

// --- FUNÇÃO GEMINI API PARA DICA FINANCEIRA ---

/**
 * Chama a Gemini API para obter uma dica financeira mágica após um gasto.
 * @param {string} category - 'Necessidade' ou 'Desejo'.
 * @param {number} amount - Quantidade gasta.
 * @returns {Promise<string>} Dica motivacional gerada pelo LLM.
 */
async function getFinancialTip(category, amount) {
    const userQuery = `Eu gastei ${amount} moedas num item que classifiquei como '${category}'. Diga-me uma dica financeira mágica, motivacional e muito curta (máximo 15 palavras) sobre a importância de gastar (se for Necessidade) ou de equilibrar gastos (se for Desejo). Responda em Português de Portugal.`;
    const systemPrompt = "Aja como um mentor financeiro infantil, criando dicas fofas, mágicas e encorajadoras.";
    const apiKey = ""; 
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;

    const payload = {
        contents: [{ parts: [{ text: userQuery }] }],
        systemInstruction: { parts: [{ text: systemPrompt }] },
    };

    // Implementação de Backoff Exponencial para lidar com limites de taxa
    const MAX_RETRIES = 5;
    for (let i = 0; i < MAX_RETRIES; i++) {
        try {
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                const result = await response.json();
                return result.candidates?.[0]?.content?.parts?.[0]?.text || "Ups! Sem dica desta vez, mas continua a poupar!";
            } else if (response.status === 429 && i < MAX_RETRIES - 1) {
                // Too Many Requests, espera e tenta novamente
                const delay = Math.pow(2, i) * 1000;
                await new Promise(resolve => setTimeout(resolve, delay));
                continue;
            } else {
                 console.error("Erro HTTP na chamada Gemini:", response.status, response.statusText);
                 return "A fada da dica está ocupada. Tenta mais tarde!";
            }
        } catch (error) {
            console.error("Erro na chamada Gemini API:", error);
            return "A fada da dica está a dormir. Tenta mais tarde!";
        }
    }
}

// --- LÓGICA DE AÇÕES (GANHAR/POUPAR/GASTAR/DOAR) ---

// NOVO: RENDERIZA MODAL PARA INPUT DE POUPANÇA
function renderSaveInputModal() {
    showModal("Quanto Quer Poupar? 💰", `
        <p class="font-itim mb-4">Seu saldo atual é de **${userData.coins} moedas**. Digite a quantidade que você quer guardar na meta:</p>
        <div class="space-y-4">
            <input type="number" id="save-input-amount" placeholder="Valor a Poupar" class="w-full p-3 border rounded-lg font-itim text-lg" min="1" max="${userData.coins}">
            <button id="execute-save-btn" class="w-full bg-blue-500 text-white p-3 rounded-lg font-itim text-xl hover:bg-blue-600 transition-colors">
                Guardar na Meta (${userData.progress.targetName})
            </button>
        </div>
    `);

    document.getElementById('execute-save-btn')?.addEventListener('click', () => {
        const amount = parseInt(document.getElementById('save-input-amount').value);
        executeSave(amount);
    });
}

// NOVO: EXECUTA A TRANSAÇÃO DE POUPANÇA
function executeSave(saveAmount) {
    if (isNaN(saveAmount) || saveAmount <= 0) {
        return showModal("Erro", "Por favor, insira um valor válido.");
    }
    if (userData.coins < saveAmount) {
        return showModal("Saldo Insuficiente", `Você precisa de **${saveAmount} moedas**, mas só tem ${userData.coins}.`);
    }

    userData.coins -= saveAmount;
    userData.progress.savedAmount += saveAmount;
    
    addTransaction('save', saveAmount, `Poupança para meta: ${userData.progress.targetName}`);
    awardBadge('first_save');
    checkBadges();
    saveUserData();
    hideModal();
    showModal("Poupança Completa! 🏦", `Você guardou **${saveAmount} moedas** na sua meta!`);
}

// MANTIDO: Lógica de Gasto genérico (usado apenas pela Gemini integration, mas não mapeado no botão principal)
function executeGenericSpend(spendAmount) {
    // Este é o modal que permite escolher entre saldo livre ou meta, e a categoria N/D
    
    showModal("Onde Gastar? 🛒", `
        <p class="font-itim mb-4">O valor do gasto é de **${spendAmount} moedas**. De qual saldo você gostaria de retirar?</p>
        <div class="space-y-3">
            <div class="p-3 border rounded-lg bg-red-50">
                <p class="font-bold mb-2">Isso é uma necessidade ou um desejo?</p>
                <select id="spend-category" class="w-full p-2 border rounded font-itim">
                    <option value="Desejo">Desejo (Brinquedo, Doce, etc.)</option>
                    <option value="Necessidade">Necessidade (Comida, Material Escolar, etc.)</option>
                </select>
            </div>
            
            <button id="spend-from-coins" class="w-full bg-red-500 text-white p-3 rounded-lg font-itim hover:bg-red-600 transition-colors" data-source="coins">
                Retirar de Moedas Livres (${userData.coins} disponíveis)
            </button>
            <button id="spend-from-saved" class="w-full bg-orange-500 text-white p-3 rounded-lg font-itim hover:bg-orange-600 transition-colors" data-source="saved">
                Retirar da Poupança (${userData.progress.savedAmount} disponíveis)
            </button>
        </div>
    `);

    const spendFromCoinsBtn = document.getElementById('spend-from-coins');
    const spendFromSavedBtn = document.getElementById('spend-from-saved');
    const categorySelect = document.getElementById('spend-category');

    spendFromCoinsBtn.disabled = userData.coins < spendAmount;
    spendFromSavedBtn.disabled = userData.progress.savedAmount < spendAmount;

    [spendFromCoinsBtn, spendFromSavedBtn].forEach(btn => {
        btn.onclick = () => {
            const source = btn.dataset.source;
            const category = categorySelect.value;
            let success = false;

            if (source === 'coins' && userData.coins >= spendAmount) {
                userData.coins -= spendAmount;
                addTransaction('spend', spendAmount, `Gasto: ${category} (Livre)`);
                success = true;
            } else if (source === 'saved' && userData.progress.savedAmount >= spendAmount) {
                userData.progress.savedAmount -= spendAmount;
                addTransaction('spend', spendAmount, `Gasto: ${category} (Meta)`);
                success = true;
            }

            if (success) {
                saveUserData();
                hideModal();
                
                showModal("Gasto Realizado! 💸", `
                    <p class="mb-4 font-itim">**${spendAmount} moedas** foram gastas! (Categoria: ${category}).</p>
                    <div id="gemini-tip-container">
                        <button id="get-tip-btn" class="w-full bg-purple-500 text-white p-3 rounded-lg font-itim text-lg hover:bg-purple-600 transition-colors">
                            Obter Dica Financeira Mágica ✨
                        </button>
                    </div>
                `);
                
                document.getElementById('get-tip-btn')?.addEventListener('click', async (e) => {
                    const btn = e.target;
                    const tipContainer = document.getElementById('gemini-tip-container');
                    
                    btn.disabled = true;
                    btn.textContent = "A invocar a magia... 🔮";
                    
                    const tip = await getFinancialTip(category, spendAmount);
                    
                    tipContainer.innerHTML = `
                        <div class="p-3 mt-3 bg-yellow-100 border border-yellow-300 rounded-lg">
                            <p class="font-bold text-yellow-800">Dica Mágica da Gemini:</p>
                            <p class="mt-1 text-yellow-900">${tip}</p>
                        </div>
                    `;
                });

            } else {
                showModal("Erro de Saldo", "Saldo insuficiente na conta selecionada.");
            }
        };
    });
}


// NOVO: FUNÇÃO PARA DOAR MOEDAS (Função antiga, agora sem botão no menu principal)
function renderDonateModal() {
     const donateAmount = userData.actions.donate;
     showModal("Doar Moedas ❤️", `
        <p class="font-itim mb-4">Você tem **${userData.coins} moedas**. Você quer doar o valor padrão de **${donateAmount} moedas** e ajudar quem precisa?</p>
        <div class="space-y-4">
            <button id="confirm-donate-btn" class="w-full bg-pink-500 text-white p-3 rounded-lg font-itim text-xl hover:bg-pink-600 transition-colors" data-amount="${donateAmount}">
                Sim, Doar Moedas
            </button>
        </div>
    `);

    document.getElementById('confirm-donate-btn')?.addEventListener('click', () => {
        const amount = parseInt(document.getElementById('confirm-donate-btn').dataset.amount);
         
        if (userData.coins < amount) {
            hideModal();
            return showModal("Saldo Insuficiente", `Você precisa de pelo menos **${amount} moedas** para doar.`);
        }
        
        userData.coins -= amount;
        userData.donationCount = (userData.donationCount || 0) + 1;
        
        addTransaction('donate', amount, "Doação para Caridade");
        checkBadges();
        saveUserData();
        hideModal();
        showModal("Doação Feita! ❤️", `Obrigado por doar **${amount} moedas**! Você fez o bem!`);
    });
}

// --- LÓGICA DO JOGO ---
function launchGame() {
    if (isGameOnCooldown()) {
         const remainingTime = getRemainingCooldownTime();
         return showModal("Jogo em Recarga", `Você pode jogar novamente em **${remainingTime}**.`);
    }

    document.getElementById('game-modal').classList.remove('hidden');
    startGame();
}

// --- GAME ASSETS E LÓGICA (Simplificada) ---
const canvas = document.getElementById('game-canvas');
const ctx = canvas?.getContext('2d');
const GAME_WIDTH = 300;
const GAME_HEIGHT = 400;

let game = {
    piggy: { x: GAME_WIDTH / 2 - 15, y: GAME_HEIGHT - 80, w: 30, h: 30, vy: 0, gravity: 0.25, jumpPower: -10, onCloud: false },
    clouds: [], coins: [], obstacles: [], 
    multiplier: { active: false, remainingTime: 0, value: 2 }, 
    score: 0, isRunning: false, lastTime: 0,
};

function drawPiggy() {
    if (!ctx) return;
    ctx.font = '30px Itim';
    ctx.fillText(userData.currentPet?.value || '🐷', game.piggy.x - 15, game.piggy.y + 25); 
    if (game.multiplier.active) {
        ctx.fillStyle = 'rgba(255, 215, 0, 0.5)';
        ctx.beginPath();
        ctx.arc(game.piggy.x, game.piggy.y + 15, 20, 0, Math.PI * 2);
        ctx.fill();
    }
}
function drawCloud(x, y) {
    if (!ctx) return;
    ctx.fillStyle = 'white';
    ctx.beginPath();
    ctx.arc(x, y, 20, 0, Math.PI * 2);
    ctx.arc(x + 15, y - 10, 20, 0, Math.PI * 2);
    ctx.arc(x + 30, y, 20, 0, Math.PI * 2);
    ctx.arc(x + 15, y + 10, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#3498db';
    ctx.stroke();
}

function drawCoin(x, y) {
    if (!ctx) return;
    ctx.font = '20px Arial';
    ctx.fillText('⭐', x - 10, y + 15);
}

function drawObstacle(x, y) {
    if (!ctx) return;
    ctx.font = '30px Arial';
    ctx.fillText('💀', x - 15, y + 25);
}

function drawMultiplier(x, y) {
    if (!ctx) return;
    ctx.font = '30px Arial';
    ctx.fillText('💎', x - 15, y + 25);
}

function updateGame(deltaTime) {
    game.piggy.vy += game.piggy.gravity;
    game.piggy.y += game.piggy.vy;
    
    if (game.piggy.y < GAME_HEIGHT / 2 && game.piggy.vy < 0) {
        const scrollSpeed = -game.piggy.vy;
        game.piggy.y = GAME_HEIGHT / 2;
        
        game.clouds.forEach(c => c.y += scrollSpeed);
        game.coins.forEach(c => c.y += scrollSpeed);
        game.obstacles.forEach(o => o.y += scrollSpeed);
    }

    game.piggy.onCloud = false;
    game.clouds.forEach(cloud => {
        if (game.piggy.vy > 0 && 
            game.piggy.x + game.piggy.w > cloud.x && 
            game.piggy.x < cloud.x + 50 &&
            game.piggy.y + game.piggy.h > cloud.y && 
            game.piggy.y + game.piggy.h < cloud.y + 20) {
                
            game.piggy.vy = 0;
            game.piggy.y = cloud.y - game.piggy.h;
            game.piggy.onCloud = true;
        }
    });

    let highestCloudY = GAME_HEIGHT;
    if (game.clouds.length > 0) {
        highestCloudY = game.clouds.reduce((min, c) => Math.min(min, c.y), GAME_HEIGHT);
    }

    const MAX_VERTICAL_GAP = 120;
    const MIN_VERTICAL_GAP = 80;

    if (highestCloudY > MIN_VERTICAL_GAP) {
        const newY = highestCloudY - (Math.random() * (MAX_VERTICAL_GAP - MIN_VERTICAL_GAP) + MIN_VERTICAL_GAP);
        
        game.clouds.push({ x: Math.random() * (GAME_WIDTH - 50), y: newY, w: 50 });

        if (Math.random() < 0.7) {
            game.coins.push({ 
                x: Math.random() * (GAME_WIDTH - 20), 
                y: newY - 40, 
                w: 20, h: 20,
                type: Math.random() < 0.9 ? 'coin' : 'multiplier'
            });
        }

        if (Math.random() < 0.3) {
             game.obstacles.push({
                x: Math.random() * (GAME_WIDTH - 30), y: newY - 50, w: 30, h: 30, penalty: 5 
            });
        }
    }

    game.coins = game.coins.filter(coin => {
        if (game.piggy.x < coin.x + coin.w && game.piggy.x + game.piggy.w > coin.x &&
            game.piggy.y < coin.y + coin.h && game.piggy.y + game.piggy.h > coin.y) {
            
            if (coin.type === 'coin') {
                const points = game.multiplier.active ? 2 : 1;
                game.score += points;
                document.getElementById('game-score').textContent = game.score;
            } else if (coin.type === 'multiplier') {
                game.multiplier.active = true;
                game.multiplier.remainingTime = 5 * 60;
            }
            return false;
        }
        return coin.y < GAME_HEIGHT;
    });
    
    game.obstacles = game.obstacles.filter(obstacle => {
         if (game.piggy.x < obstacle.x + obstacle.w && game.piggy.x + game.piggy.w > obstacle.x &&
            game.piggy.y < obstacle.y + obstacle.h && game.piggy.y + game.piggy.h > obstacle.y) {
            
            game.score = Math.max(0, game.score - obstacle.penalty);
            document.getElementById('game-score').textContent = game.score;
            return false;
        }
        return obstacle.y < GAME_HEIGHT;
    });

    if (game.multiplier.active) {
        game.multiplier.remainingTime--;
        if (game.multiplier.remainingTime <= 0) {
            game.multiplier.active = false;
        }
    }

    game.clouds = game.clouds.filter(cloud => cloud.y < GAME_HEIGHT);
    if (game.piggy.y > GAME_HEIGHT) {
        gameOver();
    }
    if (game.piggy.x > GAME_WIDTH) game.piggy.x = -game.piggy.w;
    if (game.piggy.x < -game.piggy.w) game.piggy.x = GAME_WIDTH;
}

function gameLoop(timestamp) {
    if (!game.isRunning || !ctx) return;

    const deltaTime = timestamp - game.lastTime;
    game.lastTime = timestamp;

    ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    game.clouds.forEach(c => drawCloud(c.x, c.y));
    
    game.coins.forEach(c => {
        if (c.type === 'coin') drawCoin(c.x, c.y);
        if (c.type === 'multiplier') drawMultiplier(c.x, c.y);
    });
    
    game.obstacles.forEach(o => drawObstacle(o.x, o.y));

    drawPiggy();
    
    updateGame(deltaTime / 1000 * 60);

    requestAnimationFrame(gameLoop);
}

function startGame() { 
    // Implementação completa do startGame
    game = {
        piggy: { x: GAME_WIDTH / 2 - 15, y: GAME_HEIGHT - 80, w: 30, h: 30, vy: 0, gravity: 0.25, jumpPower: -10, onCloud: false },
        clouds: [
            { x: GAME_WIDTH / 2 - 25, y: GAME_HEIGHT - 30, w: 50}, 
            { x: Math.random() * (GAME_WIDTH - 50), y: GAME_HEIGHT - 120, w: 50}, 
            { x: Math.random() * (GAME_WIDTH - 50), y: GAME_HEIGHT - 210, w: 50}, 
        ],
        coins: [], obstacles: [],
        multiplier: { active: false, remainingTime: 0, value: 2 },
        score: 0, isRunning: true, lastTime: performance.now(),
    };
    document.getElementById('game-score').textContent = game.score;
    document.getElementById('game-message').textContent = `Pule nas nuvens e colete ⭐ com o seu ${userData.currentPet?.label || 'Porquinho'}!`;
    
    requestAnimationFrame(gameLoop);
    document.addEventListener('keydown', handleInput);
    canvas?.addEventListener('click', handleInput);
}

function gameOver() {
    game.isRunning = false;
    document.removeEventListener('keydown', handleInput);
    canvas?.removeEventListener('click', handleInput);

    const finalScore = game.score * userData.actions.earn;

    if (finalScore > 0) {
        userData.coins += finalScore; 
        userData.gameCooldownEndTime = Date.now() + COOLDOWN_DURATION_MS; // Define o cooldown
        addTransaction('earn', finalScore, `Recompensa do Jogo (${game.score} itens)`);
        checkBadges();
        saveUserData();
        document.getElementById('game-message').textContent = `FIM DE JOGO! Você ganhou ${finalScore} moedas!`;
        showModal("Vitória no Jogo! 🥳", `Você coletou **${game.score} itens** e ganhou **${finalScore} moedas**!`);
    } else {
         document.getElementById('game-message').textContent = 'FIM DE JOGO! Tente novamente para ganhar moedas.';
    }

    document.getElementById('game-modal').classList.add('hidden'); 
}

function handleInput(event) {
    if (game.isRunning) {
        if (event.key === ' ' || event.key === 'ArrowUp' || event.type === 'click') {
            if (game.piggy.onCloud) {
                game.piggy.vy = game.piggy.jumpPower;
                game.piggy.onCloud = false;
            }
        }
        
        const moveSpeed = 10;
        if (event.key === 'ArrowLeft') {
            game.piggy.x -= moveSpeed;
        } else if (event.key === 'ArrowRight') {
            game.piggy.x += moveSpeed;
        }
    }
}


// --- FUNÇÕES DE LÓGICA / DADOS ---

function calculateInterest() {
    const INTEREST_RATE = 0.005; 
    const lastDate = new Date(userData.lastInterestDate);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - lastDate.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)); 

    if (diffDays >= 1 && userData.progress.savedAmount > 0) {
        let interestGained = 0;
        for (let i = 0; i < diffDays; i++) {
            interestGained += Math.floor(userData.progress.savedAmount * INTEREST_RATE);
        }
        
        if (interestGained > 0) {
            userData.progress.savedAmount += interestGained;
            userData.lastInterestDate = now.getTime(); 
            addTransaction('earn', interestGained, `Juros (${diffDays} dias) da Poupança`);
            showModal("Juros Ganhos! ✨", `Sua poupança rendeu **${interestGained} moedas** de juros acumulados!`);
            saveUserData();
        }
    }
    userData.lastInterestDate = now.getTime(); 
}

function awardBadge(badgeId) {
     if (!userData.badges.includes(badgeId)) {
        userData.badges.push(badgeId);
        const badge = BADGES[badgeId];
        if (badge) {
            showModal(`Nova Conquista: ${badge.name}! 🏆`, `${badge.description} Parabéns!`);
            saveUserData();
        }
    }
}

function checkBadges() {
     if (userData.transactions?.some(t => t.type === 'earn') && userData.coins > 0) {
        awardBadge('first_earn');
    }
    if (userData.transactions?.some(t => t.type === 'save')) {
        awardBadge('first_save');
    }
    if (userData.donationCount >= DONATION_TARGET) {
         awardBadge('generous');
    }
    const progressPercent = userData.progress.goal > 0
        ? (userData.progress.savedAmount / userData.progress.goal)
        : 0;

    if (progressPercent >= 0.10) {
        awardBadge('goal_starter');
    }
    if (progressPercent >= 1.0) {
        awardBadge('goal_master');
    }
}

function addTransaction(type, amount, description) {
     userData.transactions = userData.transactions || [];
     userData.transactions.unshift({
        id: Date.now(),
        type: type, // 'earn', 'save', 'spend', 'donate'
        amount: amount,
        description: description,
        date: new Date().toLocaleDateString('pt-BR')
    });
    userData.transactions = userData.transactions.slice(0, 50); 
}

// --- FUNÇÕES MODAIS ---

// NOVO: Função auxiliar para converter **Markdown** para HTML <b>
function convertMarkdownToHtml(text) {
    if (typeof text !== 'string') return text;
    // Converte **negrito** para <b>negrito</b>
    return text.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
}

function renderTasks(container, showDelete = false) {
     container.innerHTML = '';
    if (!userData.tasks || userData.tasks.length === 0) {
        container.innerHTML = '<p class="text-center text-gray-500 pt-2 font-itim">Nenhuma tarefa. Adicione uma!</p>';
        return;
    }

    userData.tasks.forEach(task => {
        const li = document.createElement('li');
        const deleteBtn = showDelete ? `<button data-task-id="${task.id}" class="delete-task-btn text-red-500 p-1 hover:text-red-700 transition-colors"><i class="fa-solid fa-trash-can"></i></button>` : '';

        li.className = 'flex items-center justify-between p-3 border-b last:border-b-0';
        li.innerHTML = `
            <span class="text-lg font-itim ${task.completed ? 'line-through text-gray-500' : 'text-gray-800'}">
                ${task.text}
            </span>
            <div class="flex space-x-2 items-center">
                ${deleteBtn}
                ${!showDelete ? `
                <button data-task-id="${task.id}" class="toggle-task p-2 rounded-full w-10 h-10 flex items-center justify-center 
                    ${task.completed ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500 hover:bg-green-100'}">
                    <i class="fa-solid ${task.completed ? 'fa-check' : 'fa-circle'}"></i>
                </button>
                ` : ''}
            </div>
        `;
        container.appendChild(li);
    });

    if (!showDelete) { // Botões da criança (toggle)
        document.querySelectorAll('.toggle-task').forEach(button => {
            button.addEventListener('click', (e) => {
                const taskId = e.currentTarget.dataset.taskId;
                toggleTaskCompletion(taskId);
            });
        });
    } else { // Botões de exclusão (não usados na vista da criança)
        document.querySelectorAll('.delete-task-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const taskId = e.currentTarget.dataset.taskId;
                deleteTask(taskId);
            });
        });
    }
}

function toggleTaskCompletion(taskId) {
    const task = userData.tasks.find(t => t.id === taskId);
    if (task) {
        const wasCompleted = task.completed;
        task.completed = !task.completed;
        
        if (task.completed && !wasCompleted) {
            const reward = userData.actions.earn;
            userData.coins += reward; 
            addTransaction('earn', reward, `Tarefa concluída: ${task.text}`);
            checkBadges(); 
            showModal("Tarefa Concluída!", `Parabéns! Você ganhou **${reward} moedas**!`);
        } else if (wasCompleted && !task.completed) {
            const penalty = userData.actions.earn;
            userData.coins = Math.max(0, userData.coins - penalty);
            addTransaction('spend', penalty, `Tarefa desfeita: ${task.text}`);
            showModal("Tarefa Desfeita", `Você perdeu **${penalty} moedas** de volta.`);
        }
        saveUserData();
    }
}

function deleteTask(taskId) {
    userData.tasks = userData.tasks.filter(t => t.id !== taskId);
    saveUserData();
}

// NOVO: Modal para o filho alterar o nome da meta
window.renderGoalSettingModal = function() {
    showModal("Minha Meta de Poupança 🎯", `
        <p class="font-itim mb-4 text-center text-xl">
            Meta atual: <span class="text-blue-600 font-bold">${userData.progress.targetName}</span>
            (Faltam ${userData.progress.goal - userData.progress.savedAmount} moedas)
        </p>
        <div class="space-y-4">
            <label for="goal-name-input" class="font-bold font-itim block">Mudar o nome da meta:</label>
            <input type="text" id="goal-name-input" value="${userData.progress.targetName}" 
                   placeholder="Ex: Bicicleta Nova, Viagem, Tablet" 
                   class="w-full p-3 border rounded-lg font-itim text-lg">
            <button id="save-goal-name-btn" class="w-full bg-green-500 text-white p-3 rounded-lg font-itim text-xl hover:bg-green-600 transition-colors">
                Salvar Nome
            </button>
        </div>
        <p class="text-sm text-gray-500 mt-4 font-itim text-center">O valor da meta é definido pelo seu responsável.</p>
    `);

    document.getElementById('save-goal-name-btn')?.addEventListener('click', () => {
        const newName = document.getElementById('goal-name-input').value.trim();
        if (newName) {
            userData.progress.targetName = newName;
            saveUserData();
            hideModal();
            showModal("Sucesso!", `O nome da meta foi atualizado para **${newName}**!`);
        } else {
            showModal("Erro", "O nome da meta não pode ser vazio.");
        }
    });
}


// Expondo as funções modais para serem acessíveis via onclick
window.renderTaskManagementModal = () => showModal("Gerenciar Tarefas", "Conteúdo...");
window.renderSettingsModal = () => showModal("Configurações do App", "Conteúdo...");
window.renderProfileSettingsModal = () => showModal("Perfil e Ícone", "Conteúdo...");
window.renderThemesModal = () => showModal("Temas de Fundo", "Conteúdo...");
window.renderCompletedTasksModal = () => showModal("Tarefas Concluídas", "Conteúdo...");

// CORRIGIDO: renderHistoryModal exposto globalmente
window.renderHistoryModal = function() { showModal("Histórico de Transações", renderHistoryList(userData.transactions || []));}
// CORRIGIDO: renderBadgesModal exposto globalmente
window.renderBadgesModal = function() {
    const ownedBadges = userData.badges || [];
    
    const badgeContent = Object.values(BADGES).map(badge => {
        const unlocked = ownedBadges.includes(badge.id);
        const iconClass = unlocked ? 'text-yellow-500' : 'text-gray-400';
        
        return `
            <div class="flex items-start space-x-3 p-3 border rounded-lg ${unlocked ? 'bg-yellow-50' : 'bg-gray-100'}">
                <i class="fa-solid ${badge.icon} text-3xl ${iconClass} mt-1"></i>
                <div>
                    <p class="font-bold text-lg">${badge.name}</p>
                    <p class="text-sm text-gray-700">${badge.description}</p>
                </div>
            </div>
        `;
    }).join('');

    showModal("Suas Conquistas 🏆", `
        <p class="font-itim mb-4 text-center text-xl">Você desbloqueou **${ownedBadges.length} de ${Object.keys(BADGES).length}** conquistas!</p>
        <div class="space-y-3 max-h-80 overflow-y-auto">
            ${badgeContent}
        </div>
    `);
}

// NOVO: LÓGICA DO MODAL DE SELEÇÃO DE EMOÇÃO
window.renderEmotionSelectionModal = function() {
    const allEmotions = STANDARD_EMOTIONS.concat(SHOP_EMOTIONS.map(e => ({ ...e, price: e.price || 0 })));
    
    const content = allEmotions.map(item => {
        const isEquipped = userData.currentEmotion.value === item.value;
        const owned = userData.currentEmotion.shopOwned.includes(item.id) || !item.price;
        const buttonText = isEquipped ? 'Equipado' : owned ? 'Usar' : `${item.price} Moedas`;
        const buttonClass = isEquipped ? 'bg-green-500' : owned ? 'bg-blue-500' : 'bg-gray-400 cursor-not-allowed';

        return `
            <div class="p-2 border rounded-lg shadow-sm text-center bg-gray-50">
                <span class="text-4xl">${item.value}</span>
                <p class="font-bold text-sm">${item.label}</p>
                <button class="select-emotion-btn ${buttonClass} text-white text-xs p-1 rounded-lg w-full transition-colors"
                    data-value="${item.value}" data-id="${item.id}" data-price="${item.price || 0}" data-owned="${owned}">
                    ${buttonText}
                </button>
            </div>
        `;
    }).join('');

    showModal("Selecione sua Emoção ✨", `
        <div class="grid grid-cols-3 gap-3">
            ${content}
        </div>
    `);

    document.querySelectorAll('.select-emotion-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const btn = e.currentTarget;
            const value = btn.dataset.value;
            const id = btn.dataset.id;
            const price = parseInt(btn.dataset.price);
            const owned = btn.dataset.owned === 'true';

            if (!owned && price > 0) {
                if (userData.coins < price) {
                     return showModal("Moedas Insuficientes", `Você precisa de **${price} moedas** para comprar esta emoção!`);
                }
                
                // Compra e equipa
                userData.coins -= price;
                userData.currentEmotion.shopOwned.push(id);
                userData.currentEmotion.value = value;
                addTransaction('spend', price, `Compra de Emoção: ${value}`);
                showModal("Emoção Desbloqueada!", `Você comprou e está usando **${value}**!`);
            } else {
                // Equipa
                userData.currentEmotion.value = value;
                hideModal();
            }
            saveUserData();
        });
    });
}


// --- NOVO: LÓGICA DA LOJA MÁGICA REVISADA ---
window.renderShopModal = function() {
    showModal("Loja Mágica ✨", `
        <div class="tabs flex space-x-2 border-b mb-4 font-itim">
            <button id="tab-themes" class="tab-btn p-2 border-b-2 border-transparent hover:border-blue-400" data-tab="themes">Temas</button>
            <button id="tab-pets" class="tab-btn p-2 border-b-2 border-transparent hover:border-blue-400" data-tab="pets">Bichinhos</button>
            <button id="tab-icons" class="tab-btn p-2 border-b-2 border-transparent hover:border-blue-400" data-tab="icons">Ícones</button>
            <button id="tab-emotions" class="tab-btn p-2 border-b-2 border-transparent hover:border-blue-400" data-tab="emotions">Emoções</button>
        </div>
        <div id="shop-content"></div>
        <p class="text-right text-sm font-bold text-orange-500 mt-4">Suas Moedas: ${userData.coins}</p>
    `);
    
    let currentTab = 'themes';
    
    function renderTab(tabId) {
        const contentEl = document.getElementById('shop-content');
        if (!contentEl) return;
        
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('border-blue-600', btn.dataset.tab === tabId);
            btn.classList.toggle('text-blue-600', btn.dataset.tab === tabId);
        });

        if (tabId === 'themes') contentEl.innerHTML = renderThemesShop();
        else if (tabId === 'pets') contentEl.innerHTML = renderPetsShop();
        else if (tabId === 'icons') contentEl.innerHTML = renderIconsShop();
        else if (tabId === 'emotions') contentEl.innerHTML = renderEmotionsShop();
        
        attachShopEventListeners();
    }
    
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => renderTab(e.target.dataset.tab));
    });
    
    renderTab(currentTab);
}

// Funções de Renderização Específicas da Loja (Themes, Pets, Icons, Emotions)
function renderThemesShop() {
     return `<div class="grid grid-cols-2 gap-4">${Object.entries(DEFAULT_CHILD_DATA.settings.themes).map(([key, item]) => {
        const owned = userData.settings.themes[key]?.purchased;
        const price = item.price;
        const canAfford = userData.coins >= price;
        const buttonText = owned ? 'Equipado' : price === 0 ? 'Grátis' : canAfford ? 'Comprar' : 'Moedas';
        const buttonClass = owned ? 'bg-green-500' : price === 0 ? 'bg-blue-500' : canAfford ? 'bg-orange-500' : 'bg-gray-400 cursor-not-allowed';
        
        return `
            <div class="p-3 border rounded-lg shadow-sm text-center bg-gray-50">
                <div class="h-16 w-full rounded-lg mb-2 shadow-inner" style="background: linear-gradient(180deg, ${item.start} 0%, ${item.end} 100%);"></div>
                <p class="font-bold">${key.charAt(0).toUpperCase() + key.slice(1)}</p>
                <p class="text-xs text-gray-500 mb-2">${owned ? 'Seu' : `${price} Moedas`}</p>
                <button class="shop-item-btn ${buttonClass} text-white text-sm p-2 rounded-lg w-full transition-colors"
                    data-type="theme" data-id="${key}" data-price="${price}" data-owned="${owned}">
                    ${buttonText}
                </button>
            </div>
        `;
    }).join('')}</div>`;
}

function renderPetsShop() {
    return `<div class="grid grid-cols-3 gap-3">${PET_CHARACTERS.map(item => {
        const owned = userData.unlockedPets.includes(item.id);
        const isEquipped = userData.currentPet?.id === item.id;
        const price = item.price;
        const canAfford = userData.coins >= price;
        const buttonText = isEquipped ? 'Equipado' : owned ? 'Usar' : price === 0 ? 'Grátis' : canAfford ? 'Comprar' : 'Moedas';
        const buttonClass = isEquipped ? 'bg-green-500' : owned ? 'bg-blue-500' : price === 0 ? 'bg-blue-500' : canAfford ? 'bg-orange-500' : 'bg-gray-400 cursor-not-allowed';
        
        return `
            <div class="p-2 border rounded-lg shadow-sm text-center bg-gray-50">
                <span class="text-4xl">${item.value}</span>
                <p class="font-bold text-sm">${item.label}</p>
                <p class="text-xs text-gray-500 mb-2">${owned ? 'Seu' : `${price} Moedas`}</p>
                <button class="shop-item-btn ${buttonClass} text-white text-xs p-1 rounded-lg w-full transition-colors"
                    data-type="pet" data-id="${item.id}" data-value="${item.value}" data-price="${price}" data-owned="${owned}">
                    ${buttonText}
                </button>
            </div>
        `;
    }).join('')}</div>`;
}

function renderIconsShop() {
    const currentIcon = userData.profileIcon.value;
    const shopItems = SHOP_ICONS.concat({ id: 'default', type: 'fa-icon', value: 'fa-user-astronaut', label: 'Padrão', price: 0 }); // Inclui o padrão
    
    return `<div class="grid grid-cols-3 gap-3">${shopItems.map(item => {
        const owned = userData.profileIcon.shopOwned.includes(item.id) || item.price === 0;
        const isEquipped = currentIcon === item.value;
        const price = item.price;
        const canAfford = userData.coins >= price;
        const buttonText = isEquipped ? 'Equipado' : owned ? 'Usar' : price === 0 ? 'Grátis' : canAfford ? 'Comprar' : 'Moedas';
        const buttonClass = isEquipped ? 'bg-green-500' : 'bg-blue-500'; // Simplificado
        
        const iconDisplay = item.type === 'fa-icon' 
            ? `<i class="fa-solid ${item.value} text-3xl"></i>` 
            : `<span class="text-3xl">${item.value}</span>`;

        return `
            <div class="p-2 border rounded-lg shadow-sm text-center bg-gray-50">
                <div class="h-10 flex items-center justify-center">${iconDisplay}</div>
                <p class="font-bold text-sm">${item.label}</p>
                <p class="text-xs text-gray-500 mb-2">${owned ? 'Seu' : `${price} Moedas`}</p>
                <button class="shop-item-btn ${buttonClass} text-white text-xs p-1 rounded-lg w-full transition-colors"
                    data-type="icon" data-id="${item.id}" data-value="${item.value}" data-icon-type="${item.type}" data-price="${price}" data-owned="${owned}">
                    ${buttonText}
                </button>
            </div>
        `;
    }).join('')}</div>`;
}

function renderEmotionsShop() {
    const allEmotions = STANDARD_EMOTIONS.concat(SHOP_EMOTIONS);
    
    return `<div class="grid grid-cols-3 gap-3">${allEmotions.map(item => {
        const owned = userData.currentEmotion.shopOwned.includes(item.id) || item.price === 0 || !item.price;
        const isEquipped = userData.currentEmotion.value === item.value;
        const price = item.price || 0;
        const canAfford = userData.coins >= price;
        const buttonText = isEquipped ? 'Equipado' : owned ? 'Usar' : price === 0 ? 'Grátis' : canAfford ? 'Comprar' : 'Moedas';
        const buttonClass = isEquipped ? 'bg-green-500' : owned ? 'bg-blue-500' : price === 0 ? 'bg-blue-500' : canAfford ? 'bg-orange-500' : 'bg-gray-400 cursor-not-allowed';
        
        return `
            <div class="p-2 border rounded-lg shadow-sm text-center bg-gray-50">
                <span class="text-4xl">${item.value}</span>
                <p class="font-bold text-sm">${item.label}</p>
                <p class="text-xs text-gray-500 mb-2">${owned ? 'Seu' : `${price} Moedas`}</p>
                <button class="select-emotion-btn ${buttonClass} text-white text-xs p-1 rounded-lg w-full transition-colors"
                    data-value="${item.value}" data-id="${item.id}" data-price="${price}" data-owned="${owned}">
                    ${buttonText}
                </button>
            </div>
        `;
    }).join('')}</div>`;
}

// --- Lógica de Compra e Equipamento (Unificado) ---
function attachShopEventListeners() {
    document.querySelectorAll('.shop-item-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const btn = e.currentTarget;
            const type = btn.dataset.type;
            const id = btn.dataset.id;
            const price = parseInt(btn.dataset.price);
            const owned = btn.dataset.owned === 'true';

            if (!owned) {
                if (userData.coins < price) {
                     return showModal("Moedas Insuficientes", `Você precisa de **${price} moedas** para comprar este item!`);
                }
                
                // Lógica de Compra
                userData.coins -= price;
                addTransaction('spend', price, `Compra na Loja: ${type} (${id})`);
                
                // Marca como comprado e equipa
                if (type === 'theme') {
                    userData.settings.themes[id].purchased = true;
                    userData.settings.theme = id;
                } else if (type === 'pet') {
                    userData.unlockedPets.push(id);
                    userData.currentPet = PET_CHARACTERS.find(p => p.id === id);
                } else if (type === 'icon') {
                    userData.profileIcon.shopOwned.push(id);
                    userData.profileIcon = { type: btn.dataset.iconType, value: btn.dataset.value, shopOwned: userData.profileIcon.shopOwned };
                } else if (type === 'emotion') {
                    userData.currentEmotion.shopOwned.push(id);
                    userData.currentEmotion = { value: btn.dataset.value, shopOwned: userData.currentEmotion.shopOwned };
                }

                showModal("Compra Concluída!", `Você comprou e equipou **${btn.textContent}** por **${price} moedas**!`);

            } else {
                // Lógica de Equipamento
                if (type === 'theme') {
                    userData.settings.theme = id;
                } else if (type === 'pet') {
                    userData.currentPet = PET_CHARACTERS.find(p => p.id === id);
                } else if (type === 'icon') {
                    userData.profileIcon = { type: btn.dataset.iconType, value: btn.dataset.value, shopOwned: userData.profileIcon.shopOwned };
                } else if (type === 'emotion') {
                    userData.currentEmotion = { value: btn.dataset.value, shopOwned: userData.currentEmotion.shopOwned };
                }
                showModal("Item Equipado", `Você está usando **${btn.textContent}**!`);
            }
            
            saveUserData();
            renderShopModal(); // Re-renderiza a loja para atualizar os botões
        });
    });
}


// NOVO: LÓGICA DO MODAL DE CONQUISTAS (BADGES)
window.renderBadgesModal = function() {
    const ownedBadges = userData.badges || [];
    
    const badgeContent = Object.values(BADGES).map(badge => {
        const unlocked = ownedBadges.includes(badge.id);
        const iconClass = unlocked ? 'text-yellow-500' : 'text-gray-400';
        
        return `
            <div class="flex items-start space-x-3 p-3 border rounded-lg ${unlocked ? 'bg-yellow-50' : 'bg-gray-100'}">
                <i class="fa-solid ${badge.icon} text-3xl ${iconClass} mt-1"></i>
                <div>
                    <p class="font-bold text-lg">${badge.name}</p>
                    <p class="text-sm text-gray-700">${badge.description}</p>
                </div>
            </div>
        `;
    }).join('');

    showModal("Suas Conquistas 🏆", `
        <p class="font-itim mb-4 text-center text-xl">Você desbloqueou **${ownedBadges.length} de ${Object.keys(BADGES).length}** conquistas!</p>
        <div class="space-y-3 max-h-80 overflow-y-auto">
            ${badgeContent}
        </div>
    `);
}

// --- UI GERAL ---

// CORREÇÃO CRÍTICA: Aplica a conversão de **Markdown** para HTML <b>
window.showModal = function(title, message) {
    if (modalTitleEl) modalTitleEl.textContent = title;
    if (modalBodyEl) modalBodyEl.innerHTML = convertMarkdownToHtml(message);
    modalEl?.classList.remove('hidden');
}

window.hideModal = function() {
    modalEl?.classList.add('hidden');
    if (game.isRunning) {
         game.isRunning = false;
         document.getElementById('game-modal')?.classList.add('hidden');
    }
}

document.getElementById('modal-close-btn')?.addEventListener('click', hideModal);

// O sidebar e o open-sidebar-btn foram removidos da vista da criança, mas mantemos o listener do botão de fechar para o pai
document.getElementById('close-sidebar-btn')?.addEventListener('click', () => {
    sidebarEl?.classList.remove('translate-x-0');
    sidebarEl?.classList.add('-translate-x-full');
});

document.getElementById('menu-logout')?.addEventListener('click', async () => {
    // Este botão está na sidebar do pai, que está fora do fluxo da criança
    sidebarEl?.classList.add('-translate-x-full');
    await signOut(auth);
    showLoginView();
    showModal("Sessão Encerrada", "Você saiu. Faça login novamente.");
});


// --- DASHBOARD DO PAI LÓGICA (MANTIDA) ---
// Função utilitária para gerar código
function generateUniqueCode() {
    let code = '';
    for (let i = 0; i < 4; i++) {
        code += Math.floor(Math.random() * 10).toString();
    }
    return code;
}

// NOVO: Mudar para a Home do Pai (Tela 1) - EXPOSTO GLOBALMENTE
window.showParentHome = function() {
    currentChildId = null; // Desseleciona a criança
    
    const homeView = document.getElementById('parent-home-view');
    const managementView = document.getElementById('child-management-view');

    if (homeView) homeView.classList.remove('hidden');
    if (managementView) managementView.classList.add('hidden');
    
    renderParentDashboard(); // Renderiza a lista de crianças
}

// NOVO: RENDERIZA MODAL PARA ADICIONAR CRIANÇA
window.renderAddChildModal = function() {
    showModal("Adicionar Novo Perfil", `
        <form id="add-child-form-modal" class="space-y-4">
            <label for="new-child-name-input-modal" class="font-bold font-itim block">Nome da Criança:</label>
            <input type="text" id="new-child-name-input-modal" placeholder="Nome (Ex: Alex, Bia)" class="w-full p-3 border rounded-lg font-itim text-lg" required>
            <p id="add-child-message" class="text-red-500 font-itim"></p>
            <button type="submit" id="submit-add-child-btn" class="w-full bg-purple-500 text-white p-3 rounded-lg font-itim text-xl hover:bg-purple-600 transition-colors">
                Adicionar Perfil
            </button>
        </form>
    `);

    // Anexa o listener ao novo formulário dentro do modal
    document.getElementById('add-child-form-modal')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const nameInput = document.getElementById('new-child-name-input-modal');
        const name = nameInput.value.trim();
        
        if (name && parentId) {
            try { 
                const childUid = crypto.randomUUID(); 
                const childCode = generateUniqueCode();
                
                const newChild = {
                    uid: childUid,
                    name: name,
                    code: childCode,
                    profileIcon: DEFAULT_CHILD_DATA.profileIcon, 
                    currentEmotion: DEFAULT_CHILD_DATA.currentEmotion
                };
                
                // 1. Cria o documento real da criança primeiro
                const childInitialData = { ...DEFAULT_CHILD_DATA, name: name };
                await setDoc(CHILD_PROFILE_DOC_REF(parentId, childUid), childInitialData); 
                
                // 2. Atualiza a lista do pai
                if (!parentData.children) {
                    parentData.children = [];
                }
                parentData.children.push(newChild);
                await saveParentData(); 

                nameInput.value = '';
                hideModal();
                showModal("Criança Adicionada!", `**${name}** foi adicionada com sucesso. Código: **${childCode}**.`);
                
            } catch (error) {
                console.error("Erro CRÍTICO ao adicionar criança:", error);
                document.getElementById('add-child-message').textContent = `Erro: ${error.message}. Tente novamente.`;
                
            } finally {
                // CRÍTICO: Garante que o usuário permaneça na vista do pai mesmo após o erro no catch
                window.showParentHome(); 
            }
        } else {
            document.getElementById('add-child-message').textContent = "Nome da criança é obrigatório.";
        }
    });
}


function renderParentDashboard() {

    if (userType !== 'Parent') return;

    const childrenListEl = document.getElementById('parent-children-list');
    const parentGreetingEl = document.getElementById('parent-greeting'); // Elemento de saudação
    
    // DEFESA CRÍTICA: Inicializa os elementos e usa try/catch para evitar tela em branco
    if (childrenListEl) childrenListEl.innerHTML = '';
    if (parentGreetingEl) {
         const parentFirstName = parentData.name.split(' ')[0] || 'Responsável';
         parentGreetingEl.textContent = `Olá, ${parentFirstName}!`;
    }
    
    try {
        if (parentData.children.length === 0) {
            if (childrenListEl) childrenListEl.innerHTML = `<p class="text-gray-500 font-itim text-center mt-4 p-6 bg-gray-50 rounded-lg shadow-inner">Nenhuma criança adicionada ainda. Clique no '+' para começar.</p>`;
        } else {
            // 1. Renderiza a lista de crianças
            parentData.children.forEach(child => {
                // Usando tamanho maior para o ícone conforme o Figma
                const iconHtml = getIconHtml(child.profileIcon, 'text-4xl', 'w-20 h-20'); 

                const div = document.createElement('div');
                // NOVO ESTILO: Altura fixa alta (107px) e sombra (Figma)
                div.className = 'w-full h-[107px] p-2 bg-[#FCFCFC] rounded-lg shadow-md flex justify-between items-center transition-shadow hover:shadow-lg';
                div.style.boxShadow = '0px 4px 4px rgba(0, 0, 0, 0.25)'; // Sombra explícita do Figma
                
                div.innerHTML = `
                    <div class="flex items-center space-x-3">
                        ${iconHtml} 
                        <div>
                            <span class="font-itim text-2xl sm:text-3xl text-gray-800 font-bold block">${child.name}</span>
                            <span class="text-sm font-bold text-blue-600">CÓDIGO: ${child.code}</span>
                        </div>
                    </div>
                    
                    <div class="flex space-x-2 items-center p-1">
                        
                        <button data-uid="${child.uid}" class="view-child-btn bg-blue-500 text-white p-2 rounded-full hover:bg-blue-600 transition-colors shadow-md w-10 h-10 flex items-center justify-center" title="Gerenciar Perfil">
                            <i class="fa-solid fa-gear text-xl"></i>
                        </button>
                        
                        <button data-uid="${child.uid}" class="delete-child-btn text-red-500 bg-gray-100 hover:bg-red-100 p-2 rounded-full transition-colors shadow-md w-10 h-10 flex items-center justify-center" title="Apagar Perfil">
                            <i class="fa-solid fa-trash-can text-xl"></i>
                        </button>
                    </div>
                `;
                if (childrenListEl) childrenListEl.appendChild(div);
            });
            
            // 2. Adiciona listeners para ver o dashboard individual e excluir
            document.querySelectorAll('.view-child-btn').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const childUid = e.currentTarget.dataset.uid;
                    currentChildId = childUid;
                    const childDataLocal = await getChildDataSnapshot(childUid); 
                    if (childDataLocal) {
                         window.showChildManagementView(childUid);
                    } else {
                        // Fallback com dados default, mas nome correto
                         window.showChildManagementView(childUid); 
                    }
                });
            });

            // NOVO: Listener para Excluir
            document.querySelectorAll('.delete-child-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const childUid = e.currentTarget.dataset.uid;
                    const child = parentData.children.find(c => c.uid === childUid);
                    if (child) {
                        confirmDeleteChild(child.uid, child.name);
                    }
                });
            });
        }
        
    } catch (e) {
        console.error("Erro CRÍTICO durante renderParentDashboard:", e);
        if (childrenListEl) childrenListEl.innerHTML = `<p class="text-red-500 font-itim text-center mt-4">Erro Crítico ao exibir perfis. Veja o console.</p>`;
    }
}


// --- NOVO: LÓGICA DE EXCLUSÃO DE PERFIL (PAI) ---

function confirmDeleteChild(uid, name) {
    showModal("Confirmação de Exclusão", `
        <p class="font-itim text-xl text-center mb-4">Você tem certeza que deseja **EXCLUIR PERMANENTEMENTE** o perfil de:</p>
        <p class="font-itim text-2xl font-bold text-red-600 text-center">${name}</p>
        <p class="text-sm text-center text-gray-500 mt-2">Isto irá apagar todas as moedas, tarefas e histórico desta criança.</p>
        <div class="flex justify-center space-x-4 mt-6">
            <button onclick="hideModal()" class="bg-gray-300 text-gray-800 p-3 rounded-lg font-itim hover:bg-gray-400">Cancelar</button>
            <button id="execute-delete-btn" data-uid="${uid}" class="bg-red-600 text-white p-3 rounded-lg font-itim hover:bg-red-700">Excluir Permanentemente</button>
        </div>
    `);

    document.getElementById('execute-delete-btn')?.addEventListener('click', (e) => {
        const targetUid = e.currentTarget.dataset.uid;
        hideModal();
        deleteChildProfile(targetUid);
    });
}

async function deleteChildProfile(uid) {
    if (!parentId || userType !== 'Parent' || !uid) return;

    try {
        // 1. Remove o documento principal da criança no Firestore
        const childDocRef = CHILD_PROFILE_DOC_REF(parentId, uid);
        await deleteDoc(childDocRef); 

        // 2. Remove a criança da lista denormalizada do pai (parentData.children)
        parentData.children = parentData.children.filter(child => child.uid !== uid);
        await saveParentData(); 
        
        // 3. Atualiza a UI
        showModal("Excluído com Sucesso", "O perfil da criança foi removido.");
        window.showParentHome(); // Volta para a tela Home do pai e re-renderiza a lista
        
    } catch (error) {
        console.error("Erro ao excluir perfil da criança:", error);
        showModal("Erro de Exclusão", `Não foi possível excluir o perfil no banco de dados. Detalhe: ${error.message}.`);
        // Garante que a UI do pai seja atualizada mesmo se a exclusão do doc falhar
        window.showParentHome();
    }
}

// NOVO: Mudar para o Gerenciamento da Criança (Tela 2) - EXPOSTO GLOBALMENTE
window.showChildManagementView = async function(childUid) {
    currentChildId = childUid;
    const childData = await getChildDataSnapshot(childUid);
    if (childData) {
        renderChildManagement(childData);
        document.getElementById('parent-home-view').classList.add('hidden');
        document.getElementById('child-management-view').classList.remove('hidden');
    } else {
        showModal("Erro", "Não foi possível carregar o perfil da criança. Tentando com dados básicos.");
        // Renderiza com dados default, mas com o nome correto
        const child = parentData.children.find(c => c.uid === childUid);
        renderChildManagement({ ...DEFAULT_CHILD_DATA, name: child?.name || 'Criança' });
        document.getElementById('parent-home-view').classList.add('hidden');
        document.getElementById('child-management-view').classList.remove('hidden');
    }
}

function renderChildManagement(childData) {
    // CORREÇÃO: Altera o alvo para o ID único da vista de gerenciamento
    const childManagementContainer = document.getElementById('child-management-container');
    const child = parentData.children.find(c => c.uid === currentChildId);
    
    if (!child || !childManagementContainer) return;

    // Garantindo que o childData tem a estrutura completa, mesmo que falhe no carregamento
    childData = { ...DEFAULT_CHILD_DATA, ...childData };

    const totalTasks = childData.tasks?.length || 0;
    const completedTasks = childData.tasks?.filter(t => t.completed).length || 0;
    const savedAmount = childData.progress.savedAmount || 0;
    const goalAmount = childData.progress.goal || 0;
    
    // NOVO: Exibir emoção e Ícone
    const currentEmotion = childData.currentEmotion?.value || '😊';
    const iconHtml = getIconHtml(childData.profileIcon, 'text-3xl', 'w-12 h-12');


    childManagementContainer.innerHTML = `
        
        <div class="bg-white p-4 rounded-lg shadow-md mb-4 border-2 border-green-300">
            <div class="flex items-center space-x-3 border-b pb-2 mb-3">
                ${iconHtml} <h4 class="text-2xl font-itim text-green-700">${child.name} <span class="ml-2 text-3xl">${currentEmotion}</span></h4>
            </div>
            <p class="text-xl font-itim mb-2">Código de Acesso: <span class="text-blue-600 font-bold">${child.code}</span></p>
            <p class="text-xl font-itim mb-2">Saldo Atual: <span class="text-orange-500 font-bold">${childData.coins} moedas</span></p>
            
            <p class="text-xl font-itim mb-2">Meta: <span class="text-purple-600 font-bold">${childData.progress.targetName}</span></p>
            <p class="text-xl font-itim mb-2">Poupança: <span class="text-red-500 font-bold">${savedAmount} / ${goalAmount} moedas</span></p>

            <div class="bg-yellow-50 p-3 rounded-lg mt-3">
                <label for="goal-value-input" class="text-lg font-bold font-itim block mb-1">Definir Valor da Meta:</label>
                <div class="flex space-x-2">
                    <input type="number" id="goal-value-input" placeholder="Novo Valor em Moedas" class="w-full p-2 border rounded-lg font-itim" min="1" value="${goalAmount}">
                    <button id="set-goal-btn" class="bg-yellow-600 text-white p-2 rounded-lg font-itim hover:bg-yellow-700">Salvar</button>
                </div>
            </div>

            <p class="text-xl font-itim mt-3 border-t pt-3">Tarefas: ${completedTasks} / ${totalTasks}</p>
        </div>
        
        <div class="bg-gray-100 p-4 rounded-lg shadow-inner mb-4">
            <h5 class="text-xl font-itim text-gray-800 mb-3">Dar Mesada/Bônus</h5>
            <div class="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
                <input type="number" id="allowance-amount" placeholder="Qtd. Moedas" class="w-full sm:w-1/4 p-2 border rounded-lg font-itim" min="1" value="10">
                <input type="text" id="allowance-reason" placeholder="Motivo (Ex: Mesada Semanal)" class="w-full sm:flex-grow p-2 border rounded-lg font-itim">
                <button id="give-allowance-btn" class="w-full sm:w-auto bg-green-500 text-white p-2 rounded-lg font-itim hover:bg-green-600">Dar Moedas</button>
            </div>
        </div>

        <div class="bg-gray-100 p-4 rounded-lg shadow-inner mb-4">
            <h5 class="text-xl font-itim text-gray-800 mb-3">Criar Tarefa</h5>
            <div class="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
                <input type="text" id="parent-new-task-input" placeholder="Nova Tarefa (Ex: Lavar louça)" class="w-full sm:flex-grow p-2 border rounded-lg font-itim">
                <button id="parent-add-task-btn" class="w-full sm:w-auto bg-purple-500 text-white p-2 rounded-lg font-itim hover:bg-purple-600">Adicionar</button>
            </div>
            <h5 class="text-xl font-itim text-gray-800 mt-4 border-t pt-3">Tarefas Atuais</h5>
            <ul id="parent-tasks-list" class="space-y-1 mt-2 max-h-40 overflow-y-auto"></ul>
        </div>

        <div class="bg-white p-4 rounded-lg shadow-md border-t">
            <h5 class="text-xl font-itim text-gray-800 mb-3">Histórico de Transações</h5>
            <div id="parent-child-history" class="max-h-40 overflow-y-auto border p-2 rounded bg-gray-50">
                ${renderHistoryList(childData.transactions)}
            </div>
        </div>
    `;
    
    // Anexa listeners ao painel de gestão
    document.getElementById('give-allowance-btn')?.addEventListener('click', () => {
        const amount = parseInt(document.getElementById('allowance-amount').value);
        const reason = document.getElementById('allowance-reason').value.trim() || "Mesada/Bônus";
        giveAllowance(childData, amount, reason, currentChildId);
    });
    
    document.getElementById('parent-add-task-btn')?.addEventListener('click', () => {
        const taskText = document.getElementById('parent-new-task-input').value.trim();
        createTaskForChild(childData, taskText, currentChildId);
    });
    
    // NOVO: Listener para definir valor da meta
    document.getElementById('set-goal-btn')?.addEventListener('click', () => {
         const newGoal = parseInt(document.getElementById('goal-value-input').value);
         setGoalValueForChild(childData, newGoal, currentChildId);
    });
    
    // Renderiza as tarefas ativas no painel do pai
    renderTasksParent(document.getElementById('parent-tasks-list'), childData, currentChildId);
}

// NOVO: Função para o Pai definir o valor da meta
async function setGoalValueForChild(childData, newGoal, uid) {
    if (isNaN(newGoal) || newGoal <= 0) {
         return showModal("Erro", "O valor da meta deve ser um número positivo.");
    }
    
    childData.progress.goal = newGoal;
    
    await setDoc(CHILD_PROFILE_DOC_REF(parentId, uid), { progress: childData.progress }, { merge: true });
    
    showModal("Meta Definida!", `O valor da meta de **${childData.progress.targetName}** foi definido para **${newGoal} moedas**!`);
    
    const updatedData = await getChildDataSnapshot(uid);
    if (updatedData) renderChildManagement(updatedData);
}


function renderHistoryList(transactions) {
    return (transactions && transactions.length > 0) 
        ? `<ul class="space-y-2">${transactions.map(t => `
            <li class="flex justify-between items-center p-2 rounded ${t.type === 'earn' ? 'bg-green-100 text-green-700' : t.type === 'donate' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}">
                <span class="font-itim text-xs w-1/4">${t.date}</span>
                <span class="font-itim text-xs w-1/2">${t.description}</span>
                <span class="font-bold text-sm w-1/4 text-right">${t.type === 'earn' ? '+' : '-'}${t.amount} Moedas</span>
            </li>
        `).join('')}</ul>`
        : '<p class="text-gray-500 font-itim text-center">Nenhuma transação recente.</p>';
}

async function giveAllowance(childData, amount, reason, uid) {
    if (amount <= 0 || !uid) {
        return showModal("Erro", "Quantidade inválida.");
    }
    
    childData.coins += amount;
    childData.transactions = childData.transactions || [];
    childData.transactions.unshift({
        id: Date.now(),
        type: 'earn',
        amount: amount,
        description: reason,
        date: new Date().toLocaleDateString('pt-BR')
    });
    childData.transactions = childData.transactions.slice(0, 50);
    
    // CORRIGIDO O PATH: Salva no documento da criança sob a coleção do pai
    await setDoc(CHILD_PROFILE_DOC_REF(parentId, uid), childData, { merge: true });
    
    showModal("Sucesso", `Mesada de **${amount} moedas** dada a ${childData.name}!`);
    document.getElementById('allowance-reason').value = '';
    // CORREÇÃO DASHBOARD: Recarrega os dados e re-renderiza o painel do filho
    const updatedData = await getChildDataSnapshot(uid);
    if (updatedData) renderChildManagement(updatedData);
}

async function createTaskForChild(childData, taskText, uid) {
    if (!taskText || !uid) return;

    const newTask = {
        id: Date.now().toString(),
        text: taskText,
        completed: false
    };
    
    childData.tasks = childData.tasks || [];
    childData.tasks.push(newTask);
    
    // CORRIGIDO O PATH: Salva no documento da criança sob a coleção do pai
    await setDoc(CHILD_PROFILE_DOC_REF(parentId, uid), { tasks: childData.tasks }, { merge: true });
    document.getElementById('parent-new-task-input').value = '';
    // CORREÇÃO DASHBOARD: Recarrega os dados e re-renderiza o painel do filho
    const updatedData = await getChildDataSnapshot(uid);
    if (updatedData) renderChildManagement(updatedData);
    showModal("Sucesso", `Tarefa '${taskText}' adicionada para ${childData.name}.`);
}

function renderTasksParent(container, currentData, currentUid) {
    container.innerHTML = '';
    if (!currentData.tasks || currentData.tasks.length === 0) {
        container.innerHTML = '<p class="text-center text-gray-500 pt-2 font-itim">Nenhuma tarefa.</p>';
        return;
    }

    currentData.tasks.forEach(task => {
        const li = document.createElement('li');
        
        li.className = 'flex items-center justify-between p-2 bg-gray-50 rounded-lg';
        li.innerHTML = `
            <span class="text-gray-800 font-itim text-sm">${task.text}</span>
            <div class="flex space-x-2 items-center">
                <span class="text-sm font-itim ${task.completed ? 'text-green-500' : 'text-gray-500'}">${task.completed ? 'Feita' : 'Pendente'}</span>
                <button data-task-id="${task.id}" data-uid="${currentUid}" class="delete-task-btn text-red-500 p-1 hover:text-red-700 transition-colors">
                    <i class="fa-solid fa-trash-can"></i>
                </button>
            </div>
        `;
        container.appendChild(li);
    });

    document.querySelectorAll('.delete-task-btn').forEach(button => {
         button.addEventListener('click', async (e) => {
            const taskId = e.currentTarget.dataset.taskId;
            const targetUid = e.currentTarget.dataset.uid;
            
            const childData = await getChildDataSnapshot(targetUid);
            if (childData) {
                childData.tasks = childData.tasks.filter(t => t.id !== taskId);
                // CORRIGIDO O PATH: Salva no documento da criança sob a coleção do pai
                await setDoc(CHILD_PROFILE_DOC_REF(parentId, targetUid), { tasks: childData.tasks }, { merge: true });
                renderChildManagement(childData); // Atualiza o painel do pai
            }
        });
    });
}

initFirebase(); // CHAMADA ADICIONADA PARA INICIALIZAR O FLUXO DO APLICATIVO