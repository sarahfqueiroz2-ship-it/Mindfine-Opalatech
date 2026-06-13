const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5001;

// CORS
app.use(cors({
    origin: '*',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept']
}));


app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'escola-parte')));

// ========== CONEXÃO POSTGRESQL ==========
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

// Criar tabelas automaticamente
async function criarTabelas() {
    const client = await pool.connect();
    try {
        // Tabela usuarios
        await client.query(`
            CREATE TABLE IF NOT EXISTS usuarios (
                matricula TEXT PRIMARY KEY,
                nome TEXT,
                email TEXT,
                senha TEXT,
                tipo TEXT DEFAULT 'estudante',
                nivel INTEGER DEFAULT 1,
                xp INTEGER DEFAULT 0,
                moedas INTEGER DEFAULT 0,
                skin_atual TEXT DEFAULT 'pandas/skin.png',
                fundo_atual TEXT DEFAULT 'fundos/fundo-a.png'
            )
        `);
        
        // Tabela emocoes
        await client.query(`
            CREATE TABLE IF NOT EXISTS emocoes (
                id SERIAL PRIMARY KEY,
                matricula TEXT REFERENCES usuarios(matricula),
                data TEXT,
                emocao TEXT,
                emoji TEXT
            )
        `);
        
        // Tabela universos_desbloqueados
        await client.query(`
            CREATE TABLE IF NOT EXISTS universos_desbloqueados (
                id SERIAL PRIMARY KEY,
                matricula TEXT REFERENCES usuarios(matricula),
                universo TEXT
            )
        `);
        
        // Tabela figurinhas_desbloqueadas
        await client.query(`
            CREATE TABLE IF NOT EXISTS figurinhas_desbloqueadas (
                id SERIAL PRIMARY KEY,
                matricula TEXT REFERENCES usuarios(matricula),
                pagina TEXT,
                slot INTEGER,
                figurinha_id TEXT,
                data_desbloqueio TEXT
            )
        `);
        
        // Tabela usuario_config
        await client.query(`
            CREATE TABLE IF NOT EXISTS usuario_config (
                id SERIAL PRIMARY KEY,
                matricula TEXT REFERENCES usuarios(matricula),
                chave TEXT,
                valor TEXT
            )
        `);
        
        // Tabela diario_entradas
        await client.query(`
            CREATE TABLE IF NOT EXISTS diario_entradas (
                id SERIAL PRIMARY KEY,
                matricula TEXT REFERENCES usuarios(matricula),
                data TEXT,
                titulo TEXT,
                conteudo TEXT,
                tipo TEXT DEFAULT 'text',
                audio_base64 TEXT,
                data_hora TEXT
            )
        `);
        
        // Tabela galeria_arte
        await client.query(`
            CREATE TABLE IF NOT EXISTS galeria_arte (
                id SERIAL PRIMARY KEY,
                matricula TEXT REFERENCES usuarios(matricula),
                data TEXT,
                imagem_base64 TEXT
            )
        `);
        
        // Tabela recordes_jogos
        await client.query(`
            CREATE TABLE IF NOT EXISTS recordes_jogos (
                id SERIAL PRIMARY KEY,
                matricula TEXT REFERENCES usuarios(matricula),
                jogo_nome TEXT,
                pontuacao INTEGER,
                data_record TEXT
            )
        `);
        
        // Tabela musicas_favoritas
        await client.query(`
            CREATE TABLE IF NOT EXISTS musicas_favoritas (
                id SERIAL PRIMARY KEY,
                matricula TEXT REFERENCES usuarios(matricula),
                musica_id INTEGER,
                titulo TEXT,
                artista TEXT,
                data_adicionado TEXT
            )
        `);
        
        // Tabela conversas
        await client.query(`
            CREATE TABLE IF NOT EXISTS conversas (
                id TEXT PRIMARY KEY,
                matricula_aluno TEXT REFERENCES usuarios(matricula),
                nome_aluno TEXT,
                anonimo INTEGER DEFAULT 0,
                ultima_mensagem TEXT,
                ultima_data TEXT,
                urgente INTEGER DEFAULT 1,
                resolvido INTEGER DEFAULT 0
            )
        `);
        
        // Tabela mensagens
        await client.query(`
            CREATE TABLE IF NOT EXISTS mensagens (
                id SERIAL PRIMARY KEY,
                conversa_id TEXT REFERENCES conversas(id),
                remetente TEXT,
                texto TEXT,
                data_hora TEXT
            )
        `);
        
        // Tabela alertas
        await client.query(`
            CREATE TABLE IF NOT EXISTS alertas (
                id TEXT PRIMARY KEY,
                titulo TEXT,
                descricao TEXT,
                turma TEXT,
                aluno TEXT,
                severidade TEXT,
                tipo TEXT,
                emoji TEXT,
                detalhes TEXT,
                resolvido INTEGER DEFAULT 0,
                data_criacao TEXT,
                data_resolucao TEXT
            )
        `);
        
        // Tabela intervencoes
        await client.query(`
            CREATE TABLE IF NOT EXISTS intervencoes (
                id TEXT PRIMARY KEY,
                titulo TEXT,
                descricao TEXT,
                turma TEXT,
                aluno TEXT,
                prioridade TEXT,
                tipo TEXT,
                responsavel TEXT,
                data_prevista TEXT,
                progresso INTEGER DEFAULT 0,
                status TEXT DEFAULT 'pendente',
                curso TEXT,
                data_criacao TEXT,
                data_atualizacao TEXT
            )
        `);
        
        console.log('✅ Todas as tabelas criadas/verificadas!');
    } catch (err) {
        console.error('Erro ao criar tabelas:', err);
    } finally {
        client.release();
    }
}

criarTabelas();

