import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

// Estas variáveis DEVEM ser configuradas no seu ambiente de aplicação
// (Similar a como __firebase_config era injetado)
const SUPABASE_URL = "https://hmmaqtvsvoemyovxxdxa.supabase.co"; 
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhtbWFxdHZzdm9lbXlvdnh4ZHhhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgwMzIwMjEsImV4cCI6MjA3MzYwODAyMX0.bh_OAefqK7uHCc9vdZeM_BQwwxQDWQyBjKn8XJlTYQc"; 

// Inicialização do Cliente Supabase
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Para a transição, ainda precisamos da referência de autenticação
const auth = supabase.auth;
const db = supabase; // Usamos 'db' para consistência, mas é o cliente Supabase

// A Supabase não requer um App ID para pathing de documentos.
// Vamos manter o conceito de 'appId' para pathing, mas será constante.
const appId = 'fin_family_app'; 
const initialAuthToken = null; // Supabase usa sessões, não tokens customizados no carregamento.

// Exporta as referências necessárias
export { 
    db, 
    auth, 
    appId, 
    initialAuthToken,
    supabase
};