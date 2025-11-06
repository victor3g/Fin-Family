import { 
    DEFAULT_CHILD_DATA, 
    PET_CHARACTERS, 
    STANDARD_EMOTIONS, 
    SHOP_EMOTIONS, 
    DEFAULT_THEME_COLORS,
    BADGES, 
    SHOP_ICONS,
    DONATION_TARGET 
} from "./data-structures.js";

import { 
    initFirebase,
    loadOrCreateUserData, 
    setupRealtimeListener,
    setupParentRealtimeListener,
    showParentDashboard,
} from "./core-logic.js"; 


// --- Elementos do DOM (Cache) ---
const userNameEl = document.getElementById('user-name');
const coinCountEl = document.getElementById('coin-count');
const tasksDoneEl = document.getElementById('tasks-done');
const tasksTotalEl = document.getElementById('tasks-total');
const progressBarEl = document.getElementById('progress-bar');
const modalEl = document.getElementById('main-modal');
const modalTitleEl = document.getElementById('modal-title');
const modalBodyEl = document.getElementById('modal-body');
const sidebarEl = document.getElementById('sidebar');
const profileIconContainer = document.getElementById('profile-icon-container');
const piggyCharEl = document.getElementById('piggy-character');
const piggyGreetingEl = document.getElementById('piggy-greeting');
const piggyContainerEl = document.getElementById('animated-piggy-container');


// --- FUNÇÕES DE NAVEGAÇÃO / ROTAS (EXPOSTAS NO WINDOW) ---

function setView(viewId) {
    document.getElementById('login-view')?.classList.add('hidden');
    document.getElementById('child-app-view')?.classList.add('hidden');
    document.getElementById('parent-dashboard-view')?.classList.add('hidden');
    document.getElementById('signup-view')?.classList.add('hidden');
    document.getElementById('forgot-password-view')?.classList.add('hidden');
    
    const targetElement = document.getElementById(viewId);
    if (targetElement) {
        targetElement.classList.remove('hidden');
    } else {
        console.error(`Erro de UI: Elemento de vista não encontrado: ${viewId}`);
        window.showModal("Erro de Navegação", `A vista com ID "${viewId}" não foi encontrada. Verifique o HTML.`);
    }
}

// CORREÇÃO CRÍTICA: Expor funções de navegação inicial para que o HTML as encontre via `onclick`
window.showSignupView = function() { 
    if (typeof window.handleSignup !== 'function') {
        return window.showModal("Erro Crítico (Módulo JS)", "Função de cadastro não carregada. Verifique os scripts no index.html.");
    }
    document.getElementById('signup-message').textContent = ''; 
    setView('signup-view');
}
window.showForgotPasswordView = function() { 
    if (typeof window.handleForgotPassword !== 'function') {
        return window.showModal("Erro Crítico (Módulo JS)", "Função de recuperação não carregada. Verifique os scripts no index.html.");
    }
    document.getElementById('reset-message').textContent = ''; 
    setView('forgot-password-view');
}

window.showLoginView = function() { 
    window.userType = 'Guest';
    applyTheme('padrão', DEFAULT_THEME_COLORS); 
    setView('login-view'); 
}
window.parentLogout = async function() {
    window.userType = 'Guest';
    window.parentId = null;
    window.currentChildId = null;
    window.childParentId = null;
    await window.signOut(window.auth);
    window.showLoginView();
}
window.childLogout = async function() {
     window.userType = 'Guest';
     window.currentUserId = null;
     window.childParentId = null;
     await window.signOut(window.auth);
     window.showLoginView();
}
window.showParentHome = function() { 
    window.currentChildId = null; 
    const homeView = document.getElementById('parent-home-view');
    const managementView = document.getElementById('child-management-view');
    if (homeView) homeView.classList.remove('hidden');
    if (managementView) managementView.classList.add('hidden');
    renderParentDashboard(); 
}
window.showChildManagementView = async function(childUid) {
    window.currentChildId = childUid;
    const childData = await window.getChildDataSnapshot(childUid);
    if (childData) {
        renderChildManagement(childData);
        document.getElementById('parent-home-view').classList.add('hidden');
        document.getElementById('child-management-view').classList.remove('hidden');
    } else {
        window.showModal("Erro", "Não foi possível carregar o perfil da criança.");
        window.showParentHome();
    }
}

