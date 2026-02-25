// static/client/js/camera.js

class CameraController {
    constructor() {
        // --- 相機控制 ---
        this.video = document.getElementById('video');
        this.cameraPlaceholder = document.getElementById('cameraPlaceholder');
        this.startCameraBtn = document.getElementById('startCamera');
        this.captureBtn = document.getElementById('capture');
        this.stopCameraBtn = document.getElementById('stopCamera');
        
        // --- 檔案上傳 ---
        this.fileInput = document.getElementById('fileInput');

        // --- 預覽與處理區 ---
        this.previewContainer = document.getElementById('previewContainer');
        this.placeholder = document.getElementById('placeholder');
        this.stage1 = document.getElementById('stage1');
        this.stage2 = document.getElementById('stage2');
        this.stage3 = document.getElementById('stage3');

        // --- 影像資訊 ---
        this.imageInfo = document.getElementById('imageInfo');
        this.imageDimensions = document.getElementById('imageDimensions');
        this.imageBrightness = document.getElementById('imageBrightness');
        this.imageSharpness = document.getElementById('imageSharpness');

        // --- 處理選項 ---
        this.processOptions = document.getElementById('processOptions');
        this.reprocessBtn = document.getElementById('reprocess');
        this.confirmUploadBtn = document.getElementById('confirmUpload');

        // --- 裁切控制 ---
        this.topMargin = document.getElementById('topMargin');
        this.bottomMargin = document.getElementById('bottomMargin');
        this.leftMargin = document.getElementById('leftMargin');
        this.rightMargin = document.getElementById('rightMargin');
        this.topValue = document.getElementById('topValue');
        this.bottomValue = document.getElementById('bottomValue');
        this.leftValue = document.getElementById('leftValue');
        this.rightValue = document.getElementById('rightValue');
        this.resetCropBtn = document.getElementById('resetCropBtn');
        
        // --- 畫布 ---
        this.canvasFinal = document.getElementById('canvasFinal');

        this.stream = null;
        this.currentBlob = null;

        this.initEventListeners();
    }
    
    initEventListeners() {
        this.startCameraBtn?.addEventListener('click', () => this.start());
        this.stopCameraBtn?.addEventListener('click', () => this.stop());
        this.captureBtn?.addEventListener('click', () => this.capture());
        
        this.fileInput?.addEventListener('change', (e) => this.handleFile(e));
        
        this.confirmUploadBtn?.addEventListener('click', () => this.uploadImage());
        this.reprocessBtn?.addEventListener('click', async () => await window.imageProcessor.reprocess());

        // 裁切拉桿事件
        this.topMargin?.addEventListener('input', () => this.updateMarginUI(this.topMargin, this.topValue));
        this.bottomMargin?.addEventListener('input', () => this.updateMarginUI(this.bottomMargin, this.bottomValue));
        this.leftMargin?.addEventListener('input', () => this.updateMarginUI(this.leftMargin, this.leftValue));
        this.rightMargin?.addEventListener('input', () => this.updateMarginUI(this.rightMargin, this.rightValue));

        this.resetCropBtn?.addEventListener('click', () => {
            [this.topMargin, this.bottomMargin, this.leftMargin, this.rightMargin].forEach(el => { if (el) el.value = 0; });
            [this.topValue, this.bottomValue, this.leftValue, this.rightValue].forEach(el => { if (el) el.textContent = 0; });
            window.imageProcessor.updateCrop();
        });
    }

    updateMarginUI(input, span) {
        if (span) span.textContent = input.value;
        window.imageProcessor.updateCrop();
    }
    
