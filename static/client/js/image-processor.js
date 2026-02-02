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
    // param {Blob|File} imageSource - 影像來源
    // returns {Promise<Object>} - 處理結果
     */
    async processImage(imageSource) {
        console.log('↓ processImage() ↓');
        return new Promise((resolve, reject) => {
            const img = new Image();
            const url = URL.createObjectURL(imageSource);

            img.onload = () => {
                console.log('processImage() img.onload 觸發');
                URL.revokeObjectURL(url);
                console.log('URL.revokeObjectURL(url) 釋放資源');
                console.log('img.width:', img.width, 'img.height:', img.height);
                
                // 儲存原始影像
                this.originalCanvas.width = img.width;
                this.originalCanvas.height = img.height;
                this.originalCtx.drawImage(img, 0, 0);
                console.log('this.originalCanvas.width:', this.originalCanvas.width, 'this.originalCanvas.height:', this.originalCanvas.height);
                console.log('原始影像已繪製至 originalCanvas', img);

                // 處理影像
                const result = this.applyProcessing(img);
                resolve(result);
                console.log('processImage() 處理完成，結果:', result);
                console.log('↑ processImage() ↑');
            };

            img.onerror = () => {
                URL.revokeObjectURL(url);
                reject(new Error('影像載入失敗'));
            };

            img.src = url;
            console.log('↑ processImage() ↑');
        });        
    }

    /**
     * 應用 OCR-Friendly 處理
     */
    applyProcessing(img) {
        console.log('↓ applyProcessing() ↓');
        const width = img.width;
        const height = img.height;
        console.log('From processImage() 原始影像大小', width, height);

        // 設定處理後畫布
        this.processedCanvas.width = width;
        this.processedCanvas.height = height;
        console.log('this.processedCanvas.width:', this.processedCanvas.width, 'this.processedCanvas.height:', this.processedCanvas.height);
        this.processedCtx.drawImage(img, 0, 0);
        console.log('影像已繪製至 processedCanvas', img);

        // 取得影像資料
        let imageData = this.processedCtx.getImageData(0, 0, width, height);
        console.log('取得 imageData', imageData);
                
        // // 取得處理選項
        // const options = this.getProcessingOptions();

        // --- 新增：灰階化 (黑白化) ---
        imageData = this.grayscale(imageData);
        console.log('灰階化後的 imageData', imageData);

        // --- Normalize ---
        imageData = this.normalize(imageData);
        console.log('正規化後的 imageData', imageData);

        // 寫回畫布
        this.processedCtx.putImageData(imageData, 0, 0);
        console.log('處理後的 imageData 已寫回 processedCanvas', this.processedCanvas);

        // 計算影像品質指標
        const metrics = this.calculateMetrics(imageData);
        console.log('計算後的影像品質指標 metrics', metrics);

        console.log('處理完成的影像大小', width, height);
        console.log('↑ applyProcessing() ↑');
        return {
            width,
            height,
            metrics,
            canvas: this.processedCanvas
        };
    }

    // 灰階化函數
    grayscale(imageData) {
        console.log('↓ grayscale() ↓');
        console.log('before grayscale(imageData):', imageData);
        const data = imageData.data;
        for (let i = 0; i < data.length; i += 4) {
            // 使用加權平均值轉換為灰階
            const avg = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
            data[i] = avg;     // R
            data[i + 1] = avg; // G
            data[i + 2] = avg; // B
        }
        console.log('after grayscale(imageData):', imageData);
        console.log('↑ grayscale() ↑');
        return imageData;
    }

    // 正規化函數
    normalize(imageData) {
        console.log('↓ normalize() ↓');
        console.log('before normalize(imageData):', imageData);
        
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

        console.log('after normalize(imageData):', imageData);
        console.log('↑ normalize() ↑');
        return imageData;
    }


    /**
     * 計算影像品質指標
     */
    calculateMetrics(imageData) {
        console.log('↓ calculateMetrics() ↓');
        console.log('imageData for metrics calculation:', imageData);

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
        console.log('avgBrightness:', avgBrightness, 'sharpness:', sharpness);
        console.log('↑ calculateMetrics() ↑');
        return {
            brightness: Math.round(avgBrightness),
            sharpness: Math.round(sharpness)
        };
    }

    /**
     * 將畫布轉為 Blob
     */
    async canvasToBlob(canvas, quality = 0.95) {
        console.log('↓ canvasToBlob() ↓');
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