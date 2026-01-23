// ================== DOM ==================
// ----- 左側: Camera -----
// <!-- 即時相機 -->
const video = document.getElementById("video");
const overlay = document.getElementById("overlay");
const captureCanvas = document.getElementById("captureCanvas");

// <!-- 拍攝品質 -->
const sharpnessMetric = document.getElementById("sharpnessMetric");
const brightnessMetric = document.getElementById("brightnessMetric");
const contrastMetric = document.getElementById("contrastMetric");

// <!-- Camera Controls -->
document.getElementById("startBtn").onclick = startCamera;
document.getElementById("stopBtn").onclick = stopCamera;
document.getElementById("captureBtn").onclick = capturePhoto;

// <!-- Zoom 數位 / 硬體變焦 -->
const zoomSlider = document.getElementById("zoomSlider");

// ----- 右側: Upload / Preview / Edit -----

// ===== panel =====
// <!-- Upload -->
const fileInput = document.getElementById("fileInput");
fileInput.addEventListener("change", handleFileUpload);

// <!-- Preview Image -->
const previewImg = document.getElementById("previewImage");

// <!-- Edit Canvas -->
const editCanvas = document.getElementById("editCanvas");

// <!-- Edit Sliders -->
const editControls = document.getElementById("editControls");

const brightnessInput = document.getElementById("brightness");
const contrastInput = document.getElementById("contrast");
const sharpnessInput = document.getElementById("sharpness");

// <!-- Actions -->
const previewActions = document.getElementById("previewActions");

const cancelBtn = document.getElementById("cancelBtn");
const uploadBtn = document.getElementById("uploadBtn");
cancelBtn.addEventListener("click", handleCancel);
uploadBtn.addEventListener("click", handleUpload);

// <!-- Empty -->
const previewEmpty = document.getElementById("previewEmpty");

// ================== Context ==================
const octx = overlay.getContext("2d");
const cctx = captureCanvas.getContext("2d");
const ectx = editCanvas.getContext("2d");

// ================== State ==================
let stream = null;      // for startCamera / stopCamera
let videoTrack = null;  // for startCamera / stopCamera
let analyzing = false;
let zoomFactor = 1;
let maxHardwareZoom = 1;
let originalImage = null;

// | Functions |
// ================== Camera ==================
async function startCamera() {
    stream = await navigator.mediaDevices.getUserMedia({
        video: {
            facingMode: "environment",
            width: { ideal: 3840 },
            height: { ideal: 2160 }
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

// ================== Zoom ==================
zoomSlider.oninput = e => {
    const value = parseFloat(e.target.value);
    if (!videoTrack) return;

    const caps = videoTrack.getCapabilities();
    if (caps.zoom) {
        videoTrack.applyConstraints({
            advanced: [{ zoom: Math.min(value, maxHardwareZoom) }]
        });
        zoomFactor = 1;
    } else {
        zoomFactor = value;
    }
};

// ================== Live Analyze ==================
function analyzeFrame() {
    if (!analyzing) return;

    overlay.width = video.videoWidth;
    overlay.height = video.videoHeight;

    if (zoomFactor > 1) {
        const w = video.videoWidth / zoomFactor;
        const h = video.videoHeight / zoomFactor;
        octx.drawImage(video,
            (video.videoWidth - w) / 2,
            (video.videoHeight - h) / 2,
            w, h,
            0, 0, overlay.width, overlay.height
        );
    } else {
        octx.drawImage(video, 0, 0);
    }

    const frame = octx.getImageData(0, 0, overlay.width, overlay.height);
    updateMetrics(frame);

    requestAnimationFrame(analyzeFrame);
}

// ================== Metrics ==================
function updateMetrics(img) {
    let sum = 0, sumSq = 0, lap = 0;
    const d = img.data;

    for (let i = 0; i < d.length; i += 4) {
        const g = 0.299*d[i] + 0.587*d[i+1] + 0.114*d[i+2];
        sum += g;
        sumSq += g * g;
    }

    const mean = sum / (img.width * img.height);
    const variance = sumSq / (img.width * img.height) - mean * mean;
    const contrast = Math.sqrt(variance);

    for (let i = 4; i < d.length - 4; i += 4) {
        lap += Math.abs(d[i] - d[i-4] - d[i+4]);
    }

    setMetric(brightnessMetric, mean, 80, 130);
    setMetric(contrastMetric, contrast, 30, 60);
    setMetric(sharpnessMetric, lap / 100000, 20, 40);
}

function setMetric(el, v, warn, good) {
    el.textContent = v.toFixed(1);
    el.className = v > good ? "good" : v > warn ? "warn" : "bad";
}

// ================== Capture ==================
function capturePhoto() {
    captureCanvas.width = video.videoWidth;
    captureCanvas.height = video.videoHeight;
    cctx.drawImage(video, 0, 0);

    const img = new Image();
    img.onload = () => loadToEditor(img);
    img.src = captureCanvas.toDataURL("image/jpeg", 0.95);
}

// ================== Upload Image ==================
function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    const img = new Image();
    img.onload = () => loadToEditor(img);
    img.src = URL.createObjectURL(file);
}

// ================== Editor ==================
function loadToEditor(img) {
    editCanvas.width = img.width;
    editCanvas.height = img.height;
    ectx.drawImage(img, 0, 0);

    originalImage = ectx.getImageData(0, 0, img.width, img.height);

    previewImg.classList.add("d-none");
    editCanvas.classList.remove("d-none");
    editControls.classList.remove("d-none");
    previewActions.classList.remove("d-none");
    previewEmpty.classList.add("d-none");

    applyFilters();
}

[brightnessInput, contrastInput, sharpnessInput].forEach(i =>
    i.oninput = applyFilters
);

function applyFilters() {
    if (!originalImage) return;

    const img = new ImageData(
        new Uint8ClampedArray(originalImage.data),
        originalImage.width,
        originalImage.height
    );

    adjustBC(img);
    sharpen(img, parseFloat(sharpnessInput.value));

    ectx.putImageData(img, 0, 0);
}

function adjustBC(img) {
    const b = +brightnessInput.value;
    const c = +contrastInput.value;
    const f = (259 * (c + 255)) / (255 * (259 - c));

    for (let i = 0; i < img.data.length; i += 4) {
        img.data[i]   = f*(img.data[i]-128)+128+b;
        img.data[i+1] = f*(img.data[i+1]-128)+128+b;
        img.data[i+2] = f*(img.data[i+2]-128)+128+b;
    }
}

function sharpen(img, amount) {
    if (amount === 0) return;
    const w = img.width, h = img.height;
    const src = img.data.slice();
    const k = [0,-1,0,-1,5+amount,-1,0,-1,0];

    for (let y=1;y<h-1;y++) for (let x=1;x<w-1;x++)
        for (let c=0;c<3;c++) {
            let i=(y*w+x)*4+c,sum=0,ki=0;
            for (let ky=-1;ky<=1;ky++)
                for (let kx=-1;kx<=1;kx++)
                    sum+=src[((y+ky)*w+(x+kx))*4+c]*k[ki++];
            img.data[i]=Math.min(255,Math.max(0,sum));
        }
}

// ================== Actions ==================
function handleCancel(){
    location.reload();
}

function handleUpload() {
    editCanvas.toBlob(blob => {
        const form = new FormData();
        form.append("image", blob);
        fetch("/api/invoice/upload/", { method:"POST", body:form })
            .then(() => alert("上傳完成"));
    }, "image/jpeg", 0.95);
};
