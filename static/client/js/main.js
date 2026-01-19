// ===== 元件 =====
const video = document.getElementById("video");
const overlay = document.getElementById("overlay");
const ctx = overlay.getContext("2d");
const captureCanvas = document.getElementById("captureCanvas");
const captureCtx = captureCanvas.getContext("2d");

const zoomSlider = document.getElementById("zoomSlider");
const hint = document.getElementById("hint");

const previewImg = document.getElementById("previewImage");
const previewActions = document.getElementById("previewActions");
const previewEmpty = document.getElementById("previewEmpty");

const uploadBtn = document.getElementById("uploadBtn");
const cancelBtn = document.getElementById("cancelBtn");

let stream = null;
let videoTrack = null;
let analyzing = false;
let zoomFactor = 1;
let maxHardwareZoom = 1;
let lastCaptureBlob = null;

// ===== 事件 =====
document.getElementById("startBtn").onclick = startCamera;
document.getElementById("stopBtn").onclick = stopCamera;
document.getElementById("captureBtn").onclick = capturePhoto;
zoomSlider.oninput = e => setZoom(parseFloat(e.target.value));

uploadBtn.onclick = () => uploadToBackend(lastCaptureBlob);
cancelBtn.onclick = clearPreview;

// ===== 開啟相機 =====
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

// ===== 變焦 =====
function setZoom(value) {
    if (!videoTrack) return;

    const caps = videoTrack.getCapabilities();
    if (caps.zoom) {
        videoTrack.applyConstraints({ advanced: [{ zoom: Math.min(value, maxHardwareZoom) }] });
        zoomFactor = 1;
    } else {
        zoomFactor = value;
    }
}

// ===== 即時畫面 =====
function analyzeFrame() {
    if (!analyzing) return;

    overlay.width = video.videoWidth;
    overlay.height = video.videoHeight;

    if (zoomFactor > 1) {
        const w = video.videoWidth / zoomFactor;
        const h = video.videoHeight / zoomFactor;
        ctx.drawImage(video,
            (video.videoWidth - w) / 2,
            (video.videoHeight - h) / 2,
            w, h,
            0, 0, overlay.width, overlay.height
        );
    } else {
        ctx.drawImage(video, 0, 0, overlay.width, overlay.height);
    }

    requestAnimationFrame(analyzeFrame);
}

// ===== 拍照 =====
function capturePhoto() {
    captureCanvas.width = video.videoWidth;
    captureCanvas.height = video.videoHeight;

    captureCtx.drawImage(video, 0, 0);

    captureCanvas.toBlob(blob => {
        lastCaptureBlob = blob;
        showPreview(URL.createObjectURL(blob));
    }, "image/jpeg", 0.95);
}

// ===== 預覽 =====
function showPreview(url) {
    previewImg.src = url;
    previewImg.classList.remove("d-none");
    previewActions.classList.remove("d-none");
    previewEmpty.classList.add("d-none");
}

// ===== 清除預覽 =====
function clearPreview() {
    previewImg.src = "";
    previewImg.classList.add("d-none");
    previewActions.classList.add("d-none");
    previewEmpty.classList.remove("d-none");
    lastCaptureBlob = null;
}

// ===== 上傳 =====
function uploadToBackend(blob) {
    const form = new FormData();
    form.append("image", blob);

    fetch("/api/invoice/upload/", {
        method: "POST",
        body: form
    }).then(() => {
        alert("上傳完成");
        clearPreview();
    });
}

// ===== 關閉 =====
function stopCamera() {
    analyzing = false;
    if (stream) stream.getTracks().forEach(t => t.stop());
    
    // 清除即時畫面
    ctx.clearRect(0, 0, overlay.width, overlay.height);
    video.srcObject = null;
}
