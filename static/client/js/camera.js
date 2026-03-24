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

        // <!-- 影像資訊 -->
        this.imageInfo = document.getElementById('imageInfo');
        this.imageDimensions = document.getElementById('imageDimensions');
        this.imageBrightness = document.getElementById('imageBrightness');
        this.imageSharpness = document.getElementById('imageSharpness');

        // <!-- 處理選項 -->
        this.processOptions = document.getElementById('processOptions');
        this.reprocessBtn = document.getElementById('reprocess');
        this.confirmUploadBtn = document.getElementById('confirmUpload');

        // Crop controls
        this.topMargin = null;
        this.bottomMargin = null;
        this.leftMargin = null;
        this.rightMargin = null;
        this.topValue = null;
        this.bottomValue = null;
        this.leftValue = null;
        this.rightValue = null;
        this.topNarrow = null;
        this.bottomNarrow = null;
        this.rotateAngle = null;
        this.topNarrowValue = null;
        this.bottomNarrowValue = null;
        this.rotateAngleValue = null;
        this.resetCropBtn = document.getElementById('resetCropBtn');
        
        // New canvases
        this.canvasResult = document.getElementById('canvasResult');
        this.canvasCropped = document.getElementById('canvasCropped');

        this.stream = null;
        this.currentBlob = null;
        this.isStarting = false;

        this.initEventListeners();
        this.initCropTouch();
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
        
        // 重新整理
        this.reprocessBtn?.addEventListener('click', async () => await window.imageProcessor.reprocess());

        // 取消裁切拉桿事件（改用拖曳）

        this.resetCropBtn?.addEventListener('click', () => {
            if (this.topMargin) this.topMargin.value = 0;
            if (this.bottomMargin) this.bottomMargin.value = 0;
            if (this.leftMargin) this.leftMargin.value = 0;
            if (this.rightMargin) this.rightMargin.value = 0;
            if (this.topNarrow) this.topNarrow.value = 0;
            if (this.bottomNarrow) this.bottomNarrow.value = 0;
            if (this.rotateAngle) this.rotateAngle.value = 0;
            
            if (this.topValue) this.topValue.textContent = 0;
            if (this.bottomValue) this.bottomValue.textContent = 0;
            if (this.leftValue) this.leftValue.textContent = 0;
            if (this.rightValue) this.rightValue.textContent = 0;
            if (this.topNarrowValue) this.topNarrowValue.textContent = 0;
            if (this.bottomNarrowValue) this.bottomNarrowValue.textContent = 0;
            if (this.rotateAngleValue) this.rotateAngleValue.textContent = 0;

            window.imageProcessor.updateCrop();
        });
    }

    // 依目前輸入更新 UI 顯示（百分比）
    updateCropRangeLimits() {
        if (this.topValue) this.topValue.textContent = this.topMargin?.value ?? 0;
        if (this.bottomValue) this.bottomValue.textContent = this.bottomMargin?.value ?? 0;
        if (this.leftValue) this.leftValue.textContent = this.leftMargin?.value ?? 0;
        if (this.rightValue) this.rightValue.textContent = this.rightMargin?.value ?? 0;
        if (this.topNarrowValue) this.topNarrowValue.textContent = this.topNarrow?.value ?? 0;
        if (this.bottomNarrowValue) this.bottomNarrowValue.textContent = this.bottomNarrow?.value ?? 0;
        if (this.rotateAngleValue) this.rotateAngleValue.textContent = this.rotateAngle?.value ?? 0;
    }

    // 去抖：避免拖拉滑桿時每次都重算 OpenCV
    debouncedUpdateCrop() {
        clearTimeout(this._cropTimer);
        this._cropTimer = setTimeout(() => {
            window.imageProcessor.updateCrop();
        }, 80);
    }

    // 觸控/滑鼠拖曳裁切四角
    initCropTouch() {
        const canvas = this.canvasResult;
        if (!canvas) return;

        const getPoints = () => window.imageProcessor.getCropPoints?.();
        const setPoints = (pts) => window.imageProcessor.setCropPoints?.(pts);
        let activeIdx = -1;
        let rafId = null;
        let pendingPos = null;

        const getPos = (e) => {
            const rect = canvas.getBoundingClientRect();
            const x = (e.clientX - rect.left) * (canvas.width / rect.width);
            const y = (e.clientY - rect.top) * (canvas.height / rect.height);
            return { x, y };
        };

        const hitTest = (pos, pts) => {
            const r = 70;
            for (let i = 0; i < pts.length; i++) {
                const dx = pts[i].x - pos.x;
                const dy = pts[i].y - pos.y;
                if (dx * dx + dy * dy <= r * r) return i;
            }
            return -1;
        };

        const onStart = (e) => {
            const pts = getPoints();
            if (!pts || pts.length !== 4) return;
            const pos = getPos(e);
            activeIdx = hitTest(pos, pts);
            if (activeIdx !== -1) {
                e.preventDefault();
                window.imageProcessor.setDragActive?.(true);
                if (e.pointerId != null) {
                    canvas.setPointerCapture(e.pointerId);
                }
            }
        };

        const onMove = (e) => {
            if (activeIdx === -1) return;
            pendingPos = getPos(e);
            if (rafId == null) {
                rafId = requestAnimationFrame(() => {
                    const pts = getPoints();
                    if (pts && pendingPos) {
                        pts[activeIdx] = { x: pendingPos.x, y: pendingPos.y };
                        setPoints(pts);
                    }
                    rafId = null;
                });
            }
            e.preventDefault();
        };

        const onEnd = (e) => {
            activeIdx = -1;
            window.imageProcessor.setDragActive?.(false);
            if (e && e.pointerId != null) {
                try { canvas.releasePointerCapture(e.pointerId); } catch {}
            }
        };

        canvas.style.touchAction = 'none';
        // Pointer Events 支援滑鼠 + 觸控
        canvas.addEventListener('pointerdown', onStart, { passive: false });
        canvas.addEventListener('pointermove', onMove, { passive: false });
        canvas.addEventListener('pointerup', onEnd);
        canvas.addEventListener('pointercancel', onEnd);
    }
    
    /* 啟動相機 */
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
    
    /* 停止相機 */
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
    
    /* 拍照 */
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
            
            // 處理影像（拍照會先存檔）
            await this.processAndPreview(blob, { saveToStatic: true, overwriteOriginal: true });
            
        } catch (error) {
            console.error('❌ 拍照失敗:', error);
            alert('拍照失敗，請重試');
        }
    }

    /** 🔑 確保乾淨的初始狀態 */
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
        
        // 處理影像（選檔會存檔，但不覆蓋原始相片；手機拍照例外）
        const overwriteOriginal = this.shouldOverwriteOriginalForFile(file);
        await this.processAndPreview(file, { saveToStatic: true, overwriteOriginal });
        console.log('↑ processAndPreview() ↑');
        console.log('↑ handleFile() ↑');
    }

    isMobileDevice() {
        return /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    }

    shouldOverwriteOriginalForFile(file) {
        if (!this.isMobileDevice()) return false;
        const captureAttr = this.fileInput?.getAttribute('capture');
        if (captureAttr) return true;

        const name = (file?.name || '').toLowerCase();
        const looksLikeCameraName =
            name === 'image.jpg' ||
            name === 'image.jpeg' ||
            name === 'image.png' ||
            name.startsWith('img_') ||
            name.startsWith('image_') ||
            name.startsWith('capture_');
        if (!looksLikeCameraName) return false;

        const now = Date.now();
        const recent = Math.abs(now - (file?.lastModified || 0)) < 2 * 60 * 1000;
        return recent;
    }

    /* 先儲存影像到 static/imgs，再回傳可存取的 URL */
    async saveImageToStatic(imageSource, { overwriteOriginal = false, filename = null } = {}) {
        const formData = new FormData();
        const uploadFilename = imageSource?.name || `capture_${Date.now()}.jpg`;
        formData.append('image', imageSource, uploadFilename);
        if (overwriteOriginal) {
            formData.append('overwrite', '1');
            if (filename) {
                formData.append('filename', filename);
            }
        }

        const response = await fetch('/api/save-image/', {
            method: 'POST',
            body: formData,
            headers: {
                'X-CSRFToken': this.getCsrfToken()
            }
        });

        if (!response.ok) {
            throw new Error(`save-image HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        if (!data.success) {
            throw new Error(data.error || '影像儲存失敗');
        }

        return data;
    }
    
    /* 處理並預覽影像 */
    async processAndPreview(imageSource, { saveToStatic = true, overwriteOriginal = false } = {}) {
        console.log('↓ processAndPreview() ↓');
        try {
            console.log('processAndPreview() input:', imageSource);

            let processingSource = imageSource;
            if (saveToStatic) {
                // 先儲存到 static/imgs，再以儲存後的檔案進行處理
                const saved = await this.saveImageToStatic(imageSource, {
                    overwriteOriginal,
                    filename: overwriteOriginal ? 'capture_original' : null
                });
                this.savedImageUrl = saved.url;
                const savedResponse = await fetch(saved.url, { cache: 'no-store' });
                if (!savedResponse.ok) {
                    throw new Error(`讀取已儲存影像失敗：HTTP ${savedResponse.status}`);
                }
                processingSource = await savedResponse.blob();
            }

            /*
            image-processor.js
            ImageProcessor.processImage(imageSource) 處理
            */
            const result = await window.imageProcessor.processImage(processingSource);
            console.log('processImage() result:', result);

            // 儲存處理後的 Blob
            this.currentBlob = await window.imageProcessor.canvasToBlob(result.canvas);
            console.log('canvasToBlob() result:', this.currentBlob);
            console.log('↑ canvasToBlob() ↑');

            // 更新預覽
            this.updatePreview(result);
            this.updateCropRangeLimits();
            
            console.log('✅ 影像處理完成:', result);
            
        } catch (error) {
            console.error('❌ 影像處理失敗:', error);
            alert('影像處理失敗: ' + error.message);
        }
    }
    
    /* 更新預覽區域 */
    updatePreview(result) {
        console.log('↓ updatePreview() ↓');
        
        // 隱藏 placeholder
        const placeholder = this.previewContainer.querySelector('.text-muted');
        if (placeholder) placeholder.classList.add('d-none');
        
        this.previewContainer.classList.add('showing-image');
        
        // 顯示偵測結果與裁切預覽
        this.canvasResult?.classList.remove('d-none');
        this.canvasCropped?.classList.remove('d-none');
        
        // 顯示灰階/對比預覽
        
        // 更新影像資訊
        this.imageDimensions.textContent = `${result.width} × ${result.height}`;
        this.imageBrightness.textContent = `${result.metrics.brightness}/255`;
        this.imageSharpness.textContent = result.metrics.sharpness > 50 ? '良好' : '一般';
        
        this.imageInfo.classList.remove('d-none');
        this.processOptions.classList.remove('d-none');
        console.log('↑ updatePreview() ↑');
    }
    
    /* 清空預覽 */
    clearPreview() {
        console.log('↓ clearPreview() ↓');
        
        // 顯示 placeholder
        const placeholder = this.previewContainer?.querySelector('.text-muted');
        if (placeholder) placeholder.classList.remove('d-none');
        
        if (this.canvasResult) this.canvasResult.classList.add('d-none');
        if (this.canvasCropped) this.canvasCropped.classList.add('d-none');
        if (this.imageInfo) this.imageInfo.classList.add('d-none');
        if (this.processOptions) this.processOptions.classList.add('d-none');

        // 重置裁切拉桿
        if (this.resetCropBtn) this.resetCropBtn.click();

        console.log('↑ clearPreview() ↑');
    }
    
    /* 上傳影像到後端 */
    async uploadImage() {
        console.log('↓ uploadImage() ↓');
        if (!this.currentBlob) {
            alert('請先拍照或上傳影像');
            return;
        }

        console.log('forming FormData for upload');

        // 從 OCR 裁切畫布取得最終影像（預覽畫布為彩色，OCR 仍用黑白）
        const ocrCanvas = window.imageProcessor?.getCroppedOcrCanvas?.();
        if (ocrCanvas) {
            this.currentBlob = await window.imageProcessor.canvasToBlob(ocrCanvas);
        } else if (this.canvasCropped) {
            this.currentBlob = await window.imageProcessor.canvasToBlob(this.canvasCropped);
        }

        // 送出前先把 OCR friendly 圖檔存到 static/imgs
        let saved = null;
        try {
            saved = await this.saveImageToStatic(this.currentBlob, { overwriteOriginal: false });
            this.savedImageUrl = saved.url;
        } catch (error) {
            console.error('❌ 儲存 OCR 圖檔失敗:', error);
            alert('儲存 OCR 圖檔失敗: ' + error.message);
            return;
        }

        const formData = new FormData();
        formData.append('image', this.currentBlob, saved?.filename || 'invoice.jpg');
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
        
    /* 取得 CSRF Token */
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
