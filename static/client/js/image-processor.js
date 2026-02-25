// static/client/js/image-processor.js

/**
 * OCR-Friendly 影像處理器
 * 優化影像以提高 QR Code 和 OCR 辨識率
 */
class ImageProcessor {
    constructor() {
        // 畫布參考
        this.originalCanvas = document.getElementById('originalCanvas');
        this.canvasEnhanced = document.getElementById('canvasEnhanced');
        this.canvasCropped = document.getElementById('canvasCropped');
        this.canvasFinal = document.getElementById('canvasFinal');
        this.canvasResult = document.getElementById('canvasResult');

        this.originalCtx = this.originalCanvas.getContext('2d');

        this.detectedRect = null;
        this.enhancedMat = null; // cv.Mat (Full Image after Stage 1)
        this.isCvReady = false;

        // 監聽 OpenCV 載入
        if (typeof cv !== 'undefined') {
            this.isCvReady = true;
        } else {
            window.addEventListener('opencv-ready', () => {
                this.isCvReady = true;
                console.log('✅ OpenCV.js 已就緒 (via custom event)');
            });
            // 某些版本的 opencv.js 使用 Module.onRuntimeInitialized
            if (window.Module) {
                const oldInit = window.Module.onRuntimeInitialized;
                window.Module.onRuntimeInitialized = () => {
                    if (oldInit) oldInit();
                    this.isCvReady = true;
                    console.log('✅ OpenCV.js 已就緒 (via onRuntimeInitialized)');
                };
            }
        }
    }

    /**
     * 檢查 OpenCV 是否可用
     */
    checkCv() {
        if (typeof cv !== 'undefined' && cv.Mat) {
            this.isCvReady = true;
            return true;
        }
        return false;
    }

    /**
     * 載入影像並啟動流水線
     */
    async processImage(imageSource) {
        console.log('↓ processImage() ↓');
        if (!this.checkCv()) {
            throw new Error('影像處理模組 (OpenCV) 尚未載入完成，請稍候再試');
        }

        return new Promise((resolve, reject) => {
            const img = new Image();
            const url = URL.createObjectURL(imageSource);

            img.onload = () => {
                try {
                    console.log('processImage() img.onload');
                    URL.revokeObjectURL(url);

                    // 1. 儲存原始影像
                    this.originalCanvas.width = img.width;
                    this.originalCanvas.height = img.height;
                    this.originalCtx.drawImage(img, 0, 0);

                    // 2. 執行處理流水線
                    const result = this.runPipeline(img);
                    if (!result) {
                        throw new Error('影像處理流水線未回傳結果');
                    }
                    resolve(result);
                    console.log('↑ processImage() ↑');
                } catch (err) {
                    reject(err);
                }
            };

            img.onerror = () => {
                URL.revokeObjectURL(url);
                reject(new Error('影像載入失敗'));
            };

            img.src = url;
        });        
    }

    /**
     * 影像處理流水線
     */
    runPipeline(img) {
        console.log('↓ runPipeline() ↓');
        
        // Stage 1: Initial Enhancement (Gray + Contrast + Blur)
        this.applyEnhancement();

        // Stage 2: Detection
        this.detectTextRegions();

        // Stage 3 & 4: Crop and OCR Preprocess
        const result = this.updateCrop();
        console.log('↑ runPipeline() ↑', result);
        return result;
    }

    /**
     * Stage 1: 影像增強 (協助邊緣檢測)
     */
    applyEnhancement() {
        if (!this.checkCv()) return;

        let src = cv.imread(this.originalCanvas);
        let gray = new cv.Mat();

        cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

        const autoContrast = document.getElementById('autoContrast')?.checked;
        if (autoContrast) {
            cv.normalize(gray, gray, 0, 255, cv.NORM_MINMAX);
        }

        let blurred = new cv.Mat();
        cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0);

        if (this.enhancedMat) this.enhancedMat.delete();
        this.enhancedMat = blurred;