export async function showChildApp(uid, parentUid) {
    window.userType = 'Child';
    window.currentUserId = uid;
    window.childParentId = parentUid;
    
    sidebarEl?.classList.add('-translate-x-full'); 
    
    await loadOrCreateUserData(window.currentUserId, DEFAULT_CHILD_DATA);
    setupRealtimeListener(window.currentUserId);
    setView('child-app-view');
}
export async function showParentDashboard(uid) {
    window.userType = 'Parent';
    window.parentId = uid;
    applyTheme('padrão', DEFAULT_THEME_COLORS);
    await window.loadParentData();
    window.showParentHome(); 
    setupParentRealtimeListener(window.parentId);
}


// --- LÓGICA DE UI E RENDERIZAÇÃO ---

export function applyTheme(themeName, fallbackColors = DEFAULT_THEME_COLORS) {
    let theme = window.userData.settings?.themes?.[themeName];
    
    if (window.userType !== 'Child' || !theme) {
        theme = fallbackColors;
    }

    document.body.style.setProperty('--color-start', theme.start);
    document.body.style.setProperty('--color-end', theme.end);
    
    const bodyEl = document.body;
    if (window.userType === 'Child' || window.userType === 'Parent') {
         bodyEl.classList.add('app-gradient');
         bodyEl.classList.remove('bg-[#EDEFF2]');
    } else {
         bodyEl.classList.remove('app-gradient');
         bodyEl.classList.add('bg-[#EDEFF2]');
    }
}

export function getIconHtml(iconData, sizeClass = 'text-3xl', containerSize = 'w-10 h-10') {
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
    
    return `<div class="${containerSize} rounded-full overflow-hidden profile-placeholder flex items-center justify-center">${content}</div>`;
}

export function updateUI() {
    if (window.userType !== 'Child') return;

    userNameEl.textContent = window.userData.name;
    coinCountEl.textContent = window.userData.coins;
    
    profileIconContainer.innerHTML = '';
    profileIconContainer.innerHTML = getIconHtml(window.userData.profileIcon, 'text-4xl', 'w-16 h-16');

    if (piggyCharEl) {
         piggyCharEl.textContent = window.userData.currentPet?.value || '🐷'; 
    }
    document.getElementById('emotion-display-container').textContent = window.userData.currentEmotion.value;

    const totalTasks = window.userData.tasks.length;
    const completedTasks = window.userData.tasks.filter(t => t.completed).length;
    tasksTotalEl.textContent = totalTasks;
    tasksDoneEl.textContent = completedTasks;
    const savedAmount = window.userData.progress.savedAmount || 0;
    const progressGoal = window.userData.progress.goal || 0;
    
    const progressPercent = progressGoal > 0
        ? Math.min(100, (savedAmount / progressGoal) * 100)
        : 0;
        
    progressBarEl.style.width = `${progressPercent}%`;
    document.getElementById('progress-percent').textContent = `${Math.floor(progressPercent)}%`;
    
    document.getElementById('goal-name-display').textContent = window.userData.progress.targetName;
    document.getElementById('goal-amount-display').textContent = `${savedAmount}/${progressGoal} moedas`;


    document.getElementById('save-amount').textContent = `Mudar`;
    document.getElementById('spend-amount').textContent = `Comprar`;
    document.getElementById('donate-amount').textContent = `Ver`;

    // Cooldown Jogo
    const ganharBtn = document.getElementById('action-ganhar');
    const ganharAmount = document.getElementById('earn-amount');
    const isCooldown = window.isGameOnCooldown();

    if (isCooldown) {
        ganharBtn.classList.remove('bg-[#32CD32]', 'hover:bg-green-600');
        ganharBtn.classList.add('bg-gray-400', 'cursor-not-allowed');
        ganharBtn.disabled = true;
        ganharAmount.textContent = window.getRemainingCooldownTime();
        document.getElementById('earn-text').textContent = 'Recarga'; 
    } else {
        ganharBtn.classList.remove('bg-gray-400', 'cursor-not-allowed');
        ganharBtn.classList.add('bg-[#32CD32]', 'hover:bg-green-600');
        ganharBtn.disabled = false;
        ganharAmount.textContent = `+${window.userData.actions.earn}`;
        document.getElementById('earn-text').textContent = 'Ganhar'; 
    }
    
    window.renderTasks(document.getElementById('tasks-list'), false);
}

