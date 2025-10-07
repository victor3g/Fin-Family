// server.js
const express = require('express');
const dotenv = require('dotenv');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');

dotenv.config();

const app = express();
const port = 3000;

// Configura o middleware para servir arquivos estáticos da pasta 'public'
app.use(express.static('public'));
app.use(express.json()); // Habilita o parsing de JSON no corpo das requisições

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Rota de API para criar um novo usuário
app.post('/api/auth/signup', async (req, res) => {
    const { email, password } = req.body;
    const { data, error } = await supabase.auth.signUp({ email, password });

    if (error) {
        return res.status(400).json({ error: error.message });
    }
    res.status(200).json({ message: 'Conta criada com sucesso!', data });
});

// Rota de API para login de usuário
app.post('/api/auth/signin', async (req, res) => {
    const { email, password } = req.body;
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
        return res.status(401).json({ error: error.message });
    }
    res.status(200).json({ message: 'Login bem-sucedido!', data });
});

// Serve o arquivo index.html na raiz
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(port, () => {
    console.log(`Servidor rodando em http://localhost:${port}`);
});