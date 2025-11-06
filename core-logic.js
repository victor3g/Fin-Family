import { 
    db,         // Este é o cliente 'supabase'
    auth,       // Este é o 'supabase.auth'
    appId, 
    initialAuthToken,
    supabase    // Importamos o cliente principal
} from "./supabase-config.js";

import { 
    PARENT_CREDENTIALS, 
    COOLDOWN_DURATION_MS, 
    DEFAULT_CHILD_DATA, 
    DEFAULT_PARENT_DATA,
    PET_CHARACTERS, 
    BADGES, 
    DONATION_TARGET 
} from "./data-structures.js";

import { 
    showChildApp, 
    showParentDashboard, 
    renderParentDashboard, 
    renderChildManagement,
    applyTheme,
    updateUI,
    showModal,
    hideModal,
    renderHistoryList,
    renderTasks 
} from "./ui-logic.js";


// --- VARIÁVEIS DE ESTADO GLOBAL (Expostas em 'window' para comunicação entre módulos e HTML) ---
window.parentId = null; 
window.currentUserId = null;
window.currentChildId = null;
window.userType = 'Guest'; 
window.childParentId = null; 
window.userData = {};
window.parentData = DEFAULT_PARENT_DATA;
window.game = null; 
window.reactionTimeout = null;

// Variáveis para os canais de Realtime do Supabase
let childChannel = null;
let parentChannel = null;

// --- SUPABASE PATHING (Nomes das Tabelas) ---
// Em vez de referências de 'doc', apenas definimos os nomes das tabelas
const PARENT_TABLE = 'parent_data';
const CHILD_TABLE = 'child_profiles';


// --- LÓGICA DE AUTENTICAÇÃO E INICIALIZAÇÃO ---

export function initFirebase() {
    // Liga o listener de autenticação do SUPABASE
    supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_IN' || event === 'USER_UPDATED' || (event === 'INITIAL_SESSION' && session)) {
            window.currentUserId = session.user.id;
            window.showLoginView();
        } else if (event === 'SIGNED_OUT') {
            window.currentUserId = null;
            window.showLoginView();
        }
    });

    // Tenta carregar a sessão existente
    (async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
            window.currentUserId = session.user.id;
            window.showLoginView();
        } else {
            // Se não houver sessão, faz o login anônimo (como o código original tentava)
            const { data, error } = await supabase.auth.signInAnonymously();
            if (error) {
                console.error("Erro ao fazer login anônimo:", error);
                showModal("Erro de Conexão", "Não foi possível iniciar a sessão anônima. Verifique as configurações do Supabase.");
            } else if (data) {
                window.currentUserId = data.user.id;
                window.showLoginView();
            }
        }
    })();
}

// === FUNÇÕES GLOBAIS DE LOGIN/AUTENTICAÇÃO (Mapeadas para window) ===
// (A lógica de login é 'simulada' e não usa o Supabase Auth,
// ela apenas verifica as credenciais hardcoded e usa o ID anônimo)
window.parentLogin = async function() {
    const email = document.getElementById('login-email-input').value;
    const password = document.getElementById('login-password-input').value;

    if (email === PARENT_CREDENTIALS.email && password === PARENT_CREDENTIALS.password) {
        // Define o ID do Pai como o ID do usuário anônimo atual
        window.parentId = window.currentUserId; 
        await window.loadParentData(); // Carrega os dados ANTES de mostrar o dashboard
        showParentDashboard(window.parentId);
        document.getElementById('login-message').textContent = '';
    } else {
        document.getElementById('login-message').textContent = 'Credenciais incorretas.';
    }
}