        cv.imshow(this.canvasEnhanced, this.enhancedMat);
        src.delete(); gray.delete();
    }

    /**
     * Stage 2: 定位與偵測 (Detection)
     */
    detectTextRegions() {
        if (!this.checkCv() || !this.enhancedMat) return;

        let src = this.enhancedMat;
        let binary = new cv.Mat();
        let edges = new cv.Mat();

        cv.adaptiveThreshold(
            src, binary, 255,
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

        let previewMat = src.clone();
        cv.cvtColor(previewMat, previewMat, cv.COLOR_GRAY2RGBA);
        cv.rectangle(previewMat,
            new cv.Point(this.detectedRect.x, this.detectedRect.y),
            new cv.Point(this.detectedRect.x + this.detectedRect.width, this.detectedRect.y + this.detectedRect.height),
            [255, 0, 0, 255], 3);
        cv.imshow(this.canvasEnhanced, previewMat);

        binary.delete(); edges.delete(); contours.delete(); hierarchy.delete(); kernel.delete(); previewMat.delete();
    }

    /**
     * Stage 2 & 3: 更新裁切與 OCR 友善處理
     */
    updateCrop() {
        if (!this.detectedRect || !this.enhancedMat) {
            console.warn('updateCrop() failed: detectedRect or enhancedMat missing');
            return null;
        }

        const top = parseInt(document.getElementById('topMargin')?.value || 0);
        const bottom = parseInt(document.getElementById('bottomMargin')?.value || 0);
        const left = parseInt(document.getElementById('leftMargin')?.value || 0);
        const right = parseInt(document.getElementById('rightMargin')?.value || 0);

        let cropX = Math.max(0, this.detectedRect.x + left);
        let cropY = Math.max(0, this.detectedRect.y + top);
        let cropWidth = Math.min(this.enhancedMat.cols - cropX, this.detectedRect.width - left + right);
        let cropHeight = Math.min(this.enhancedMat.rows - cropY, this.detectedRect.height - top + bottom);

        if (cropWidth <= 0 || cropHeight <= 0) {
            console.warn('updateCrop() failed: invalid crop dimensions', cropWidth, cropHeight);
            return null;
        }

        let rect = new cv.Rect(cropX, cropY, cropWidth, cropHeight);
        let croppedMat = this.enhancedMat.roi(rect);
        cv.imshow(this.canvasCropped, croppedMat);

        this.applyOCRFriendly(croppedMat);
        croppedMat.delete();

        // 計算並返回結果與指標
        const finalCtx = this.canvasFinal.getContext('2d');
        const imageData = finalCtx.getImageData(0, 0, this.canvasFinal.width, this.canvasFinal.height);
        const metrics = this.calculateMetrics(imageData);

        const result = {
            width: cropWidth,
            height: cropHeight,
            metrics,
            canvas: this.canvasFinal
        };

        // 如果 cameraController 已存在，同步更新 UI
        if (window.cameraController) {
            window.cameraController.updatePreview(result);
        }

        return result;
    }

    /**
     * Stage 3: OCR 友善預處理 (二值化)
     */
    applyOCRFriendly(croppedMat) {
        let finalMat = new cv.Mat();
        cv.adaptiveThreshold(
            croppedMat, finalMat, 255,
            cv.ADAPTIVE_THRESH_GAUSSIAN_C,
            cv.THRESH_BINARY,
            21, 7
        );
        cv.imshow(this.canvasFinal, finalMat);
        finalMat.delete();
    }

    /* ======================
       Utilities
    ====================== */

    rectOverlap(a, b) {
        return !(b.x > a.x + a.width || b.x + b.width < a.x || b.y > a.y + a.height || b.y + b.height < a.y);
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

    async canvasToBlob(canvas, quality = 0.95) {
        return new Promise((resolve) => { canvas.toBlob((blob) => { resolve(blob); }, 'image/jpeg', quality); });
    }

    async reprocess() {
        console.log('↓ reprocess() ↓');
        if (!this.originalCanvas.width) return;

        const img = new Image();
        img.onload = () => {
            this.runPipeline(img);
        };
        img.src = this.originalCanvas.toDataURL();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.imageProcessor = new ImageProcessor();
    console.log('🖼️ [ImageProcessor] 初始化完成');
});
