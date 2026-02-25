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

        // <!-- 裁切調整 -->
        this.adjustmentControls = document.getElementById('adjustmentControls');
        this.topMargin = document.getElementById('topMargin');
        this.bottomMargin = document.getElementById('bottomMargin');
        this.leftMargin = document.getElementById('leftMargin');
        this.rightMargin = document.getElementById('rightMargin');
        this.topValue = document.getElementById('topValue');
        this.bottomValue = document.getElementById('bottomValue');
        this.leftValue = document.getElementById('leftValue');
        this.rightValue = document.getElementById('rightValue');
        this.applyCropBtn = document.getElementById('applyCrop');
        this.resetAdjustmentBtn = document.getElementById('resetAdjustment');

        // <!-- 處理選項 -->
        this.processOptions = document.getElementById('processOptions');
        this.reAdjustBtn = document.getElementById('reAdjust');
        this.confirmUploadBtn = document.getElementById('confirmUpload');

        this.stream = null;
        this.currentBlob = null;
        this.originalImage = null; // 儲存原始 Image 物件
        this.detectedRect = null;  // 儲存自動偵測到的矩陣

        this.initEventListeners();
    }
    
    initEventListeners() {
        // 相機控制
        this.startCameraBtn?.addEventListener('click', () => this.start());
        this.stopCameraBtn?.addEventListener('click', () => this.stop());
        this.captureBtn?.addEventListener('click', () => this.capture());
        
        // 檔案上傳
        this.fileInput?.addEventListener('change', (e) => this.handleFile(e));
        
        // 裁切調整即時預覽
        [this.topMargin, this.bottomMargin, this.leftMargin, this.rightMargin].forEach(slider => {
            slider?.addEventListener('input', () => {
                this.updateSliderValues();
                this.drawAdjustmentPreview();
            });
        });

        this.resetAdjustmentBtn?.addEventListener('click', () => this.resetAdjustment());
        this.applyCropBtn?.addEventListener('click', () => this.applyCrop());
        this.reAdjustBtn?.addEventListener('click', () => this.showAdjustmentUI());

        // 最終上傳
        this.confirmUploadBtn?.addEventListener('click', () => this.uploadImage());
    }
    
    /**
     * 啟動相機
     */
    async start() {
        console.log('↓ start() ↓');
        if (this.stream) {
            console.warn('start() Camera already running');
            return;
        }

        console.log('start() stream:', this.stream);

        try {
            // 🔑 確保之前的資源完全釋放
            await this.ensureCleanState();
            console.log('↑ ensureCleanState() ↑');
            await new Promise(r => setTimeout(r, 200)); // 🔑 給瀏覽器釋放時間
            
            console.log('Requesting camera access...');
            this.stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: { ideal: 'environment' },
                    width: { ideal: 3000 },
                    height: { ideal: 3000 }
                },
                audio: false
            });
            console.log('start() stream:', this.stream);
            // 🔑 確保 video element 處於正確狀態
            this.video.srcObject = this.stream;
            console.log('start() this.video.srcObject:', this.video.srcObject);

            // 🔑 等待 metadata 載入
            await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => reject(new Error('Timeout waiting for video')), 5000);
                this.video.onloadedmetadata = () => {
                    clearTimeout(timeout);
                    resolve();
                };
            });

            await this.video.play(); // 🔑 確保真正啟動
            console.log('start() video playing', !this.video.paused);

            // 更新 UI 狀態
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
        console.log('↑ start() ↑');
    }
    
    /**
     * 停止相機
     */
    stop() {
        console.log('↓ stop() ↓');

        // 1. 停止所有 tracks
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
        }
        console.log('stop() this.stream before null:', this.stream);
        
        // 2. 清掉 stream reference（非常重要）
        this.stream = null;
        console.log('stop() this.stream after null:', this.stream);

        // 3. 重置 video element（Safari / Chrome 都需要）
        if (this.video) {
            console.log('stop() Resetting video element', this.video);
            // console.log('[CameraController] stop-Video element before reset:', this.video.srcObject);
            this.video.pause();
            this.video.srcObject = null;
            this.video.removeAttribute('src');
            this.video.load(); // 🔥 這行才是真正的 reset
            this.video.classList.add('d-none');
            // console.log('[CameraController] stop-Video element reset done', this.video);
            // console.log('[CameraController] stop-Video element after reset:', this.video.srcObject);
        }

        // 4. UI 回到初始狀態
        this.cameraPlaceholder?.classList.remove('d-none');
        this.startCameraBtn.classList.remove('d-none');
        this.captureBtn.classList.add('d-none');
        this.stopCameraBtn.classList.add('d-none');

        console.log('相機(可重新啟動)');
        console.log('↑ stop() ↑');
    }
    
    /**
     * 拍照
     */
    async capture() {
        console.log('↓ capture() ↓');
        console.log('capture() video size',
            this.video.videoWidth,
            this.video.videoHeight
        );

        if (!this.stream) {
            alert('請先啟動相機');
            return;
        }
        
        try {
            console.log('capture() this.stream:', this.stream);
            // 創建臨時畫布
            const canvas = document.createElement('canvas');
            canvas.width = this.video.videoWidth;
            canvas.height = this.video.videoHeight;
            console.log('capture() canvas:', canvas);

            const ctx = canvas.getContext('2d');
            ctx.drawImage(this.video, 0, 0);
            console.log('capture() canvas context:', ctx);

            // 轉為 Blob
            const blob = await new Promise(resolve => {
                canvas.toBlob(resolve, 'image/jpeg', 1);
            });
            
            console.log('capture() blob:', blob);
            
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
        console.log('↓ ensureCleanState() ↓');
        if (this.stream) {
            await this.cleanupStream();
            console.log('↑ cleanupStream() ↑');
        }
        
        if (this.video) {
            console.log('Resetting video element', this.video);
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
        console.log('↓ cleanupStream() ↓');
        if (this.stream) {
            console.log('Cleaning up stream:', this.stream);
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
        console.log('↓ handleFile() ↓');
        const file = event.target.files[0];
        if (!file) return;
        
        if (!file.type.startsWith('image/')) {
            alert('請選擇圖片檔案');
            return;
        }
        
        console.log('📁 已選擇檔案:', file.name, file.size, 'bytes');
        
        // 處理影像
        await this.processAndPreview(file);
        console.log('↑ processAndPreview() ↑');
        console.log('↑ handleFile() ↑');
    }
    
    /**
     * 處理並進入調整階段
     */
    async processAndPreview(imageSource) {
        console.log('↓ processAndPreview() ↓');
        try {
            // 載入並初步偵測
            const result = await window.imageProcessor.loadImage(imageSource);
            this.originalImage = result.img;
            this.detectedRect = result.initialRect;

            // 進入調整模式
            this.resetAdjustmentValues();
            this.showAdjustmentUI();
            this.drawAdjustmentPreview();
            
            console.log('✅ 影像載入與偵測完成');
            
        } catch (error) {
            console.error('❌ 影像處理失敗:', error);
            alert('影像處理失敗: ' + error.message);
        }
    }

    /**
     * 顯示調整介面
     */
    showAdjustmentUI() {
        this.previewContainer.classList.add('d-none');
        this.processedCanvas.classList.remove('d-none');
        this.imageInfo.classList.add('d-none');
        this.processOptions.classList.add('d-none');
        this.adjustmentControls.classList.remove('d-none');
    }

    /**
     * 重置調整值
     */
    resetAdjustmentValues() {
        this.topMargin.value = 0;
        this.bottomMargin.value = 0;
        this.leftMargin.value = 0;
        this.rightMargin.value = 0;
        this.updateSliderValues();
    }

    /**
     * 更新 Slider 數值顯示
     */
    updateSliderValues() {
        this.topValue.textContent = this.topMargin.value;
        this.bottomValue.textContent = this.bottomMargin.value;
        this.leftValue.textContent = this.leftMargin.value;
        this.rightValue.textContent = this.rightMargin.value;
    }

    /**
     * 繪製調整預覽（原圖 + 紅框）
     */
    drawAdjustmentPreview() {
        if (!this.originalImage || !this.detectedRect) return;

        const canvas = this.processedCanvas;
        const ctx = canvas.getContext('2d');

        // 設定畫布大小為原圖大小
        canvas.width = this.originalImage.width;
        canvas.height = this.originalImage.height;

        // 畫原圖
        ctx.drawImage(this.originalImage, 0, 0);

        // 計算調整後的矩形
        const rect = this.getCurrentRect();

        // 畫紅框
        ctx.strokeStyle = '#ff0000';
        ctx.lineWidth = Math.max(5, canvas.width / 200);
        ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);

        // 畫半透明遮罩
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        // 上
        ctx.fillRect(0, 0, canvas.width, rect.y);
        // 下
        ctx.fillRect(0, rect.y + rect.height, canvas.width, canvas.height - (rect.y + rect.height));
        // 左
        ctx.fillRect(0, rect.y, rect.x, rect.height);
        // 右
        ctx.fillRect(rect.x + rect.width, rect.y, canvas.width - (rect.x + rect.width), rect.height);
    }

    /**
     * 取得目前調整後的矩形
     */
    getCurrentRect() {
        const top = parseInt(this.topMargin.value);
        const bottom = parseInt(this.bottomMargin.value);
        const left = parseInt(this.leftMargin.value);
        const right = parseInt(this.rightMargin.value);

        return {
            x: Math.max(0, this.detectedRect.x + left),
            y: Math.max(0, this.detectedRect.y + top),
            width: Math.min(this.originalImage.width - (this.detectedRect.x + left), this.detectedRect.width - left + right),
            height: Math.min(this.originalImage.height - (this.detectedRect.y + top), this.detectedRect.height - top + bottom)
        };
    }

    /**
     * 套用裁切並執行 OCR Friendly 處理
     */
    async applyCrop() {
        console.log('↓ applyCrop() ↓');
        try {
            const rect = this.getCurrentRect();
            const result = await window.imageProcessor.applyFinalProcessing(this.originalImage, rect);

            if (result) {
                // 儲存最終 Blob
                this.currentBlob = await window.imageProcessor.canvasToBlob(result.canvas);

                // 顯示最終預覽
                this.updateFinalPreview(result);
            }
        } catch (error) {
            console.error('❌ 裁切處理失敗:', error);
            alert('處理失敗，請重試');
        }
    }

    /**
     * 更新最終預覽區域
     */
    updateFinalPreview(result) {
        this.adjustmentControls.classList.add('d-none');
        this.processOptions.classList.remove('d-none');
        this.imageInfo.classList.remove('d-none');

        // 更新影像資訊
        this.imageDimensions.textContent = `${result.width} × ${result.height}`;
        this.imageBrightness.textContent = `${result.metrics.brightness}/255`;
        this.imageSharpness.textContent = result.metrics.sharpness > 50 ? '良好' : '一般';
    }

    /**
     * 重置所有調整
     */
    resetAdjustment() {
        this.resetAdjustmentValues();
        this.drawAdjustmentPreview();
    }
    
    /**
     * 清空預覽
     */
    clearPreview() {
        console.log('↓ clearPreview() ↓');
        
        // 🔑 安全檢查
        if (this.previewContainer) {
            this.previewContainer.innerHTML = `
                <div class="d-flex align-items-center justify-content-center text-muted">
                    <div class="text-center text-success">
                        <i class="bi bi-image fs-1 mb-2"></i>
                        <p class="mb-0">尚未拍攝或上傳影像</p>
                    </div>
                </div>
            `;
            this.previewContainer.classList.remove('d-none');
        }
        
        if (this.processedCanvas) this.processedCanvas.classList.add('d-none');
        if (this.imageInfo) this.imageInfo.classList.add('d-none');
        if (this.processOptions) this.processOptions.classList.add('d-none');
        if (this.adjustmentControls) this.adjustmentControls.classList.add('d-none');

        this.originalImage = null;
        this.detectedRect = null;
        this.currentBlob = null;

        console.log('↑ clearPreview() ↑');
    }
    
    /**
     * 上傳影像到後端
     */
    async uploadImage() {
        console.log('↓ uploadImage() ↓');
        if (!this.currentBlob) {
            alert('請先拍照或上傳影像');
            return;
        }

        console.log('forming FormData for upload');
        const formData = new FormData();
        formData.append('image', this.currentBlob, 'invoice.jpg');
        console.log('FormData prepared:', formData);
        
        try {
            const response = await fetch('/api/process/', {
                method: 'POST',
                body: formData,
                headers: {
                    'X-CSRFToken': this.getCsrfToken()
                }
            });
            console.log('↑ getCsrfToken() ↑');
            
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
        console.log('↑ uploadImage() ↑');
    }
        
    /**
     * 取得 CSRF Token
     */
    getCsrfToken() {
        console.log('↓ getCsrfToken() ↓');
        const cookieValue = document.cookie
            .split('; ')
            .find(row => row.startsWith('csrftoken='))
            ?.split('=')[1];
        console.log('Found CSRF token:');
        return cookieValue || '';
    }
}

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    window.cameraController = new CameraController();
    console.log('↓ 📷 [CameraController] 已初始化 ↓');
});