// --- FUNÇÕES MODAIS GERAIS E AUXILIARES (EXPOSTAS NO WINDOW) ---

function convertMarkdownToHtml(text) {
    if (typeof text !== 'string') return text;
    return text.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
}

window.showModal = function(title, message) {
    if (modalTitleEl) modalTitleEl.textContent = title;
    if (modalBodyEl) modalBodyEl.innerHTML = convertMarkdownToHtml(message);
    modalEl?.classList.remove('hidden');
}

window.hideModal = function() {
    modalEl?.classList.add('hidden');
    if (window.game?.isRunning) {
         window.game.isRunning = false;
         document.getElementById('game-modal')?.classList.add('hidden');
    }
}
window.renderHistoryModal = function() { 
    window.showModal("Histórico de Transações", window.renderHistoryList(window.userData.transactions || []));
}
window.renderDonateModal = function() {
    const donateAmount = window.userData.actions.donate;
    window.showModal("Doar Moedas ❤️", `
        <p class="font-itim mb-4">Você tem **${window.userData.coins} moedas**. Você quer doar o valor padrão de **${donateAmount} moedas** e ajudar quem precisa?</p>
        <div class="space-y-4">
            <button id="confirm-donate-btn" class="w-full bg-pink-500 text-white p-3 rounded-lg font-itim text-xl hover:bg-pink-600 transition-colors" data-amount="${donateAmount}">
                Sim, Doar Moedas
            </button>
        </div>
    `);

    document.getElementById('confirm-donate-btn')?.addEventListener('click', () => {
        const amount = parseInt(document.getElementById('confirm-donate-btn').dataset.amount);
         
        if (window.userData.coins < amount) {
            window.hideModal();
            return window.showModal("Saldo Insuficiente", `Você precisa de pelo menos **${amount} moedas** para doar.`);
        }
        
        window.userData.coins -= amount;
        window.userData.donationCount = (window.userData.donationCount || 0) + 1;
        
        window.addTransaction('donate', amount, "Doação para Caridade");
        window.checkBadges();
        window.saveUserData();
        window.hideModal();
        window.showModal("Doação Feita! ❤️", `Obrigado por doar **${amount} moedas**! Você fez o bem!`);
    });
}


// --- Funções de Renderização Específicas (Exportadas para Core/Window) ---