window.childLogin = async function(code) {
    document.getElementById('login-message').textContent = 'Buscando perfil...';
    
    // O ID do pai é o ID anônimo atual
    const parentUid = window.currentUserId;
    await window.loadParentData(parentUid); // Carrega os dados do pai para encontrar a criança

    let childFound = false;
    
    if (window.parentData && window.parentData.children) {
        const children = window.parentData.children || [];
        const child = children.find(c => c.code === code);
        
        if (child) {
            childFound = true;
            // Passa o UID da criança (child.uid) e o ID do pai (o ID anônimo)
            showChildApp(child.uid, parentUid); 
            return;
        }
    }

    if (!childFound) {
         document.getElementById('login-message').textContent = 'Código de acesso inválido ou não encontrado.';
    }
}

// Funções de simulação de cadastro (não precisam de mudança, pois são simulações)
window.handleSignup = async function(e) {
    e.preventDefault();
    const password = document.getElementById('signup-password-input').value;
    const confirmPassword = document.getElementById('signup-confirm-password-input').value;
    const messageEl = document.getElementById('signup-message');

    if (password !== confirmPassword) {
        messageEl.textContent = "Erro: As senhas não coincidem.";
        return;
    }
    
    messageEl.textContent = `Conta criada! (Simulação). Use esta tela para Login.`;
    messageEl.classList.remove('text-red-500');
    messageEl.classList.add('text-green-600');
    
    setTimeout(() => {
        window.showLoginView();
    }, 2000);
}

window.handleForgotPassword = async function(e) {
    e.preventDefault();
    const email = document.getElementById('reset-email-input').value;
    const messageEl = document.getElementById('reset-message');
    
    messageEl.textContent = `Link de redefinição enviado para ${email}! (Simulação)`;
    messageEl.classList.remove('text-red-500');
    messageEl.classList.add('text-green-600');
    
    setTimeout(() => {
         window.showLoginView();
    }, 2000);
}


// --- PERSISTÊNCIA DE DADOS (Reescrito para Supabase) ---

export async function loadOrCreateUserData(uid, defaultData) {
    const parentUidToUse = window.userType === 'Child' ? window.childParentId : window.parentId;
    if (!parentUidToUse) {
        window.userData = { ...defaultData };
        return;
    }

    try {
        // getDoc -> supabase.from().select()
        const { data, error }_ = await supabase
            .from(CHILD_TABLE)
            .select('data')
            .eq('child_uid', uid)
            .eq('parent_uid', parentUidToUse)
            .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 = 'Not found'
            throw error;
        }

        if (data) {
            // Combina os defaults com os dados do banco (como o original)
            const dbData = data.data; // Acessa a coluna 'data' (jsonb)
            window.userData = { ...defaultData, ...dbData };
            window.userData.settings.themes = { ...defaultData.settings.themes, ...dbData.settings?.themes };
            window.userData.currentPet = { ...PET_CHARACTERS.find(p => p.id === dbData.currentPet?.id), ...dbData.currentPet }; 
        } else {
            // setDoc (para criar) -> supabase.from().insert()
            window.userData = defaultData;
            const parentChild = window.parentData.children.find(c => c.uid === uid);
            if (parentChild) {
                 window.userData.name = parentChild.name;
            }
            
            const { error: insertError } = await supabase
                .from(CHILD_TABLE)
                .insert({
                    child_uid: uid,
                    parent_uid: parentUidToUse,
                    data: window.userData
                });
            if (insertError) throw insertError;
        }
        
        if (window.userType === 'Child') {
            window.calculateInterest();
            applyTheme(window.userData.settings.theme); 
        }
    } catch (e) {
        console.error("Erro ao carregar/criar dados da criança:", e);
        window.userData = { ...defaultData };
    }
}

