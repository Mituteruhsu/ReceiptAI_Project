// static/client/js/camera.js

class CameraController {
    constructor() {
        // <!-- 左側：相機控制 -->
        // <!-- 相機預覽區 -->
        this.video = document.getElementById('video');
        this.cameraPlaceholder = document.getElementById('cameraPlaceholder');
        
        // <!-- 控制按鈕 -->
        this.startCameraBtn = document.getElementById('startCamera');
        this.captureBtn = document.getElementById('capture');
        this.stopCameraBtn = document.getElementById('stopCamera');
        
        // <!-- 檔案上傳 -->
        this.fileInput = document.getElementById('fileInput');

        // <!-- 右側：預覽與處理 -->
        // <!-- 預覽區 -->
        this.previewContainer = document.getElementById('previewContainer');

        // <!-- 原始影像（隱藏） -->
        this.originalCanvas = document.getElementById('originalCanvas');

        // <!-- 處理後影像 -->
        this.processedCanvas = document.getElementById('processedCanvas');

        // <!-- 影像資訊 -->
        this.imageInfo = document.getElementById('imageInfo');
        this.imageDimensions = document.getElementById('imageDimensions');
        this.imageBrightness = document.getElementById('imageBrightness');
        this.imageSharpness = document.getElementById('imageSharpness');

        // <!-- 處理選項 -->
        this.processOptions = document.getElementById('processOptions');
        this.autoContrast = document.getElementById('autoContrast');
        this.reprocessBtn = document.getElementById('reprocess');
        this.confirmUploadBtn = document.getElementById('confirmUpload');

        this.stream = null;
        this.currentBlob = null;
        this.isStarting = false;

        this.initEventListeners();
    }
    
    initEventListeners() {
        // 相機控制
        this.startCameraBtn?.addEventListener('click', () => this.start());
        this.stopCameraBtn?.addEventListener('click', () => this.stop());
        this.captureBtn?.addEventListener('click', () => this.capture());
        
        // 檔案上傳
        this.fileInput?.addEventListener('change', (e) => this.handleFile(e));
        
        // 處理選項
        this.confirmUploadBtn?.addEventListener('click', () => this.uploadImage());
    }
    