export function renderTasks(container, showDelete = false) {
     container.innerHTML = '';
    if (!window.userData.tasks || window.userData.tasks.length === 0) {
        container.innerHTML = '<p class="text-center text-gray-500 pt-2 font-itim">Nenhuma tarefa. Adicione uma!</p>';
        return;
    }

    window.userData.tasks.forEach(task => {
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

    if (!showDelete) {
        document.querySelectorAll('.toggle-task').forEach(button => {
            button.addEventListener('click', (e) => {
                const taskId = e.currentTarget.dataset.taskId;
                window.toggleTaskCompletion(taskId);
            });
        });
    } else {
        document.querySelectorAll('.delete-task-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const taskId = e.currentTarget.dataset.taskId;
                window.deleteTask(taskId);
            });
        });
    }
}
export function renderHistoryList(transactions) {
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

function renderThemesShop() {
     return `<div class="grid grid-cols-2 gap-4">${Object.entries(DEFAULT_CHILD_DATA.settings.themes).map(([key, item]) => {
        const owned = window.userData.settings.themes[key]?.purchased;
        const price = item.price;
        const canAfford = window.userData.coins >= price;
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
        const owned = window.userData.unlockedPets.includes(item.id);
        const isEquipped = window.userData.currentPet?.id === item.id;
        const price = item.price;
        const canAfford = window.userData.coins >= price;
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
    const currentIcon = window.userData.profileIcon.value;
    const shopItems = SHOP_ICONS.concat({ id: 'default', type: 'fa-icon', value: 'fa-user-astronaut', label: 'Padrão', price: 0 });
    
    return `<div class="grid grid-cols-3 gap-3">${shopItems.map(item => {
        const owned = window.userData.profileIcon.shopOwned.includes(item.id) || item.price === 0;
        const isEquipped = currentIcon === item.value;
        const price = item.price;
        const canAfford = window.userData.coins >= price;
        const buttonText = isEquipped ? 'Equipado' : owned ? 'Usar' : price === 0 ? 'Grátis' : canAfford ? 'Comprar' : 'Moedas';
        const buttonClass = isEquipped ? 'bg-green-500' : 'bg-blue-500';
        
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
        const owned = window.userData.currentEmotion.shopOwned.includes(item.id) || item.price === 0 || !item.price;
        const isEquipped = window.userData.currentEmotion.value === item.value;
        const price = item.price || 0;
        const canAfford = window.userData.coins >= price;
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

function attachShopEventListeners() {
    document.querySelectorAll('.shop-item-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const btn = e.currentTarget;
            const type = btn.dataset.type;
            const id = btn.dataset.id;
            const price = parseInt(btn.dataset.price);
            const owned = btn.dataset.owned === 'true';

            if (!owned) {
                if (window.userData.coins < price) {
                     return window.showModal("Moedas Insuficientes", `Você precisa de **${price} moedas** para comprar este item!`);
                }
                
                // Compra
                window.handleShopPurchase(type, id, price, btn.dataset.value, btn.dataset.iconType);
                window.showModal("Compra Concluída!", `Você comprou e equipou **${btn.textContent}** por **${price} moedas**!`);

            } else {
                // Equipa
                window.handleShopEquip(type, id, btn.dataset.value, btn.dataset.iconType);
                window.showModal("Item Equipado", `Você está usando **${btn.textContent}**!`);
            }
            
            window.saveUserData();
            window.renderShopModal();
        });
    });
    document.querySelectorAll('.select-emotion-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const btn = e.currentTarget;
            const value = btn.dataset.value;
            const id = btn.dataset.id;
            const price = parseInt(btn.dataset.price);
            const owned = btn.dataset.owned === 'true';

            if (!owned && price > 0) {
                if (window.userData.coins < price) {
                     return window.showModal("Moedas Insuficientes", `Você precisa de **${price} moedas** para comprar esta emoção!`);
                }
                
                window.userData.coins -= price;
                window.userData.currentEmotion.shopOwned.push(id);
                window.userData.currentEmotion.value = value;
                window.addTransaction('spend', price, `Compra de Emoção: ${value}`);
                window.showModal("Emoção Desbloqueada!", `Você comprou e está usando **${value}**!`);
            } else {
                window.userData.currentEmotion.value = value;
                window.hideModal();
            }
            window.saveUserData();
            window.renderShopModal();
        });
    });
}


// --- Funções de Inicialização e Listeners de Eventos do DOM (CRÍTICO: Correção) ---

