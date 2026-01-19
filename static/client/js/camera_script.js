// ===== Elements =====
const video = document.getElementById("video");
const overlay = document.getElementById("overlay");
const ctx = overlay.getContext("2d");

const captureCanvas = document.getElementById("captureCanvas");
const captureCtx = captureCanvas.getContext("2d");

const fileInput = document.getElementById("fileInput");

const previewImg = document.getElementById("previewImage");
const previewActions = document.getElementById("previewActions");
const previewEmpty = document.getElementById("previewEmpty");

const uploadBtn = document.getElementById("uploadBtn");
const cancelBtn = document.getElementById("cancelBtn");

let stream = null;
let analyzing = false;
let lastCaptureBlob = null;

// ===== Events =====
document.getElementById("startBtn").onclick = startCamera;
document.getElementById("stopBtn").onclick = stopCamera;
document.getElementById("captureBtn").onclick = capturePhoto;

fileInput.onchange = handleFileUpload;
uploadBtn.onclick = () => uploadToBackend(lastCaptureBlob);
cancelBtn.onclick = clearPreview;

// ===== Camera =====
async function startCamera() {
    stopCamera();

    try {
        stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: "environment" },
            audio: false
        });

        video.srcObject = stream;

        video.onloadedmetadata = () => {
            overlay.width = video.videoWidth;
            overlay.height = video.videoHeight;
            analyzing = true;
            requestAnimationFrame(drawFrame);
        };

    } catch (err) {
        alert("無法開啟攝影機，請改用圖片上傳");
        console.error(err);
    }
}

function drawFrame() {
    if (!analyzing) return;
    ctx.drawImage(video, 0, 0, overlay.width, overlay.height);
    requestAnimationFrame(drawFrame);
}

// ===== Capture =====
function capturePhoto() {
    if (!video.videoWidth) return;

    captureCanvas.width = video.videoWidth;
    captureCanvas.height = video.videoHeight;

    captureCtx.drawImage(video, 0, 0);

    captureCanvas.toBlob(blob => {
        lastCaptureBlob = blob;
        showPreview(URL.createObjectURL(blob));
    }, "image/jpeg", 0.95);
}

// ===== Upload via File =====
function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    lastCaptureBlob = file;
    showPreview(URL.createObjectURL(file));
}

// ===== Preview =====
function showPreview(url) {
    previewImg.src = url;
    previewImg.classList.remove("d-none");
    previewActions.classList.remove("d-none");
    previewEmpty.classList.add("d-none");
}

function clearPreview() {
    previewImg.src = "";
    previewImg.classList.add("d-none");
    previewActions.classList.add("d-none");
    previewEmpty.classList.remove("d-none");
    lastCaptureBlob = null;
}

// ===== Upload =====
function uploadToBackend(blob) {
    const form = new FormData();
    form.append("image", blob);

    fetch("/api/invoice/upload/", {
        method: "POST",
        body: form
    })
    .then(() => {
        alert("上傳完成");
        clearPreview();
    });
}

// ===== Stop =====
function stopCamera() {
    analyzing = false;

    if (stream) {
        stream.getTracks().forEach(t => t.stop());
        stream = null;
    }

    ctx.clearRect(0, 0, overlay.width, overlay.height);
    video.srcObject = null;
}