// ========== ROTA DE LOGIN ==========
app.post('/api/login', async (req, res) => {
    const { tipo_usuario, identificador, senha } = req.body;
    
    console.log(`Login tentativa: ${identificador} - ${tipo_usuario}`);
    
    try {
        // Buscar usuário no banco
        let query = 'SELECT * FROM usuarios WHERE LOWER(matricula) = LOWER($1) OR LOWER(email) = LOWER($1)';
        let result = await pool.query(query, [identificador]);
        
        if (result.rows.length === 0) {
            // Usuário não encontrado
            return res.status(401).json({ 
                sucesso: false, 
                mensagem: 'Usuário não encontrado!' 
            });
        }
        
        const usuario = result.rows[0];
        
        // Verificar tipo de usuário
        if (usuario.tipo !== tipo_usuario) {
            return res.status(401).json({ 
                sucesso: false, 
                mensagem: `Acesso negado. Você não é um ${tipo_usuario}.` 
            });
        }
        
        // Verificar senha (em produção, use bcrypt)
        if (usuario.senha && usuario.senha !== senha) {
            return res.status(401).json({ 
                sucesso: false, 
                mensagem: 'Senha incorreta!' 
            });
        }
        
        // Login bem-sucedido
        res.json({
            sucesso: true,
            nome: usuario.nome,
            email: usuario.email,
            matricula: usuario.matricula,
            tipo: usuario.tipo
        });
        
    } catch (error) {
        console.error('Erro no login:', error);
        res.status(500).json({ 
            sucesso: false, 
            mensagem: 'Erro interno do servidor' 
        });
    }
});

// ========== ROTAS DO PROGRESSO ==========

