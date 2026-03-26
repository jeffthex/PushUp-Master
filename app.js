const videoElement = document.getElementById('input_video');
const canvasElement = document.getElementById('output_canvas');
const canvasCtx = canvasElement.getContext('2d');
const countDisplay = document.getElementById('top-bar'); // Nome atualizado

let counter = 0;
let stage = "up"; // Estado inicial

// Configuração do MediaPipe Pose
const pose = new Pose({
  locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`
});

pose.setOptions({
  modelComplexity: 1,
  minDetectionConfidence: 0.5,
  minTrackingConfidence: 0.5
});

// Lógica de contagem e desenho
pose.onResults((results) => {
  if (!results.poseLandmarks) return;

  // Sincroniza o tamanho do canvas com o vídeo da câmera
  canvasElement.width = results.image.width;
  canvasElement.height = results.image.height;

  // --- Lógica de Contagem (Otimizada para posição de LADO) ---
  const shoulderY = results.poseLandmarks[11].y; // Pega o Y do ombro
  
  // Limites mais rígidos para melhor contagem
  if (shoulderY > 0.65) {
    stage = "down";
  }
  if (shoulderY < 0.35 && stage === "down") {
    stage = "up";
    counter++;
    countDisplay.innerText = counter;
  }

  // --- NOVA LÓGICA DE DESENHO DO ESQUELETO ---
  canvasCtx.save();
  canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

  // 1. Filtragem do Rosto: Criamos uma lista de conexões SEM os pontos 0-10 (rosto)
  const filteredPoseConnections = [
    // Tronco
    [11, 12], // Ombro-Ombro
    [11, 23], // Ombro Esq-Quadril Esq
    [12, 24], // Ombro Dir-Quadril Dir
    [23, 24], // Quadril-Quadril
    // Braços (Destaque para flexão)
    [11, 13], [13, 15], // Braço Esq
    [12, 14], [14, 16], // Braço Dir
    // Pernas (Tronco e Pernas solicitados)
    [23, 25], [25, 27], [27, 29], [29, 31], // Perna Esq
    [24, 26], [26, 28], [28, 30], [30, 32]  // Perna Dir
  ];
  
  // 2. Desenha os conectores (Linhas Brancas Translúcidas)
  drawConnectors(canvasCtx, results.poseLandmarks, filteredPoseConnections,
                 {color: 'rgba(255, 255, 255, 0.5)', lineWidth: 3}); // rgba(255,255,255,0.5) é branco com 50% transparência

  // 3. Desenha os landmarks (Pontos Vermelhos nas Conexões)
  // Nota: Isso desenha todos os pontos detectados, incluindo o rosto (apenas pontos vermelhos). 
  // Filtrar apenas pontos específicos do corpo sem as linhas é mais complexo em JS.
  // Começamos removendo as linhas do rosto primeiro.
  drawLandmarks(canvasCtx, results.poseLandmarks,
                {color: '#FF0000', lineWidth: 1, radius: 2}); // Vermelho para os pontos
  
  canvasCtx.restore();
});

// Inicializa a câmera
const camera = new Camera(videoElement, {
  onFrame: async () => {
    await pose.send({image: videoElement});
  },
  width: 640,
  height: 480
});
camera.start();

// Registro do Service Worker (Inalterado)
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js');
}

// Função do botão de notificação (Inalterado)
async function ativarNotificacao() {
  const permission = await Notification.requestPermission();
  if (permission === 'granted') {
    alert('Notificações autorizadas!');
  }
}