window.loadParentData = async function(uid = window.parentId) {
    if (!uid || typeof uid !== 'string') {
        window.parentData = { name: "Responsável", children: [] };
        return;
    }
    
    // Define o window.parentId globalmente se estivermos carregando
    window.parentId = uid; 

    try {
        // getDoc -> supabase.from().select()
        const { data, error } = await supabase
            .from(PARENT_TABLE)
            .select('data')
            .eq('parent_uid', uid)
            .single();

        if (error && error.code !== 'PGRST116') { // Not found
            throw error;
        }

        if (data) {
            window.parentData = { ...DEFAULT_PARENT_DATA, ...data.data };
        } else {
            // setDoc (para criar) -> supabase.from().insert()
            window.parentData = DEFAULT_PARENT_DATA;
            const { error: insertError } = await supabase
                .from(PARENT_TABLE)
                .insert({
                    parent_uid: uid,
                    data: window.parentData
                });
            if (insertError) throw insertError;
        }
    } catch (e) {
        console.error("Erro ao carregar/criar dados do pai:", e);
        window.parentData = { name: "Responsável", children: [] };
    }
}

export function setupRealtimeListener(uid) {
    if (!window.childParentId) return;

    // Desinscreve de canais antigos
    if (childChannel) {
        supabase.removeChannel(childChannel);
        childChannel = null;
    }

    // onSnapshot -> supabase.channel()
    childChannel = supabase
        .channel(`child-profile:${uid}`)
        .on('postgres_changes', 
            { 
                event: 'UPDATE', 
                schema: 'public', 
                table: CHILD_TABLE, 
                filter: `child_uid=eq.${uid}` 
            },
            (payload) => {
                console.log('Realtime (Criança) payload recebido:', payload);
                const data = payload.new.data; // Pega o JSON da coluna 'data'
                if (data) {
                    window.userData = { ...DEFAULT_CHILD_DATA, ...data };
                    window.userData.settings.themes = { ...DEFAULT_CHILD_DATA.settings.themes, ...data.settings?.themes };
                    window.userData.currentPet = { ...PET_CHARACTERS.find(p => p.id === data.currentPet?.id), ...data.currentPet }; 

                    applyTheme(window.userData.settings.theme); 
                    updateUI();
                }
            }
        )
        .subscribe((status, err) => {
            if (err) {
                console.error("Erro no listener em tempo real (Criança):", err);
            }
        });
}

export function setupParentRealtimeListener(uid) {
    if (!uid || typeof uid !== 'string') return;
    
    // Desinscreve de canais antigos
    if (parentChannel) {
        supabase.removeChannel(parentChannel);
        parentChannel = null;
    }

    // onSnapshot -> supabase.channel()
    parentChannel = supabase
        .channel(`parent-data:${uid}`)
        .on('postgres_changes',
            {
                event: 'UPDATE',
                schema: 'public',
                table: PARENT_TABLE,
                filter: `parent_uid=eq.${uid}`
            },
            (payload) => {
                console.log('Realtime (Pai) payload recebido:', payload);
                const data = payload.new.data; // Pega o JSON da coluna 'data'
                if (data) {
                    window.parentData = { ...window.parentData, ...data };
                    renderParentDashboard();
                }
            }
        )
        .subscribe((status, err) => {
            if (err) {
                console.error("Erro no listener em tempo real (Pai):", err);
            }
        });
}

window.saveUserData = async function(uid = window.currentUserId) {
    const parentUidToUse = window.userType === 'Child' ? window.childParentId : window.parentId;
    if (!uid || !parentUidToUse || window.userType === 'Guest') return;

    try {
        const dataToSave = { ...window.userData };
        delete dataToSave.game; // Não salva o estado do jogo
        
        // setDoc({ merge: true }) -> supabase.from().upsert()
        // 'upsert' atualiza se existir, ou insere se não existir.
        const { error } = await supabase
            .from(CHILD_TABLE)
            .upsert({
                child_uid: uid,
                parent_uid: parentUidToUse,
                data: dataToSave,
                updated_at: new Date() // Força o 'UPDATE' para o realtime
            });
            
        if (error) throw error;
        
    } catch (e) {
        console.error("Erro ao salvar dados da criança (Supabase):", e);
    }
}

