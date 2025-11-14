// src/parent-dashboard.js
import { DEFAULT_CHILD_DATA, DEFAULT_PARENT_DATA } from './config.js';
import { 
    saveParentData, getChildDataSnapshot, loadOrCreateChildData, 
    saveChildData, deleteChildProfile 
} from './supabase-client.js';
import { showModal, hideModal, getIconHtml } from './ui.js';
import { parentData, parentId, setParentData, showParentHome } from './main.js';

let currentChildId = null;

export function setCurrentChildId(uid) {
    currentChildId = uid;
}

export function generateUniqueCode() {
    let code = '';
    for (let i = 0; i < 4; i++) {
        code += Math.floor(Math.random() * 10).toString();
    }
    // TODO: Adicionar lógica para garantir que o código seja único no Supabase
    return code;
}

// Expõe a função para ser usada no HTML (onclick)
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

    document.getElementById('add-child-form-modal')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const nameInput = document.getElementById('new-child-name-input-modal');
        const name = nameInput.value.trim();
        
        if (name && parentId) {
            try { 
                const childUid = crypto.randomUUID(); 
                const childCode = generateUniqueCode();
                
                const newChildReference = {
                    uid: childUid,
                    name: name,
                    code: childCode,
                    profileIcon: DEFAULT_CHILD_DATA.profileIcon, 
                    currentEmotion: DEFAULT_CHILD_DATA.currentEmotion
                };
                
                // 1. Cria/Salva o documento real da criança no Supabase
                await loadOrCreateChildData(parentId, childUid);
                
                // 2. Atualiza a lista denormalizada do pai
                parentData.children = parentData.children || [];
                parentData.children.push(newChildReference);
                setParentData(parentData);
                await saveParentData(parentId, { children: parentData.children }); 

                nameInput.value = '';
                hideModal();
                showModal("Criança Adicionada!", `**${name}** foi adicionada. Código: **${childCode}**.`);
                window.showParentHome();
                
            } catch (error) {
                console.error("Erro CRÍTICO ao adicionar criança:", error);
                document.getElementById('add-child-message').textContent = `Erro: ${error.message}. Tente novamente.`;
            }
        } else {
            document.getElementById('add-child-message').textContent = "Nome da criança é obrigatório.";
        }
    });
}

export function renderParentDashboard() {
    const childrenListEl = document.getElementById('parent-children-list');
    const parentGreetingEl = document.getElementById('parent-greeting'); 
    
    if (childrenListEl) childrenListEl.innerHTML = '';
    if (parentGreetingEl) {
         const parentFirstName = parentData.name.split(' ')[0] || 'Responsável';
         parentGreetingEl.textContent = `Olá, ${parentFirstName}!`;
    }
    
    if (parentData.children.length === 0) {
        if (childrenListEl) childrenListEl.innerHTML = `<p class="text-gray-500 font-itim text-center mt-4 p-6 bg-gray-50 rounded-lg shadow-inner">Nenhuma criança adicionada ainda. Clique no '+' para começar.</p>`;
    } else {
        parentData.children.forEach(child => {
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
                const child = parentData.children.find(c => c.uid === childUid);
                if (child) {
                    confirmDeleteChild(child.uid, child.name);
                }
            });
        });
    }
}

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
        deleteChild(targetUid);
    });
}

async function deleteChild(uid) {
    if (!parentId || !uid) return;

    try {
        await deleteChildProfile(parentId, uid); 

        // Remove a criança da lista denormalizada do pai
        parentData.children = parentData.children.filter(child => child.uid !== uid);
        setParentData(parentData);
        await saveParentData(parentId, { children: parentData.children });
        
        showModal("Excluído com Sucesso", "O perfil da criança foi removido.");
        window.showParentHome();
        
    } catch (error) {
        console.error("Erro ao excluir perfil da criança:", error);
        showModal("Erro de Exclusão", `Não foi possível excluir o perfil. Detalhe: ${error.message}.`);
        window.showParentHome();
    }
}

