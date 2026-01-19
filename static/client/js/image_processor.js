// client/templates/client/js/image_processor.js
/**
 * 影像處理模組 - 提供基本的影像分析和標準化功能
 * 
 * 重要說明：
 * - 這是「有限度」的 AI 協助前端功能
 * - 目的是提供使用者指引，不用於保證可用性
 * - 最終品質評估由後端進行
 */

class ImageProcessor {
    constructor() {
        this.canvas = document.getElementById('canvas');
        this.ctx = this.canvas.getContext('2d');
    }

    /**
     * 計算清晰度（使用 Laplacian variance）
     * 結果: 0-100 (越高越清晰)
     */
    calculateSharpness(imageData) {
        if (typeof cv === 'undefined') {
            console.warn('OpenCV 未加載，使用簡單清晰度檢測');
            return this.simpleSharpnessDetection(imageData);
        }

        try {
            let src = cv.matFromImageData(imageData);
            let gray = new cv.Mat();
            let lap = new cv.Mat();

            cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
            cv.Laplacian(gray, lap, cv.CV_64F);

            let mean = new cv.Mat();
            let stdDev = new cv.Mat();
            cv.meanStdDev(lap, mean, stdDev);

            // 提取標準差（標準差越大表示梯度越多）
            const variance = stdDev.doubleAt(0, 0) ** 2;
            
            // 正規化到 0-100
            const sharpness = Math.min(100, Math.max(0, variance / 50));

            src.delete();
            gray.delete();
            lap.delete();
            mean.delete();
            stdDev.delete();

            return Math.round(sharpness);
        } catch (error) {
            console.error('清晰度計算失敗:', error);
            return 50;
        }
    }

    /**
     * 簡單清晰度檢測（OpenCV 不可用時使用）
     */
    simpleSharpnessDetection(imageData) {
        const data = imageData.data;
        let edgeCount = 0;
        const threshold = 30;

        for (let i = 0; i < data.length; i += 4) {
            const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
            
            if (i + 4 < data.length) {
                const nextGray = data[i + 4] * 0.299 + data[i + 5] * 0.587 + data[i + 6] * 0.114;
                if (Math.abs(gray - nextGray) > threshold) {
                    edgeCount++;
                }
            }
        }

        return Math.min(100, Math.round((edgeCount / (data.length / 4)) * 100));
    }

    /**
     * 計算亮度
     * 結果: 0-255
     */
    calculateBrightness(imageData) {
        const data = imageData.data;
        let sum = 0;

        for (let i = 0; i < data.length; i += 4) {
            sum += data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
        }

        return Math.round(sum / (data.length / 4));
    }

    /**
     * 計算對比度
     * 結果: 0-100
     */
    calculateContrast(imageData) {
        const data = imageData.data;
        const mean = this.calculateBrightness(imageData);
        let variance = 0;

        for (let i = 0; i < data.length; i += 4) {
            const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
            variance += (gray - mean) ** 2;
        }

        variance = Math.sqrt(variance / (data.length / 4));
        // 正規化到 0-100
        return Math.min(100, Math.round((variance / 128) * 100));
    }