app.get('/api/progresso/:matricula', async (req, res) => {
    const { matricula } = req.params;
    
    try {
        let usuario = await pool.query('SELECT * FROM usuarios WHERE matricula = $1', [matricula]);
        
        if (usuario.rows.length === 0) {
            await pool.query(
                `INSERT INTO usuarios (matricula, nome, email, nivel, xp, moedas, skin_atual, fundo_atual) 
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                [matricula, "Usuário", `${matricula}@mindfine.com`, 1, 0, 0, "pandas/skin.png", "fundos/fundo-a.png"]
            );
            
            const universosPadrao = ["Santuário", "Ilha do Pirata", "Ilha do Bruxo"];
            for (const universo of universosPadrao) {
                await pool.query('INSERT INTO universos_desbloqueados (matricula, universo) VALUES ($1, $2)',
                    [matricula, universo]);
            }
            
            usuario = await pool.query('SELECT * FROM usuarios WHERE matricula = $1', [matricula]);
        }
        
        const universos = await pool.query('SELECT universo FROM universos_desbloqueados WHERE matricula = $1', [matricula]);
        const listaUniversos = universos.rows.map(u => u.universo);
        if (listaUniversos.length === 0) {
            listaUniversos.push("Santuário", "Ilha do Pirata", "Ilha do Bruxo");
        }
        
        res.json({
            moedas: usuario.rows[0].moedas,
            xp: usuario.rows[0].xp,
            nivel: usuario.rows[0].nivel,
            skin_atual: usuario.rows[0].skin_atual,
            fundo_atual: usuario.rows[0].fundo_atual || 'fundos/fundo-a.png',
            universos_desbloqueados: listaUniversos,
            figurinhas_desbloqueadas: [],
            recordes_jogos: {},
            galeria_arte: []
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ erro: err.message });
    }
});

app.post('/api/progresso/:matricula', async (req, res) => {
    const { matricula } = req.params;
    const updates = req.body;
    
    const campos = [];
    const valores = [];
    let idx = 1;
    
    if (updates.moedas !== undefined) { campos.push(`moedas = $${idx++}`); valores.push(updates.moedas); }
    if (updates.xp !== undefined) { campos.push(`xp = $${idx++}`); valores.push(updates.xp); }
    if (updates.nivel !== undefined) { campos.push(`nivel = $${idx++}`); valores.push(updates.nivel); }
    if (updates.skin_atual !== undefined) { campos.push(`skin_atual = $${idx++}`); valores.push(updates.skin_atual); }
    if (updates.fundo_atual !== undefined) { campos.push(`fundo_atual = $${idx++}`); valores.push(updates.fundo_atual); }
    if (updates.universos_desbloqueados !== undefined) { 
        // Para universos, precisa de lógica separada
        await pool.query('DELETE FROM universos_desbloqueados WHERE matricula = $1', [matricula]);
        for (const universo of updates.universos_desbloqueados) {
            await pool.query('INSERT INTO universos_desbloqueados (matricula, universo) VALUES ($1, $2)', [matricula, universo]);
        }
    }
    
    if (campos.length > 0) {
        valores.push(matricula);
        const sql = `UPDATE usuarios SET ${campos.join(', ')} WHERE matricula = $${idx}`;
        await pool.query(sql, valores);
    }
    
    res.json({ sucesso: true });
});

// ========== ROTA DE EMOCÕES ==========

app.post('/api/emocao/:matricula', async (req, res) => {
    const { matricula } = req.params;
    const { emocao, emoji } = req.body;
    const hoje = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }).split('/').reverse().join('-');
    
    try {
        const existente = await pool.query('SELECT * FROM emocoes WHERE matricula = $1 AND data = $2', [matricula, hoje]);
        
        if (existente.rows.length > 0) {
            return res.status(400).json({ erro: "Você já registrou sua emoção hoje!" });
        }
        
        await pool.query('INSERT INTO emocoes (matricula, data, emocao, emoji) VALUES ($1, $2, $3, $4)',
            [matricula, hoje, emocao, emoji]);
        
        await pool.query('UPDATE usuarios SET moedas = moedas + 25, xp = xp + 25 WHERE matricula = $1', [matricula]);
        await pool.query('UPDATE usuarios SET nivel = nivel + 1, xp = 0 WHERE matricula = $1 AND xp >= 100', [matricula]);
        
        const result = await pool.query('SELECT moedas FROM usuarios WHERE matricula = $1', [matricula]);
        res.json({ sucesso: true, moedas_ganhas: 25, xp_ganhas: 25, total_moedas: result.rows[0]?.moedas });
    } catch (err) {
        console.error(err);
        res.status(500).json({ erro: err.message });
    }
});

app.get('/api/check-emocao/:matricula', async (req, res) => {
    const { matricula } = req.params;
    const hoje = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }).split('/').reverse().join('-');
    
    try {
        const result = await pool.query('SELECT * FROM emocoes WHERE matricula = $1 AND data = $2', [matricula, hoje]);
        res.json({ ja_registrou: result.rows.length > 0 });
    } catch (err) {
        res.status(500).json({ erro: err.message });
    }
});

app.get('/api/emocoes/:matricula', async (req, res) => {
    const { matricula } = req.params;
    
    try {
        const result = await pool.query('SELECT data, emocao, emoji FROM emocoes WHERE matricula = $1 ORDER BY data DESC', [matricula]);
        const historico = {};
        result.rows.forEach(row => {
            historico[row.data] = { feeling: row.emocao, type: "positive" };
        });
        res.json(historico);
    } catch (err) {
        res.status(500).json({ erro: err.message });
    }
});

// ========== ROTAS DE FIGURINHAS ==========

app.get('/api/figurinhas/:matricula', async (req, res) => {
    const { matricula } = req.params;
    
    try {
        const result = await pool.query('SELECT pagina, slot, figurinha_id FROM figurinhas_desbloqueadas WHERE matricula = $1', [matricula]);
        const figurinhas = {};
        result.rows.forEach(row => {
            if (!figurinhas[row.pagina]) {
                figurinhas[row.pagina] = {};
            }
            figurinhas[row.pagina][row.slot] = row.figurinha_id;
        });
        res.json(figurinhas);
    } catch (err) {
        res.status(500).json({ erro: err.message });
    }
});

app.post('/api/figurinhas/desbloquear', async (req, res) => {
    const { matricula, pagina, slot, figurinha_id } = req.body;
    const hoje = new Date().toISOString().split('T')[0];
    
    try {
        const existente = await pool.query('SELECT * FROM figurinhas_desbloqueadas WHERE matricula = $1 AND pagina = $2 AND slot = $3',
            [matricula, pagina, slot]);
        
        if (existente.rows.length > 0) {
            return res.json({ sucesso: false, ja_desbloqueada: true });
        }
        
        await pool.query(`INSERT INTO figurinhas_desbloqueadas (matricula, pagina, slot, figurinha_id, data_desbloqueio)
                         VALUES ($1, $2, $3, $4, $5)`,
            [matricula, pagina, slot, figurinha_id, hoje]);
        
        res.json({ sucesso: true });
    } catch (err) {
        res.status(500).json({ erro: err.message });
    }
});

app.get('/api/figurinhas/paginas-desbloqueadas/:matricula', async (req, res) => {
    const { matricula } = req.params;
    
    try {
        const result = await pool.query('SELECT valor FROM usuario_config WHERE matricula = $1 AND chave = $2',
            [matricula, 'paginas_album']);
        const paginas = result.rows.length > 0 ? JSON.parse(result.rows[0].valor) : 1;
        res.json({ paginas_desbloqueadas: paginas });
    } catch (err) {
        res.status(500).json({ erro: err.message });
    }
});

app.post('/api/figurinhas/paginas-desbloqueadas', async (req, res) => {
    const { matricula, paginas } = req.body;
    
    try {
        await pool.query(`INSERT INTO usuario_config (matricula, chave, valor) VALUES ($1, $2, $3)
                         ON CONFLICT (id) DO UPDATE SET valor = EXCLUDED.valor`,
            [matricula, 'paginas_album', JSON.stringify(paginas)]);
        res.json({ sucesso: true });
    } catch (err) {
        res.status(500).json({ erro: err.message });
    }
});

// ========== ROTAS DO DIÁRIO ==========

app.get('/api/diario/:matricula', async (req, res) => {
    const { matricula } = req.params;
    
    try {
        const result = await pool.query('SELECT * FROM diario_entradas WHERE matricula = $1 ORDER BY data DESC', [matricula]);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ erro: err.message });
    }
});

app.post('/api/diario/:matricula', async (req, res) => {
    const { matricula } = req.params;
    const { titulo, conteudo, tipo, audio_base64 } = req.body;
    const hoje = new Date().toISOString().split('T')[0];
    const agora = new Date().toISOString();
    
    try {
        const result = await pool.query(
            `INSERT INTO diario_entradas (matricula, data, titulo, conteudo, tipo, audio_base64, data_hora)
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
            [matricula, hoje, titulo || "Sem título", conteudo || "", tipo || "text", audio_base64 || null, agora]);
        
        res.json({ sucesso: true, id: result.rows[0].id, mensagem: "Entrada salva com sucesso!" });
    } catch (err) {
        res.status(500).json({ erro: err.message });
    }
});

app.delete('/api/diario/:matricula/:id', async (req, res) => {
    const { matricula, id } = req.params;
    
    try {
        await pool.query('DELETE FROM diario_entradas WHERE matricula = $1 AND id = $2', [matricula, id]);
        res.json({ sucesso: true, mensagem: "Entrada removida" });
    } catch (err) {
        res.status(500).json({ erro: err.message });
    }
});

// ========== ROTAS DA GALERIA ==========

app.get('/api/galeria/:matricula', async (req, res) => {
    const { matricula } = req.params;
    
    try {
        const result = await pool.query('SELECT * FROM galeria_arte WHERE matricula = $1 ORDER BY data DESC', [matricula]);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ erro: err.message });
    }
});

