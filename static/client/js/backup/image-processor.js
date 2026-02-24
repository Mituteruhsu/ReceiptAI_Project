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
                // console.log('img.width:', img.width, 'img.height:', img.height);
                
                // 儲存原始影像
                this.originalCanvas.width = img.width;
                this.originalCanvas.height = img.height;
                this.originalCtx.drawImage(img, 0, 0);
                // console.log('this.originalCanvas.width:', this.originalCanvas.width, 'this.originalCanvas.height:', this.originalCanvas.height);
                // console.log('原始影像已繪製至 originalCanvas', img);

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

        // --- 邊緣偵測（Sobel） ---
        const edges = this.detectEdges(imageData);
        console.log('邊緣偵測後的 edges', edges);

        // --- 找發票外框（Bounding Box） ---
        const box = this.findBoundingBox(edges);
        console.log('找到的發票外框 box', box);

        // --- 裁切到發票外框 ---
        imageData = this.cropToBox(imageData, box);
        console.log('裁切後的 imageData', imageData);

        // --- adaptiveThreshold (自適應二值化) ---
        imageData = this.adaptiveThreshold(imageData, 21, 7);
        console.log('自適應二值化後的 imageData', imageData);

        // // --- 可選擇性加入 Morphology 處理 ---
        // imageData = this.morphClose(imageData);
        // console.log('Morphology 處理後的 imageData', imageData);

        // // 寫回畫布
        // this.processedCtx.putImageData(imageData, 0, 0);
        // console.log('處理後的 imageData 已寫回 processedCanvas', this.processedCanvas);

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

    // 自適應二值化函數
    adaptiveThreshold(imageData, blockSize = 21, C = 7) {
        console.log('↓ adaptiveThreshold() ↓');
        console.log('before adaptiveThreshold(imageData):', imageData);
        const { width, height, data } = imageData;
        const output = new Uint8ClampedArray(data.length);
        const half = Math.floor(blockSize / 2);

        // 積分影像（Integral Image）
        const integral = new Uint32Array(width * height);

        for (let y = 0; y < height; y++) {
            let rowSum = 0;
            for (let x = 0; x < width; x++) {
                const idx = (y * width + x) * 4;
                const gray = data[idx]; // R channel
                rowSum += gray;
                const above = y > 0 ? integral[(y - 1) * width + x] : 0;
                integral[y * width + x] = rowSum + above;
            }
        }

        // threshold
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const x1 = Math.max(x - half, 0);
                const y1 = Math.max(y - half, 0);
                const x2 = Math.min(x + half, width - 1);
                const y2 = Math.min(y + half, height - 1);

                const area = (x2 - x1 + 1) * (y2 - y1 + 1);

                const A = integral[y2 * width + x2];
                const B = y1 > 0 ? integral[(y1 - 1) * width + x2] : 0;
                const C_ = x1 > 0 ? integral[y2 * width + (x1 - 1)] : 0;
                const D = (x1 > 0 && y1 > 0) ? integral[(y1 - 1) * width + (x1 - 1)] : 0;

                const mean = (A - B - C_ + D) / area;
                const idx = (y * width + x) * 4;
                const val = data[idx] < (mean - C) ? 0 : 255;

                output[idx] = output[idx + 1] = output[idx + 2] = val;
                output[idx + 3] = 255;
            }
        }

        imageData.data.set(output);
        console.log('↑ adaptiveThreshold() ↑');
        return imageData;
    }

    // Morphology 函數（可選擇性加入）
    morphClose(imageData) {
        console.log('↓ morphClose() ↓');
        imageData = this.dilate(imageData, 3);
        imageData = this.erode(imageData, 3);
        console.log('↑ morphClose() ↑');
        return imageData;
    }

    // 膨脹(Dilation) 和 腐蝕(Erosion) 可根據需要實現
    dilate(imageData, kernelSize = 3) {
        console.log('↓ dilate() ↓');
        const { width, height, data } = imageData;
        const output = new Uint8ClampedArray(data.length);
        const half = Math.floor(kernelSize / 2);

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                let max = 0;

                for (let ky = -half; ky <= half; ky++) {
                    for (let kx = -half; kx <= half; kx++) {
                        const ny = y + ky;
                        const nx = x + kx;
                        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
                        const idx = (ny * width + nx) * 4;
                        max = Math.max(max, data[idx]);
                    }
                }

                const i = (y * width + x) * 4;
                output[i] = output[i + 1] = output[i + 2] = max;
                output[i + 3] = 255;
            }
        }

        imageData.data.set(output);
        console.log('↑ dilate() ↑');
        return imageData;
    }

    // 腐蝕函數
    erode(imageData, kernelSize = 3) {
        console.log('↓ erode() ↓');
        const { width, height, data } = imageData;
        const output = new Uint8ClampedArray(data.length);
        const half = Math.floor(kernelSize / 2);

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                let min = 255;

                for (let ky = -half; ky <= half; ky++) {
                    for (let kx = -half; kx <= half; kx++) {
                        const ny = y + ky;
                        const nx = x + kx;
                        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
                        const idx = (ny * width + nx) * 4;
                        min = Math.min(min, data[idx]);
                    }
                }

                const i = (y * width + x) * 4;
                output[i] = output[i + 1] = output[i + 2] = min;
                output[i + 3] = 255;
            }
        }

        imageData.data.set(output);
        console.log('↑ erode() ↑');
        return imageData;
    }

    // ==========================
    // 邊緣偵測（Sobel）
    detectEdges(imageData) {
        const { width, height, data } = imageData;
        const output = new Uint8ClampedArray(data.length);

        const gx = [-1,0,1,-2,0,2,-1,0,1];
        const gy = [-1,-2,-1,0,0,0,1,2,1];

        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                let sx = 0, sy = 0;
                let k = 0;

                for (let ky = -1; ky <= 1; ky++) {
                    for (let kx = -1; kx <= 1; kx++) {
                        const i = ((y + ky) * width + (x + kx)) * 4;
                        const v = data[i];
                        sx += v * gx[k];
                        sy += v * gy[k];
                        k++;
                    }
                }

                const mag = Math.sqrt(sx * sx + sy * sy);
                const idx = (y * width + x) * 4;
                output[idx] = output[idx+1] = output[idx+2] = mag > 128 ? 255 : 0;
                output[idx+3] = 255;
            }
        }

        imageData.data.set(output);
        return imageData;
    }

    // 找發票外框（Bounding Box）
    findBoundingBox(imageData) {
        const { width, height, data } = imageData;
        let minX = width, minY = height, maxX = 0, maxY = 0;

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const i = (y * width + x) * 4;
                if (data[i] > 0) {
                    minX = Math.min(minX, x);
                    minY = Math.min(minY, y);
                    maxX = Math.max(maxX, x);
                    maxY = Math.max(maxY, y);
                }
            }
        }

        return { minX, minY, maxX, maxY };
    }

    // 裁切到發票外框
    cropToBox(imageData, box) {
        const { minX, minY, maxX, maxY } = box;
        const w = maxX - minX;
        const h = maxY - minY;

        const cropped = this.processedCtx.createImageData(w, h);

        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const src = ((y + minY) * imageData.width + (x + minX)) * 4;
                const dst = (y * w + x) * 4;
                cropped.data[dst]     = imageData.data[src];
                cropped.data[dst + 1] = imageData.data[src + 1];
                cropped.data[dst + 2] = imageData.data[src + 2];
                cropped.data[dst + 3] = 255;
            }
        }

        this.processedCanvas.width = w;
        this.processedCanvas.height = h;
        this.processedCtx.putImageData(cropped, 0, 0);

        return cropped;
    }

    // 自動旋轉校正
    estimateSkewAngle(imageData) {
        const { width, height, data } = imageData;
        let sumAngle = 0, count = 0;

        for (let y = 0; y < height - 1; y++) {
            for (let x = 0; x < width - 1; x++) {
                const i = (y * width + x) * 4;
                if (data[i] === 255 && data[i + 4] === 255) {
                    sumAngle += 0;
                    count++;
                }
            }
        }

        return count ? (sumAngle / count) : 0;
    }

    // 旋轉畫布
    rotateCanvas(angle) {
        const rad = angle * Math.PI / 180;
        const w = this.processedCanvas.width;
        const h = this.processedCanvas.height;

        const temp = document.createElement('canvas');
        temp.width = w;
        temp.height = h;
        const tctx = temp.getContext('2d');
        tctx.drawImage(this.processedCanvas, 0, 0);

        this.processedCtx.clearRect(0, 0, w, h);
        this.processedCtx.save();
        this.processedCtx.translate(w / 2, h / 2);
        this.processedCtx.rotate(rad);
        this.processedCtx.drawImage(temp, -w / 2, -h / 2);
        this.processedCtx.restore();
    }
    // ==========================

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
    async canvasToBlob(canvas, quality = 1) {
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
        console.trace('↓ reprocess() ↓');
        // 從原始畫布重新處理
        const img = new Image();
        img.onload = () => {
            const result = this.applyProcessing(img);
            window.cameraController.updatePreview(result);
        };
        img.src = this.originalCanvas.toDataURL();
        console.log('↑ reprocess() ↑');
    }
}

// 全域初始化
document.addEventListener('DOMContentLoaded', () => {
    window.imageProcessor = new ImageProcessor();
    console.log('↓ 🖼️ [ImageProcessor] 初始化 ↓');
});