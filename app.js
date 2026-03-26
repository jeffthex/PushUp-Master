const videoElement = document.getElementById('input_video');
const canvasElement = document.getElementById('output_canvas');
const canvasCtx = canvasElement.getContext('2d');

// --- ESTADOS E PERSISTÊNCIA ---
let sessionCounter = 0;
const now = new Date();
const todayKey = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');

let userData = JSON.parse(localStorage.getItem('flexData')) || {
    history: {},
    streak: 0,
    lastActive: null,
    startDate: todayKey,
    grandTotal: 0
};

// --- TRAVAS DE SEGURANÇA ---
let lastDownTime = 0; 
const MIN_PUSHUP_TIME = 600; // Tempo mínimo de uma flexão em milissegundos (0.6s)

// --- FUNÇÃO MATEMÁTICA ---
function calcularAngulo(A, B, C) {
    let radians = Math.atan2(C.y - B.y, C.x - B.x) - Math.atan2(A.y - B.y, A.x - B.x);
    let angle = Math.abs(radians * 180.0 / Math.PI);
    if (angle > 180.0) angle = 360 - angle;
    return angle;
}

function initData() {
    if (!userData.history[todayKey]) userData.history[todayKey] = 0;
    if (userData.lastActive) {
        const last = new Date(userData.lastActive + 'T00:00:00');
        const today = new Date(todayKey + 'T00:00:00');
        const diffDays = Math.floor((today - last) / (1000 * 60 * 60 * 24));
        if (diffDays > 1) userData.streak = 0;
    }
    saveData();
}

function saveData() {
    localStorage.setItem('flexData', JSON.stringify(userData));
    updateUI();
}

function updateUI() {
    document.getElementById('total-today').innerText = userData.history[todayKey] || 0;
    document.getElementById('streak-count').innerText = userData.streak;
    document.getElementById('grand-total').innerText = userData.grandTotal;
    const start = new Date(userData.startDate + 'T00:00:00');
    const today = new Date(todayKey + 'T00:00:00');
    const daysDiff = Math.floor((today - start) / (1000 * 60 * 60 * 24));
    const currentGoal = 15 + (Math.floor(daysDiff / 14) * 2);
    document.getElementById('goal-info').innerText = `Meta da Sessão: ${currentGoal}`;
}

const audioPoint = new Audio('point.mp3');
const audio10Point = new Audio('10point.mp3');
let stage = "up";

const pose = new Pose({ locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}` });
pose.setOptions({ modelComplexity: 1, minDetectionConfidence: 0.7, minTrackingConfidence: 0.7 }); // Aumentei a confiança mínima

pose.onResults((results) => {
    if (!results.poseLandmarks) return;
    canvasElement.width = results.image.width;
    canvasElement.height = results.image.height;

    const landmarks = results.poseLandmarks;
    const anguloEsq = calcularAngulo(landmarks[11], landmarks[13], landmarks[15]);
    const anguloDir = calcularAngulo(landmarks[12], landmarks[14], landmarks[16]);
    const anguloMedio = (anguloEsq + anguloDir) / 2;

    // --- LÓGICA DE CONTAGEM COM TRAVA DE TEMPO ---
    
    // 1. Detecta que desceu
    if (anguloMedio < 100) { 
        if (stage !== "down") {
            lastDownTime = Date.now(); // Marca o início da descida
        }
        stage = "down";
    }
    
    // 2. Detecta que subiu
    if (anguloMedio > 155 && stage === "down") {
        const duration = Date.now() - lastDownTime;

        // SÓ CONTA SE: demorou mais que 0.6s (evita balanço de braço/ajuste de câmera)
        if (duration > MIN_PUSHUP_TIME) {
            stage = "up";
            
            if (userData.lastActive !== todayKey) {
                userData.streak++;
                userData.lastActive = todayKey;
            }

            sessionCounter++;
            userData.history[todayKey]++;
            userData.grandTotal++;
            
            document.getElementById('session-count').innerText = sessionCounter;
            saveData();

            if (sessionCounter % 10 === 0 && sessionCounter !== 0) audio10Point.play();
            else audioPoint.play();

            const fb = document.getElementById('feedback');
            fb.style.opacity = "1";
            setTimeout(() => fb.style.opacity = "0", 400);
        } else {
            // Se foi rápido demais, pode ter sido um erro. 
            // Não resetamos o stage para "up" imediatamente para evitar bugs, 
            // mas ignoramos o incremento.
        }
    }

    // Desenho
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    const conn = [[11,12], [11,23], [12,24], [23,24], [11,13], [13,15], [12,14], [14,16], [23,25], [25,27], [24,26], [26,28]];
    drawConnectors(canvasCtx, landmarks, conn, {color: 'rgba(255, 255, 255, 0.4)', lineWidth: 3});
    const bodyInd = [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28];
    const bodyLms = bodyInd.map(i => landmarks[i]);
    drawLandmarks(canvasCtx, bodyLms, {color: '#FF0000', lineWidth: 1, radius: 2});
    canvasCtx.restore();
});

// Formatação do histórico
function formatDateString(dateStr) {
    const dateObj = new Date(dateStr + 'T00:00:00');
    const weekday = dateObj.toLocaleDateString('pt-BR', { weekday: 'long' });
    const date = dateObj.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    return `${weekday.charAt(0).toUpperCase() + weekday.slice(1)} - ${date}`;
}

function renderHistory() {
    const list = document.getElementById('history-list');
    list.innerHTML = "";
    const dates = Object.keys(userData.history).sort().reverse().slice(0, 7);
    dates.forEach(d => {
        list.innerHTML += `<div class="history-item"><span>${formatDateString(d)}</span> <b>${userData.history[d]} reps</b></div>`;
    });
}

const camera = new Camera(videoElement, { onFrame: async () => { await pose.send({image: videoElement}); }, width: 640, height: 480 });
camera.start();
initData();

async function ativarNotificacao() {
    audioPoint.play().then(() => { audioPoint.pause(); audioPoint.currentTime = 0; });
    const permission = await Notification.requestPermission();
    if (permission === 'granted') alert('Sistema Ativado!');
}