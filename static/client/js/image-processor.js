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

        // New canvases for cropping
        this.canvasResult = document.getElementById('canvasResult');
        this.canvasCropped = document.getElementById('canvasCropped');

        this.detectedRect = null;
        this.currentSrc = null; // cv.Mat
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

        // 使用 OpenCV 進行文字區域偵測與裁切 (內部會呼叫 updateCrop)
        this.detectTextRegions();

        // 取得裁切並增強後的影像進行指標計算
        const croppedWidth = this.canvasCropped.width;
        const croppedHeight = this.canvasCropped.height;
        const croppedCtx = this.canvasCropped.getContext('2d');
        const imageData = croppedCtx.getImageData(0, 0, croppedWidth, croppedHeight);

        // 計算影像品質指標
        const metrics = this.calculateMetrics(imageData);

        console.log('處理完成的影像大小', croppedWidth, croppedHeight);
        console.log('↑ applyProcessing() ↑');
        return {
            width: croppedWidth,
            height: croppedHeight,
            metrics,
            canvas: this.canvasCropped
        };
    }

    /* ======================
       Geometry utilities (Ported from smartcropper.html)
    ====================== */

    rectOverlap(a, b) {
        return !(
            b.x > a.x + a.width ||
            b.x + b.width < a.x ||
            b.y > a.y + a.height ||
            b.y + b.height < a.y
        );
    }

    mergeRect(a, b) {
        const x1 = Math.min(a.x, b.x);
        const y1 = Math.min(a.y, b.y);
        const x2 = Math.max(a.x + a.width, b.x + b.width);
        const y2 = Math.max(a.y + a.height, b.y + b.height);
        return { x: x1, y: y1, width: x2 - x1, height: y2 - y1 };
    }

    mergeOverlappingRects(rects) {
        let merged = [];

        for (let r of rects) {
            let mergedOnce = false;
            for (let i = 0; i < merged.length; i++) {
                if (this.rectOverlap(r, merged[i])) {
                    merged[i] = this.mergeRect(r, merged[i]);
                    mergedOnce = true;
                    break;
                }
            }
            if (!mergedOnce) merged.push(r);
        }

        let changed = true;
        while (changed) {
            changed = false;
            for (let i = 0; i < merged.length; i++) {
                for (let j = i + 1; j < merged.length; j++) {
                    if (this.rectOverlap(merged[i], merged[j])) {
                        merged[i] = this.mergeRect(merged[i], merged[j]);
                        merged.splice(j, 1);
                        changed = true;
                        j--;
                    }
                }
            }
        }
        return merged;
    }

    /* ======================
       Main detection (Ported from smartcropper.html)
    ====================== */

    detectTextRegions() {
        if (!cv) {
            console.error('OpenCV.js not loaded');
            return;
        }

        let src = cv.imread(this.originalCanvas);
        if (this.currentSrc) this.currentSrc.delete();
        this.currentSrc = src.clone();

        let gray = new cv.Mat();
        let blur = new cv.Mat();
        let binary = new cv.Mat();
        let edges = new cv.Mat();

        // 灰階 + 模糊
        cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
        cv.GaussianBlur(gray, blur, new cv.Size(5, 5), 0);

        // 自適應二值化（文字 → 白）
        cv.adaptiveThreshold(
            blur, binary, 255,
            cv.ADAPTIVE_THRESH_GAUSSIAN_C,
            cv.THRESH_BINARY_INV,
            15, 10
        );

        // 邊緣 + 膨脹（文字聚合）
        cv.Canny(binary, edges, 40, 120);
        let kernel = cv.getStructuringElement(
            cv.MORPH_RECT, new cv.Size(25, 25)
        );
        cv.dilate(edges, edges, kernel);

        // 找輪廓
        let contours = new cv.MatVector();
        let hierarchy = new cv.Mat();
        cv.findContours(
            edges, contours, hierarchy,
            cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE
        );

        const minArea = 800;
        const marginRatio = 0.05;
        const marginX = src.cols * marginRatio;
        const marginY = src.rows * marginRatio;

        let rects = [];
        for (let i = 0; i < contours.size(); i++) {
            let rect = cv.boundingRect(contours.get(i));
            let area = rect.width * rect.height;

            if (area < minArea) continue;

            if (
                rect.x <= marginX ||
                rect.y <= marginY ||
                rect.x + rect.width >= src.cols - marginX ||
                rect.y + rect.height >= src.rows - marginY
            ) {
                continue;
            }
            rects.push(rect);
        }

        let mergedRects = this.mergeOverlappingRects(rects);

        if (mergedRects.length > 0) {
            let maxRect = mergedRects.reduce((prev, curr) =>
                (curr.width * curr.height > prev.width * prev.height) ? curr : prev
            );

            let verticalOverlapRects = mergedRects.filter(r => {
                return !(r.x + r.width < maxRect.x || r.x > maxRect.x + maxRect.width);
            });

            let minX = Math.min(...verticalOverlapRects.map(r => r.x));
            let maxX = Math.max(...verticalOverlapRects.map(r => r.x + r.width));
            let minY = Math.min(...verticalOverlapRects.map(r => r.y));
            let maxY = Math.max(...verticalOverlapRects.map(r => r.y + r.height));

            this.detectedRect = {
                x: minX,
                y: minY,
                width: maxX - minX,
                height: maxY - minY
            };
        } else {
            this.detectedRect = {
                x: 0,
                y: 0,
                width: src.cols,
                height: src.rows
            };
        }

        // 自動套用裁切
        this.updateCrop();

        // 清理
        src.delete(); gray.delete(); blur.delete();
        binary.delete(); edges.delete();
        contours.delete(); hierarchy.delete();
        kernel.delete();
    }

    /**
     * 裁切功能 (Ported from smartcropper.html 並整合影像增強)
     */
    updateCrop() {
        if (!this.detectedRect || !this.currentSrc) return;

        const top = parseInt(document.getElementById('topMargin')?.value || 0);
        const bottom = parseInt(document.getElementById('bottomMargin')?.value || 0);
        const left = parseInt(document.getElementById('leftMargin')?.value || 0);
        const right = parseInt(document.getElementById('rightMargin')?.value || 0);

        // 計算裁切區域（加上調整值）
        let cropX = Math.max(0, this.detectedRect.x + left);
        let cropY = Math.max(0, this.detectedRect.y + top);
        let cropWidth = Math.min(this.currentSrc.cols - cropX, this.detectedRect.width - left + right);
        let cropHeight = Math.min(this.currentSrc.rows - cropY, this.detectedRect.height - top + bottom);

        if (cropWidth <= 0 || cropHeight <= 0) {
            console.error('Invalid crop dimensions');
            return;
        }

        // 建立裁切區域
        let rect = new cv.Rect(cropX, cropY, cropWidth, cropHeight);
        let croppedMat = this.currentSrc.roi(rect);

        // 1. 先將裁切區域畫到畫布
        this.canvasCropped.width = cropWidth;
        this.canvasCropped.height = cropHeight;
        cv.imshow(this.canvasCropped, croppedMat);

        // 2. 進行影像增強 (原本的功能)
        const croppedCtx = this.canvasCropped.getContext('2d');
        let imageData = croppedCtx.getImageData(0, 0, cropWidth, cropHeight);

        const autoContrast = document.getElementById('autoContrast')?.checked;

        // 轉灰階
        imageData = this.grayscale(imageData);

        // 自動對比
        if (autoContrast) {
            imageData = this.normalize(imageData);
        }

        // 自適應二值化
        imageData = this.adaptiveThreshold(imageData, 21, 7);

        // 寫回畫布
        croppedCtx.putImageData(imageData, 0, 0);

        // 3. 在結果圖上畫偵測框 (視覺反饋)
        let result = this.currentSrc.clone();
        // 原始偵測框 (紅色)
        cv.rectangle(
            result,
            new cv.Point(this.detectedRect.x, this.detectedRect.y),
            new cv.Point(this.detectedRect.x + this.detectedRect.width, this.detectedRect.y + this.detectedRect.height),
            [255, 0, 0, 255],
            3
        );
        // 調整後裁切框 (綠色)
        cv.rectangle(
            result,
            new cv.Point(cropX, cropY),
            new cv.Point(cropX + cropWidth, cropY + cropHeight),
            [0, 255, 0, 255],
            2
        );

        this.canvasResult.width = this.currentSrc.cols;
        this.canvasResult.height = this.currentSrc.rows;
        cv.imshow(this.canvasResult, result);

        croppedMat.delete();
        result.delete();

        // 4. 更新影像資訊 UI
        if (window.cameraController) {
            const metrics = this.calculateMetrics(imageData);
            window.cameraController.imageDimensions.textContent = `${cropWidth} × ${cropHeight}`;
            window.cameraController.imageBrightness.textContent = `${metrics.brightness}/255`;
            window.cameraController.imageSharpness.textContent = metrics.sharpness > 50 ? '良好' : '一般';
        }
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