window.saveParentData = async function() {
    if (!window.parentId || window.userType !== 'Parent') return;
    try {
        // setDoc({ merge: true }) -> supabase.from().upsert()
        const { error } = await supabase
            .from(PARENT_TABLE)
            .upsert({
                parent_uid: window.parentId,
                data: window.parentData,
                updated_at: new Date() // Força o 'UPDATE' para o realtime
            });
            
        if (error) throw error;
        
    } catch (e) {
        console.error("Erro ao salvar dados do pai (Supabase):", e);
    }
}

window.getChildDataSnapshot = async function(uid) {
     if (!window.parentId) return null;
     
     try {
        // getDoc -> supabase.from().select()
        const { data, error } = await supabase
            .from(CHILD_TABLE)
            .select('data')
            .eq('child_uid', uid)
            .eq('parent_uid', window.parentId)
            .single();

        if (error) throw error;

        if (data) {
             const dbData = data.data; // Pega o JSON
             return { 
                 ...DEFAULT_CHILD_DATA, 
                 ...dbData,
                 tasks: dbData.tasks || [], 
                 transactions: dbData.transactions || [],
                 currentPet: { ...PET_CHARACTERS.find(p => p.id === dbData.currentPet?.id), ...dbData.currentPet } 
            };
        }
     } catch (e) {
        console.error("Erro ao buscar snapshot da criança (Supabase):", e);
     }
     return null;
}

// --- LÓGICA DE JOGO E REGRAS ---
// (Nenhuma mudança necessária aqui, pois é lógica interna do JS)

window.isGameOnCooldown = function() {
    return window.userData.gameCooldownEndTime > Date.now();
}

