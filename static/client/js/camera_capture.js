const video = document.getElementById("video");
const canvas = document.getElementById("editCanvas");
const ctx = canvas.getContext("2d");

const brightnessInput = document.getElementById("brightness");
const contrastInput = document.getElementById("contrast");
const sharpnessInput = document.getElementById("sharpness");

let stream = null;
let originalImage = null;

// ===== Camera =====
document.getElementById("cameraBtn").onclick = async () => {
    try {
        stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: "environment" },
            audio: false
        });
        video.srcObject = stream;
    } catch {
        alert("相機無法啟動，請使用圖片上傳");
    }
};

document.getElementById("captureBtn").onclick = () => {
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);
    loadOriginal();
};

// ===== Upload File =====
document.getElementById("fileInput").onchange = e => {
    const file = e.target.files[0];
    if (!file) return;

    const img = new Image();
    img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        loadOriginal();
    };
    img.src = URL.createObjectURL(file);
};

// ===== Store Original =====
function loadOriginal() {
    originalImage = ctx.getImageData(0, 0, canvas.width, canvas.height);
    applyFilters();
}

// ===== Filters =====
[brightnessInput, contrastInput, sharpnessInput].forEach(i =>
    i.oninput = applyFilters
);

function applyFilters() {
    if (!originalImage) return;

    const imgData = new ImageData(
        new Uint8ClampedArray(originalImage.data),
        originalImage.width,
        originalImage.height
    );

    adjustBrightnessContrast(imgData);
    sharpen(imgData, parseFloat(sharpnessInput.value));

    ctx.putImageData(imgData, 0, 0);
}

function adjustBrightnessContrast(img) {
    const b = parseInt(brightnessInput.value);
    const c = parseInt(contrastInput.value);

    const factor = (259 * (c + 255)) / (255 * (259 - c));

    for (let i = 0; i < img.data.length; i += 4) {
        img.data[i] = factor * (img.data[i] - 128) + 128 + b;
        img.data[i+1] = factor * (img.data[i+1] - 128) + 128 + b;
        img.data[i+2] = factor * (img.data[i+2] - 128) + 128 + b;
    }
}

// ===== Sharpen =====
function sharpen(img, amount) {
    if (amount === 0) return;

    const w = img.width;
    const h = img.height;
    const src = img.data.slice();
    const k = [
        0, -1, 0,
       -1, 5 + amount, -1,
        0, -1, 0
    ];

    for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
            for (let c = 0; c < 3; c++) {
                let i = (y * w + x) * 4 + c;
                let sum = 0;
                let ki = 0;

                for (let ky = -1; ky <= 1; ky++) {
                    for (let kx = -1; kx <= 1; kx++) {
                        let si = ((y + ky) * w + (x + kx)) * 4 + c;
                        sum += src[si] * k[ki++];
                    }
                }
                img.data[i] = Math.min(255, Math.max(0, sum));
            }
        }
    }
}

// ===== Upload =====
document.getElementById("uploadBtn").onclick = () => {
    canvas.toBlob(blob => {
        const form = new FormData();
        form.append("image", blob);

        fetch("/api/invoice/upload/", {
            method: "POST",
            body: form
        }).then(() => alert("上傳完成"));
    }, "image/jpeg", 0.95);
};
