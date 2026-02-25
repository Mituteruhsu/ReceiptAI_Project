class CameraController {
    constructor() {
        this.video = document.getElementById('video');
        this.cameraPlaceholder = document.getElementById('cameraPlaceholder');
        this.startCameraBtn = document.getElementById('startCamera');
        this.captureBtn = document.getElementById('capture');
        this.stopCameraBtn = document.getElementById('stopCamera');
        this.fileInput = document.getElementById('fileInput');

        this.previewContainer = document.getElementById('previewContainer');
        this.processedCanvas = document.getElementById('processedCanvas');

        this.adjustmentControls = document.getElementById('adjustmentControls');
        this.topMargin = document.getElementById('topMargin');
        this.bottomMargin = document.getElementById('bottomMargin');
        this.leftMargin = document.getElementById('leftMargin');
        this.rightMargin = document.getElementById('rightMargin');
        this.topValue = document.getElementById('topValue');
        this.bottomValue = document.getElementById('bottomValue');
        this.leftValue = document.getElementById('leftValue');
        this.rightValue = document.getElementById('rightValue');

        this.imageInfo = document.getElementById('imageInfo');
        this.imageDimensions = document.getElementById('imageDimensions');
        this.imageBrightness = document.getElementById('imageBrightness');
        this.imageSharpness = document.getElementById('imageSharpness');

        this.applyCropBtn = document.getElementById('applyCrop');
        this.resetAdjustmentBtn = document.getElementById('resetAdjustment');
        this.processOptions = document.getElementById('processOptions');
        this.reAdjustBtn = document.getElementById('reAdjust');
        this.confirmUploadBtn = document.getElementById('confirmUpload');

        this.stream = null;
        this.currentBlob = null;
        this.originalImage = null;
        this.detectedRect = null;

        this.initEventListeners();
    }

    initEventListeners() {
        this.startCameraBtn?.addEventListener('click', () => this.start());
        this.stopCameraBtn?.addEventListener('click', () => this.stop());
        this.captureBtn?.addEventListener('click', () => this.capture());
        this.fileInput?.addEventListener('change', (e) => this.handleFile(e));

        [this.topMargin, this.bottomMargin, this.leftMargin, this.rightMargin].forEach(s => {
            s?.addEventListener('input', () => {
                this.topValue.textContent = this.topMargin.value;
                this.bottomValue.textContent = this.bottomMargin.value;
                this.leftValue.textContent = this.leftMargin.value;
                this.rightValue.textContent = this.rightMargin.value;
                this.drawAdjustmentPreview();
            });
        });

        this.resetAdjustmentBtn?.addEventListener('click', () => this.resetAdjustment());
        this.applyCropBtn?.addEventListener('click', () => this.applyCrop());
        this.reAdjustBtn?.addEventListener('click', () => this.showAdjustmentUI());
        this.confirmUploadBtn?.addEventListener('click', () => this.uploadImage());
    }

    async start() {
        try {
            this.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
            this.video.srcObject = this.stream;
            this.video.classList.remove('d-none');
            this.cameraPlaceholder.classList.add('d-none');
            this.startCameraBtn.classList.add('d-none');
            this.captureBtn.classList.remove('d-none');
            this.stopCameraBtn.classList.remove('d-none');
        } catch (e) { alert('無法開啟相機'); }
    }

    stop() {
        if (this.stream) this.stream.getTracks().forEach(t => t.stop());
        this.stream = null;
        this.video.srcObject = null;
        this.video.classList.add('d-none');
        this.cameraPlaceholder.classList.remove('d-none');
        this.startCameraBtn.classList.remove('d-none');
        this.captureBtn.classList.add('d-none');
        this.stopCameraBtn.classList.add('d-none');
    }

    async capture() {
        const canvas = document.createElement('canvas');
        canvas.width = this.video.videoWidth;
        canvas.height = this.video.videoHeight;
        canvas.getContext('2d').drawImage(this.video, 0, 0);
        const blob = await new Promise(r => canvas.toBlob(r, 'image/jpeg'));
        await this.processAndPreview(blob);
    }

    async handleFile(e) {
        const file = e.target.files[0];
        if (file) await this.processAndPreview(file);
    }

    async processAndPreview(source) {
        const result = await window.imageProcessor.loadImage(source);
        this.originalImage = result.img;
        this.detectedRect = result.initialRect;
        this.showAdjustmentUI();
        this.resetAdjustmentValues();
        this.drawAdjustmentPreview();
    }

    showAdjustmentUI() {
        this.previewContainer.classList.add('d-none');
        this.processedCanvas.classList.remove('d-none');
        this.adjustmentControls.classList.remove('d-none');
        this.processOptions.classList.add('d-none');
    }

    resetAdjustmentValues() {
        this.topMargin.value = this.bottomMargin.value = this.leftMargin.value = this.rightMargin.value = 0;
        this.topValue.textContent = this.bottomValue.textContent = this.leftValue.textContent = this.rightValue.textContent = 0;
    }

    drawAdjustmentPreview() {
        if (!this.originalImage) return;
        const canvas = this.processedCanvas;
        const ctx = canvas.getContext('2d');
        canvas.width = this.originalImage.width;
        canvas.height = this.originalImage.height;
        ctx.drawImage(this.originalImage, 0, 0);

        const rect = this.getCurrentRect();
        ctx.strokeStyle = '#ff0000';
        ctx.lineWidth = Math.max(5, canvas.width / 200);
        ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);

        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.fillRect(0, 0, canvas.width, rect.y);
        ctx.fillRect(0, rect.y + rect.height, canvas.width, canvas.height - (rect.y + rect.height));
        ctx.fillRect(0, rect.y, rect.x, rect.height);
        ctx.fillRect(rect.x + rect.width, rect.y, canvas.width - (rect.x + rect.width), rect.height);
    }

    getCurrentRect() {
        const l = parseInt(this.leftMargin.value), r = parseInt(this.rightMargin.value), t = parseInt(this.topMargin.value), b = parseInt(this.bottomMargin.value);
        return {
            x: Math.max(0, this.detectedRect.x + l),
            y: Math.max(0, this.detectedRect.y + t),
            width: Math.min(this.originalImage.width - (this.detectedRect.x + l), this.detectedRect.width - l + r),
            height: Math.min(this.originalImage.height - (this.detectedRect.y + t), this.detectedRect.height - t + b)
        };
    }

    async applyCrop() {
        const result = window.imageProcessor.applyFinalProcessing(this.originalImage, this.getCurrentRect());
        this.currentBlob = await window.imageProcessor.canvasToBlob(result.canvas);
        this.adjustmentControls.classList.add('d-none');
        this.processOptions.classList.remove('d-none');
        this.imageDimensions.textContent = `${result.width} x ${result.height}`;
        this.imageBrightness.textContent = `${result.metrics.brightness}/255`;
        this.imageSharpness.textContent = result.metrics.sharpness > 50 ? '良好' : '一般';
    }

    resetAdjustment() { this.resetAdjustmentValues(); this.drawAdjustmentPreview(); }

    async uploadImage() {
        if (!this.currentBlob) return alert('請先處理影像');
        const formData = new FormData();
        formData.append('image', this.currentBlob, 'invoice.jpg');
        const response = await fetch('/api/process/', {
            method: 'POST',
            body: formData,
            headers: { 'X-CSRFToken': document.cookie.split('; ').find(r => r.startsWith('csrftoken='))?.split('=')[1] || '' }
        });
        const result = await response.json();
        if (result.success) {
            sessionStorage.setItem('invoiceData', JSON.stringify(result.data));
            window.location.href = '/client/confirm/';
        } else alert('辨識失敗: ' + result.error);
    }
}

document.addEventListener('DOMContentLoaded', () => { window.cameraController = new CameraController(); });