app.post('/api/galeria/:matricula', async (req, res) => {
    const { matricula } = req.params;
    const { imagem_base64 } = req.body;
    const hoje = new Date().toLocaleDateString('pt-BR');
    
    try {
        const result = await pool.query(
            `INSERT INTO galeria_arte (matricula, data, imagem_base64) VALUES ($1, $2, $3) RETURNING id`,
            [matricula, hoje, imagem_base64]);
        
        res.json({ sucesso: true, id: result.rows[0].id, mensagem: "Desenho salvo com sucesso!" });
    } catch (err) {
        res.status(500).json({ erro: err.message });
    }
});

app.delete('/api/galeria/:matricula/:id', async (req, res) => {
    const { matricula, id } = req.params;
    
    try {
        await pool.query('DELETE FROM galeria_arte WHERE matricula = $1 AND id = $2', [matricula, id]);
        res.json({ sucesso: true, mensagem: "Desenho removido" });
    } catch (err) {
        res.status(500).json({ erro: err.message });
    }
});

// ========== ROTAS DE RECORDES ==========

app.get('/api/recorde/:matricula/:jogo', async (req, res) => {
    const { matricula, jogo } = req.params;
    
    try {
        const result = await pool.query('SELECT pontuacao FROM recordes_jogos WHERE matricula = $1 AND jogo_nome = $2',
            [matricula, jogo]);
        res.json({ recorde: result.rows.length > 0 ? result.rows[0].pontuacao : 0 });
    } catch (err) {
        res.status(500).json({ erro: err.message });
    }
});

app.post('/api/recorde/:matricula/:jogo', async (req, res) => {
    const { matricula, jogo } = req.params;
    const { pontuacao } = req.body;
    const hoje = new Date().toISOString().split('T')[0];
    
    try {
        const result = await pool.query('SELECT pontuacao FROM recordes_jogos WHERE matricula = $1 AND jogo_nome = $2',
            [matricula, jogo]);
        
        const isMemoria = jogo.startsWith('jogo_memoria');
        const isMelhor = result.rows.length === 0 || (isMemoria ? pontuacao < result.rows[0].pontuacao : pontuacao > result.rows[0].pontuacao);
        
        if (isMelhor) {
            await pool.query(`INSERT INTO recordes_jogos (matricula, jogo_nome, pontuacao, data_record)
                             VALUES ($1, $2, $3, $4)
                             ON CONFLICT (id) DO UPDATE SET pontuacao = EXCLUDED.pontuacao, data_record = EXCLUDED.data_record`,
                [matricula, jogo, pontuacao, hoje]);
            res.json({ sucesso: true, novo_recorde: true, recorde: pontuacao });
        } else {
            res.json({ sucesso: true, novo_recorde: false, recorde: result.rows[0].pontuacao });
        }
    } catch (err) {
        res.status(500).json({ erro: err.message });
    }
});

// ========== ROTAS DA PLAYLIST ==========

app.get('/api/playlist/:matricula', async (req, res) => {
    const { matricula } = req.params;
    
    try {
        const result = await pool.query('SELECT musica_id FROM musicas_favoritas WHERE matricula = $1', [matricula]);
        const favoritos = result.rows.map(row => row.musica_id);
        res.json({ favoritos: favoritos });
    } catch (err) {
        res.status(500).json({ erro: err.message });
    }
});

app.post('/api/playlist/:matricula', async (req, res) => {
    const { matricula } = req.params;
    const { musica_id, titulo, artista } = req.body;
    const hoje = new Date().toISOString().split('T')[0];
    
    try {
        const existente = await pool.query('SELECT * FROM musicas_favoritas WHERE matricula = $1 AND musica_id = $2',
            [matricula, musica_id]);
        
        if (existente.rows.length > 0) {
            return res.json({ sucesso: false, ja_existe: true });
        }
        
        await pool.query(`INSERT INTO musicas_favoritas (matricula, musica_id, titulo, artista, data_adicionado)
                         VALUES ($1, $2, $3, $4, $5)`,
            [matricula, musica_id, titulo || '', artista || '', hoje]);
        
        res.json({ sucesso: true });
    } catch (err) {
        res.status(500).json({ erro: err.message });
    }
});

app.delete('/api/playlist/:matricula/:musica_id', async (req, res) => {
    const { matricula, musica_id } = req.params;
    
    try {
        await pool.query('DELETE FROM musicas_favoritas WHERE matricula = $1 AND musica_id = $2', [matricula, musica_id]);
        res.json({ sucesso: true });
    } catch (err) {
        res.status(500).json({ erro: err.message });
    }
});

// ========== ROTAS DO CHAT ==========

app.get('/api/chats', async (req, res) => {
    const { aluno } = req.query;
    let query = 'SELECT * FROM conversas ORDER BY urgente DESC, ultima_data DESC';
    let params = [];
    
    if (aluno) {
        query = 'SELECT * FROM conversas WHERE matricula_aluno = $1 ORDER BY ultima_data DESC';
        params = [aluno];
    }
    
    try {
        const result = await pool.query(query, params);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ erro: err.message });
    }
});

app.get('/api/chats/:conversa_id/mensagens', async (req, res) => {
    const { conversa_id } = req.params;
    
    try {
        const result = await pool.query('SELECT * FROM mensagens WHERE conversa_id = $1 ORDER BY data_hora ASC', [conversa_id]);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ erro: err.message });
    }
});

