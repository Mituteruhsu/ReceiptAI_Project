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
        this.currentSrc = null; // cv.Mat (Processed Full Image)
    }

    /**
     * 載入影像並處理
     */
    async processImage(imageSource) {
        console.log('↓ processImage() ↓');
        return new Promise((resolve, reject) => {
            const img = new Image();
            const url = URL.createObjectURL(imageSource);

            img.onload = () => {
                console.log('processImage() img.onload 觸發');
                URL.revokeObjectURL(url);
                
                // 儲存原始影像
                this.originalCanvas.width = img.width;
                this.originalCanvas.height = img.height;
                this.originalCtx.drawImage(img, 0, 0);

                // 處理影像
                const result = this.applyProcessing(img);
                resolve(result);
                console.log('processImage() 處理完成');
                console.log('↑ processImage() ↑');
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
        console.log('↓ applyProcessing() ↓');

        // 1. 拍完照片先轉黑白 (全圖預處理)
        this.fullPreprocess();

        // 2. 後面才進行自動裁切 (偵測文字區域)
        this.detectTextRegions();

        // 取得裁切後的影像進行指標計算
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

    /**
     * 全圖預處理：轉黑白與增強
     */
    fullPreprocess() {
        if (!cv) return;

        // 建立臨時畫布進行全圖處理，保持 originalCanvas 為原始狀態
        const width = this.originalCanvas.width;
        const height = this.originalCanvas.height;
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = width;
        tempCanvas.height = height;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.drawImage(this.originalCanvas, 0, 0);

        let imageData = tempCtx.getImageData(0, 0, width, height);
        const autoContrast = document.getElementById('autoContrast')?.checked;

        // 拍完照片先轉黑白 (Grayscale + Threshold)
        imageData = this.grayscale(imageData);
        if (autoContrast) {
            imageData = this.normalize(imageData);
        }
        imageData = this.adaptiveThreshold(imageData, 21, 7);

        // 寫回畫布
        tempCtx.putImageData(imageData, 0, 0);

        // 將預處理後的黑白影像存入 currentSrc (cv.Mat)
        if (this.currentSrc) this.currentSrc.delete();
        this.currentSrc = cv.imread(tempCanvas);
    }

    /* ======================
       Geometry utilities
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
       Main detection
    ====================== */

    detectTextRegions() {
        if (!cv || !this.currentSrc) {
            console.error('OpenCV.js not loaded or source image missing');
            return;
        }

        let src = this.currentSrc;
        let gray = new cv.Mat();
        let blur = new cv.Mat();
        let binary = new cv.Mat();
        let edges = new cv.Mat();

        cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
        cv.GaussianBlur(gray, blur, new cv.Size(5, 5), 0);

        cv.adaptiveThreshold(
            blur, binary, 255,
            cv.ADAPTIVE_THRESH_GAUSSIAN_C,
            cv.THRESH_BINARY_INV,
            15, 10
        );

        cv.Canny(binary, edges, 40, 120);
        let kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(25, 25));
        cv.dilate(edges, edges, kernel);

        let contours = new cv.MatVector();
        let hierarchy = new cv.Mat();
        cv.findContours(edges, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

        const minArea = 800;
        const marginRatio = 0.05;
        const marginX = src.cols * marginRatio;
        const marginY = src.rows * marginRatio;

        let rects = [];
        for (let i = 0; i < contours.size(); i++) {
            let rect = cv.boundingRect(contours.get(i));
            let area = rect.width * rect.height;
            if (area < minArea) continue;
            if (rect.x <= marginX || rect.y <= marginY || rect.x + rect.width >= src.cols - marginX || rect.y + rect.height >= src.rows - marginY) continue;
            rects.push(rect);
        }

        let mergedRects = this.mergeOverlappingRects(rects);

        if (mergedRects.length > 0) {
            let maxRect = mergedRects.reduce((prev, curr) => (curr.width * curr.height > prev.width * prev.height) ? curr : prev);
            let verticalOverlapRects = mergedRects.filter(r => !(r.x + r.width < maxRect.x || r.x > maxRect.x + maxRect.width));
            let minX = Math.min(...verticalOverlapRects.map(r => r.x));
            let maxX = Math.max(...verticalOverlapRects.map(r => r.x + r.width));
            let minY = Math.min(...verticalOverlapRects.map(r => r.y));
            let maxY = Math.max(...verticalOverlapRects.map(r => r.y + r.height));
            this.detectedRect = { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
        } else {
            this.detectedRect = { x: 0, y: 0, width: src.cols, height: src.rows };
        }

        this.updateCrop();

        gray.delete(); blur.delete(); binary.delete(); edges.delete(); contours.delete(); hierarchy.delete(); kernel.delete();
    }

    updateCrop() {
        if (!this.detectedRect || !this.currentSrc) return;

        const top = parseInt(document.getElementById('topMargin')?.value || 0);
        const bottom = parseInt(document.getElementById('bottomMargin')?.value || 0);
        const left = parseInt(document.getElementById('leftMargin')?.value || 0);
        const right = parseInt(document.getElementById('rightMargin')?.value || 0);

        let cropX = Math.max(0, this.detectedRect.x + left);
        let cropY = Math.max(0, this.detectedRect.y + top);
        let cropWidth = Math.min(this.currentSrc.cols - cropX, this.detectedRect.width - left + right);
        let cropHeight = Math.min(this.currentSrc.rows - cropY, this.detectedRect.height - top + bottom);

        if (cropWidth <= 0 || cropHeight <= 0) return;

        let rect = new cv.Rect(cropX, cropY, cropWidth, cropHeight);
        let croppedMat = this.currentSrc.roi(rect);

        this.canvasCropped.width = cropWidth;
        this.canvasCropped.height = cropHeight;
        cv.imshow(this.canvasCropped, croppedMat);

        let result = this.currentSrc.clone();
        cv.rectangle(result, new cv.Point(this.detectedRect.x, this.detectedRect.y), new cv.Point(this.detectedRect.x + this.detectedRect.width, this.detectedRect.y + this.detectedRect.height), [255, 0, 0, 255], 3);
        cv.rectangle(result, new cv.Point(cropX, cropY), new cv.Point(cropX + cropWidth, cropY + cropHeight), [0, 255, 0, 255], 2);

        this.canvasResult.width = this.currentSrc.cols;
        this.canvasResult.height = this.currentSrc.rows;
        cv.imshow(this.canvasResult, result);

        croppedMat.delete(); result.delete();

        if (window.cameraController) {
            const metrics = this.calculateMetrics(this.canvasCropped.getContext('2d').getImageData(0, 0, cropWidth, cropHeight));
            window.cameraController.imageDimensions.textContent = `${cropWidth} × ${cropHeight}`;
            window.cameraController.imageBrightness.textContent = `${metrics.brightness}/255`;
            window.cameraController.imageSharpness.textContent = metrics.sharpness > 50 ? '良好' : '一般';
        }
    }

    grayscale(imageData) {
        const data = imageData.data;
        for (let i = 0; i < data.length; i += 4) {
            const avg = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
            data[i] = data[i+1] = data[i+2] = avg;
        }
        return imageData;
    }

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

    adaptiveThreshold(imageData, blockSize = 21, C = 7) {
        const { width, height, data } = imageData;
        const output = new Uint8ClampedArray(data.length);
        const half = Math.floor(blockSize / 2);
        const integral = new Uint32Array(width * height);

        for (let y = 0; y < height; y++) {
            let rowSum = 0;
            for (let x = 0; x < width; x++) {
                rowSum += data[(y * width + x) * 4];
                integral[y * width + x] = rowSum + (y > 0 ? integral[(y - 1) * width + x] : 0);
            }
        }

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const x1 = Math.max(x - half, 0), y1 = Math.max(y - half, 0);
                const x2 = Math.min(x + half, width - 1), y2 = Math.min(y + half, height - 1);
                const area = (x2 - x1 + 1) * (y2 - y1 + 1);
                const sum = integral[y2 * width + x2] - (y1 > 0 ? integral[(y1 - 1) * width + x2] : 0) - (x1 > 0 ? integral[y2 * width + (x1 - 1)] : 0) + (x1 > 0 && y1 > 0 ? integral[(y1 - 1) * width + (x1 - 1)] : 0);
                const val = data[(y * width + x) * 4] < (sum / area - C) ? 0 : 255;
                const idx = (y * width + x) * 4;
                output[idx] = output[idx + 1] = output[idx + 2] = val;
                output[idx + 3] = 255;
            }
        }
        imageData.data.set(output);
        return imageData;
    }

    calculateMetrics(imageData) {
        const data = imageData.data;
        let totalBrightness = 0, edges = 0;
        for (let i = 0; i < data.length; i += 4) {
            totalBrightness += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        }
        const avgBrightness = totalBrightness / (data.length / 4);
        const width = imageData.width;
        for (let i = 0; i < data.length - width * 4; i += 4) {
            const g1 = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
            const g2 = 0.299 * data[i + width * 4] + 0.587 * data[i + width * 4 + 1] + 0.114 * data[i + width * 4 + 2];
            edges += Math.abs(g1 - g2);
        }
        return { brightness: Math.round(avgBrightness), sharpness: Math.round(edges / (data.length / 4)) };
    }

    async canvasToBlob(canvas, quality = 1) {
        return new Promise((resolve) => { canvas.toBlob((blob) => { resolve(blob); }, 'image/jpeg', quality); });
    }

    async reprocess() {
        const img = new Image();
        img.onload = () => {
            const result = this.applyProcessing(img);
            window.cameraController.updatePreview(result);
        };
        img.src = this.originalCanvas.toDataURL();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.imageProcessor = new ImageProcessor();
    console.log('↓ 🖼️ [ImageProcessor] 初始化 ↓');
});
