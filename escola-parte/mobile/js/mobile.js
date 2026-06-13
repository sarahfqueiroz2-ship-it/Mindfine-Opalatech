// ========================================
// MINDFINE - JS MOBILE
// ========================================

// Funções utilitárias
function showLoading() {
    const loader = document.createElement("div");
    loader.id = "loading";
    loader.className = "loading";
    loader.innerHTML = '<div class="spinner"></div><p>Carregando...</p>';
    document.body.appendChild(loader);
}

function hideLoading() {
    const loader = document.getElementById("loading");
    if (loader) loader.remove();
}

function showToast(message, type = "success") {
    const toast = document.createElement("div");
    toast.className = "toast toast-" + type;
    toast.innerHTML = message;
    toast.style.cssText = `
        position: fixed;
        bottom: 80px;
        left: 50%;
        transform: translateX(-50%);
        background: ${type === "success" ? "#10b981" : "#ef4444"};
        color: white;
        padding: 12px 24px;
        border-radius: 30px;
        font-size: 14px;
        z-index: 2000;
        box-shadow: 0 2px 10px rgba(0,0,0,0.2);
    `;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

function logout() {
    localStorage.removeItem("usuario");
    window.location.href = "login-mobile.html";
}

function getUsuario() {
    const usuario = localStorage.getItem("usuario");
    return usuario ? JSON.parse(usuario) : null;
}

function formatDate(date) {
    const d = new Date(date);
    return d.toLocaleDateString("pt-BR");
}

// API calls
const API_URL = "https://mindfine-backend.onrender.com/api";

async function apiFetch(endpoint, options = {}) {
    const response = await fetch(`${API_URL}${endpoint}`, {
        headers: { "Content-Type": "application/json" },
        ...options
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
}

// Inicialização
document.addEventListener("DOMContentLoaded", () => {
    // Verificar login
    const usuario = getUsuario();
    if (!usuario && !window.location.pathname.includes("login")) {
        window.location.href = "login-mobile.html";
    }
});