app.post('/api/chats', async (req, res) => {
    const { id, matricula_aluno, nome_aluno, anonimo } = req.body;
    const agora = new Date().toISOString();
    
    try {
        await pool.query(`INSERT INTO conversas (id, matricula_aluno, nome_aluno, anonimo, ultima_data, urgente, resolvido)
                         VALUES ($1, $2, $3, $4, $5, 1, 0)`,
            [id, matricula_aluno, nome_aluno, anonimo ? 1 : 0, agora]);
        res.json({ sucesso: true });
    } catch (err) {
        res.status(500).json({ erro: err.message });
    }
});

app.post('/api/chats/:conversa_id/mensagens', async (req, res) => {
    const { conversa_id } = req.params;
    const { remetente, texto } = req.body;
    const agora = new Date().toISOString();
    
    try {
        await pool.query(`INSERT INTO mensagens (conversa_id, remetente, texto, data_hora)
                         VALUES ($1, $2, $3, $4)`,
            [conversa_id, remetente, texto, agora]);
        
        await pool.query(`UPDATE conversas SET ultima_mensagem = $1, ultima_data = $2 WHERE id = $3`,
            [texto, agora, conversa_id]);
        
        res.json({ sucesso: true });
    } catch (err) {
        res.status(500).json({ erro: err.message });
    }
});

app.put('/api/chats/:conversa_id/:acao', async (req, res) => {
    const { conversa_id, acao } = req.params;
    
    try {
        if (acao === 'urgente') {
            await pool.query(`UPDATE conversas SET urgente = CASE WHEN urgente = 1 THEN 0 ELSE 1 END WHERE id = $1`, [conversa_id]);
        } else if (acao === 'resolver') {
            await pool.query(`UPDATE conversas SET resolvido = 1, urgente = 0 WHERE id = $1`, [conversa_id]);
        } else if (acao === 'reabrir') {
            await pool.query(`UPDATE conversas SET resolvido = 0 WHERE id = $1`, [conversa_id]);
        } else {
            return res.status(400).json({ erro: 'Ação inválida' });
        }
        res.json({ sucesso: true });
    } catch (err) {
        res.status(500).json({ erro: err.message });
    }
});

app.delete('/api/chats', async (req, res) => {
    try {
        await pool.query('DELETE FROM mensagens');
        await pool.query('DELETE FROM conversas');
        res.json({ sucesso: true });
    } catch (err) {
        res.status(500).json({ erro: err.message });
    }
});

// ========== ROTAS DA ESCOLA ==========

function getTurmaFromMatricula(matricula) {
    if (!matricula || matricula.length < 5) return "Turma não definida";
    const anoIngresso = parseInt(matricula.substring(0, 4));
    const codigoTurma = matricula.charAt(4);
    const anoAtual = new Date().getFullYear();
    let ano = anoAtual - anoIngresso + 1;
    if (ano < 1) ano = 1;
    if (ano > 3) ano = 3;
    const cursos = { '1': 'Informática', '2': 'Administração', '3': 'Meio Ambiente' };
    const curso = cursos[codigoTurma] || 'Desconhecido';
    return `${ano}° ${curso}`;
}

app.get('/api/escola/alunos', async (req, res) => {
    try {
        const result = await pool.query('SELECT matricula, nome, email, nivel, xp, moedas FROM usuarios');
        const alunos = result.rows.map(aluno => ({
            ...aluno,
            turma: getTurmaFromMatricula(aluno.matricula)
        }));
        res.json(alunos);
    } catch (err) {
        res.status(500).json({ erro: err.message });
    }
});

app.get('/api/escola/turmas', async (req, res) => {
    try {
        const result = await pool.query('SELECT matricula, nome, email, nivel, xp, moedas FROM usuarios');
        const turmas = {};
        
        result.rows.forEach(aluno => {
            const turma = getTurmaFromMatricula(aluno.matricula);
            if (!turmas[turma]) {
                turmas[turma] = {
                    nome: turma,
                    alunos: [],
                    totalAlunos: 0,
                    totalMoedas: 0,
                    totalXP: 0,
                    nivelMedio: 0
                };
            }
            turmas[turma].alunos.push(aluno);
            turmas[turma].totalAlunos++;
            turmas[turma].totalMoedas += aluno.moedas || 0;
            turmas[turma].totalXP += aluno.xp || 0;
        });
        
        Object.values(turmas).forEach(turma => {
            turma.nivelMedio = turma.totalAlunos > 0 ? 
                Math.round(turma.alunos.reduce((sum, a) => sum + (a.nivel || 1), 0) / turma.totalAlunos) : 0;
        });
        
        res.json(Object.values(turmas));
    } catch (err) {
        res.status(500).json({ erro: err.message });
    }
});

app.get('/api/escola/estatisticas', async (req, res) => {
    try {
        const result = await pool.query('SELECT matricula, nivel, xp, moedas FROM usuarios');
        const rows = result.rows;
        
        const totalAlunos = rows.length;
        const totalMoedas = rows.reduce((sum, a) => sum + (a.moedas || 0), 0);
        const totalXP = rows.reduce((sum, a) => sum + (a.xp || 0), 0);
        const nivelMedio = totalAlunos > 0 ? 
            Math.round(rows.reduce((sum, a) => sum + (a.nivel || 1), 0) / totalAlunos) : 0;
        
        const niveis = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
        rows.forEach(a => {
            const nivel = a.nivel || 1;
            if (nivel <= 5) niveis[nivel]++;
            else niveis[5]++;
        });
        
        res.json({
            totalAlunos,
            totalMoedas,
            totalXP,
            nivelMedio,
            niveis
        });
    } catch (err) {
        res.status(500).json({ erro: err.message });
    }
});

// ========== ROTAS DE RELATÓRIOS ==========