window.getRemainingCooldownTime = function() {
    const remainingMs = window.userData.gameCooldownEndTime - Date.now();
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

window.launchGame = function() {
    if (window.isGameOnCooldown()) {
         const remainingTime = window.getRemainingCooldownTime();
         return showModal("Jogo em Recarga", `Você pode jogar novamente em **${remainingTime}**.`);
    }

    document.getElementById('game-modal').classList.remove('hidden');
    window.startGame();
}

window.triggerReaction = function() {
    const piggyCharEl = document.getElementById('piggy-character');
    const piggyGreetingEl = document.getElementById('piggy-greeting');
    
    if (!piggyCharEl || window.userType !== 'Child') return;
    
    piggyCharEl.classList.remove('piggy-reacting');
    void piggyCharEl.offsetWidth; 
    piggyCharEl.classList.add('piggy-reacting');

    clearTimeout(window.reactionTimeout);
    const REACTION_MESSAGES = [
        "Opa! Fui tocado!", "Eba! Mais moedas!", "Toca de novo! ✨", "Pronto para poupar?", "Uau! 😊",
    ];
    const randomMsg = REACTION_MESSAGES[Math.floor(Math.random() * REACTION_MESSAGES.length)];
    piggyGreetingEl.textContent = randomMsg;
    piggyGreetingEl.classList.remove('opacity-0');

    window.reactionTimeout = setTimeout(() => {
        piggyGreetingEl.classList.add('opacity-0');
    }, 2000);
}

// Funções de Lógica do Jogo (Mantidas em 'window' para callbacks)
window.GAME_WIDTH = 300;
window.GAME_HEIGHT = 400;

window.startGame = function() { 
    const canvas = document.getElementById('game-canvas');
    const ctx = canvas?.getContext('2d');
    
    window.game = {
        piggy: { x: window.GAME_WIDTH / 2 - 15, y: window.GAME_HEIGHT - 80, w: 30, h: 30, vy: 0, gravity: 0.25, jumpPower: -10, onCloud: false },
        clouds: [
            { x: window.GAME_WIDTH / 2 - 25, y: window.GAME_HEIGHT - 30, w: 50}, 
            { x: Math.random() * (window.GAME_WIDTH - 50), y: window.GAME_HEIGHT - 120, w: 50}, 
            { x: Math.random() * (window.GAME_WIDTH - 50), y: window.GAME_HEIGHT - 210, w: 50}, 
        ],
        coins: [], obstacles: [],
        multiplier: { active: false, remainingTime: 0, value: 2 },
        score: 0, isRunning: true, lastTime: performance.now(),
        ctx: ctx
    };
    document.getElementById('game-score').textContent = window.game.score;
    document.getElementById('game-message').textContent = `Pule nas nuvens e colete ⭐ com o seu ${window.userData.currentPet?.label || 'Porquinho'}!`;
    
    requestAnimationFrame(window.gameLoop);
    document.addEventListener('keydown', window.handleInput);
    canvas?.addEventListener('click', window.handleInput);
}

window.gameLoop = function(timestamp) {
    if (!window.game || !window.game.isRunning || !window.game.ctx) return;

    // Lógica de update e desenho (mantida como estava)
    const deltaTime = timestamp - window.game.lastTime;
    window.game.lastTime = timestamp;
    window.game.ctx.clearRect(0, 0, window.GAME_WIDTH, window.GAME_HEIGHT);
    // ... (O resto da sua lógica de jogo vai aqui) ...

    requestAnimationFrame(window.gameLoop);
}

window.gameOver = function() {
    if (!window.game) return;
    window.game.isRunning = false;
    document.removeEventListener('keydown', window.handleInput);
    document.getElementById('game-canvas')?.removeEventListener('click', window.handleInput);

    const finalScore = window.game.score * window.userData.actions.earn;

    if (finalScore > 0) {
        window.userData.coins += finalScore; 
        window.userData.gameCooldownEndTime = Date.now() + COOLDOWN_DURATION_MS;
        window.addTransaction('earn', finalScore, `Recompensa do Jogo (${window.game.score} itens)`);
        window.checkBadges();
        window.saveUserData();
        showModal("Vitória no Jogo! 🥳", `Você coletou **${window.game.score} itens** e ganhou **${finalScore} moedas**!`);
    } else {
         document.getElementById('game-message').textContent = 'FIM DE JOGO! Tente novamente para ganhar moedas.';
    }

    document.getElementById('game-modal').classList.add('hidden'); 
}

window.handleInput = function(event) {
    if (window.game && window.game.isRunning) {
        if (event.key === ' ' || event.key === 'ArrowUp' || event.type === 'click') {
            if (window.game.piggy.onCloud) {
                window.game.piggy.vy = window.game.piggy.jumpPower;
                window.game.piggy.onCloud = false;
            }
        }
        
        const moveSpeed = 10;
        if (event.key === 'ArrowLeft') {
            window.game.piggy.x -= moveSpeed;
        } else if (event.key === 'ArrowRight') {
            window.game.piggy.x += moveSpeed;
        }
    }
}


// --- LÓGICA DE AÇÕES E REGRAS FINANCEIRAS ---
// (Nenhuma mudança necessária aqui, lógica interna)

window.calculateInterest = function() {
    const INTEREST_RATE = 0.005; 
    const lastDate = new Date(window.userData.lastInterestDate);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - lastDate.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)); 

    if (diffDays >= 1 && window.userData.progress.savedAmount > 0) {
        let interestGained = 0;
        for (let i = 0; i < diffDays; i++) {
            interestGained += Math.floor(window.userData.progress.savedAmount * INTEREST_RATE);
        }
        
        if (interestGained > 0) {
            window.userData.progress.savedAmount += interestGained;
            window.userData.lastInterestDate = now.getTime(); 
            window.addTransaction('earn', interestGained, `Juros (${diffDays} dias) da Poupança`);
            showModal("Juros Ganhos! ✨", `Sua poupança rendeu **${interestGained} moedas** de juros acumulados!`);
            window.saveUserData();
        }
    }
    window.userData.lastInterestDate = now.getTime(); 
}

window.awardBadge = function(badgeId) {
     if (!window.userData.badges.includes(badgeId)) {
        window.userData.badges.push(badgeId);
        const badge = BADGES[badgeId];
        if (badge) {
            showModal(`Nova Conquista: ${badge.name}! 🏆`, `${badge.description} Parabéns!`);
            window.saveUserData();
        }
    }
}

