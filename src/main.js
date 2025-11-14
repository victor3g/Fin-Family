// src/main.js
import { PARENT_CREDENTIALS, DEFAULT_CHILD_DATA, DEFAULT_PARENT_DATA, BADGES, DONATION_TARGET } from './config.js';
import { 
    signIn, signOut, loadOrCreateChildData, setupRealtimeListener, 
    loadParentData, setupParentRealtimeListener, getChildDataSnapshot 
} from './supabase-client.js';
import { 
    showModal, hideModal, updateUI, applyTheme, showGreeting, 
    attachActionListeners, isGameOnCooldown
} from './ui.js';
import { 
    renderParentDashboard, setCurrentChildId 
} from './parent-dashboard.js';

// --- VARIÁVEIS DE ESTADO GLOBAL (MANTIDAS AQUI PARA ACESSO MÚTUO) ---
export let currentUserId = null; 
export let childParentId = null; 
export let userType = 'Guest'; // 'Parent', 'Child', 'Guest'
export let parentId = null; // UID do pai logado
export let userData = { ...DEFAULT_CHILD_DATA }; // Objeto de dados dinâmico da criança atual
export let parentData = { ...DEFAULT_PARENT_DATA }; // Objeto de dados dinâmico do pai atual

// Setter para atualizar o estado global
export function setParentData(data) {
    parentData = data;
}

// --- UTILIDADES DE DADOS (Expostas para UI e Game) ---

export function addTransaction(type, amount, description) {
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

export function awardBadge(badgeId) {
     if (!userData.badges.includes(badgeId)) {
        userData.badges.push(badgeId);
        const badge = BADGES[badgeId];
        if (badge) {
            showModal(`Nova Conquista: ${badge.name}! 🏆`, `${badge.description} Parabéns!`);
        }
    }
}

export function checkBadges() {
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
            // Nota: O saveChildData deve ser chamado após o cálculo do juros
        }
    }
    userData.lastInterestDate = now.getTime(); 
}

// --- FUNÇÕES DE NAVEGAÇÃO / ROTAS ---
function setView(viewId) {
    document.getElementById('login-view').classList.add('hidden');
    document.getElementById('child-app-view').classList.add('hidden');
    document.getElementById('parent-dashboard-view').classList.add('hidden');
    document.getElementById('signup-view').classList.add('hidden');
    document.getElementById('forgot-password-view').classList.add('hidden');

    document.getElementById(viewId).classList.remove('hidden');
}

export function showLoginView() {
    userType = 'Guest';
    currentUserId = null;
    parentId = null;
    childParentId = null;
    applyTheme('padrão'); 
    setView('login-view');
}

async function showChildApp(uid, parentUid) {
    userType = 'Child';
    currentUserId = uid;
    childParentId = parentUid; 
    
    // 1. Carrega dados
    const initialData = await loadOrCreateChildData(parentUid, uid);
    userData = initialData;
    
    // 2. Calcula juros, aplica tema e atualiza UI
    calculateInterest();
    applyTheme(userData.settings.theme); 
    showGreeting();
    updateUI();
    
    // 3. Configura listener de tempo real
    setupRealtimeListener(uid, (data) => {
        userData = { ...userData, ...data }; // Atualiza dados globais
        applyTheme(userData.settings.theme);
        updateUI(); // Redesenha a tela
    });

    // 4. Configura loop de atualização do Cooldown
    setInterval(() => {
        if (isGameOnCooldown()) updateUI();
    }, 60000);
    
    // 5. Exibe a tela
    setView('child-app-view');
}

async function showParentDashboard(uid) {
    userType = 'Parent';
    parentId = uid;
    
    await loadParentData(parentId).then(data => {
        parentData = data;
    });

    applyTheme('padrão'); 
    window.showParentHome(); 
    
    setupParentRealtimeListener(parentId, (data) => {
        parentData = { ...parentData, ...data };
        renderParentDashboard();
    });
    
    setView('parent-dashboard-view');
}

// EXPOSTA GLOBALMENTE para uso no HTML do Painel do Pai
window.parentLogout = function() {
    signOut().then(showLoginView);
}

