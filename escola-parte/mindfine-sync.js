// ==========================================
// MINDFINE - SISTEMA DE PERSISTÊNCIA
// Arquivo: mindfine-sync.js
// ==========================================

const API_BASE_URL = 'https://mindfine-backend.onrender.com/api';

// ========== FUNÇÕES AUXILIARES ==========


function getUsuarioLogado() {
    // SEMPRE retorna um usuário mockado, nunca bloqueia
    const usuario = localStorage.getItem('usuario');
    if (usuario) {
        return JSON.parse(usuario);
    }
    // Criar usuário padrão se não existir
    const usuarioPadrao = {
        nome: "Usuário Teste",
        email: "teste@mindfine.com",
        matricula: "123456",
        tipo: "estudante"
    };
    localStorage.setItem('usuario', JSON.stringify(usuarioPadrao));
    return usuarioPadrao;
}

// A função getMatricula() continua igual, mas nunca vai falhar
function getMatricula() {
    const usuario = getUsuarioLogado();
    return usuario.matricula;
}
// ========== CARREGAR PROGRESSO DO SERVIDOR ==========

async function carregarProgressoDoServidor() {
    const matricula = getMatricula();
    if (!matricula) return null;
    
    try {
        const response = await fetch(`${API_BASE_URL}/progresso/${matricula}`);
        
        if (!response.ok) {
            throw new Error('Erro ao carregar progresso');
        }
        
        const progresso = await response.json();
        console.log('✅ Progresso carregado:', progresso);
        return progresso;
        
    } catch (error) {
        console.error('❌ Erro ao carregar progresso:', error);
        return null;
    }
}

// ========== SALVAR PROGRESSO NO SERVIDOR ==========

async function salvarProgressoNoServidor(dados) {
    const matricula = getMatricula();
    if (!matricula) return false;
    
    try {
        const response = await fetch(`${API_BASE_URL}/progresso/${matricula}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(dados)
        });
        
        if (!response.ok) {
            throw new Error('Erro ao salvar progresso');
        }
        
        console.log('✅ Progresso salvo com sucesso!');
        return true;
        
    } catch (error) {
        console.error('❌ Erro ao salvar progresso:', error);
        return false;
    }
}

// ========== FUNÇÕES ESPECÍFICAS ==========

// 1. Atualizar Moedas
async function atualizarMoedas(novoValor) {
    await salvarProgressoNoServidor({ moedas: novoValor });
}

// 2. Atualizar XP e Nível
async function atualizarXPeNivel(xp, nivel) {
    await salvarProgressoNoServidor({ xp: xp, nivel: nivel });
}

// 3. Desbloquear Universo
async function desbloquearUniverso(nomeUniverso) {
    const progresso = await carregarProgressoDoServidor();
    if (!progresso) return;
    
    const universos = progresso.universos_desbloqueados;
    if (!universos.includes(nomeUniverso)) {
        universos.push(nomeUniverso);
        await salvarProgressoNoServidor({ universos_desbloqueados: universos });
    }
}

// 4. Desbloquear Ilha
async function desbloquearIlha(nomeIlha) {
    const progresso = await carregarProgressoDoServidor();
    if (!progresso) return;
    
    const ilhas = progresso.ilhas_desbloqueadas;
    if (!ilhas.includes(nomeIlha)) {
        ilhas.push(nomeIlha);
        await salvarProgressoNoServidor({ ilhas_desbloqueadas: ilhas });
    }
}

// 5. Trocar Skin
async function trocarSkin(nomeSkin) {
    await salvarProgressoNoServidor({ skin_atual: nomeSkin });
}

// 6. Adicionar Figurinha
async function adicionarFigurinha(idFigurinha) {
    const progresso = await carregarProgressoDoServidor();
    if (!progresso) return;
    
    const figurinhas = progresso.figurinhas_desbloqueadas;
    if (!figurinhas.includes(idFigurinha)) {
        figurinhas.push(idFigurinha);
        await salvarProgressoNoServidor({ figurinhas_desbloqueadas: figurinhas });
    }
}

// 7. Salvar Recorde de Jogo
async function salvarRecordeJogo(nomeJogo, pontuacao) {
    const progresso = await carregarProgressoDoServidor();
    if (!progresso) return;
    
    const recordes = progresso.recordes_jogos;
    
    // Só salva se for maior que o recorde atual
    if (!recordes[nomeJogo] || pontuacao > recordes[nomeJogo]) {
        recordes[nomeJogo] = pontuacao;
        await salvarProgressoNoServidor({ recordes_jogos: recordes });
        return true; // Novo recorde!
    }
    
    return false;
}

// 8. Salvar Desenho na Galeria
async function salvarDesenhoGaleria(desenhoBase64) {
    const progresso = await carregarProgressoDoServidor();
    if (!progresso) return;
    
    const galeria = progresso.galeria_arte;
    galeria.unshift({
        data: desenhoBase64,
        date: new Date().toLocaleDateString('pt-BR')
    });
    
    // Limitar a 50 desenhos
    if (galeria.length > 50) {
        galeria.pop();
    }
    
    await salvarProgressoNoServidor({ galeria_arte: galeria });
}

// 9. Registrar Emoção Diária
async function registrarEmocaoDiaria(emocao, emoji) {
    const matricula = getMatricula();
    if (!matricula) return false;
    
    try {
        const response = await fetch(`${API_BASE_URL}/emocao/${matricula}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ emocao: emocao, emoji: emoji })
        });
        
        if (!response.ok) {
            const erro = await response.json();
            console.log('⚠️', erro.erro);
            return false;
        }
        
        console.log('✅ Emoção registrada!');
        return true;
        
    } catch (error) {
        console.error('❌ Erro ao registrar emoção:', error);
        return false;
    }
}