app.get('/api/relatorio/emocoes', async (req, res) => {
    const { curso, ano, periodo } = req.query;
    const dias = periodo === 'semana' ? 7 : periodo === 'mes' ? 30 : periodo === 'trimestre' ? 90 : 365;
    
    let sql = `
        SELECT e.emocao, COUNT(*) as total 
        FROM emocoes e
        JOIN usuarios u ON e.matricula = u.matricula
        WHERE e.data >= CURRENT_DATE - INTERVAL '${dias} days'
    `;
    let params = [];
    let idx = 1;
    
    if (curso && curso !== 'todos' && curso !== 'all') {
        const cursoMap = { 'inf': 'INF', 'adm': 'ADM', 'ma': 'AMB' };
        const cursoCode = cursoMap[curso] || curso.toUpperCase();
        sql += ` AND u.matricula LIKE $${idx}`;
        params.push(`%${cursoCode}%`);
        idx++;
    }
    if (ano && ano !== 'todos' && ano !== 'all') {
        sql += ` AND SUBSTRING(u.matricula, 5, 1) = $${idx}`;
        params.push(ano);
        idx++;
    }
    
    sql += ` GROUP BY e.emocao`;
    
    try {
        const result = await pool.query(sql, params);
        
        const emocoes = { 
            alegria: 0, animado: 0, relaxado: 0, 
            tristeza: 0, ansioso: 0, raiva: 0 
        };
        
        result.rows.forEach(row => {
            const emocao = row.emocao;
            if (emocao === 'Alegria') emocoes.alegria = parseInt(row.total);
            else if (emocao === 'Animado') emocoes.animado = parseInt(row.total);
            else if (emocao === 'Relaxado') emocoes.relaxado = parseInt(row.total);
            else if (emocao === 'Tristeza') emocoes.tristeza = parseInt(row.total);
            else if (emocao === 'Ansioso') emocoes.ansioso = parseInt(row.total);
            else if (emocao === 'Raiva') emocoes.raiva = parseInt(row.total);
        });
        
        const total = Object.values(emocoes).reduce((a,b) => a + b, 0);
        if (total > 0) {
            Object.keys(emocoes).forEach(k => {
                emocoes[k] = Math.round((emocoes[k] / total) * 100);
            });
        } else {
            emocoes.alegria = 35;
            emocoes.animado = 20;
            emocoes.relaxado = 25;
            emocoes.tristeza = 10;
            emocoes.ansioso = 8;
            emocoes.raiva = 2;
        }
        
        res.json(emocoes);
    } catch (err) {
        console.error('Erro:', err);
        res.status(500).json({ erro: err.message });
    }
});