window.childLogout = function() {
     signOut().then(showLoginView);
}

window.showParentHome = function() {
    setCurrentChildId(null);
    const homeView = document.getElementById('parent-home-view');
    const managementView = document.getElementById('child-management-view');

    if (homeView) homeView.classList.remove('hidden');
    if (managementView) managementView.classList.add('hidden');
    
    renderParentDashboard();
}

// --- LÓGICA DE AUTENTICAÇÃO ---

function handleLoginToggle(e) {
    const isParent = e.target.checked;
    const parentEmailDiv = document.getElementById('parent-email-input-div');
    const parentPasswordDiv = document.getElementById('parent-password-input-div');
    const childCodeInput = document.getElementById('login-child-code-input');
    const createAccountBtn = document.getElementById('create-account-btn');
    const forgotPasswordLink = document.getElementById('forgot-password-link');
    const emailInput = document.getElementById('login-email-input');
    const passwordInput = document.getElementById('login-password-input');

    document.getElementById('login-title-type').textContent = isParent ? 'Pai' : 'Criança';

    parentEmailDiv?.classList.toggle('hidden', !isParent);
    parentPasswordDiv?.classList.toggle('hidden', !isParent);
    childCodeInput.classList.toggle('hidden', isParent);
    createAccountBtn?.classList.toggle('hidden', !isParent);
    forgotPasswordLink?.classList.toggle('hidden', !isParent);

    if (emailInput) emailInput.required = isParent;
    if (passwordInput) passwordInput.required = isParent;
    childCodeInput.required = !isParent;
}

document.getElementById('login-type-toggle').addEventListener('change', handleLoginToggle);

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
    const messageEl = document.getElementById('login-message');

    if (email === PARENT_CREDENTIALS.email && password === PARENT_CREDENTIALS.password) {
        // Simulação de login bem-sucedido. Em um app real, o sign-in do Supabase seria usado.
        showParentDashboard('parent-simulated-id'); // Usa um UID simulado para o pai
        messageEl.textContent = '';
    } else {
        messageEl.textContent = 'Credenciais incorretas.';
    }
}

async function childLogin(code) {
    document.getElementById('login-message').textContent = 'Buscando perfil...';
    
    // Busca na lista de filhos do pai (simulado)
    const parentUid = 'parent-simulated-id'; // Assume que o único pai usa o ID simulado
    const parentControls = await loadParentData(parentUid); 

    let childFound = false;
    
    if (parentControls) {
        const children = parentControls.children || [];
        const child = children.find(c => c.code === code);
        
        if (child) {
            childFound = true;
            showChildApp(child.uid, parentUid); 
            return;
        }
    }

    if (!childFound) {
         document.getElementById('login-message').textContent = 'Código de acesso inválido ou não encontrado.';
    }
}

// --- NOVO: LÓGICA DE CADASTRO E RECUPERAÇÃO (SIMULAÇÃO FUNCIONAL) ---
window.showSignupView = function() {
    document.getElementById('signup-message').textContent = '';
    setView('signup-view');
}

window.showForgotPasswordView = function() {
    document.getElementById('reset-message').textContent = '';
    setView('forgot-password-view');
}

document.getElementById('signup-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const messageEl = document.getElementById('signup-message');
    // Simulação de Cadastro BEM-SUCEDIDO
    messageEl.textContent = `Conta criada! (Simulação). Use a tela de Login.`;
    messageEl.classList.remove('text-red-500');
    messageEl.classList.add('text-green-600');
    setTimeout(showLoginView, 2000);
});

document.getElementById('forgot-password-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('reset-email-input').value;
    const messageEl = document.getElementById('reset-message');
    
    // Simulação de Recuperação BEM-SUCEDIDA
    messageEl.textContent = `Link de redefinição enviado para ${email}! (Simulação)`;
    messageEl.classList.remove('text-red-500');
    messageEl.classList.add('text-green-600');
    
    setTimeout(showLoginView, 2000);
});

document.getElementById('child-logout-btn')?.addEventListener('click', window.childLogout);

// --- INICIALIZAÇÃO ---
document.addEventListener('DOMContentLoaded', () => {
    showLoginView();
});