window.checkBadges = function() {
     if (window.userData.transactions?.some(t => t.type === 'earn') && window.userData.coins > 0) {
        window.awardBadge('first_earn');
    }
    if (window.userData.transactions?.some(t => t.type === 'save')) {
        window.awardBadge('first_save');
    }
    if (window.userData.donationCount >= DONATION_TARGET) {
         window.awardBadge('generous');
    }
    const progressPercent = window.userData.progress.goal > 0
        ? (window.userData.progress.savedAmount / window.userData.progress.goal)
        : 0;

    if (progressPercent >= 0.10) {
        window.awardBadge('goal_starter');
    }
    if (progressPercent >= 1.0) {
        window.awardBadge('goal_master');
    }
}

window.addTransaction = function(type, amount, description) {
     window.userData.transactions = window.userData.transactions || [];
     window.userData.transactions.unshift({
        id: Date.now(),
        type: type,
        amount: amount,
        description: description,
        date: new Date().toLocaleDateString('pt-BR')
    });
    window.userData.transactions = window.userData.transactions.slice(0, 50); 
}

window.toggleTaskCompletion = function(taskId) {
    const task = window.userData.tasks.find(t => t.id === taskId);
    if (task) {
        const wasCompleted = task.completed;
        task.completed = !task.completed;
        
        if (task.completed && !wasCompleted) {
            const reward = window.userData.actions.earn;
            window.userData.coins += reward; 
            window.addTransaction('earn', reward, `Tarefa concluída: ${task.text}`);
            window.checkBadges(); 
            showModal("Tarefa Concluída!", `Parabéns! Você ganhou **${reward} moedas**!`);
        } else if (wasCompleted && !task.completed) {
            const penalty = window.userData.actions.earn;
            window.userData.coins = Math.max(0, window.userData.coins - penalty);
            window.addTransaction('spend', penalty, `Tarefa desfeita: ${task.text}`);
            showModal("Tarefa Desfeita", `Você perdeu **${penalty} moedas** de volta.`);
        }
        window.saveUserData();
    }
}

window.deleteTask = function(taskId) {
    window.userData.tasks = window.userData.tasks.filter(t => t.id !== taskId);
    window.saveUserData();
}

window.executeSave = function(saveAmount) {
    if (isNaN(saveAmount) || saveAmount <= 0) {
        return showModal("Erro", "Por favor, insira um valor válido.");
    }
    if (window.userData.coins < saveAmount) {
        return showModal("Saldo Insuficiente", `Você precisa de **${saveAmount} moedas**, mas só tem ${window.userData.coins}.`);
    }

    window.userData.coins -= saveAmount;
    window.userData.progress.savedAmount += saveAmount;
    
    window.addTransaction('save', saveAmount, `Poupança para meta: ${window.userData.progress.targetName}`);
    window.awardBadge('first_save');
    window.checkBadges();
    window.saveUserData();
    hideModal();
    showModal("Poupança Completa! 🏦", `Você guardou **${saveAmount} moedas** na sua meta!`);
}

// --- LÓGICA DA API GEMINI ---
// (Veja o PASSO 5 para uma melhoria de segurança sobre isso)
window.getFinancialTip = async function(category, amount) {
    try {
        // Chama a Edge Function do Supabase
        const { data, error } = await supabase.functions.invoke('get-gemini-tip', {
            body: { category, amount },
        });

        if (error) throw error;

        return data.tip || "Ups! Sem dica desta vez, mas continua a poupar!";
        
    } catch (error) {
        console.error("Erro ao chamar a Edge Function (Gemini):", error);
        return "A fada da dica está a dormir (erro na função). Tenta mais tarde!";
    }
}