app.get('/api/relatorio/cursos', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT 
                CASE 
                    WHEN matricula LIKE '%INF%' THEN 'Informática'
                    WHEN matricula LIKE '%ADM%' THEN 'Administração'
                    WHEN matricula LIKE '%AMB%' THEN 'Meio Ambiente'
                    ELSE 'Outro'
                END as curso,
                COUNT(DISTINCT matricula) as alunos,
                ROUND(AVG(nivel), 1) as nivel_medio,
                SUM(CASE WHEN nivel < 5 THEN 1 ELSE 0 END) as alertas
            FROM usuarios
            GROUP BY curso
        `);
        
        const resultado = result.rows
            .filter(row => row.curso !== 'Outro')
            .map(row => ({
                curso: row.curso,
                cursoCod: row.curso === 'Informática' ? 'inf' : row.curso === 'Administração' ? 'adm' : 'meio',
                turmas: 3,
                alunos: parseInt(row.alunos),
                score: parseFloat(row.nivel_medio).toFixed(1),
                alertas: parseInt(row.alertas)
            }));
        
        res.json(resultado);
    } catch (err) {
        console.error('Erro:', err);
        res.status(500).json({ erro: err.message });
    }
});

app.get('/api/relatorio/recomendacoes', async (req, res) => {
    try {
        const result = await pool.query('SELECT matricula, nivel FROM usuarios');
        const usuarios = result.rows;
        
        const recs = [];
        let somaNiveis = 0;
        usuarios.forEach(u => somaNiveis += (u.nivel || 1));
        const mediaGeral = usuarios.length > 0 ? somaNiveis / usuarios.length : 0;
        const alunosCriticos = usuarios.filter(u => (u.nivel || 1) <= 2);
        
        if (alunosCriticos.length > 0) {
            recs.push({
                icon: 'alert-circle',
                title: 'Alunos com baixo engajamento',
                desc: `${alunosCriticos.length} aluno(s) com nível crítico (≤ 2). Recomenda-se acompanhamento individualizado.`,
                tag: 'Urgente',
                tagColor: '#ef4444'
            });
        }
        
        if (mediaGeral < 4) {
            recs.push({
                icon: 'trending-down',
                title: 'Nível geral abaixo do esperado',
                desc: `Média geral de ${mediaGeral.toFixed(1)}. Incentive a participação nos jogos e atividades diárias.`,
                tag: 'Atenção',
                tagColor: '#f97316'
            });
        } else if (mediaGeral > 7) {
            recs.push({
                icon: 'award',
                title: 'Ótimo desempenho geral',
                desc: `Média de ${mediaGeral.toFixed(1)}! Continue incentivando as boas práticas.`,
                tag: 'Destaque',
                tagColor: '#10b981'
            });
        }
        
        if (recs.length === 0) {
            recs.push({
                icon: 'check-circle',
                title: 'Tudo em ordem',
                desc: 'Todos os alunos estão com níveis adequados. Continue incentivando o bem-estar!',
                tag: 'OK',
                tagColor: '#32B5F1'
            });
        }
        
        recs.push({
            icon: 'heart',
            title: 'Atividade sugerida',
            desc: 'Que tal uma roda de conversa sobre bem-estar emocional esta semana?',
            tag: 'Sugestão',
            tagColor: '#8b5cf6'
        });
        
        res.json(recs);
    } catch (err) {
        res.status(500).json({ erro: err.message });
    }
});

app.get('/api/relatorio/historico', async (req, res) => {
    const { curso, ano } = req.query;
    
    let sql = `
        SELECT TO_CHAR(e.data, 'YYYY-MM') as mes,
               AVG(u.nivel) as nivel_medio,
               COUNT(e.id) as total_emocoes
        FROM emocoes e
        JOIN usuarios u ON e.matricula = u.matricula
        WHERE e.data >= CURRENT_DATE - INTERVAL '5 months'
    `;
    let params = [];
    let idx = 1;
    
    if (curso && curso !== 'todos') {
        const cursoMap = { 'inf': 'INF', 'adm': 'ADM', 'ma': 'AMB' };
        const cursoCode = cursoMap[curso] || curso.toUpperCase();
        sql += ` AND u.matricula LIKE $${idx}`;
        params.push(`%${cursoCode}%`);
        idx++;
    }
    if (ano && ano !== 'todos') {
        sql += ` AND SUBSTRING(u.matricula, 5, 1) = $${idx}`;
        params.push(ano);
        idx++;
    }
    
    sql += ` GROUP BY TO_CHAR(e.data, 'YYYY-MM') ORDER BY mes DESC LIMIT 5`;
    
    try {
        const result = await pool.query(sql, params);
        
        const meses = { 1: 'Jan', 2: 'Fev', 3: 'Mar', 4: 'Abr', 5: 'Mai', 6: 'Jun', 
                        7: 'Jul', 8: 'Ago', 9: 'Set', 10: 'Out', 11: 'Nov', 12: 'Dez' };
        
        const historico = result.rows.map(row => {
            const mesNum = parseInt(row.mes.split('-')[1]);
            return {
                mes: meses[mesNum] || row.mes,
                val: parseFloat(row.nivel_medio).toFixed(1),
                badge: row.nivel_medio > 7 ? 'up' : row.nivel_medio < 6 ? 'down' : 'same'
            };
        });
        
        res.json(historico);
    } catch (err) {
        res.status(500).json({ erro: err.message });
    }
});

// ========== ROTAS DE ALERTAS ==========

app.get('/api/alertas', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM alertas ORDER BY data_criacao DESC');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ erro: err.message });
    }
});

app.post('/api/alertas', async (req, res) => {
    const { id, titulo, desc, turma, aluno, severidade, tipo, emoji, detalhes } = req.body;
    const agora = new Date().toISOString();
    
    try {
        await pool.query(`INSERT INTO alertas (id, titulo, descricao, turma, aluno, severidade, tipo, emoji, detalhes, resolvido, data_criacao)
                         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 0, $10)`,
            [id, titulo || '', desc || '', turma || '', aluno || '', severidade || 'medio', tipo || '', emoji || 'alert-circle', JSON.stringify(detalhes || {}), agora]);
        res.json({ sucesso: true });
    } catch (err) {
        res.status(500).json({ erro: err.message });
    }
});

app.put('/api/alertas/:id/resolver', async (req, res) => {
    const { id } = req.params;
    
    try {
        await pool.query('UPDATE alertas SET resolvido = 1, data_resolucao = $1 WHERE id = $2', [new Date().toISOString(), id]);
        res.json({ sucesso: true });
    } catch (err) {
        res.status(500).json({ erro: err.message });
    }
});

app.delete('/api/alertas/:id', async (req, res) => {
    const { id } = req.params;
    
    try {
        await pool.query('DELETE FROM alertas WHERE id = $1', [id]);
        res.json({ sucesso: true });
    } catch (err) {
        res.status(500).json({ erro: err.message });
    }
});

// ========== ROTAS DE INTERVENÇÕES ==========

app.get('/api/intervencoes', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM intervencoes ORDER BY data_criacao DESC');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ erro: err.message });
    }
});

app.post('/api/intervencoes', async (req, res) => {
    const { id, titulo, desc, turma, aluno, prioridade, tipo, responsavel, data, progresso, status, curso } = req.body;
    const agora = new Date().toISOString();
    
    try {
        await pool.query(`INSERT INTO intervencoes (id, titulo, descricao, turma, aluno, prioridade, tipo, responsavel, data_prevista, progresso, status, curso, data_criacao)
                         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
            [id, titulo, desc, turma, aluno, prioridade, tipo, responsavel, data, progresso || 0, status || 'pendente', curso || '', agora]);
        res.json({ sucesso: true });
    } catch (err) {
        res.status(500).json({ erro: err.message });
    }
});

app.put('/api/intervencoes/:id', async (req, res) => {
    const { id } = req.params;
    const { status, progresso } = req.body;
    
    try {
        await pool.query('UPDATE intervencoes SET status = $1, progresso = $2, data_atualizacao = $3 WHERE id = $4',
            [status, progresso, new Date().toISOString(), id]);
        res.json({ sucesso: true });
    } catch (err) {
        res.status(500).json({ erro: err.message });
    }
});

app.delete('/api/intervencoes/:id', async (req, res) => {
    const { id } = req.params;
    
    try {
        await pool.query('DELETE FROM intervencoes WHERE id = $1', [id]);
        res.json({ sucesso: true });
    } catch (err) {
        res.status(500).json({ erro: err.message });
    }
});

// ========== ROTA PARA CRIAR USUÁRIOS (ADMIN) ==========
app.post('/api/criar-usuario', async (req, res) => {
    const { matricula, nome, email, senha, tipo } = req.body;
    
    try {
        const result = await pool.query('SELECT * FROM usuarios WHERE matricula = $1', [matricula]);
        
        if (result.rows.length > 0) {
            return res.status(400).json({ 
                sucesso: false, 
                mensagem: 'Usuário já existe!' 
            });
        }
        
        await pool.query(
            `INSERT INTO usuarios (matricula, nome, email, senha, tipo, nivel, xp, moedas, skin_atual, fundo_atual)
             VALUES ($1, $2, $3, $4, $5, 1, 0, 0, 'pandas/skin.png', 'fundos/fundo-a.png')`,
            [matricula, nome, email, senha || '123456', tipo || 'estudante']
        );
        
        res.json({ 
            sucesso: true, 
            mensagem: 'Usuário criado com sucesso!' 
        });
    } catch (error) {
        console.error('Erro:', error);
        res.status(500).json({ sucesso: false, mensagem: 'Erro ao criar usuário' });
    }
});