function initDOMElements() {
    
    // 1. LIGAÇÃO DO TOGGLE DE LOGIN (CRÍTICO)
    const loginToggle = document.getElementById('login-type-toggle');
    if (loginToggle) {
        loginToggle.addEventListener('click', (e) => {
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
        });
    } else {
         console.warn("Elemento 'login-type-toggle' não encontrado no DOM.");
    }


    // 2. LIGAÇÃO DO FORMULÁRIO DE LOGIN (CRÍTICO)
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            if (typeof window.parentLogin !== 'function') {
                return window.showModal("Erro de Lógica (Login)", "Funções de login não estão acessíveis. Verifique core-logic.js");
            }

            const isParent = document.getElementById('login-type-toggle').checked;
            
            if (isParent) {
                window.parentLogin();
            } else {
                const code = document.getElementById('login-child-code-input').value;
                window.childLogin(code);
            }
        });
    } else {
         console.warn("Elemento 'login-form' não encontrado no DOM.");
    }

    // 3. LIGAÇÃO DOS FORMS DE CADASTRO E RECUPERAÇÃO (CRÍTICO)
    document.getElementById('signup-form')?.addEventListener('submit', window.handleSignup);
    document.getElementById('forgot-password-form')?.addEventListener('submit', window.handleForgotPassword);


    // 4. LIGAÇÃO DOS BOTÕES DE NAVEGAÇÃO SECUNDÁRIOS
    document.getElementById('create-account-btn')?.addEventListener('click', window.showSignupView);
    document.getElementById('forgot-password-link')?.addEventListener('click', window.showForgotPasswordView);


    // 5. LÓGICA DE AÇÕES DO APP DA CRIANÇA E MODAIS
    document.getElementById('tasks-edit-section')?.addEventListener('click', () => {
         if (window.userType === 'Child') window.renderTaskManagementModal();
    });
    
    document.getElementById('goal-section')?.addEventListener('click', () => {
         if (window.userType === 'Child') window.renderGoalSettingModal();
    });
    
    document.getElementById('emotion-display-container')?.addEventListener('click', window.renderEmotionSelectionModal);
    if (piggyContainerEl) {
        piggyContainerEl.addEventListener('click', window.triggerReaction);
    }
    
    document.getElementById('action-ganhar')?.addEventListener('click', window.launchGame);
    document.getElementById('action-poupar')?.addEventListener('click', window.renderSaveInputModal); 
    document.getElementById('action-gastar')?.addEventListener('click', window.renderShopModal);
    document.getElementById('action-doar')?.addEventListener('click', window.renderBadgesModal); 

    document.getElementById('child-logout-btn')?.addEventListener('click', window.childLogout);
    document.getElementById('modal-close-btn')?.addEventListener('click', window.hideModal);
}

// --- Funções de Renderização Auxiliares (Copied from original for functionality) ---

window.renderAddChildModal = function() {
    window.showModal("Adicionar Novo Perfil", `
        <form id="add-child-form-modal" class="space-y-4">
            <label for="new-child-name-input-modal" class="font-bold font-itim block">Nome da Criança:</label>
            <input type="text" id="new-child-name-input-modal" placeholder="Nome (Ex: Alex, Bia)" class="w-full p-3 border rounded-lg font-itim text-lg" required>
            <p id="add-child-message" class="text-red-500 font-itim"></p>
            <button type="submit" id="submit-add-child-btn" class="w-full bg-purple-500 text-white p-3 rounded-lg font-itim text-xl hover:bg-purple-600 transition-colors">
                Adicionar Perfil
            </button>
        </form>
    `);
    document.getElementById('add-child-form-modal')?.addEventListener('submit', window.handleAddNewChild);
}
window.renderBadgesModal = function() { 
    const ownedBadges = window.userData.badges || [];
    
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

    window.showModal("Suas Conquistas 🏆", `
        <p class="font-itim mb-4 text-center text-xl">Você desbloqueou **${ownedBadges.length} de ${Object.keys(BADGES).length}** conquistas!</p>
        <div class="space-y-3 max-h-80 overflow-y-auto">
            ${badgeContent}
        </div>
    `);
}
window.renderEmotionSelectionModal = function() { 
    const allEmotions = STANDARD_EMOTIONS.concat(SHOP_EMOTIONS.map(e => ({ ...e, price: e.price || 0 })));
    
    const content = allEmotions.map(item => {
        const isEquipped = window.userData.currentEmotion.value === item.value;
        const owned = window.userData.currentEmotion.shopOwned.includes(item.id) || !item.price;
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

    window.showModal("Selecione sua Emoção ✨", `
        <div class="grid grid-cols-3 gap-3">
            ${content}
        </div>
    `);
}
window.renderShopModal = function() { 
    window.showModal("Loja Mágica ✨", `
        <div class="tabs flex space-x-2 border-b mb-4 font-itim">
            <button id="tab-themes" class="tab-btn p-2 border-b-2 border-transparent hover:border-blue-400" data-tab="themes">Temas</button>
            <button id="tab-pets" class="tab-btn p-2 border-b-2 border-transparent hover:border-blue-400" data-tab="pets">Bichinhos</button>
            <button id="tab-icons" class="tab-btn p-2 border-b-2 border-transparent hover:border-blue-400" data-tab="icons">Ícones</button>
            <button id="tab-emotions" class="tab-btn p-2 border-b-2 border-transparent hover:border-blue-400" data-tab="emotions">Emoções</button>
        </div>
        <div id="shop-content"></div>
        <p class="text-right text-sm font-bold text-orange-500 mt-4">Suas Moedas: ${window.userData.coins}</p>
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
window.renderSaveInputModal = function() {
    window.showModal("Quanto Quer Poupar? 💰", `
        <p class="font-itim mb-4">Seu saldo atual é de **${window.userData.coins} moedas**. Digite a quantidade que você quer guardar na meta:</p>
        <div class="space-y-4">
            <input type="number" id="save-input-amount" placeholder="Valor a Poupar" class="w-full p-3 border rounded-lg font-itim text-lg" min="1" max="${window.userData.coins}">
            <button id="execute-save-btn" class="w-full bg-blue-500 text-white p-3 rounded-lg font-itim text-xl hover:bg-blue-600 transition-colors">
                Guardar na Meta (${window.userData.progress.targetName})
            </button>
        </div>
    `);

    document.getElementById('execute-save-btn')?.addEventListener('click', () => {
        const amount = parseInt(document.getElementById('save-input-amount').value);
        window.executeSave(amount);
    });
}
window.renderGoalSettingModal = function() {
    window.showModal("Minha Meta de Poupança 🎯", `
        <p class="font-itim mb-4 text-center text-xl">
            Meta atual: <span class="text-blue-600 font-bold">${window.userData.progress.targetName}</span>
            (Faltam ${window.userData.progress.goal - window.userData.progress.savedAmount} moedas)
        </p>
        <div class="space-y-4">
            <label for="goal-name-input" class="font-bold font-itim block">Mudar o nome da meta:</label>
            <input type="text" id="goal-name-input" value="${window.userData.progress.targetName}" 
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
            window.userData.progress.targetName = newName;
            window.saveUserData();
            window.hideModal();
            window.showModal("Sucesso!", `O nome da meta foi atualizado para **${newName}**!`);
        } else {
            window.showModal("Erro", "O nome da meta não pode ser vazio.");
        }
    });
}
window.renderTaskManagementModal = () => window.showModal("Gerenciar Tarefas", "Conteúdo...");
window.renderProfileSettingsModal = () => window.showModal("Perfil e Ícone", "Conteúdo...");
window.renderThemesModal = () => window.showModal("Temas de Fundo", "Conteúdo...");
window.renderCompletedTasksModal = () => window.showModal("Tarefas Concluídas", "Conteúdo...");