    /**
     * 檢測發票區域（使用邊界檢測）
     * 返回最大的白色矩形
     */
    detectInvoiceArea() {
        if (typeof cv === 'undefined') {
            console.warn('OpenCV 未加載，無法進行區域檢測');
            return null;
        }

        try {
            let src = cv.imread(this.canvas);
            let gray = new cv.Mat();
            let edges = new cv.Mat();
            let binary = new cv.Mat();

            // 轉換為灰度
            cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

            // 二值化（對發票紙張進行檢測）
            cv.threshold(gray, binary, 200, 255, cv.THRESH_BINARY);

            // 邊界檢測
            cv.Canny(binary, edges, 50, 150);

            // 尋找輪廓
            let contours = new cv.MatVector();
            let hierarchy = new cv.Mat();
            cv.findContours(edges, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

            let maxArea = 0;
            let bestRect = null;

            // 尋找最大的矩形
            for (let i = 0; i < contours.size(); i++) {
                let rect = cv.boundingRect(contours.get(i));
                let area = rect.width * rect.height;

                // 篩選合理的發票尺寸
                if (area > maxArea && this.isValidInvoiceSize(rect, this.canvas.width, this.canvas.height)) {
                    maxArea = area;
                    bestRect = rect;
                }
            }

            src.delete();
            gray.delete();
            edges.delete();
            binary.delete();
            contours.delete();
            hierarchy.delete();

            return bestRect;
        } catch (error) {
            console.error('區域檢測失敗:', error);
            return null;
        }
    }

    /**
     * 驗證發票尺寸是否合理
     */
    isValidInvoiceSize(rect, canvasWidth, canvasHeight) {
        const minWidth = canvasWidth * 0.3;
        const minHeight = canvasHeight * 0.3;
        const maxWidth = canvasWidth * 0.95;
        const maxHeight = canvasHeight * 0.95;
        const aspectRatioMin = 0.5; // 寬高比下限
        const aspectRatioMax = 3; // 寬高比上限

        const width = rect.width;
        const height = rect.height;
        const aspectRatio = width / height;

        return width >= minWidth &&
               height >= minHeight &&
               width <= maxWidth &&
               height <= maxHeight &&
               aspectRatio >= aspectRatioMin &&
               aspectRatio <= aspectRatioMax;
    }

    /**
     * 修正影像方向（根據 EXIF）
     * 注: 前端無法直接讀取 EXIF，交由後端處理
     */
    fixOrientation() {
        console.log('EXIF 修正將在後端進行');
    }

    /**
     * 標準化影像（resize、enhance）
     * @param {Canvas} sourceCanvas - 來源 canvas
     * @param {number} maxWidth - 最大寬度
     * @param {number} maxHeight - 最大高度
     */
    normalizeImage(sourceCanvas, maxWidth = 2048, maxHeight = 2048) {
        const targetCanvas = document.createElement('canvas');
        const ctx = targetCanvas.getContext('2d');

        let width = sourceCanvas.width;
        let height = sourceCanvas.height;

        // 計算縮放比例
        if (width > maxWidth || height > maxHeight) {
            const ratio = Math.min(maxWidth / width, maxHeight / height);
            width = Math.round(width * ratio);
            height = Math.round(height * ratio);
        }

        targetCanvas.width = width;
        targetCanvas.height = height;

        ctx.drawImage(sourceCanvas, 0, 0, width, height);

        return targetCanvas;
    }

    /**
     * 輕微銳化影像
     * @param {ImageData} imageData - 影像數據
     */
    sharpenImage(imageData) {
        const data = imageData.data;
        const width = imageData.width;
        const height = imageData.height;

        // 簡單銳化核心
        const kernel = [
            0, -0.25, 0,
            -0.25, 2, -0.25,
            0, -0.25, 0
        ];

        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                for (let c = 0; c < 3; c++) {
                    let sum = 0;
                    let idx = 0;

                    for (let ky = -1; ky <= 1; ky++) {
                        for (let kx = -1; kx <= 1; kx++) {
                            const pixelIdx = ((y + ky) * width + (x + kx)) * 4 + c;
                            sum += data[pixelIdx] * kernel[idx];
                            idx++;
                        }
                    }

                    const pixelIdx = (y * width + x) * 4 + c;
                    data[pixelIdx] = Math.max(0, Math.min(255, sum));
                }
            }
        }

        return imageData;
    }

    /**
     * 增加對比度
     * @param {ImageData} imageData - 影像數據
     * @param {number} factor - 對比度因子 (1.0 = 無變化, > 1.0 = 增加)
     */
    enhanceContrast(imageData, factor = 1.2) {
        const data = imageData.data;
        const mean = 128; // 假設均值為 128

        for (let i = 0; i < data.length; i += 4) {
            for (let c = 0; c < 3; c++) {
                data[i + c] = Math.max(0, Math.min(255, 
                    mean + (data[i + c] - mean) * factor
                ));
            }
        }

        return imageData;
    }

    /**
     * 獲取影像品質報告
     */
    getQualityReport() {
        const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
        
        return {
            sharpness: this.calculateSharpness(imageData),
            brightness: this.calculateBrightness(imageData),
            contrast: this.calculateContrast(imageData),
            invoiceRect: this.detectInvoiceArea()
        };
    }
}