// ========== ROTA PARA BUSCAR DADOS DO ALUNO ==========
app.get('/api/aluno/:matricula', async (req, res) => {
    const { matricula } = req.params;
    
    try {
        const result = await pool.query('SELECT matricula, nome, email, tipo FROM usuarios WHERE matricula = $1', [matricula]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ erro: 'Aluno não encontrado' });
        }
        
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ erro: err.message });
    }
});

// ROTA PARA VER TODOS OS USUÁRIOS (no navegador)
app.get('/api/admin/usuarios', async (req, res) => {
    try {
        const result = await pool.query('SELECT matricula, nome, email, nivel, xp, moedas FROM usuarios ORDER BY matricula');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ erro: err.message });
    }
});

// ROTA PARA ADICIONAR/EDITAR USUÁRIO
app.get('/api/admin/salvar-usuario', async (req, res) => {
    const { matricula, nome, email, senha } = req.query;
    
    if (!matricula || !nome) {
        return res.json({ erro: 'Faltou matricula ou nome. Exemplo: /api/admin/salvar-usuario?matricula=123&nome=João' });
    }
    
    try {
        await pool.query(
            `INSERT INTO usuarios (matricula, nome, email, senha, tipo, nivel, xp, moedas, skin_atual, fundo_atual) 
             VALUES ($1, $2, $3, $4, 'estudante', 1, 0, 0, 'pandas/skin.png', 'fundos/fundo-a.png')
             ON CONFLICT (matricula) DO UPDATE SET nome = EXCLUDED.nome, email = EXCLUDED.email`,
            [matricula, nome, email || `${matricula}@escola.com`, senha || '123456']
        );
        
        res.json({ sucesso: true, mensagem: `Usuário ${nome} (${matricula}) salvo!` });
    } catch (err) {
        res.status(500).json({ erro: err.message });
    }
});

// ROTA PARA DELETAR USUÁRIO
app.get('/api/admin/deletar-usuario', async (req, res) => {
    const { matricula } = req.query;
    
    if (!matricula) {
        return res.json({ erro: 'Faltou matricula. Exemplo: /api/admin/deletar-usuario?matricula=123' });
    }
    
    try {
        await pool.query('DELETE FROM usuarios WHERE matricula = $1', [matricula]);
        res.json({ sucesso: true, mensagem: `Usuário ${matricula} deletado!` });
    } catch (err) {
        res.status(500).json({ erro: err.message });
    }
});

// ========== ROTAS PARA ADMIN (CRIAR USUÁRIOS PELO NAVEGADOR) ==========

app.get('/api/criar-usuario-manual', async (req, res) => {
    const { matricula, nome, email, senha } = req.query;
    
    if (!matricula || !nome) {
        return res.json({ erro: 'Faltou matricula ou nome. Exemplo: /api/criar-usuario-manual?matricula=123&nome=João' });
    }
    
    try {
        // Verificar se usuário já existe
        const existe = await pool.query('SELECT * FROM usuarios WHERE matricula = $1', [matricula]);
        
        if (existe.rows.length > 0) {
            // Atualizar se já existe
            await pool.query(
                `UPDATE usuarios SET nome = $1, email = $2 WHERE matricula = $3`,
                [nome, email || `${matricula}@email.com`, matricula]
            );
            res.json({ sucesso: true, mensagem: `Usuário ${nome} ATUALIZADO!` });
        } else {
            // Criar novo
            await pool.query(
                `INSERT INTO usuarios (matricula, nome, email, senha, tipo, nivel, xp, moedas, skin_atual, fundo_atual) 
                 VALUES ($1, $2, $3, $4, 'estudante', 1, 0, 0, 'pandas/skin.png', 'fundos/fundo-a.png')`,
                [matricula, nome, email || `${matricula}@email.com`, senha || '123']
            );
            res.json({ sucesso: true, mensagem: `Usuário ${nome} CRIADO com sucesso!` });
        }
    } catch (err) {
        console.error('Erro:', err);
        res.status(500).json({ erro: err.message });
    }
});

// Rota para ver todos os usuários
app.get('/api/admin/usuarios', async (req, res) => {
    try {
        const result = await pool.query('SELECT matricula, nome, email, nivel, xp, moedas FROM usuarios ORDER BY matricula');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ erro: err.message });
    }
});

app.get('/api/criar-aluno', async (req, res) => {
    const { matricula, nome, senha } = req.query;
    
    try {
        // 1. Primeiro, adiciona a coluna senha se não existir
        await pool.query(`ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS senha TEXT DEFAULT '123456'`);
        
        // 2. Depois, insere o aluno
        await pool.query(
            `INSERT INTO usuarios (matricula, nome, senha, email, tipo, nivel, xp, moedas) 
             VALUES ($1, $2, $3, $4, 'estudante', 1, 0, 0)
             ON CONFLICT (matricula) DO UPDATE SET nome = $2, senha = $3`,
            [matricula, nome, senha || '123456', `${matricula}@email.com`]
        );
        
        res.send(`✅ Aluno ${nome} criado/atualizado com sucesso!`);
    } catch (err) {
        res.send(`❌ Erro: ${err.message}`);
    }
});

// ========== INICIAR SERVIDOR ==========
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
});