export function renderParentDashboard() {
    if (window.userType !== 'Parent') return;

    const childrenListEl = document.getElementById('parent-children-list');
    const parentGreetingEl = document.getElementById('parent-greeting');
    
    if (childrenListEl) childrenListEl.innerHTML = '';
    if (parentGreetingEl) {
         const parentFirstName = window.parentData.name.split(' ')[0] || 'Responsável';
         parentGreetingEl.textContent = `Olá, ${parentFirstName}!`;
    }
    
    try {
        if (window.parentData.children.length === 0) {
            if (childrenListEl) childrenListEl.innerHTML = `<p class="text-gray-500 font-itim text-center mt-4 p-6 bg-gray-50 rounded-lg shadow-inner">Nenhuma criança adicionada ainda. Clique no '+' para começar.</p>`;
        } else {
            window.parentData.children.forEach(child => {
                const iconHtml = getIconHtml(child.profileIcon, 'text-4xl', 'w-20 h-20'); 

                const div = document.createElement('div');
                div.className = 'w-full h-[107px] p-2 bg-[#FCFCFC] rounded-lg shadow-md flex justify-between items-center transition-shadow hover:shadow-lg';
                div.style.boxShadow = '0px 4px 4px rgba(0, 0, 0, 0.25)';
                
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
            
            document.querySelectorAll('.view-child-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const childUid = e.currentTarget.dataset.uid;
                    window.showChildManagementView(childUid);
                });
            });

            document.querySelectorAll('.delete-child-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const childUid = e.currentTarget.dataset.uid;
                    const child = window.parentData.children.find(c => c.uid === childUid);
                    if (child) {
                        window.confirmDeleteChild(child.uid, child.name);
                    }
                });
            });
        }
    } catch (e) {
        if (childrenListEl) childrenListEl.innerHTML = `<p class="text-red-500 font-itim text-center mt-4">Erro Crítico ao exibir perfis. Veja o console.</p>`;
    }
}
window.confirmDeleteChild = function(uid, name) {
    window.showModal("Confirmação de Exclusão", `
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
        window.hideModal();
        window.deleteChildProfile(targetUid);
    });
}

export function renderChildManagement(childData) {
    const childManagementContainer = document.getElementById('child-management-container');
    const child = window.parentData.children.find(c => c.uid === window.currentChildId);
    
    if (!child || !childManagementContainer) return;

    childData = { ...DEFAULT_CHILD_DATA, ...childData };

    const totalTasks = childData.tasks?.length || 0;
    const completedTasks = childData.tasks?.filter(t => t.completed).length || 0;
    const savedAmount = childData.progress.savedAmount || 0;
    const goalAmount = childData.progress.goal || 0;
    
    const currentEmotion = childData.currentEmotion?.value || '😊';
    const iconHtml = getIconHtml(childData.profileIcon, 'text-3xl', 'w-12 h-12');


    childManagementContainer.innerHTML = `
        
        <div class="bg-white p-4 rounded-lg shadow-md mb-4 border-2 border-green-300">
            <div class="flex items-center space-x-3 border-b pb-2 mb-3">
                ${iconHtml}
                <h4 class="text-2xl font-itim text-green-700">${child.name} <span class="ml-2 text-3xl">${currentEmotion}</span></h4>
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
                ${window.renderHistoryList(childData.transactions)}
            </div>
        </div>
    `;
    
    document.getElementById('give-allowance-btn')?.addEventListener('click', () => {
        const amount = parseInt(document.getElementById('allowance-amount').value);
        const reason = document.getElementById('allowance-reason').value.trim() || "Mesada/Bônus";
        window.giveAllowance(childData, amount, reason, window.currentChildId);
    });
    
    document.getElementById('parent-add-task-btn')?.addEventListener('click', () => {
        const taskText = document.getElementById('parent-new-task-input').value.trim();
        window.createTaskForChild(childData, taskText, window.currentChildId);
    });
    
    document.getElementById('set-goal-btn')?.addEventListener('click', () => {
         const newGoal = parseInt(document.getElementById('goal-value-input').value);
         window.setGoalValueForChild(childData, newGoal, window.currentChildId);
    });
    
    renderTasksParent(document.getElementById('parent-tasks-list'), childData, window.currentChildId);
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
                <button data-task-id="${task.id}" data-uid="${currentUid}" class="delete-task-btn-parent text-red-500 p-1 hover:text-red-700 transition-colors">
                    <i class="fa-solid fa-trash-can"></i>
                </button>
            </div>
        `;
        container.appendChild(li);
    });

    document.querySelectorAll('.delete-task-btn-parent').forEach(button => {
         button.addEventListener('click', async (e) => {
            const taskId = e.currentTarget.dataset.taskId;
            const targetUid = e.currentTarget.dataset.uid;
            
            const childData = await window.getChildDataSnapshot(targetUid);
            if (childData) {
                childData.tasks = childData.tasks.filter(t => t.id !== taskId);
                await window.setDoc(window.CHILD_PROFILE_DOC_REF(window.parentId, targetUid), { tasks: childData.tasks }, { merge: true });
                renderChildManagement(childData);
            }
        });
    });
}


// --- Ponto de Entrada Principal (Modificado) ---
function init() {
    // 1. Inicializa os elementos de DOM e liga os listeners (CRÍTICO: Chamado imediatamente)
    initDOMElements();

    // 2. Inicializa o fluxo de autenticação (no Core)
    initFirebase(); 
    
    // 3. Adiciona listeners secundários (Sidebar, Modais, etc.)
    document.getElementById('close-sidebar-btn')?.addEventListener('click', () => {
        sidebarEl?.classList.remove('translate-x-0');
        sidebarEl?.classList.add('-translate-x-full');
    });

    document.getElementById('menu-logout')?.addEventListener('click', async () => {
        sidebarEl?.classList.add('-translate-x-full');
        await window.signOut(window.auth);
        window.showLoginView();
        window.showModal("Sessão Encerrada", "Você saiu. Faça login novamente.");
    });
}

// Chamar a função de inicialização após a definição de todas as funções do módulo
init();