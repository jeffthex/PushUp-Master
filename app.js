const videoElement = document.getElementById('input_video');
const canvasElement = document.getElementById('output_canvas');
const canvasCtx = canvasElement.getContext('2d');

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

let sessaoAtiva = false;
let executandoTimer = false;
let lastDownTime = 0; 
const MIN_PUSHUP_TIME = 600; 

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
    const progress = Math.min((sessionCounter / currentGoal) * 100, 100);
    document.getElementById('progress-fill').style.width = sessaoAtiva ? progress + '%' : '0%';
}

function iniciarSessao() {
    document.getElementById('start-overlay').classList.add('hidden');
    executandoTimer = true;
    const container = document.getElementById('countdown-container');
    const steps = ["5", "4", "3", "2", "1", "GO!"];
    let i = 0;

    const interval = setInterval(() => {
        if (i < steps.length) {
            container.innerHTML = `<span class="countdown-number">${steps[i]}</span>`;
            i++;
        } else {
            clearInterval(interval);
            container.innerHTML = "";
            executandoTimer = false;
            sessaoAtiva = true;
            sessionCounter = 0;
            document.getElementById('session-count').innerText = "0";
            updateUI();
        }
    }, 1000);
}

let confirmReset = false;
function confirmarResetarDia() {
    const btn = document.getElementById('reset-today-btn');
    if (!confirmReset) {
        confirmReset = true;
        btn.innerText = 'TEM CERTEZA? CLIQUE DE NOVO';
        btn.classList.add('active');
        setTimeout(() => {
            if(confirmReset) {
                btn.innerText = 'ZERAR CONTAGEM HOJE';
                btn.classList.remove('active');
                confirmReset = false;
            }
        }, 3000);
    } else {
        const hoje = userData.history[todayKey] || 0;
        userData.grandTotal = Math.max(userData.grandTotal - hoje, 0);
        userData.history[todayKey] = 0;
        sessionCounter = 0;
        document.getElementById('session-count').innerText = "0";
        confirmReset = false;
        btn.innerText = 'ZERADO!';
        btn.classList.remove('active');
        saveData();
        renderHistory();
        setTimeout(() => { btn.innerText = 'ZERAR CONTAGEM HOJE'; }, 2000);
    }
}

const audioPoint = new Audio('point.mp3');
const audio10Point = new Audio('10point.mp3');
let stage = "up";

const pose = new Pose({ locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}` });
pose.setOptions({ modelComplexity: 1, minDetectionConfidence: 0.7, minTrackingConfidence: 0.7 });

pose.onResults((results) => {
    if (!results.poseLandmarks) return;
    canvasElement.width = results.image.width;
    canvasElement.height = results.image.height;

    const lm = results.poseLandmarks;
    const angulo = (calcularAngulo(lm[11], lm[13], lm[15]) + calcularAngulo(lm[12], lm[14], lm[16])) / 2;

    if (sessaoAtiva && !executandoTimer) {
        if (angulo < 100) { 
            if (stage !== "down") lastDownTime = Date.now();
            stage = "down";
        }
        if (angulo > 155 && stage === "down") {
            if ((Date.now() - lastDownTime) > MIN_PUSHUP_TIME) {
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
                if (sessionCounter % 10 === 0) audio10Point.play();
                else audioPoint.play();
                const fb = document.getElementById('feedback');
                fb.style.opacity = "1";
                setTimeout(() => fb.style.opacity = "0", 400);
            }
        }
    }

    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    const conn = [[11,12], [11,23], [12,24], [23,24], [11,13], [13,15], [12,14], [14,16], [23,25], [25,27], [24,26], [26,28]];
    drawConnectors(canvasCtx, lm, conn, {color: 'rgba(255, 255, 255, 0.4)', lineWidth: 3});
    const body = [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28].map(i => lm[i]);
    drawLandmarks(canvasCtx, body, {color: '#FF0000', lineWidth: 1, radius: 2});
    canvasCtx.restore();
});

function formatDateString(d) {
    const obj = new Date(d + 'T00:00:00');
    const sem = obj.toLocaleDateString('pt-BR', { weekday: 'long' });
    const data = obj.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    return `${sem.charAt(0).toUpperCase() + sem.slice(1)} - ${data}`;
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
    const btn = document.getElementById('config-btn');
    audioPoint.play().then(() => { audioPoint.pause(); audioPoint.currentTime = 0; });
    const permission = await Notification.requestPermission();
    btn.innerText = (permission === 'granted') ? 'SISTEMA ATIVADO!' : 'PERMISSÃO NEGADA';
    btn.style.backgroundColor = (permission === 'granted') ? '#2ecc71' : '#e74c3c';
    setTimeout(() => { btn.innerText = 'Configurar Alertas'; btn.style.backgroundColor = ''; }, 3000);
}