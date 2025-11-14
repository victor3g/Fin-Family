// src/supabase-client.js
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
import { SUPABASE_URL, SUPABASE_KEY, DEFAULT_CHILD_DATA, DEFAULT_PARENT_DATA } from './config.js';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// --- FUNÇÕES DE AUTENTICAÇÃO ---

export async function signIn(email, password) {
    // Simulação: A auth real do Supabase é mais complexa e exige um ambiente real
    // Neste caso, se for o admin, ele apenas "loga"
    return { user: { uid: 'parent-simulated-id' } };
}

export async function signOut() {
    // Apenas simula o logoff no código modularizado
    return true; 
}

// --- FUNÇÕES DE DADOS (CRIANÇA) ---

// Substitui o doc() do Firebase
export async function loadOrCreateChildData(parentUid, childUid) {
    let { data, error } = await supabase
        .from('child_data')
        .select('*')
        .eq('id', childUid)
        .eq('parent_id', parentUid)
        .single();
    
    if (error && error.code !== 'PGRST116') { // PGRST116: No rows found (expected se não existe)
        console.error("Erro ao carregar dados da criança:", error);
    }
    
    if (!data) {
        // Cria novo perfil se não existir (ID da criança é passado pelo pai)
        const initialData = { ...DEFAULT_CHILD_DATA, id: childUid, parent_id: parentUid };
        const { data: newData, error: newError } = await supabase
             .from('child_data')
             .insert([initialData])
             .select()
             .single();

        if (newError) {
             console.error("Erro ao criar perfil da criança:", newError);
             return DEFAULT_CHILD_DATA;
        }
        return { ...DEFAULT_CHILD_DATA, ...newData };
    }
    // Mescla com default para garantir estrutura completa
    return { 
        ...DEFAULT_CHILD_DATA, 
        ...data,
        settings: { ...DEFAULT_CHILD_DATA.settings, ...data.settings },
        currentPet: { ...DEFAULT_CHILD_DATA.currentPet, ...data.currentPet }
    };
}

export async function saveChildData(childUid, dataToSave) {
    // O RLS do Supabase garante que apenas o dono do child_data possa salvar
    const { error } = await supabase
        .from('child_data')
        .update(dataToSave) 
        .eq('id', childUid);

    if (error) {
        console.error("Erro ao salvar dados da criança:", error);
        throw error;
    }
}

export function setupRealtimeListener(childUid, updateCallback) {
    // O Supabase usa um canal de tempo real
    return supabase
        .channel(`child_data_${childUid}`)
        .on('postgres_changes', 
            { event: '*', schema: 'public', table: 'child_data', filter: `id=eq.${childUid}` }, 
            (payload) => {
                updateCallback(payload.new);
            }
        )
        .subscribe();
}

// --- FUNÇÕES DE DADOS (PAI) ---

export async function loadParentData(parentId) {
    let { data, error } = await supabase
        .from('parent_controls')
        .select('*')
        .eq('user_id', parentId)
        .single();
        
    if (error && error.code !== 'PGRST116') {
        console.error("Erro ao carregar dados do pai:", error);
    }

    if (!data) {
        const initialData = { ...DEFAULT_PARENT_DATA, user_id: parentId };
        await supabase.from('parent_controls').insert([initialData]);
        return initialData;
    }
    return { ...DEFAULT_PARENT_DATA, ...data };
}

export async function saveParentData(parentId, dataToSave) {
    const { error } = await supabase
        .from('parent_controls')
        .update(dataToSave)
        .eq('user_id', parentId);

    if (error) {
        console.error("Erro ao salvar dados do pai:", error);
        throw error;
    }
}

export function setupParentRealtimeListener(parentId, updateCallback) {
     return supabase
        .channel(`parent_controls_${parentId}`)
        .on('postgres_changes', 
            { event: '*', schema: 'public', table: 'parent_controls', filter: `user_id=eq.${parentId}` }, 
            (payload) => {
                updateCallback(payload.new);
            }
        )
        .subscribe();
}

export async function deleteChildProfile(parentUid, childUid) {
     // 1. Deleta o documento da criança
     const { error: deleteError } = await supabase
        .from('child_data')
        .delete()
        .eq('id', childUid)
        .eq('parent_id', parentUid); // Segurança dupla

     if (deleteError) throw deleteError;
     return true;
}

export async function getChildDataSnapshot(parentUid, childUid) {
    const { data, error } = await supabase
        .from('child_data')
        .select('*')
        .eq('id', childUid)
        .eq('parent_id', parentUid)
        .single();
        
    if (error && error.code !== 'PGRST116') {
        console.error("Erro ao carregar snapshot:", error);
    }
    
    // Retorna dados ou um objeto básico para evitar que o app trave
    return data ? { ...DEFAULT_CHILD_DATA, ...data } : null;
}
