const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5001;

// CORS - TEM QUE VIR PRIMEIRO
app.use(cors({
    origin: '*',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept']
}));

app.use(express.json({ limit: '50mb' }));

// Servir os arquivos estáticos
app.use(express.static(path.join(__dirname, 'escola-parte')));

// Conectar ao banco de dados
const db = new sqlite3.Database(path.join(__dirname, 'mindfine.db'));

// ========== ROTA DE LOGIN ==========
app.post('/api/login', (req, res) => {
    const { tipo_usuario, identificador, senha } = req.body;
    
    console.log(`Login tentativa: ${identificador} - ${tipo_usuario}`);
    
    res.json({
        sucesso: true,
        nome: "Usuário Teste",
        email: identificador,
        matricula: identificador
    });
});

// Rota de teste para verificar CORS
app.get('/api/teste', (req, res) => {
    res.json({ mensagem: 'CORS funcionando!', status: 'ok' });
});

// ========== ROTAS DO PROGRESSO ==========
app.get('/api/progresso/:matricula', (req, res) => {
    const { matricula } = req.params;
    
    db.get('SELECT * FROM usuarios WHERE matricula = ?', [matricula], (err, usuario) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ erro: err.message });
        }
        
        if (!usuario) {
            db.run(`INSERT INTO usuarios (matricula, nome, email, nivel, xp, moedas, skin_atual, fundo_atual) 
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [matricula, "Usuário", `${matricula}@mindfine.com`, 1, 0, 0, "pandas/skin.png", "fundos/fundo-a.png"],
                function(err) {
                    if (err) {
                        console.error(err);
                        return res.status(500).json({ erro: err.message });
                    }
                    
                    db.get('SELECT * FROM usuarios WHERE matricula = ?', [matricula], (err, novoUsuario) => {
                        if (err) return res.status(500).json({ erro: err.message });
                        
                        const universosPadrao = ["Santuário", "Ilha do Pirata", "Ilha do Bruxo"];
                        universosPadrao.forEach(universo => {
                            db.run('INSERT INTO universos_desbloqueados (matricula, universo) VALUES (?, ?)',
                                [matricula, universo]);
                        });
                        
                        return res.json({
                            moedas: novoUsuario.moedas,
                            xp: novoUsuario.xp,
                            nivel: novoUsuario.nivel,
                            skin_atual: novoUsuario.skin_atual,
                            universos_desbloqueados: universosPadrao,
                            figurinhas_desbloqueadas: [],
                            recordes_jogos: {},
                            galeria_arte: []
                        });
                    });
                }
            );
            return;
        }
        
        db.all('SELECT universo FROM universos_desbloqueados WHERE matricula = ?', [matricula], (err, universos) => {
            if (err) return res.status(500).json({ erro: err.message });
            
            const listaUniversos = universos.map(u => u.universo);
            if (listaUniversos.length === 0) {
                listaUniversos.push("Santuário", "Ilha do Pirata", "Ilha do Bruxo");
            }
            
            res.json({
                moedas: usuario.moedas,
                xp: usuario.xp,
                nivel: usuario.nivel,
                skin_atual: usuario.skin_atual,
                fundo_atual: usuario.fundo_atual || 'fundos/fundo-a.png',
                universos_desbloqueados: listaUniversos,
                figurinhas_desbloqueadas: [],
                recordes_jogos: {},
                galeria_arte: []
            });
        });
    });
});

app.post('/api/progresso/:matricula', (req, res) => {
    const { matricula } = req.params;
    const updates = req.body;
    
    const campos = [];
    const valores = [];
    
    if (updates.moedas !== undefined) { campos.push('moedas = ?'); valores.push(updates.moedas); }
    if (updates.xp !== undefined) { campos.push('xp = ?'); valores.push(updates.xp); }
    if (updates.nivel !== undefined) { campos.push('nivel = ?'); valores.push(updates.nivel); }
    if (updates.skin_atual !== undefined) { campos.push('skin_atual = ?'); valores.push(updates.skin_atual); }
    if (updates.fundo_atual !== undefined) { campos.push('fundo_atual = ?'); valores.push(updates.fundo_atual); }
    
    if (campos.length > 0) {
        valores.push(matricula);
        const sql = `UPDATE usuarios SET ${campos.join(', ')} WHERE matricula = ?`;
        db.run(sql, valores, (err) => {
            if (err) {
                console.error(err);
                return res.status(500).json({ erro: err.message });
            }
            res.json({ sucesso: true });
        });
    } else {
        res.json({ sucesso: true });
    }
});

// ========== ROTA DE EMOCÕES ==========
app.post('/api/emocao/:matricula', (req, res) => {
    const { matricula } = req.params;
    const { emocao, emoji } = req.body;
    const hoje = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }).split('/').reverse().join('-');
    
    db.get('SELECT * FROM emocoes WHERE matricula = ? AND data = ?', [matricula, hoje], (err, existente) => {
        if (err) return res.status(500).json({ erro: err.message });
        
        if (existente) {
            return res.status(400).json({ erro: "Você já registrou sua emoção hoje!" });
        }
        
        db.run('INSERT INTO emocoes (matricula, data, emocao, emoji) VALUES (?, ?, ?, ?)',
            [matricula, hoje, emocao, emoji],
            (err) => {
                if (err) return res.status(500).json({ erro: err.message });
                
                db.run('UPDATE usuarios SET moedas = moedas + 25, xp = xp + 25 WHERE matricula = ?', [matricula]);
                db.run('UPDATE usuarios SET nivel = nivel + 1, xp = 0 WHERE matricula = ? AND xp >= 100', [matricula]);
                
                db.get('SELECT moedas FROM usuarios WHERE matricula = ?', [matricula], (err, result) => {
                    res.json({ sucesso: true, moedas_ganhas: 25, xp_ganhas: 25, total_moedas: result?.moedas });
                });
            }
        );
    });
});

app.get('/api/check-emocao/:matricula', (req, res) => {
    const { matricula } = req.params;
    const hoje = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }).split('/').reverse().join('-');
    
    db.get('SELECT * FROM emocoes WHERE matricula = ? AND data = ?', [matricula, hoje], (err, result) => {
        if (err) return res.status(500).json({ erro: err.message });
        res.json({ ja_registrou: !!result });
    });
});

app.get('/api/emocoes/:matricula', (req, res) => {
    const { matricula } = req.params;
    
    db.all('SELECT data, emocao, emoji FROM emocoes WHERE matricula = ? ORDER BY data DESC', [matricula], (err, rows) => {
        if (err) return res.status(500).json({ erro: err.message });
        
        const historico = {};
        rows.forEach(row => {
            historico[row.data] = { feeling: row.emocao, type: "positive" };
        });
        res.json(historico);
    });
});

// ========== ROTAS DA ESCOLA ==========
app.get('/api/escola/alunos', (req, res) => {
    db.all('SELECT matricula, nome, email, nivel, xp, moedas FROM usuarios', [], (err, rows) => {
        if (err) return res.status(500).json({ erro: err.message });
        
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
        
        const alunos = rows.map(aluno => ({
            ...aluno,
            turma: getTurmaFromMatricula(aluno.matricula)
        }));
        
        res.json(alunos);
    });
});

app.get('/api/escola/turmas', (req, res) => {
    db.all('SELECT matricula, nome, email, nivel, xp, moedas FROM usuarios', [], (err, rows) => {
        if (err) return res.status(500).json({ erro: err.message });
        
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
        
        const turmas = {};
        rows.forEach(aluno => {
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
    });
});

app.get('/api/escola/estatisticas', (req, res) => {
    db.all('SELECT matricula, nivel, xp, moedas FROM usuarios', [], (err, rows) => {
        if (err) return res.status(500).json({ erro: err.message });
        
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
    });
});

// ========== ROTAS DE RELATÓRIOS ==========
app.get('/api/relatorio/emocoes', (req, res) => {
    const { curso, ano, periodo } = req.query;
    const dias = periodo === 'semana' ? 7 : periodo === 'mes' ? 30 : periodo === 'trimestre' ? 90 : 365;
    
    let cursoFiltro = '';
    if (curso === 'inf') cursoFiltro = 'INF';
    else if (curso === 'adm') cursoFiltro = 'ADM';
    else if (curso === 'ma') cursoFiltro = 'AMB';
    
    let sql = `
        SELECT e.emocao, COUNT(*) as total 
        FROM emocoes e
        JOIN usuarios u ON e.matricula = u.matricula
        WHERE e.data >= date('now', '-' || ? || ' days')
    `;
    let params = [dias];
    
    if (cursoFiltro) {
        sql += ` AND u.matricula LIKE '%${cursoFiltro}%'`;
    }
    if (ano && ano !== 'todos' && ano !== 'all') {
        sql += ` AND substr(u.matricula, 5, 1) = ?`;
        params.push(ano);
    }
    
    sql += ` GROUP BY e.emocao`;
    
    db.all(sql, params, (err, rows) => {
        if (err) {
            console.error('Erro em /api/relatorio/emocoes:', err);
            return res.status(500).json({ erro: err.message });
        }
        
        const emocoes = { alegria: 0, animado: 0, relaxado: 0, tristeza: 0, ansioso: 0, raiva: 0 };
        rows.forEach(row => {
            const emocao = row.emocao;
            if (emocao === 'Alegria') emocoes.alegria = row.total;
            else if (emocao === 'Animado') emocoes.animado = row.total;
            else if (emocao === 'Relaxado') emocoes.relaxado = row.total;
            else if (emocao === 'Tristeza') emocoes.tristeza = row.total;
            else if (emocao === 'Ansioso') emocoes.ansioso = row.total;
            else if (emocao === 'Raiva') emocoes.raiva = row.total;
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
    });
});

app.get('/api/relatorio/cursos', (req, res) => {
    db.all(`
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
    `, [], (err, rows) => {
        if (err) {
            console.error('Erro em /api/relatorio/cursos:', err);
            return res.status(500).json({ erro: err.message });
        }
        
        const resultado = (rows || [])
            .filter(row => row.curso !== 'Outro')
            .map(row => ({
                curso: row.curso,
                cursoCod: row.curso === 'Informática' ? 'inf' : row.curso === 'Administração' ? 'adm' : 'meio',
                turmas: 3,
                alunos: row.alunos,
                score: parseFloat(row.nivel_medio).toFixed(1),
                alertas: row.alertas || 0
            }));
        
        res.json(resultado);
    });
});

app.get('/api/relatorio/recomendacoes', (req, res) => {
    db.all('SELECT matricula, nivel FROM usuarios', [], (err, usuarios) => {
        if (err) {
            console.error('Erro em /api/relatorio/recomendacoes:', err);
            return res.status(500).json({ erro: err.message });
        }
        
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
    });
});

app.get('/api/relatorio/historico', (req, res) => {
    const { curso, ano } = req.query;
    
    let sql = `
        SELECT strftime('%Y-%m', e.data) as mes,
               AVG(u.nivel) as nivel_medio,
               COUNT(e.id) as total_emocoes
        FROM emocoes e
        JOIN usuarios u ON e.matricula = u.matricula
        WHERE e.data >= date('now', '-5 months')
    `;
    let params = [];
    
    if (curso && curso !== 'todos') {
        sql += ` AND u.matricula LIKE '%${curso === 'inf' ? 'INF' : curso === 'adm' ? 'ADM' : 'AMB'}%'`;
    }
    if (ano && ano !== 'todos') {
        sql += ` AND substr(u.matricula, 5, 1) = ?`;
        params.push(ano);
    }
    
    sql += ` GROUP BY strftime('%Y-%m', e.data) ORDER BY mes DESC LIMIT 5`;
    
    db.all(sql, params, (err, rows) => {
        if (err) return res.status(500).json({ erro: err.message });
        
        const meses = { 1: 'Jan', 2: 'Fev', 3: 'Mar', 4: 'Abr', 5: 'Mai', 6: 'Jun', 7: 'Jul', 8: 'Ago', 9: 'Set', 10: 'Out', 11: 'Nov', 12: 'Dez' };
        
        const historico = rows.map(row => {
            const mesNum = parseInt(row.mes.split('-')[1]);
            return {
                mes: meses[mesNum] || row.mes,
                val: parseFloat(row.nivel_medio).toFixed(1),
                badge: row.nivel_medio > 7 ? 'up' : row.nivel_medio < 6 ? 'down' : 'same'
            };
        });
        
        res.json(historico);
    });
});

// ========== ROTAS DE FIGURINHAS (adicione estas) ==========

// GET - Carregar páginas desbloqueadas
app.get('/api/figurinhas/paginas-desbloqueadas/:matricula', (req, res) => {
    const { matricula } = req.params;
    
    db.get('SELECT valor FROM usuario_config WHERE matricula = ? AND chave = ?',
        [matricula, 'paginas_album'],
        (err, row) => {
            if (err) return res.status(500).json({ erro: err.message });
            const paginas = row ? JSON.parse(row.valor) : 1;
            res.json({ paginas_desbloqueadas: paginas });
        }
    );
});

// GET - Carregar figurinhas desbloqueadas do usuário
app.get('/api/figurinhas/:matricula', (req, res) => {
    const { matricula } = req.params;
    
    db.all('SELECT pagina, slot, figurinha_id FROM figurinhas_desbloqueadas WHERE matricula = ?', 
        [matricula], 
        (err, rows) => {
            if (err) return res.status(500).json({ erro: err.message });
            
            const figurinhas = {};
            rows.forEach(row => {
                if (!figurinhas[row.pagina]) {
                    figurinhas[row.pagina] = {};
                }
                figurinhas[row.pagina][row.slot] = row.figurinha_id;
            });
            
            res.json(figurinhas);
        }
    );
});

// ========== ROTAS DE FIGURINHAS (COMPLETAS) ==========

// GET - Carregar figurinhas desbloqueadas do usuário
app.get('/api/figurinhas/:matricula', (req, res) => {
    const { matricula } = req.params;
    
    db.all('SELECT pagina, slot, figurinha_id FROM figurinhas_desbloqueadas WHERE matricula = ?', 
        [matricula], 
        (err, rows) => {
            if (err) return res.status(500).json({ erro: err.message });
            
            const figurinhas = {};
            rows.forEach(row => {
                if (!figurinhas[row.pagina]) {
                    figurinhas[row.pagina] = {};
                }
                figurinhas[row.pagina][row.slot] = row.figurinha_id;
            });
            
            res.json(figurinhas);
        }
    );
});

// GET - Carregar páginas desbloqueadas
app.get('/api/figurinhas/paginas-desbloqueadas/:matricula', (req, res) => {
    const { matricula } = req.params;
    
    db.get('SELECT valor FROM usuario_config WHERE matricula = ? AND chave = ?',
        [matricula, 'paginas_album'],
        (err, row) => {
            if (err) return res.status(500).json({ erro: err.message });
            const paginas = row ? JSON.parse(row.valor) : 1;
            res.json({ paginas_desbloqueadas: paginas });
        }
    );
});

// POST - Desbloquear uma figurinha
app.post('/api/figurinhas/desbloquear', (req, res) => {
    const { matricula, pagina, slot, figurinha_id } = req.body;
    const hoje = new Date().toISOString().split('T')[0];
    
    db.get('SELECT * FROM figurinhas_desbloqueadas WHERE matricula = ? AND pagina = ? AND slot = ?',
        [matricula, pagina, slot],
        (err, existente) => {
            if (err) return res.status(500).json({ erro: err.message });
            
            if (existente) {
                return res.json({ sucesso: false, ja_desbloqueada: true });
            }
            
            db.run(`INSERT INTO figurinhas_desbloqueadas (matricula, pagina, slot, figurinha_id, data_desbloqueio)
                    VALUES (?, ?, ?, ?, ?)`,
                [matricula, pagina, slot, figurinha_id, hoje],
                (err) => {
                    if (err) return res.status(500).json({ erro: err.message });
                    res.json({ sucesso: true });
                }
            );
        }
    );
});

// POST - Atualizar páginas desbloqueadas do álbum
app.post('/api/figurinhas/paginas-desbloqueadas', (req, res) => {
    const { matricula, paginas } = req.body;
    
    db.run(`INSERT OR REPLACE INTO usuario_config (matricula, chave, valor)
            VALUES (?, ?, ?)`,
        [matricula, 'paginas_album', JSON.stringify(paginas)],
        (err) => {
            if (err) return res.status(500).json({ erro: err.message });
            res.json({ sucesso: true });
        }
    );
});

// ========== ROTAS DO DIÁRIO ==========

// GET - Carregar todas as entradas do diário do usuário
app.get('/api/diario/:matricula', (req, res) => {
    const { matricula } = req.params;
    
    db.all('SELECT * FROM diario_entradas WHERE matricula = ? ORDER BY data DESC', 
        [matricula], 
        (err, rows) => {
            if (err) return res.status(500).json({ erro: err.message });
            res.json(rows || []);
        }
    );
});

// POST - Criar nova entrada no diário
app.post('/api/diario/:matricula', (req, res) => {
    const { matricula } = req.params;
    const { titulo, conteudo, tipo, audio_base64 } = req.body;
    const hoje = new Date().toISOString().split('T')[0];
    const agora = new Date().toISOString();
    
    console.log(`📝 Salvando diário para ${matricula}`);
    console.log(`Título: ${titulo}, Tipo: ${tipo}`);
    
    const sql = `INSERT INTO diario_entradas (matricula, data, titulo, conteudo, tipo, audio_base64, data_hora)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`;
    
    db.run(sql, [matricula, hoje, titulo || "Sem título", conteudo || "", tipo || "text", audio_base64 || null, agora],
        function(err) {
            if (err) {
                console.error('❌ Erro ao criar entrada:', err);
                return res.status(500).json({ erro: err.message, sucesso: false });
            }
            console.log(`✅ Entrada salva com ID: ${this.lastID}`);
            res.json({ 
                sucesso: true, 
                id: this.lastID,
                mensagem: "Entrada salva com sucesso!"
            });
        }
    );
});

// DELETE - Remover uma entrada do diário
app.delete('/api/diario/:matricula/:id', (req, res) => {
    const { matricula, id } = req.params;
    
    db.run('DELETE FROM diario_entradas WHERE matricula = ? AND id = ?',
        [matricula, id],
        function(err) {
            if (err) return res.status(500).json({ erro: err.message });
            res.json({ sucesso: true, mensagem: "Entrada removida" });
        }
    );
});

// ========== ROTAS DO CHAT ==========

// GET - Carregar todas as conversas
app.get('/api/chats', (req, res) => {
    const { aluno } = req.query;
    let sql = 'SELECT * FROM conversas ORDER BY urgente DESC, ultima_data DESC';
    let params = [];
    
    if (aluno) {
        sql = 'SELECT * FROM conversas WHERE matricula_aluno = ? ORDER BY ultima_data DESC';
        params = [aluno];
    }
    
    db.all(sql, params, (err, rows) => {
        if (err) return res.status(500).json({ erro: err.message });
        res.json(rows || []);
    });
});

// GET - Carregar mensagens de uma conversa
app.get('/api/chats/:conversa_id/mensagens', (req, res) => {
    const { conversa_id } = req.params;
    
    db.all('SELECT * FROM mensagens WHERE conversa_id = ? ORDER BY data_hora ASC',
        [conversa_id],
        (err, rows) => {
            if (err) return res.status(500).json({ erro: err.message });
            res.json(rows || []);
        }
    );
});

// POST - Criar nova conversa
app.post('/api/chats', (req, res) => {
    const { id, matricula_aluno, nome_aluno, anonimo } = req.body;
    const agora = new Date().toISOString();
    
    db.run(`INSERT INTO conversas (id, matricula_aluno, nome_aluno, anonimo, ultima_data, urgente, resolvido)
            VALUES (?, ?, ?, ?, ?, 1, 0)`,
        [id, matricula_aluno, nome_aluno, anonimo ? 1 : 0, agora],
        (err) => {
            if (err) return res.status(500).json({ erro: err.message });
            res.json({ sucesso: true });
        }
    );
});

// POST - Enviar mensagem
app.post('/api/chats/:conversa_id/mensagens', (req, res) => {
    const { conversa_id } = req.params;
    const { remetente, texto } = req.body;
    const agora = new Date().toISOString();
    
    db.run(`INSERT INTO mensagens (conversa_id, remetente, texto, data_hora)
            VALUES (?, ?, ?, ?)`,
        [conversa_id, remetente, texto, agora],
        (err) => {
            if (err) return res.status(500).json({ erro: err.message });
            
            db.run(`UPDATE conversas SET ultima_mensagem = ?, ultima_data = ? WHERE id = ?`,
                [texto, agora, conversa_id],
                (err) => {
                    res.json({ sucesso: true });
                }
            );
        }
    );
});

// PUT - Marcar conversa como urgente ou resolvida
app.put('/api/chats/:conversa_id/:acao', (req, res) => {
    const { conversa_id, acao } = req.params;
    let campo = '';
    
    if (acao === 'urgente') campo = 'urgente = CASE WHEN urgente = 1 THEN 0 ELSE 1 END';
    if (acao === 'resolver') campo = 'resolvido = 1, urgente = 0';
    if (acao === 'reabrir') campo = 'resolvido = 0';
    
    if (!campo) return res.status(400).json({ erro: 'Ação inválida' });
    
    db.run(`UPDATE conversas SET ${campo} WHERE id = ?`,
        [conversa_id],
        (err) => {
            if (err) return res.status(500).json({ erro: err.message });
            res.json({ sucesso: true });
        }
    );
});

// DELETE - Limpar todas as conversas
app.delete('/api/chats', (req, res) => {
    db.run('DELETE FROM mensagens', (err) => {
        if (err) return res.status(500).json({ erro: err.message });
        db.run('DELETE FROM conversas', (err) => {
            if (err) return res.status(500).json({ erro: err.message });
            res.json({ sucesso: true });
        });
    });
});

// ========== ROTAS DA PLAYLIST ==========

// GET - Carregar músicas favoritas do usuário
app.get('/api/playlist/:matricula', (req, res) => {
    const { matricula } = req.params;
    
    db.all('SELECT musica_id FROM musicas_favoritas WHERE matricula = ?', 
        [matricula], 
        (err, rows) => {
            if (err) return res.status(500).json({ erro: err.message });
            const favoritos = rows.map(row => row.musica_id);
            res.json({ favoritos: favoritos });
        }
    );
});

// POST - Adicionar música aos favoritos
app.post('/api/playlist/:matricula', (req, res) => {
    const { matricula } = req.params;
    const { musica_id, titulo, artista } = req.body;
    const hoje = new Date().toISOString().split('T')[0];
    
    db.get('SELECT * FROM musicas_favoritas WHERE matricula = ? AND musica_id = ?',
        [matricula, musica_id],
        (err, existente) => {
            if (err) return res.status(500).json({ erro: err.message });
            
            if (existente) {
                return res.json({ sucesso: false, ja_existe: true });
            }
            
            db.run(`INSERT INTO musicas_favoritas (matricula, musica_id, titulo, artista, data_adicionado)
                    VALUES (?, ?, ?, ?, ?)`,
                [matricula, musica_id, titulo || '', artista || '', hoje],
                (err) => {
                    if (err) return res.status(500).json({ erro: err.message });
                    res.json({ sucesso: true });
                }
            );
        }
    );
});

// DELETE - Remover música dos favoritos
app.delete('/api/playlist/:matricula/:musica_id', (req, res) => {
    const { matricula, musica_id } = req.params;
    
    db.run('DELETE FROM musicas_favoritas WHERE matricula = ? AND musica_id = ?',
        [matricula, musica_id],
        function(err) {
            if (err) return res.status(500).json({ erro: err.message });
            res.json({ sucesso: true });
        }
    );
});
// ========== ROTAS DE RECORDES DOS JOGOS ==========

// GET - Carregar recorde de um jogo específico
app.get('/api/recorde/:matricula/:jogo', (req, res) => {
    const { matricula, jogo } = req.params;
    
    console.log(`📊 Buscando recorde: ${jogo} para ${matricula}`);
    
    db.get('SELECT pontuacao FROM recordes_jogos WHERE matricula = ? AND jogo_nome = ?',
        [matricula, jogo],
        (err, row) => {
            if (err) {
                console.error('Erro:', err);
                return res.status(500).json({ erro: err.message });
            }
            console.log(`🏆 Recorde encontrado: ${row ? row.pontuacao : 'nenhum'}`);
            res.json({ recorde: row ? row.pontuacao : 0 });
        }
    );
});

// POST - Salvar recorde de um jogo
app.post('/api/recorde/:matricula/:jogo', (req, res) => {
    const { matricula, jogo } = req.params;
    const { pontuacao } = req.body;
    const hoje = new Date().toISOString().split('T')[0];
    
    console.log(`📝 Salvando recorde: ${jogo} = ${pontuacao} para ${matricula}`);
    
    db.get('SELECT pontuacao FROM recordes_jogos WHERE matricula = ? AND jogo_nome = ?',
        [matricula, jogo],
        (err, row) => {
            if (err) {
                console.error('Erro:', err);
                return res.status(500).json({ erro: err.message });
            }
            
            // Para jogo da memória: menor pontuação é melhor
            const isMemoria = jogo.startsWith('jogo_memoria');
            const isMelhor = !row || (isMemoria ? pontuacao < row.pontuacao : pontuacao > row.pontuacao);
            
            if (isMelhor) {
                db.run(`INSERT OR REPLACE INTO recordes_jogos (matricula, jogo_nome, pontuacao, data_record)
                        VALUES (?, ?, ?, ?)`,
                    [matricula, jogo, pontuacao, hoje],
                    (err) => {
                        if (err) {
                            console.error('Erro:', err);
                            return res.status(500).json({ erro: err.message });
                        }
                        console.log(`🎉 Novo recorde salvo: ${pontuacao}`);
                        res.json({ sucesso: true, novo_recorde: true, recorde: pontuacao });
                    }
                );
            } else {
                console.log(`📌 Recorde mantido: ${row.pontuacao} (novo: ${pontuacao} não superou)`);
                res.json({ sucesso: true, novo_recorde: false, recorde: row.pontuacao });
            }
        }
    );
});


// ========== ROTAS DA GALERIA DE ARTE ==========

// GET - Carregar todos os desenhos do usuário
app.get('/api/galeria/:matricula', (req, res) => {
    const { matricula } = req.params;
    
    db.all('SELECT * FROM galeria_arte WHERE matricula = ? ORDER BY data DESC', 
        [matricula], 
        (err, rows) => {
            if (err) return res.status(500).json({ erro: err.message });
            res.json(rows || []);
        }
    );
});

// POST - Salvar um novo desenho
app.post('/api/galeria/:matricula', (req, res) => {
    const { matricula } = req.params;
    const { imagem_base64 } = req.body;
    const hoje = new Date().toLocaleDateString('pt-BR');
    
    db.run(`INSERT INTO galeria_arte (matricula, data, imagem_base64)
            VALUES (?, ?, ?)`,
        [matricula, hoje, imagem_base64],
        function(err) {
            if (err) {
                console.error('Erro ao salvar desenho:', err);
                return res.status(500).json({ erro: err.message });
            }
            res.json({ 
                sucesso: true, 
                id: this.lastID,
                mensagem: "Desenho salvo com sucesso!"
            });
        }
    );
});

// DELETE - Remover um desenho
app.delete('/api/galeria/:matricula/:id', (req, res) => {
    const { matricula, id } = req.params;
    
    db.run('DELETE FROM galeria_arte WHERE matricula = ? AND id = ?',
        [matricula, id],
        function(err) {
            if (err) return res.status(500).json({ erro: err.message });
            res.json({ sucesso: true, mensagem: "Desenho removido" });
        }
    );
});

// ========== ROTAS DE RELATÓRIOS ==========

// GET - Distribuição emocional real
app.get('/api/relatorio/emocoes', (req, res) => {
    const { curso, ano, periodo } = req.query;
    const dias = periodo === 'semana' ? 7 : periodo === 'mes' ? 30 : periodo === 'trimestre' ? 90 : 365;
    
    let sql = `
        SELECT e.emocao, COUNT(*) as total 
        FROM emocoes e
        JOIN usuarios u ON e.matricula = u.matricula
        WHERE e.data >= date('now', '-' || ? || ' days')
    `;
    let params = [dias];
    
    if (curso && curso !== 'todos' && curso !== 'all') {
        const cursoMap = { 'inf': 'INF', 'adm': 'ADM', 'ma': 'AMB' };
        const cursoCode = cursoMap[curso] || curso.toUpperCase();
        sql += ` AND u.matricula LIKE '%${cursoCode}%'`;
    }
    if (ano && ano !== 'todos' && ano !== 'all') {
        sql += ` AND substr(u.matricula, 5, 1) = ?`;
        params.push(ano);
    }
    
    sql += ` GROUP BY e.emocao`;
    
    db.all(sql, params, (err, rows) => {
        if (err) {
            console.error('Erro em /api/relatorio/emocoes:', err);
            return res.status(500).json({ erro: err.message });
        }
        
        const emocoes = { 
            alegria: 0, animado: 0, relaxado: 0, 
            tristeza: 0, ansioso: 0, raiva: 0 
        };
        
        rows.forEach(row => {
            const emocao = row.emocao;
            if (emocao === 'Alegria') emocoes.alegria = row.total;
            else if (emocao === 'Animado') emocoes.animado = row.total;
            else if (emocao === 'Relaxado') emocoes.relaxado = row.total;
            else if (emocao === 'Tristeza') emocoes.tristeza = row.total;
            else if (emocao === 'Ansioso') emocoes.ansioso = row.total;
            else if (emocao === 'Raiva') emocoes.raiva = row.total;
        });
        
        const total = Object.values(emocoes).reduce((a,b) => a + b, 0);
        if (total > 0) {
            Object.keys(emocoes).forEach(k => {
                emocoes[k] = Math.round((emocoes[k] / total) * 100);
            });
        } else {
            // Dados mock para teste quando não há registros
            emocoes.alegria = 35;
            emocoes.animado = 20;
            emocoes.relaxado = 25;
            emocoes.tristeza = 10;
            emocoes.ansioso = 8;
            emocoes.raiva = 2;
        }
        
        res.json(emocoes);
    });
});

// GET - Histórico mensal de bem-estar
app.get('/api/relatorio/historico', (req, res) => {
    const { curso, ano } = req.query;
    
    let sql = `
        SELECT strftime('%Y-%m', e.data) as mes,
               AVG(u.nivel) as nivel_medio,
               COUNT(e.id) as total_emocoes
        FROM emocoes e
        JOIN usuarios u ON e.matricula = u.matricula
        WHERE e.data >= date('now', '-5 months')
    `;
    let params = [];
    
    if (curso && curso !== 'todos') {
        const cursoMap = { 'inf': 'INF', 'adm': 'ADM', 'ma': 'AMB' };
        const cursoCode = cursoMap[curso] || curso.toUpperCase();
        sql += ` AND u.matricula LIKE '%${cursoCode}%'`;
    }
    if (ano && ano !== 'todos') {
        sql += ` AND substr(u.matricula, 5, 1) = ?`;
        params.push(ano);
    }
    
    sql += ` GROUP BY strftime('%Y-%m', e.data) ORDER BY mes DESC LIMIT 5`;
    
    db.all(sql, params, (err, rows) => {
        if (err) return res.status(500).json({ erro: err.message });
        
        const meses = { 1: 'Jan', 2: 'Fev', 3: 'Mar', 4: 'Abr', 5: 'Mai', 6: 'Jun', 
                        7: 'Jul', 8: 'Ago', 9: 'Set', 10: 'Out', 11: 'Nov', 12: 'Dez' };
        
        const historico = rows.map(row => {
            const mesNum = parseInt(row.mes.split('-')[1]);
            return {
                mes: meses[mesNum] || row.mes,
                val: parseFloat(row.nivel_medio).toFixed(1),
                badge: row.nivel_medio > 7 ? 'up' : row.nivel_medio < 6 ? 'down' : 'same'
            };
        });
        
        res.json(historico);
    });
});

// GET - Bem-estar por curso
app.get('/api/relatorio/cursos', (req, res) => {
    db.all(`
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
    `, [], (err, rows) => {
        if (err) {
            console.error('Erro em /api/relatorio/cursos:', err);
            return res.status(500).json({ erro: err.message });
        }
        
        const resultado = (rows || [])
            .filter(row => row.curso !== 'Outro')
            .map(row => ({
                curso: row.curso,
                cursoCod: row.curso === 'Informática' ? 'inf' : row.curso === 'Administração' ? 'adm' : 'meio',
                turmas: 3,
                alunos: row.alunos,
                score: parseFloat(row.nivel_medio).toFixed(1),
                alertas: row.alertas || 0
            }));
        
        res.json(resultado);
    });
});

// ========== ROTAS DE ALERTAS ==========

// GET - Carregar todos os alertas
app.get('/api/alertas', (req, res) => {
    db.all('SELECT * FROM alertas ORDER BY data_criacao DESC', [], (err, rows) => {
        if (err) {
            console.error('Erro ao buscar alertas:', err);
            return res.status(500).json({ erro: err.message });
        }
        res.json(rows || []);
    });
});

// POST - Criar novo alerta
app.post('/api/alertas', (req, res) => {
    const { id, titulo, desc, turma, aluno, severidade, tipo, emoji, detalhes } = req.body;
    const agora = new Date().toISOString();
    
    db.run(`INSERT INTO alertas (id, titulo, descricao, turma, aluno, severidade, tipo, emoji, detalhes, resolvido, data_criacao)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
        [id, titulo || '', desc || '', turma || '', aluno || '', severidade || 'medio', tipo || '', emoji || 'alert-circle', JSON.stringify(detalhes || {}), agora],
        (err) => {
            if (err) {
                console.error('Erro ao criar alerta:', err);
                return res.status(500).json({ erro: err.message });
            }
            res.json({ sucesso: true });
        }
    );
});

// PUT - Resolver alerta
app.put('/api/alertas/:id/resolver', (req, res) => {
    const { id } = req.params;
    db.run('UPDATE alertas SET resolvido = 1, data_resolucao = ? WHERE id = ?', 
        [new Date().toISOString(), id],
        (err) => {
            if (err) {
                console.error('Erro ao resolver alerta:', err);
                return res.status(500).json({ erro: err.message });
            }
            res.json({ sucesso: true });
        }
    );
});

// DELETE - Remover alerta
app.delete('/api/alertas/:id', (req, res) => {
    const { id } = req.params;
    db.run('DELETE FROM alertas WHERE id = ?', [id], (err) => {
        if (err) {
            console.error('Erro ao remover alerta:', err);
            return res.status(500).json({ erro: err.message });
        }
        res.json({ sucesso: true });
    });
});

// Iniciar servidor
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
});