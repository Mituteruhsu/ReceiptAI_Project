// static/client/js/image-processor.js

/**
 * OCR-Friendly 影像處理器
 * 優化影像以提高 QR Code 和 OCR 辨識率
 */
class ImageProcessor {
    constructor() {
        // <!-- 右側：預覽與處理 -->
        // <!-- 原始影像（隱藏） -->
        this.originalCanvas = document.getElementById('originalCanvas');
        
        // <!-- 處理後影像 -->
        this.processedCanvas = document.getElementById('processedCanvas');
        this.originalCtx = this.originalCanvas.getContext('2d');
        this.processedCtx = this.processedCanvas.getContext('2d');
    }

    /**
     * 載入影像並處理
     * @param {Blob|File} imageSource - 影像來源
     * @returns {Promise<Object>} - 處理結果
     */
    async processImage(imageSource) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            const url = URL.createObjectURL(imageSource);

            img.onload = () => {
                URL.revokeObjectURL(url);
                
                // 儲存原始影像
                this.originalCanvas.width = img.width;
                this.originalCanvas.height = img.height;
                this.originalCtx.drawImage(img, 0, 0);

                // 處理影像
                const result = this.applyProcessing(img);
                resolve(result);
            };

            img.onerror = () => {
                URL.revokeObjectURL(url);
                reject(new Error('影像載入失敗'));
            };

            img.src = url;
        });
    }

    /**
     * 應用 OCR-Friendly 處理
     */
    applyProcessing(img) {
        const width = img.width;
        const height = img.height;

        // 設定處理後畫布
        this.processedCanvas.width = width;
        this.processedCanvas.height = height;
        this.processedCtx.drawImage(img, 0, 0);

        // 取得影像資料
        let imageData = this.processedCtx.getImageData(0, 0, width, height);
        
        
        // // 取得處理選項
        // const options = this.getProcessingOptions();

        // --- 新增：灰階化 (黑白化) ---
        console.log('[ImageProcessor] grayscale');
        imageData = this.grayscale(imageData);

        // --- Normalize ---
        console.log('[ImageProcessor] normalize');
        imageData = this.normalize(imageData);

        // 寫回畫布
        this.processedCtx.putImageData(imageData, 0, 0);

        // 計算影像品質指標
        const metrics = this.calculateMetrics(imageData);
        console.log('[ImageProcessor] applyProcessing done', metrics);
        console.log('[ImageProcessor] width', width);
        console.log('[ImageProcessor] height', height);
        console.log('[ImageProcessor] processedCanvas', this.processedCanvas);

        return {
            width,
            height,
            metrics,
            canvas: this.processedCanvas
        };
    }

    // 灰階化函數
    grayscale(imageData) {
        const data = imageData.data;
        for (let i = 0; i < data.length; i += 4) {
            // 使用加權平均值轉換為灰階
            const avg = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
            data[i] = avg;     // R
            data[i + 1] = avg; // G
            data[i + 2] = avg; // B
        }
        return imageData;
    }

    // 正規化函數
    normalize(imageData) {
        const data = imageData.data;
        let sum = 0, sq = 0, n = data.length / 4;

        for (let i = 0; i < data.length; i += 4) {
            sum += data[i];
            sq += data[i] * data[i];
        }

        const mean = sum / n;
        const std = Math.sqrt(sq / n - mean * mean) || 1;

        for (let i = 0; i < data.length; i += 4) {
            let v = (data[i] - mean) / std * 40 + 128;
            v = Math.max(0, Math.min(255, v));
            data[i] = data[i+1] = data[i+2] = v;
        }

        return imageData;
    }


    /**
     * 計算影像品質指標
     */
    calculateMetrics(imageData) {
        const data = imageData.data;
        let totalBrightness = 0;
        let edges = 0;

        // 計算平均亮度
        for (let i = 0; i < data.length; i += 4) {
            const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
            totalBrightness += gray;
        }

        const avgBrightness = totalBrightness / (data.length / 4);

        // 簡易邊緣檢測（清晰度指標）
        const width = imageData.width;
        for (let i = 0; i < data.length - width * 4; i += 4) {
            const gray1 = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
            const gray2 = 0.299 * data[i + width * 4] + 0.587 * data[i + width * 4 + 1] + 0.114 * data[i + width * 4 + 2];
            edges += Math.abs(gray1 - gray2);
        }

        const sharpness = edges / (data.length / 4);

        return {
            brightness: Math.round(avgBrightness),
            sharpness: Math.round(sharpness)
        };
    }

    /**
     * 將畫布轉為 Blob
     */
    async canvasToBlob(canvas, quality = 0.95) {
        console.log('[ImageProcessor] canvasToBlob');
        return new Promise((resolve) => {
            canvas.toBlob((blob) => {
                resolve(blob);
            }, 'image/jpeg', quality);
        });
    }

    /**
     * 重新處理（當使用者調整選項後）
     */
    async reprocess() {
        // 從原始畫布重新處理
        const img = new Image();
        img.onload = () => {
            const result = this.applyProcessing(img);
            window.cameraController.updatePreview(result);
        };
        img.src = this.originalCanvas.toDataURL();
    }
}

// 全域初始化
document.addEventListener('DOMContentLoaded', () => {
    window.imageProcessor = new ImageProcessor();
    
    // 重新處理按鈕
    document.getElementById('reprocess')?.addEventListener('click', () => {
        window.imageProcessor.reprocess();
    });
});