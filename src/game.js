// src/game.js
import { COOLDOWN_DURATION_MS } from './config.js';
import { showModal, isGameOnCooldown } from './ui.js';
import { saveChildData, getChildDataSnapshot } from './supabase-client.js';
import { currentUserId, addTransaction, checkBadges, userData, updateGlobalUserData } from './main.js';

const canvas = document.getElementById('game-canvas');
const ctx = canvas?.getContext('2d');
const GAME_WIDTH = 300;
const GAME_HEIGHT = 400;

let game = {}; 

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
        window.gameOver();
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

// Função global, exposta ao window para ser chamada por outros botões/funções
window.gameOver = async function() {
    game.isRunning = false;
    document.removeEventListener('keydown', handleInput);
    canvas?.removeEventListener('click', handleInput);

    const finalScore = game.score * userData.actions.earn;

    document.getElementById('game-modal').classList.add('hidden'); 

    if (finalScore > 0) {
        // Atualiza userData (global em main.js)
        userData.coins += finalScore; 
        userData.gameCooldownEndTime = Date.now() + COOLDOWN_DURATION_MS; 
        
        addTransaction('earn', finalScore, `Recompensa do Jogo (${game.score} itens)`);
        checkBadges();
        
        try {
             await saveChildData(currentUserId, { coins: userData.coins, gameCooldownEndTime: userData.gameCooldownEndTime, transactions: userData.transactions, badges: userData.badges });
        } catch (e) {
             console.error("Erro ao salvar dados após o jogo:", e);
        }
        
        showModal("Vitória no Jogo! 🥳", `Você coletou **${game.score} itens** e ganhou **${finalScore} moedas**!`);
    } else {
        showModal("Fim de Jogo!", 'Tente novamente para ganhar moedas.');
    }
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

export function launchGame() {
    if (isGameOnCooldown()) {
         const remainingTime = getRemainingCooldownTime();
         return showModal("Jogo em Recarga", `Você pode jogar novamente em **${remainingTime}**.`);
    }

    document.getElementById('game-modal').classList.remove('hidden');
    startGame();
}

function getRemainingCooldownTime() {
    const remainingMs = userData.gameCooldownEndTime - Date.now();
    if (remainingMs <= 0) return null;

    const hours = Math.floor(remainingMs / (1000 * 60 * 60));
    const minutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));

    let parts = [];
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}min`);
    if (parts.length === 0) parts.push(`Alguns segundos`); // Simplifica a exibição de segundos

    return parts.join(' ');
}
