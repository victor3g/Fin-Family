document.addEventListener("DOMContentLoaded", () => {
    // Seletores de elementos existentes
    const switchTela = document.querySelector("#switchTela");
    const switchTela2 = document.querySelector("#switchTela2");
    const tela1 = document.querySelector(".tela1");
    const tela2 = document.querySelector(".tela2");

    // Seletores de elementos para autenticação
    const emailInput = document.querySelector("#email-input");
    const senhaInput = document.querySelector("#senha-input");
    const btnEntrar = document.querySelector("#btn-entrar");
    const btnCriar = document.querySelector("#btn-criar");

    function toggleTelas() {
        tela1.classList.toggle("active");
        tela2.classList.toggle("active");
        switchTela.classList.toggle("on");
        switchTela2.classList.toggle("on");
    }

    switchTela.addEventListener("click", toggleTelas);
    switchTela2.addEventListener("click", toggleTelas);

    // Função para criar uma nova conta usando a API do seu backend
    async function criarConta() {
        const email = emailInput.value;
        const password = senhaInput.value;

        try {
            const response = await fetch('/api/auth/signup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Erro ao criar a conta.');
            }

            console.log('Conta criada com sucesso!', result.data);
            alert('Conta criada com sucesso! Verifique seu e-mail para confirmar.');

        } catch (error) {
            console.error('Erro ao criar a conta:', error.message);
            alert('Erro ao criar a conta. Tente novamente.');
        }
    }

    // Função para fazer login usando a API do seu backend
    async function fazerLogin() {
        const email = emailInput.value;
        const password = senhaInput.value;

        try {
            const response = await fetch('/api/auth/signin', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Erro ao fazer login.');
            }

            console.log('Login bem-sucedido!', result.data);
            alert('Login bem-sucedido!');
            // Redirecione ou faça a lógica pós-login aqui
            
        } catch (error) {
            console.error('Erro ao fazer login:', error.message);
            alert('Erro ao fazer login. Verifique seu e-mail e senha.');
        }
    }

    // Event listeners para os botões de ação
    btnCriar.addEventListener("click", (event) => {
        event.preventDefault();
        criarConta();
    });

    btnEntrar.addEventListener("click", (event) => {
        event.preventDefault();
        fazerLogin();
    });
});