// 10. Verificar se já registrou emoção hoje
async function jaRegistrouEmocaoHoje() {
    const matricula = getMatricula();
    if (!matricula) return true; // Bloqueia se não tiver matricula
    
    try {
        const response = await fetch(`${API_BASE_URL}/check-emocao/${matricula}`);
        const data = await response.json();
        return data.ja_registrou;
        
    } catch (error) {
        console.error('❌ Erro ao verificar emoção:', error);
        return false;
    }
}

// 11. Obter Histórico de Emoções
async function obterHistoricoEmocoes() {
    const matricula = getMatricula();
    if (!matricula) return {};
    
    try {
        const response = await fetch(`${API_BASE_URL}/emocoes/${matricula}`);
        const historico = await response.json();
        return historico;
        
    } catch (error) {
        console.error('❌ Erro ao carregar histórico:', error);
        return {};
    }
}

// ========== INICIALIZAÇÃO AUTOMÁTICA ==========

// Função para carregar dados ao entrar na página
async function inicializarPagina() {
    // Pular a chamada ao backend, usar localStorage ou valores padrão
    const moedas = parseInt(localStorage.getItem('mindfine_moedas') || '2500');
    const nivel = parseInt(localStorage.getItem('mindfine_nivel') || '5');
    const xp = parseInt(localStorage.getItem('mindfine_xp') || '90');
    const skin = localStorage.getItem('mindfine_skin') || 'pandas/skin.png';
    const universos = JSON.parse(localStorage.getItem('mindfine_universos') || '["Santuário", "Ilha do Pirata", "Ilha do Bruxo"]');
    const figurinhas = JSON.parse(localStorage.getItem('mindfine_figurinhas') || '[]');
    
    // Aplicar na UI se existir
    const coinElement = document.getElementById('coin-count');
    if (coinElement) coinElement.textContent = moedas.toLocaleString('pt-BR');
    
    const levelElement = document.getElementById('level-display');
    if (levelElement) levelElement.textContent = `NV. ${nivel}`;
    
    const xpBar = document.getElementById('xp-bar-fill');
    if (xpBar) xpBar.style.width = xp + '%';
    
    const pandaImg = document.getElementById('panda-image');
    if (pandaImg) pandaImg.src = skin;
    
    return { moedas, nivel, xp, skin_atual: skin, universos_desbloqueados: universos, figurinhas_desbloqueadas: figurinhas };
}

// ========== AUTO-SYNC (SALVAR AUTOMATICAMENTE) ==========

// Objeto global para armazenar o estado atual
window.mindfineState = {
    moedas: 0,
    xp: 0,
    nivel: 0,
    universos: [],
    ilhas: [],
    skin: 'pandas/skin.png'
};

// Função para sincronizar automaticamente quando algo mudar
let syncTimeout = null;
function autoSync() {
    // Debounce: espera 2 segundos após a última mudança para salvar
    clearTimeout(syncTimeout);
    syncTimeout = setTimeout(async () => {
        await salvarProgressoNoServidor(window.mindfineState);
        console.log('🔄 Auto-sync realizado!');
    }, 2000);
}

// Exemplo de uso: quando alterar moedas, chama autoSync()
function setMoedas(valor) {
    window.mindfineState.moedas = valor;
    document.getElementById('coin-count').textContent = valor.toLocaleString('pt-BR');
    autoSync();
}

function setXP(valor) {
    window.mindfineState.xp = valor;
    document.getElementById('xp-bar-fill').style.width = valor + '%';
    autoSync();
}

function setNivel(valor) {
    window.mindfineState.nivel = valor;
    document.getElementById('level-display').textContent = `NV. ${valor}`;
    autoSync();
}


if (window.mindfineAPI) {
    window.mindfineAPI.recarregarDados = async function() {
        const matricula = getMatricula();
        const response = await fetch(`${API_BASE_URL}/progresso/${matricula}`);
        const dados = await response.json();
        
        window.mindfineState.moedas = dados.moedas;
        window.mindfineState.xp = dados.xp;
        window.mindfineState.nivel = dados.nivel;
        
        const coinEl = document.getElementById('coin-count');
        if (coinEl) coinEl.textContent = dados.moedas.toLocaleString('pt-BR');
        
        const levelEl = document.getElementById('level-display');
        if (levelEl) levelEl.textContent = `NV. ${dados.nivel}`;
        
        const xpBar = document.getElementById('xp-bar-fill');
        if (xpBar) xpBar.style.width = dados.xp + '%';
        
        return dados;
    };
}
// ========== EXPORTAR FUNÇÕES ==========
// Estas funções ficam disponíveis globalmente para uso nas páginas

window.mindfineAPI = {
    carregarProgresso: carregarProgressoDoServidor,
    salvarProgresso: salvarProgressoNoServidor,
    atualizarMoedas,
    atualizarXPeNivel,
    desbloquearUniverso,
    desbloquearIlha,
    trocarSkin,
    adicionarFigurinha,
    salvarRecordeJogo,
    salvarDesenhoGaleria,
    registrarEmocaoDiaria,
    jaRegistrouEmocaoHoje,
    obterHistoricoEmocoes,
    inicializarPagina,
    setMoedas,
    setXP,
    setNivel
};

console.log('✅ Mindfine API carregada!');