// Expõe a função para ser usada no HTML (onclick)
window.showChildManagementView = async function(childUid) {
    setCurrentChildId(childUid);
    const childData = await getChildDataSnapshot(parentId, childUid);
    
    if (childData) {
        renderChildManagement(childData);
        document.getElementById('parent-home-view').classList.add('hidden');
        document.getElementById('child-management-view').classList.remove('hidden');
    } else {
        showModal("Erro", "Não foi possível carregar o perfil da criança.");
        window.showParentHome();
    }
}

function renderChildManagement(childData) {
    const childManagementContainer = document.getElementById('child-management-container');
    const childRef = parentData.children.find(c => c.uid === currentChildId);
    
    if (!childRef || !childManagementContainer) return;

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
                <h4 class="text-2xl font-itim text-green-700">${childRef.name} <span class="ml-2 text-3xl">${currentEmotion}</span></h4>
            </div>
            <p class="text-xl font-itim mb-2">Código de Acesso: <span class="text-blue-600 font-bold">${childRef.code}</span></p>
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
    
    document.getElementById('give-allowance-btn')?.addEventListener('click', () => {
        const amount = parseInt(document.getElementById('allowance-amount').value);
        const reason = document.getElementById('allowance-reason').value.trim() || "Mesada/Bônus";
        giveAllowance(childData, amount, reason, currentChildId);
    });
    
    document.getElementById('parent-add-task-btn')?.addEventListener('click', () => {
        const taskText = document.getElementById('parent-new-task-input').value.trim();
        createTaskForChild(childData, taskText, currentChildId);
    });
    
    document.getElementById('set-goal-btn')?.addEventListener('click', () => {
         const newGoal = parseInt(document.getElementById('goal-value-input').value);
         setGoalValueForChild(childData, newGoal, currentChildId);
    });
    
    renderTasksParent(document.getElementById('parent-tasks-list'), childData, currentChildId);
}

function renderHistoryList(transactions) {
    // Reutilizada do UI, mas adaptada
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

async function setGoalValueForChild(childData, newGoal, uid) {
    if (isNaN(newGoal) || newGoal <= 0) {
         return showModal("Erro", "O valor da meta deve ser um número positivo.");
    }
    
    childData.progress.goal = newGoal;
    
    await saveChildData(uid, { progress: childData.progress });
    
    showModal("Meta Definida!", `O valor da meta de **${childData.progress.targetName}** foi definido para **${newGoal} moedas**!`);
    
    const updatedData = await getChildDataSnapshot(parentId, uid);
    if (updatedData) renderChildManagement(updatedData);
}

async function giveAllowance(childData, amount, reason, uid) {
    if (amount <= 0 || !uid) {
        return showModal("Erro", "Quantidade inválida.");
    }
    
    const newTransaction = {
        id: Date.now(),
        type: 'earn',
        amount: amount,
        description: reason,
        date: new Date().toLocaleDateString('pt-BR')
    };
    
    const newCoins = childData.coins + amount;
    const newTransactions = [newTransaction, ...(childData.transactions || [])].slice(0, 50);

    // Salva apenas os campos alterados no banco de dados
    await saveChildData(uid, { coins: newCoins, transactions: newTransactions });
    
    showModal("Sucesso", `Mesada de **${amount} moedas** dada a ${childData.name}!`);

    // Atualiza a UI do Dashboard
    document.getElementById('allowance-reason').value = '';
    const updatedData = await getChildDataSnapshot(parentId, uid);
    if (updatedData) renderChildManagement(updatedData);
}

async function createTaskForChild(childData, taskText, uid) {
    if (!taskText || !uid) return;

    const newTask = {
        id: Date.now().toString(),
        text: taskText,
        completed: false
    };
    
    const newTasks = [...(childData.tasks || []), newTask];
    
    await saveChildData(uid, { tasks: newTasks });
    document.getElementById('parent-new-task-input').value = '';
    
    const updatedData = await getChildDataSnapshot(parentId, uid);
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
            
            const childData = await getChildDataSnapshot(parentId, targetUid);
            if (childData) {
                childData.tasks = childData.tasks.filter(t => t.id !== taskId);
                await saveChildData(targetUid, { tasks: childData.tasks });
                renderChildManagement(childData); 
            }
        });
    });
}
