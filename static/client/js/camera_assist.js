/* =========================
   Camera Control
========================= */
const video = document.getElementById('video');
const rawCanvas = document.getElementById('rawCanvas');
const ocrCanvas = document.getElementById('ocrCanvas');

// <!-- Camera Controls -->
document.getElementById("startBtn").onclick = startCamera;
document.getElementById("stopBtn").onclick = stopCamera;
document.getElementById("captureBtn").onclick = capturePhoto;

const ctxRaw = rawCanvas.getContext('2d');
const ctxOCR = ocrCanvas.getContext('2d');

let stream = null;

async function startCamera() {
    stream = await navigator.mediaDevices.getUserMedia({
        video: { 
            facingMode: 'environment',
            width: { ideal: 3840},
            height: { ideal: 2160 },
        },
        audio: false
    });
    video.srcObject = stream;
    videoTrack = stream.getVideoTracks()[0];

    const caps = videoTrack.getCapabilities();
    if (caps.zoom) maxHardwareZoom = caps.zoom.max;

    video.onloadedmetadata = () => {
        overlay.width = video.videoWidth;
        overlay.height = video.videoHeight;
        analyzing = true;
        requestAnimationFrame(analyzeFrame);
    };
}

function stopCamera() {
    analyzing = false;
    if (stream) stream.getTracks().forEach(t => t.stop());
    video.srcObject = null;
    octx.clearRect(0, 0, overlay.width, overlay.height);
}

// ================== Capture ==================
function capturePhoto() {
    captureCanvas.width = video.videoWidth;
    captureCanvas.height = video.videoHeight;
    cctx.drawImage(video, 0, 0);

    const img = new Image();
    img.onload = () => loadToEditor(img);
    img.src = captureCanvas.toDataURL("image/jpeg", 1);
}

document.getElementById('uploadInput').onchange = e => {
    const file = e.target.files[0];
    if (!file) return;
    const img = new Image();
    img.onload = () => drawAndProcess(img);
    img.src = URL.createObjectURL(file);
};

/* =========================
   Capture / Load
========================= */
function captureFromVideo() {
    rawCanvas.width = video.videoWidth;
    rawCanvas.height = video.videoHeight;
    ctxRaw.drawImage(video, 0, 0);
    drawAndProcess(rawCanvas);
}

function drawAndProcess(source) {
    ocrCanvas.width = source.width;
    ocrCanvas.height = source.height;
    ctxOCR.drawImage(source, 0, 0);
    runPipeline();
}

/* =========================
   OCR-friendly Pipeline
========================= */
function runPipeline() {
    let imgData = ctxOCR.getImageData(0, 0, ocrCanvas.width, ocrCanvas.height);

    grayscale(imgData);
    normalize(imgData);
    adaptiveThreshold(imgData, 15);
    sharpen(imgData, 1.3);

    ctxOCR.putImageData(imgData, 0, 0);
}

/* ===== Grayscale ===== */
function grayscale(img) {
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
        const g = 0.299 * d[i] + 0.587 * d[i+1] + 0.114 * d[i+2];
        d[i] = d[i+1] = d[i+2] = g;
    }
}

/* ===== Normalize (Mean / Std) ===== */
function normalize(img) {
    const d = img.data;
    let sum = 0, sq = 0, n = d.length / 4;

    for (let i = 0; i < d.length; i += 4) {
        sum += d[i];
        sq += d[i] * d[i];
    }

    const mean = sum / n;
    const std = Math.sqrt(sq / n - mean * mean) || 1;

    for (let i = 0; i < d.length; i += 4) {
        let v = (d[i] - mean) / std * 40 + 128;
        v = Math.max(0, Math.min(255, v));
        d[i] = d[i+1] = d[i+2] = v;
    }
}

/* ===== Adaptive Threshold ===== */
function adaptiveThreshold(img, blockSize) {
    const w = img.width, h = img.height;
    const d = img.data;
    const copy = new Uint8ClampedArray(d);

    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            let sum = 0, cnt = 0;
            for (let dy = -blockSize; dy <= blockSize; dy++) {
                for (let dx = -blockSize; dx <= blockSize; dx++) {
                    const nx = x + dx, ny = y + dy;
                    if (nx >= 0 && ny >= 0 && nx < w && ny < h) {
                        sum += copy[(ny * w + nx) * 4];
                        cnt++;
                    }
                }
            }
            const idx = (y * w + x) * 4;
            const thresh = sum / cnt - 5;
            const v = d[idx] > thresh ? 255 : 0;
            d[idx] = d[idx+1] = d[idx+2] = v;
        }
    }
}

/* ===== Mild Sharpen ===== */
function sharpen(img, strength = 1.3) {
    const w = img.width, h = img.height;
    const d = img.data;
    const copy = new Uint8ClampedArray(d);

    const k = [
         0, -1,  0,
        -1,  4 * strength, -1,
         0, -1,  0
    ];

    for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
            let sum = 0;
            let ki = 0;
            for (let dy = -1; dy <= 1; dy++) {
                for (let dx = -1; dx <= 1; dx++) {
                    const idx = ((y + dy) * w + (x + dx)) * 4;
                    sum += copy[idx] * k[ki++];
                }
            }
            const i = (y * w + x) * 4;
            const v = Math.max(0, Math.min(255, sum));
            d[i] = d[i+1] = d[i+2] = v;
        }
    }
}

/* =========================
   OCR Hook
========================= */
document.getElementById('ocrBtn').onclick = () => {
    ocrCanvas.toBlob(blob => {
        // TODO: POST blob to backend OCR service
        console.log('OCR image ready:', blob);
    }, 'image/png');
};