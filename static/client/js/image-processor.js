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
     * 載入影像並準備進行偵測
     * @param {Blob|File} imageSource - 影像來源
     * @returns {Promise<Object>} - 包含載入的圖片與初步偵測結果
     */
    async loadImage(imageSource) {
        console.log('↓ loadImage() ↓');
        return new Promise((resolve, reject) => {
            const img = new Image();
            const url = URL.createObjectURL(imageSource);

            img.onload = () => {
                URL.revokeObjectURL(url);
                
                // 儲存原始影像到隱藏畫布
                this.originalCanvas.width = img.width;
                this.originalCanvas.height = img.height;
                this.originalCtx.drawImage(img, 0, 0);

                // 執行初步偵測
                const initialRect = this.detectInvoiceBoundary(img);

                resolve({
                    img: img,
                    initialRect: initialRect
                });
            };

            img.onerror = () => {
                URL.revokeObjectURL(url);
                reject(new Error('影像載入失敗'));
            };

            img.src = url;
        });        
    }

    /**
     * 第一階段：偵測發票邊界
     * 使用 OpenCV.js 尋找文字密集區域
     */
    detectInvoiceBoundary(img) {
        console.log('↓ detectInvoiceBoundary() ↓');
        if (typeof cv === 'undefined') {
            console.error('OpenCV.js not loaded');
            return null;
        }

        let src = cv.imread(img);
        let gray = new cv.Mat();
        let blur = new cv.Mat();
        let binary = new cv.Mat();
        let edges = new cv.Mat();

        // 1. 灰階 + 模糊
        cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
        cv.GaussianBlur(gray, blur, new cv.Size(5, 5), 0);

        // 2. 自適應二值化（反相，使文字變白）
        cv.adaptiveThreshold(
            blur, binary, 255,
            cv.ADAPTIVE_THRESH_GAUSSIAN_C,
            cv.THRESH_BINARY_INV,
            15, 10
        );

        // 3. 邊緣偵測 + 膨脹（聚合文字區塊）
        cv.Canny(binary, edges, 40, 120);
        let kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(25, 25));
        cv.dilate(edges, edges, kernel);

        // 4. 尋找輪廓
        let contours = new cv.MatVector();
        let hierarchy = new cv.Mat();
        cv.findContours(edges, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

        let rects = [];
        const minArea = 800;
        const marginRatio = 0.02;
        const marginX = src.cols * marginRatio;
        const marginY = src.rows * marginRatio;

        for (let i = 0; i < contours.size(); i++) {
            let rect = cv.boundingRect(contours.get(i));
            let area = rect.width * rect.height;

            // 排除太小的區域或太靠近邊緣的噪音
            if (area < minArea) continue;
            if (rect.x <= marginX || rect.y <= marginY ||
                (rect.x + rect.width) >= (src.cols - marginX) ||
                (rect.y + rect.height) >= (src.rows - marginY)) {
                continue;
            }
            rects.push(rect);
        }

        let finalRect = null;
        if (rects.length > 0) {
            // 合併重疊或相近的框 (簡化版：先找最大框，再併入垂直方向重疊的框)
            let maxRect = rects.reduce((prev, curr) =>
                (curr.width * curr.height > prev.width * prev.height) ? curr : prev
            );

            let verticalOverlapRects = rects.filter(r => {
                return !(r.x + r.width < maxRect.x || r.x > maxRect.x + maxRect.width);
            });

            let minX = Math.min(...verticalOverlapRects.map(r => r.x));
            let maxX = Math.max(...verticalOverlapRects.map(r => r.x + r.width));
            let minY = Math.min(...verticalOverlapRects.map(r => r.y));
            let maxY = Math.max(...verticalOverlapRects.map(r => r.y + r.height));

            finalRect = {
                x: minX,
                y: minY,
                width: maxX - minX,
                height: maxY - minY
            };
        } else {
            // 若偵測失敗，預設取中間 80% 區域
            finalRect = {
                x: Math.round(src.cols * 0.1),
                y: Math.round(src.rows * 0.1),
                width: Math.round(src.cols * 0.8),
                height: Math.round(src.rows * 0.8)
            };
        }

        // 清理記憶體
        src.delete(); gray.delete(); blur.delete(); binary.delete();
        edges.delete(); kernel.delete(); contours.delete(); hierarchy.delete();

        console.log('偵測結果:', finalRect);
        return finalRect;
    }

    /**
     * 第二階段：套用最終裁切與 OCR 優化處理
     */
    applyFinalProcessing(img, box) {
        console.log('↓ applyFinalProcessing() ↓', box);
        if (typeof cv === 'undefined') return null;

        let src = cv.imread(img);

        // 1. 裁切 (ROI)
        let rect = new cv.Rect(
            Math.max(0, box.x),
            Math.max(0, box.y),
            Math.min(src.cols - box.x, box.width),
            Math.min(src.rows - box.y, box.height)
        );
        let cropped = src.roi(rect);

        // 2. OCR Friendly 處理：灰階 -> 自適應二值化
        let gray = new cv.Mat();
        cv.cvtColor(cropped, gray, cv.COLOR_RGBA2GRAY);

        let final = new cv.Mat();
        // 使用較大的 blockSize 以處理光照不均，並微調 C 值
        cv.adaptiveThreshold(
            gray, final, 255,
            cv.ADAPTIVE_THRESH_GAUSSIAN_C,
            cv.THRESH_BINARY,
            21, 10
        );

        // 3. 輸出到畫布
        this.processedCanvas.width = final.cols;
        this.processedCanvas.height = final.rows;
        cv.imshow(this.processedCanvas, final);

        // 計算指標（用於 UI 顯示）
        const metrics = this.calculateMetricsFromMat(final);

        // 清理
        src.delete(); cropped.delete(); gray.delete(); final.delete();

        return {
            width: this.processedCanvas.width,
            height: this.processedCanvas.height,
            metrics,
            canvas: this.processedCanvas
        };
    }

    /**
     * 從 OpenCV Mat 計算品質指標
     */
    calculateMetricsFromMat(mat) {
        // 簡單計算平均亮度（對二值化圖來說意義較小，但可維持 UI 一致）
        let mean = cv.mean(mat)[0];
        return {
            brightness: Math.round(mean),
            sharpness: 100 // 二值化後的邊緣通常很銳利
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

}

// 全域初始化
document.addEventListener('DOMContentLoaded', () => {
    window.imageProcessor = new ImageProcessor();
    console.log('↓ 🖼️ [ImageProcessor] 初始化 ↓');
});