    async start() {
        if (this.stream) return;
        try {
            await this.ensureCleanState();
            this.stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: { ideal: 'environment' }, width: { ideal: 3000 }, height: { ideal: 3000 } },
                audio: false
            });
            this.video.srcObject = this.stream;
            await new Promise(resolve => this.video.onloadedmetadata = resolve);
            await this.video.play();

            this.video.classList.remove('d-none');
            this.cameraPlaceholder?.classList.add('d-none');
            this.startCameraBtn.classList.add('d-none');
            this.captureBtn.classList.remove('d-none');
            this.stopCameraBtn.classList.remove('d-none');
            this.clearPreview();
        } catch (error) {
            console.error('相機啟動失敗:', error);
            alert('無法啟動相機，請檢查權限或使用檔案上傳');
        }
    }
    
    stop() {
        if (this.stream) this.stream.getTracks().forEach(track => track.stop());
        this.stream = null;
        if (this.video) {
            this.video.pause();
            this.video.srcObject = null;
            this.video.removeAttribute('src');
            this.video.load();
            this.video.classList.add('d-none');
        }
        this.cameraPlaceholder?.classList.remove('d-none');
        this.startCameraBtn.classList.remove('d-none');
        this.captureBtn.classList.add('d-none');
        this.stopCameraBtn.classList.add('d-none');
    }
    
    async capture() {
        if (!this.stream) return;
        try {
            const canvas = document.createElement('canvas');
            canvas.width = this.video.videoWidth;
            canvas.height = this.video.videoHeight;
            canvas.getContext('2d').drawImage(this.video, 0, 0);
            const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.95));
            await this.processAndPreview(blob);
        } catch (error) {
            console.error('拍照失敗:', error);
        }
    }

    async ensureCleanState() {
        if (this.stream) this.stream.getTracks().forEach(t => t.stop());
        this.stream = null;
        if (this.video) {
            this.video.pause();
            this.video.srcObject = null;
            this.video.load();
        }
    }
    
    async handleFile(event) {
        const file = event.target.files[0];
        if (!file || !file.type.startsWith('image/')) return;
        await this.processAndPreview(file);
    }
    
    async processAndPreview(imageSource) {
        try {
            const result = await window.imageProcessor.processImage(imageSource);
            this.updatePreview(result);
        } catch (error) {
            console.error('處理失敗:', error);
            alert('影像處理失敗');
        }
    }
    
    updatePreview(result) {
        if (this.placeholder) this.placeholder.classList.add('d-none');
        [this.stage1, this.stage2, this.stage3].forEach(s => s?.classList.remove('d-none'));
        
        this.imageDimensions.textContent = `${result.width} × ${result.height}`;
        this.imageBrightness.textContent = `${result.metrics.brightness}/255`;
        this.imageSharpness.textContent = result.metrics.sharpness > 50 ? '良好' : '一般';
        
        this.imageInfo.classList.remove('d-none');
        this.processOptions.classList.remove('d-none');
    }
    
    clearPreview() {
        if (this.placeholder) this.placeholder.classList.remove('d-none');
        [this.stage1, this.stage2, this.stage3, this.imageInfo, this.processOptions].forEach(s => s?.classList.add('d-none'));
        if (this.resetCropBtn) this.resetCropBtn.click();
    }
    
    async uploadImage() {
        if (!this.canvasFinal) return;
        
        const blob = await window.imageProcessor.canvasToBlob(this.canvasFinal);
        const formData = new FormData();
        formData.append('image', blob, 'invoice.jpg');
        
        try {
            const response = await fetch('/api/process/', {
                method: 'POST',
                body: formData,
                headers: { 'X-CSRFToken': this.getCsrfToken() }
            });
            const result = await response.json();
            if (result.success) {
                sessionStorage.setItem('invoiceData', JSON.stringify(result.data));
                window.location.href = '/client/confirm/';
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            console.error('上傳失敗:', error);
            alert('辨識失敗: ' + error.message);
        }
    }
        
    getCsrfToken() {
        return document.cookie.split('; ').find(row => row.startsWith('csrftoken='))?.split('=')[1] || '';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.cameraController = new CameraController();
    console.log('📷 [CameraController] 初始化完成');
});