    /**
     * 啟動相機
     */
    async start() {
        if (this.stream) {
            console.warn('Camera already running');
            return;
        }

        console.log('[CameraController] start');

        try {
            // 🔑 確保之前的資源完全釋放
            await this.ensureCleanState();
            await new Promise(r => setTimeout(r, 200)); // 🔑 給瀏覽器釋放時間

            this.stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: { ideal: 'environment' },
                    width: { ideal: 1920 },
                    height: { ideal: 1080 }
                }
            });

            // 🔑 確保 video element 處於正確狀態
            this.video.srcObject = this.stream;

            // 🔑 等待 metadata 載入
            await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => reject(new Error('Timeout waiting for video')), 5000);
                this.video.onloadedmetadata = () => {
                    clearTimeout(timeout);
                    resolve();
                };
            });

            await this.video.play(); // 🔑 確保真正啟動

            this.video.classList.remove('d-none');
            this.cameraPlaceholder?.classList.add('d-none');
            this.startCameraBtn.classList.add('d-none');
            this.captureBtn.classList.remove('d-none');
            this.stopCameraBtn.classList.remove('d-none');

            this.clearPreview();

            console.log('✅ 相機已啟動');

        } catch (error) {
            console.error('❌ 相機啟動失敗:', error.name, error.message);

            alert(
                error.name === 'NotReadableError'
                    ? '相機尚在釋放中，請稍候再試'
                    : '無法啟動相機，請檢查權限或改用檔案上傳'
            );
        }
    }
    
    /**
     * 停止相機
     */
    stop() {
        console.log('[CameraController] stop');

        // 1. 停止所有 tracks
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
        }

        // 2. 清掉 stream reference（非常重要）
        this.stream = null;

        // 3. 重置 video element（Safari / Chrome 都需要）
        if (this.video) {
            this.video.pause();
            this.video.srcObject = null;
            this.video.removeAttribute('src');
            this.video.load(); // 🔥 這行才是真正的 reset
            this.video.classList.add('d-none');
        }

        // 4. UI 回到初始狀態
        this.cameraPlaceholder?.classList.remove('d-none');
        this.startCameraBtn.classList.remove('d-none');
        this.captureBtn.classList.add('d-none');
        this.stopCameraBtn.classList.add('d-none');

        console.log('🛑 相機已完全釋放（可重新啟動）');
    }
    
    /**
     * 拍照
     */
    async capture() {
        console.log('[CameraController] capture triggered');
        console.log('[CameraController] video size',
            this.video.videoWidth,
            this.video.videoHeight
        );

        if (!this.stream) {
            alert('請先啟動相機');
            return;
        }
        
        try {
            // 創建臨時畫布
            const canvas = document.createElement('canvas');
            canvas.width = this.video.videoWidth;
            canvas.height = this.video.videoHeight;
            
            const ctx = canvas.getContext('2d');
            ctx.drawImage(this.video, 0, 0);
            
            // 轉為 Blob
            const blob = await new Promise(resolve => {
                canvas.toBlob(resolve, 'image/jpeg', 0.95);
            });
            
            console.log('📸 已拍照:', blob.size, 'bytes');
            
            // 處理影像
            await this.processAndPreview(blob);
            
        } catch (error) {
            console.error('❌ 拍照失敗:', error);
            alert('拍照失敗，請重試');
        }
    }

    /**
     * 🔑 確保乾淨的初始狀態
     */
    async ensureCleanState() {
        if (this.stream) {
            await this.cleanupStream();
        }
        
        if (this.video) {
            this.video.pause();
            this.video.srcObject = null;
            this.video.removeAttribute('src');
            this.video.load();
        }
        
        // 🔑 額外等待確保釋放完成
        await new Promise(r => setTimeout(r, 100));
    }
    
    /**
     * 🔑 清理 stream 資源
     */
    async cleanupStream() {
        if (this.stream) {
            this.stream.getTracks().forEach(track => {
                track.stop();
                console.log('🛑 Track stopped:', track.kind);
            });
            this.stream = null;
        }
        
        // 🔑 等待資源釋放
        await new Promise(r => setTimeout(r, 100));
    }
    
    /**
     * 處理檔案上傳
     */
    async handleFile(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        if (!file.type.startsWith('image/')) {
            alert('請選擇圖片檔案');
            return;
        }
        
        console.log('📁 已選擇檔案:', file.name, file.size, 'bytes');
        
        // 處理影像
        await this.processAndPreview(file);
    }
    
    /**
     * 處理並預覽影像
     */
    async processAndPreview(imageSource) {
        try {
            console.log('[CameraController] processAndPreview', imageSource);

            // 使用 ImageProcessor 處理
            const result = await window.imageProcessor.processImage(imageSource);
            console.log('[CameraController] processed result', result);

            // 儲存處理後的 Blob
            this.currentBlob = await window.imageProcessor.canvasToBlob(result.canvas);
            
            // 更新預覽
            this.updatePreview(result);
            
            console.log('✅ 影像處理完成:', result);
            
        } catch (error) {
            console.error('❌ 影像處理失敗:', error);
            alert('影像處理失敗: ' + error.message);
        }
    }
    
    /**
     * 更新預覽區域
     */
    updatePreview(result) {
        console.log('[CameraController] updatePreview', result);
        
        console.log('🔍 Element status:', {
                previewContainer: this.previewContainer ? '✓ 存在' : '✗ 不存在',
                processedCanvas: this.processedCanvas ? '✓ 存在' : '✗ 不存在',
                imageInfo: this.imageInfo ? '✓ 存在' : '✗ 不存在',
                processOptions: this.processOptions ? '✓ 存在' : '✗ 不存在'
            });
            
        // 清空容器並移除 placeholder
        this.previewContainer.innerHTML = '';
        this.previewContainer.classList.add('showing-image');
        
        // 顯示處理後影像
        this.processedCanvas.classList.remove('d-none');
        this.previewContainer.appendChild(this.processedCanvas);
        
        // 更新影像資訊
        this.imageDimensions.textContent = `${result.width} × ${result.height}`;
        this.imageBrightness.textContent = `${result.metrics.brightness}/255`;
        this.imageSharpness.textContent = result.metrics.sharpness > 50 ? '良好' : '一般';
        
        this.imageInfo.classList.remove('d-none');
        this.processOptions.classList.remove('d-none');
    }
    
    /**
     * 清空預覽
     */
    clearPreview() {
        console.log('[CameraController] clearPreview');
        
        // 🔑 安全檢查
        if (this.previewContainer) {
            this.previewContainer.classList.remove('showing-image');
            this.previewContainer.innerHTML = `
                <div class="d-flex align-items-center justify-content-center text-muted">
                    <div class="text-center">
                        <i class="bi bi-image fs-1 mb-2"></i>
                        <p class="mb-0">尚未拍攝或上傳影像</p>
                    </div>
                </div>
            `;
        }
        
        if (this.processedCanvas) this.processedCanvas.classList.add('d-none');
        if (this.imageInfo) this.imageInfo.classList.add('d-none');
        if (this.processOptions) this.processOptions.classList.add('d-none');
    }
    
    /**
     * 上傳影像到後端
     */
    async uploadImage() {
        if (!this.currentBlob) {
            alert('請先拍照或上傳影像');
            return;
        }

        console.log('[Upload] preparing FormData');
        const formData = new FormData();
        formData.append('image', this.currentBlob, 'invoice.jpg');
        console.log('[Upload] blob size', this.currentBlob.size);

        this.showLoader('正在辨識發票...', '使用 QR Code / OCR 辨識中');
        
        try {
            const response = await fetch('/api/process/', {
                method: 'POST',
                body: formData,
                headers: {
                    'X-CSRFToken': this.getCsrfToken()
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const result = await response.json();
            
            if (result.success) {
                console.log('✅ 辨識成功:', result.data);
                
                // 儲存到 sessionStorage
                sessionStorage.setItem('invoiceData', JSON.stringify(result.data));
                
                // 跳轉到確認頁
                window.location.href = '/client/confirm/';
            } else {
                throw new Error(result.error || '辨識失敗');
            }
        } catch (error) {
            console.error('❌ 上傳失敗:', error);
            alert('辨識失敗: ' + error.message);
            this.hideLoader();
        }
    }
        
    /**
     * 取得 CSRF Token
     */
    getCsrfToken() {
        const cookieValue = document.cookie
            .split('; ')
            .find(row => row.startsWith('csrftoken='))
            ?.split('=')[1];
        return cookieValue || '';
    }
}

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    window.cameraController = new CameraController();
    console.log('📷 CameraController 已初始化');
});