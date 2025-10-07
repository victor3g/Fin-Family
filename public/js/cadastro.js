// Configurações do seu projeto Supabase
const SUPABASE_URL = 'SUA_URL_DO_SUPABASE';
const SUPABASE_ANON_KEY = 'SUA_ANON_KEY';

const supabase = Supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Seleciona os elementos HTML
const cadastroForm = document.getElementById('cadastro-form');
const nameInput = document.getElementById('name-input');
const emailInput = document.getElementById('email-input');
const passwordInput = document.getElementById('password-input');
const confirmPasswordInput = document.getElementById('confirm-password-input');
const messageContainer = document.getElementById('message-container');

cadastroForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const name = nameInput.value;
  const email = emailInput.value;
  const password = passwordInput.value;
  const confirmPassword = confirmPasswordInput.value;

  // Validação básica do formulário
  if (!name || !email || !password || !confirmPassword) {
    showMessage('Por favor, preencha todos os campos.', 'error');
    return;
  }
  if (password !== confirmPassword) {
    showMessage('As senhas não coincidem.', 'error');
    return;
  }
  
  showMessage('Criando conta...', 'success');

  try {
    // Tenta cadastrar o usuário no Supabase
    const { data, error } = await supabase.auth.signUp({
      email: email,
      password: password,
    });

    if (error) {
      throw error;
    }

    // Se o cadastro for bem-sucedido, adicione o perfil do pai na tabela 'parents'
    const { error: insertError } = await supabase
      .from('parents')
      .insert([{ id: data.user.id, name: name, email: email }]);
      
    if (insertError) {
      throw insertError;
    }

    showMessage('Conta criada com sucesso! Verifique seu e-mail para confirmar.', 'success');
    // Você pode redirecionar o usuário após o cadastro
    // window.location.href = './login.html';

  } catch (error) {
    showMessage(`Erro: ${error.message}`, 'error');
    console.error('Erro de cadastro:', error);
  }
});

function showMessage(message, type) {
  messageContainer.textContent = message;
  messageContainer.className = `message ${type}`;
}