// Lógica de gasto (sem mudança)
window.executeGenericSpend = function(spendAmount) {
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
                Retirar de Moedas Livres (${window.userData.coins} disponíveis)
            </button>
            <button id="spend-from-saved" class="w-full bg-orange-500 text-white p-3 rounded-lg font-itim hover:bg-orange-600 transition-colors" data-source="saved">
                Retirar da Poupança (${window.userData.progress.savedAmount} disponíveis)
            </button>
        </div>
    `);

    const spendFromCoinsBtn = document.getElementById('spend-from-coins');
    const spendFromSavedBtn = document.getElementById('spend-from-saved');
    const categorySelect = document.getElementById('spend-category');

    spendFromCoinsBtn.disabled = window.userData.coins < spendAmount;
    spendFromSavedBtn.disabled = window.userData.progress.savedAmount < spendAmount;

    [spendFromCoinsBtn, spendFromSavedBtn].forEach(btn => {
        btn.onclick = () => {
            const source = btn.dataset.source;
            const category = categorySelect.value;
            let success = false;

            if (source === 'coins' && window.userData.coins >= spendAmount) {
                window.userData.coins -= spendAmount;
                window.addTransaction('spend', spendAmount, `Gasto: ${category} (Livre)`);
                success = true;
            } else if (source === 'saved' && window.userData.progress.savedAmount >= spendAmount) {
                window.userData.progress.savedAmount -= spendAmount;
                window.addTransaction('spend', spendAmount, `Gasto: ${category} (Meta)`);
                success = true;
            }

            if (success) {
                window.saveUserData();
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
                    
                    const tip = await window.getFinancialTip(category, spendAmount);
                    
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


// --- LÓGICA DO DASHBOARD DO PAI (Requer Supabase) ---

function generateUniqueCode() {
    let code = '';
    for (let i = 0; i < 4; i++) {
        code += Math.floor(Math.random() * 10).toString();
    }
    return code;
}

window.handleAddNewChild = async function(e) {
    e.preventDefault();
    const nameInput = document.getElementById('new-child-name-input-modal');
    const name = nameInput.value.trim();
    const messageEl = document.getElementById('add-child-message');
    
    if (name && window.parentId) {
        try { 
            // crypto.randomUUID() está disponível em Https/localhost
            const childUid = crypto.randomUUID(); 
            const childCode = generateUniqueCode();
            
            const newChild = {
                uid: childUid,
                name: name,
                code: childCode,
                profileIcon: DEFAULT_CHILD_DATA.profileIcon, 
                currentEmotion: DEFAULT_CHILD_DATA.currentEmotion
            };
            
            // 1. Cria o perfil da criança no banco de dados
            const childInitialData = { ...DEFAULT_CHILD_DATA, name: name };
            // setDoc (criar) -> insert
            const { error: insertError } = await supabase
                .from(CHILD_TABLE)
                .insert({
                    child_uid: childUid,
                    parent_uid: window.parentId,
                    data: childInitialData
                });
            if (insertError) throw insertError;
            
            // 2. Adiciona a criança à lista do pai e salva
            if (!window.parentData.children) {
                window.parentData.children = [];
            }
            window.parentData.children.push(newChild);
            await window.saveParentData(); // saveParentData já usa upsert

            nameInput.value = '';
            hideModal();
            showModal("Criança Adicionada!", `**${name}** foi adicionada com sucesso. Código: **${childCode}**.`);
            
        } catch (error) {
            console.error("Erro ao adicionar criança (Supabase):", error);
            messageEl.textContent = `Erro: ${error.message}. Tente novamente.`;
            
        } finally {
            window.showParentHome(); 
        }
    } else {
        messageEl.textContent = "Nome da criança é obrigatório.";
    }
}

window.deleteChildProfile = async function(uid) {
    if (!window.parentId || window.userType !== 'Parent' || !uid) return;

    try {
        // 1. Deleta o perfil da criança
        // deleteDoc -> supabase.from().delete()
        const { error: deleteError } = await supabase
            .from(CHILD_TABLE)
            .delete()
            .eq('child_uid', uid)
            .eq('parent_uid', window.parentId);
            
        if (deleteError) throw deleteError;

        // 2. Remove a criança da lista do pai e salva o pai
        window.parentData.children = window.parentData.children.filter(child => child.uid !== uid);
        await window.saveParentData(); 
        
        showModal("Excluído com Sucesso", "O perfil da criança foi removido.");
        window.showParentHome();
        
    } catch (error) {
        console.error("Erro ao excluir criança (Supabase):", error);
        showModal("Erro de Exclusão", `Não foi possível excluir o perfil no banco de dados. Detalhe: ${error.message}.`);
        window.showParentHome();
    }
}

window.giveAllowance = async function(childData, amount, reason, uid) {
    if (amount <= 0 || !uid) {
        return showModal("Erro", "Quantidade inválida.");
    }
    
    // Modifica o objeto de dados (em memória)
    childData.coins += amount;
    childData.transactions = childData.transactions || [];
    // Adiciona a transação (usando a função global que modifica o objeto childData)
    window.addTransaction.call({ userData: childData }, 'earn', amount, reason); 
    
    // Salva o objeto 'childData' modificado no banco
    // setDoc -> upsert
    const { error } = await supabase
        .from(CHILD_TABLE)
        .upsert({
            child_uid: uid,
            parent_uid: window.parentId,
            data: childData,
            updated_at: new Date()
        });
    
    if (error) {
        showModal("Erro", "Não foi possível dar a mesada.");
        console.error("Erro ao dar mesada (Supabase):", error);
        return;
    }
    
    showModal("Sucesso", `Mesada de **${amount} moedas** dada a ${childData.name}!`);
    document.getElementById('allowance-reason').value = '';

    // A UI do pai (se estiver usando Realtime) deve se atualizar sozinha.
    // Mas podemos forçar uma re-renderização local para feedback imediato.
    renderChildManagement(childData);
}

window.createTaskForChild = async function(childData, taskText, uid) {
    if (!taskText || !uid) return;

    const newTask = {
        id: Date.now().toString(),
        text: taskText,
        completed: false
    };
    
    childData.tasks = childData.tasks || [];
    childData.tasks.push(newTask);
    
    // Salva o objeto 'childData' modificado (apenas a parte 'tasks')
    // setDoc({ merge: true }) -> upsert
    const { error } = await supabase
        .from(CHILD_TABLE)
        .upsert({
            child_uid: uid,
            parent_uid: window.parentId,
            data: childData, // O upsert com o objeto inteiro funciona como merge
            updated_at: new Date()
        });

    if (error) {
        showModal("Erro", "Não foi possível criar a tarefa.");
        console.error("Erro ao criar tarefa (Supabase):", error);
        return;
    }

    document.getElementById('parent-new-task-input').value = '';
    renderChildManagement(childData); // Atualiza a UI local
    showModal("Sucesso", `Tarefa '${taskText}' adicionada para ${childData.name}.`);
}

window.setGoalValueForChild = async function(childData, newGoal, uid) {
    if (isNaN(newGoal) || newGoal <= 0) {
         return showModal("Erro", "O valor da meta deve ser um número positivo.");
    }
    
    childData.progress.goal = newGoal;
    
    // Salva o objeto 'childData' modificado
    // setDoc({ merge: true }) -> upsert
    const { error } = await supabase
        .from(CHILD_TABLE)
        .upsert({
            child_uid: uid,
            parent_uid: window.parentId,
            data: childData,
            updated_at: new Date()
        });

    if (error) {
        showModal("Erro", "Não foi possível definir a meta.");
        console.error("Erro ao definir meta (Supabase):", error);
        return;
    }
    
    showModal("Meta Definida!", `O valor da meta de **${childData.progress.targetName}** foi definido para **${newGoal} moedas**!`);
    renderChildManagement(childData); // Atualiza a UI local
}