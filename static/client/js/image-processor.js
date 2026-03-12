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
                this.originalCtx = this.originalCanvas.getContext('2d', { willReadFrequently: true });
                this.processedCtx = this.processedCanvas.getContext('2d', { willReadFrequently: true });

        // New canvases for cropping
        this.canvasResult = document.getElementById('canvasResult');
        this.canvasCropped = document.getElementById('canvasCropped');
        // OCR 專用裁切畫布（不顯示在 UI）
        this.canvasCroppedOcr = document.createElement('canvas');

        this.detectedRect = null;
        this.currentSrc = null; // cv.Mat (Processed Full Image)
    }

    /* 載入影像並處理 */
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

                // 先顯示原始影像與預設裁切框，讓使用者立即看到預覽
                this.setDefaultRect();
                this.previewOriginal();

                // 處理影像 applyProcessing(img)
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

    /* 應用 OCR-Friendly 處理 */
    applyProcessing(img) {
        console.log('↓ applyProcessing() ↓');
        
        // 1. 拍完照片先轉黑白 (全圖預處理)
        this.fullPreprocess();

        // 2. 不做自動裁切，使用置中的預設框
        this.setDefaultRect();
        this.updateCrop();

        // 取得裁切後的影像進行指標計算
        const croppedWidth = this.canvasCropped.width;
        const croppedHeight = this.canvasCropped.height;
        if (!croppedWidth || !croppedHeight) {
            return {
                width: 0,
                height: 0,
                metrics: { brightness: 0, sharpness: 0 },
                // 送出 OCR 用的裁切結果，預覽則使用 canvasCropped
                canvas: this.canvasCroppedOcr
            };
        }
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
            // 送出 OCR 用的裁切結果，預覽則使用 canvasCropped
            canvas: this.canvasCroppedOcr
        };
    }

    /* 全圖預處理：純 OpenCV 流程（移除逐像素迴圈） */
    fullPreprocess() {
        if (!cv) return;

        const autoContrast = document.getElementById('autoContrast')?.checked;

        // 流程：RGBA -> 灰階 -> (可選) Normalize -> Adaptive Threshold
        const src = cv.imread(this.originalCanvas);
        const gray = new cv.Mat();
        const norm = new cv.Mat();
        const binary = new cv.Mat();
        
        // 轉灰階
        cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

        if (autoContrast) {
            // Normalize 提升對比 (可改用 CLAHE 取得更穩定效果)
            cv.normalize(gray, norm, 0, 255, cv.NORM_MINMAX);
        } else {
            gray.copyTo(norm);
        }
        
        // Adaptive Threshold 轉二值圖
        cv.adaptiveThreshold(
            norm, binary, 255,
            cv.ADAPTIVE_THRESH_GAUSSIAN_C,
            cv.THRESH_BINARY,
            21, 7
        );

        // 將預處理後的黑白影像存入 currentSrc (cv.Mat，單通道)
        if (this.currentSrc) this.currentSrc.delete();
        this.currentSrc = binary.clone();

        src.delete(); gray.delete(); norm.delete(); binary.delete();
    }

    /* ======================
       進行自動裁切 (偵測文字區域) Geometry utilities
    ====================== */
    // 矩形重疊檢測 detectTextRegions()
    rectOverlap(a, b) {
        return !(
            b.x > a.x + a.width ||
            b.x + b.width < a.x ||
            b.y > a.y + a.height ||
            b.y + b.height < a.y
        );
    }

    // 合併兩個矩形 mergeOverlappingRects(rects)
    mergeRect(a, b) {
        const x1 = Math.min(a.x, b.x);
        const y1 = Math.min(a.y, b.y);
        const x2 = Math.max(a.x + a.width, b.x + b.width);
        const y2 = Math.max(a.y + a.height, b.y + b.height);
        return { x: x1, y: y1, width: x2 - x1, height: y2 - y1 };
    }

    // 合併重疊矩形 detectTextRegions()
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
       進行自動裁切 (偵測文字區域) Main detection
    ====================== */

    detectTextRegions() {
        if (!cv || !this.currentSrc) {
            console.error('OpenCV.js not loaded or source image missing');
            return;
        }

        const srcColor = cv.imread(this.originalCanvas);
        const gray = new cv.Mat();
        const blur = new cv.Mat();
        const edges = new cv.Mat();

        // 1. 邊緣檢測：使用原始影像 + CLAHE，降低噪點干擾
        // 先轉灰階，再做 CLAHE（避免部分 Lab 轉換在 OpenCV.js 版本中不存在）
        cv.cvtColor(srcColor, gray, cv.COLOR_RGBA2GRAY);
        if (cv.createCLAHE) {
            const clahe = cv.createCLAHE(2.0, new cv.Size(8, 8));
            clahe.apply(gray, gray);
            clahe.delete();
        }
        cv.GaussianBlur(gray, blur, new cv.Size(5, 5), 0);

        // 邊緣檢測（較高閾值避免噪點）
        cv.Canny(blur, edges, 50, 150);
        let kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(15, 15));
        cv.morphologyEx(edges, edges, cv.MORPH_CLOSE, kernel);

        // 2. 找輪廓
        let contours = new cv.MatVector();
        let hierarchy = new cv.Mat();
        cv.findContours(edges, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

        // 3. 依輪廓估計發票外框（優先四邊形）
        const imgArea = srcColor.cols * srcColor.rows;
        const minArea = imgArea * 0.05;
        const maxArea = imgArea * 0.98;
        const centerX = srcColor.cols / 2;
        const centerY = srcColor.rows / 2;
        let bestRect = null;
        let bestScore = -1;

        // 先找四邊形輪廓
        for (let i = 0; i < contours.size(); i++) {
            const contour = contours.get(i);
            const area = cv.contourArea(contour);
            if (area < minArea || area > maxArea) continue;

            const peri = cv.arcLength(contour, true);
            const approx = new cv.Mat();
            cv.approxPolyDP(contour, approx, 0.02 * peri, true);

            if (approx.rows === 4) {
                const rect = cv.boundingRect(approx);
                const rectArea = rect.width * rect.height;
                const rectCenterX = rect.x + rect.width / 2;
                const rectCenterY = rect.y + rect.height / 2;
                const dist = Math.hypot(rectCenterX - centerX, rectCenterY - centerY);
                const normDist = dist / Math.hypot(centerX, centerY);
                // 中心優先 + 面積加權
                const score = (rectArea / imgArea) * (1 - normDist);
                if (score > bestScore) {
                    bestScore = score;
                    bestRect = rect;
                }
            }

            approx.delete();
        }

        // 若找不到四邊形，退而求其次：取最大輪廓的外接矩形
        if (!bestRect) {
            for (let i = 0; i < contours.size(); i++) {
                const contour = contours.get(i);
                const area = cv.contourArea(contour);
                if (area < minArea || area > maxArea) continue;

                const rect = cv.boundingRect(contour);
                const rectArea = rect.width * rect.height;
                const rectCenterX = rect.x + rect.width / 2;
                const rectCenterY = rect.y + rect.height / 2;
                const dist = Math.hypot(rectCenterX - centerX, rectCenterY - centerY);
                const normDist = dist / Math.hypot(centerX, centerY);
                const score = (rectArea / imgArea) * (1 - normDist);
                if (score > bestScore) {
                    bestScore = score;
                    bestRect = rect;
                }
            }
        }

        if (bestRect) {
            this.detectedRect = bestRect;
        } else {
            this.detectedRect = { x: 0, y: 0, width: srcColor.cols, height: srcColor.rows };
        }

        // 4. 更新裁切預覽 
        this.updateCrop();

        srcColor.delete();
        gray.delete(); blur.delete(); edges.delete(); contours.delete(); hierarchy.delete(); kernel.delete();
    }

    // 預設置中框（約 70%）
    setDefaultRect() {
        if (!this.currentSrc || !this.originalCanvas) return;
        const w = this.originalCanvas.width || this.currentSrc.cols;
        const h = this.originalCanvas.height || this.currentSrc.rows;
        const rectW = Math.floor(w * 0.7);
        const rectH = Math.floor(h * 0.7);
        const x = Math.floor((w - rectW) / 2);
        const y = Math.floor((h - rectH) / 2);
        this.detectedRect = { x, y, width: rectW, height: rectH };
    }

    // 不依賴 OpenCV，先用原始影像快速顯示裁切預覽
    previewOriginal() {
        if (!this.detectedRect || !this.originalCanvas) return;
        const baseW = this.originalCanvas.width;
        const baseH = this.originalCanvas.height;

        let cropX = this.detectedRect.x;
        let cropY = this.detectedRect.y;
        let cropWidth = this.detectedRect.width;
        let cropHeight = this.detectedRect.height;

        cropX = Math.max(0, Math.min(baseW - 1, cropX));
        cropY = Math.max(0, Math.min(baseH - 1, cropY));
        cropWidth = Math.max(1, Math.min(baseW - cropX, cropWidth));
        cropHeight = Math.max(1, Math.min(baseH - cropY, cropHeight));

        // 預覽裁切（原始影像）
        this.canvasCropped.width = cropWidth;
        this.canvasCropped.height = cropHeight;
        const croppedCtx = this.canvasCropped.getContext('2d', { willReadFrequently: true });
        croppedCtx.drawImage(this.originalCanvas, cropX, cropY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);

        // 預覽結果（原始影像 + 紅框）
        this.canvasResult.width = baseW;
        this.canvasResult.height = baseH;
        const resultCtx = this.canvasResult.getContext('2d');
        resultCtx.drawImage(this.originalCanvas, 0, 0);
        resultCtx.strokeStyle = 'rgb(255, 0, 0)';
        resultCtx.lineWidth = 6;
        resultCtx.strokeRect(cropX, cropY, cropWidth, cropHeight);
    }

    updateCrop() {
        if (!this.detectedRect || !this.currentSrc) return;

        // 70% 為基準，100% 代表從 70% 放大到 100%，每邊只需 +15%
        // 所以需要除以 200（而不是 100）
        const topPct = (parseFloat(document.getElementById('topMargin')?.value || 70) - 70) / 200;
        const bottomPct = (parseFloat(document.getElementById('bottomMargin')?.value || 70) - 70) / 200;
        const leftPct = (parseFloat(document.getElementById('leftMargin')?.value || 70) - 70) / 200;
        const rightPct = (parseFloat(document.getElementById('rightMargin')?.value || 70) - 70) / 200;
        const topNarrowPct = parseFloat(document.getElementById('topNarrow')?.value || 0) / 100;
        const bottomNarrowPct = parseFloat(document.getElementById('bottomNarrow')?.value || 0) / 100;
        const rotateAngle = parseInt(document.getElementById('rotateAngle')?.value || 0);

        // 以原圖尺寸為基準，並以 detectedRect 為中心進行擴張
        const baseW = this.originalCanvas?.width || this.currentSrc.cols;
        const baseH = this.originalCanvas?.height || this.currentSrc.rows;

        const top = Math.round(baseH * topPct);
        const bottom = Math.round(baseH * bottomPct);
        const left = Math.round(baseW * leftPct);
        const right = Math.round(baseW * rightPct);
        // 先以裁切寬度作為基準，避免與原圖尺寸脫鉤
        let topNarrow = topNarrowPct;
        let bottomNarrow = bottomNarrowPct;

        // 以 detectedRect 為中心，四邊向外擴張，最後再裁到整張圖的邊界
        let cropX = this.detectedRect.x - left;
        let cropY = this.detectedRect.y - top;
        let cropWidth = this.detectedRect.width + left + right;
        let cropHeight = this.detectedRect.height + top + bottom;

        if (cropX < 0) {
            cropWidth += cropX;
            cropX = 0;
        }
        if (cropY < 0) {
            cropHeight += cropY;
            cropY = 0;
        }
        cropWidth = Math.min(baseW - cropX, cropWidth);
        cropHeight = Math.min(baseH - cropY, cropHeight);

        if (cropWidth <= 1 || cropHeight <= 1) return;

        const srcBinary = this.currentSrc;
        const srcColor = cv.imread(this.originalCanvas);

        let rect = new cv.Rect(cropX, cropY, cropWidth, cropHeight);
        let croppedMat = srcBinary.roi(rect);

        // 生成梯形 + 旋轉後的四點
        const maxNarrow = Math.max(0, Math.floor(cropWidth / 2) - 10);
        let tl = { x: cropX, y: cropY };
        let tr = { x: cropX + cropWidth, y: cropY };
        let br = { x: cropX + cropWidth, y: cropY + cropHeight };
        let bl = { x: cropX, y: cropY + cropHeight };

        // 梯形收縮/外擴（正值 = 外擴但線段變短），比例為 50%
        let topAdj = Math.round(cropWidth * topNarrow * 0.5);
        let bottomAdj = Math.round(cropWidth * bottomNarrow * 0.5);
        topAdj = Math.max(-maxNarrow, Math.min(maxNarrow, topAdj));
        bottomAdj = Math.max(-maxNarrow, Math.min(maxNarrow, bottomAdj));
        tl.x += topAdj;
        tr.x -= topAdj;
        bl.x += bottomAdj;
        br.x -= bottomAdj;

        // 旋轉
        const angle = rotateAngle * Math.PI / 180;
        const cx = cropX + cropWidth / 2;
        const cy = cropY + cropHeight / 2;
        const rotate = (p) => {
            const dx = p.x - cx;
            const dy = p.y - cy;
            return {
                x: cx + dx * Math.cos(angle) - dy * Math.sin(angle),
                y: cy + dx * Math.sin(angle) + dy * Math.cos(angle)
            };
        };
        tl = rotate(tl); tr = rotate(tr); br = rotate(br); bl = rotate(bl);

        const clampPoint = (p) => ({
            x: Math.max(0, Math.min(baseW - 1, p.x)),
            y: Math.max(0, Math.min(baseH - 1, p.y))
        });
        tl = clampPoint(tl); tr = clampPoint(tr); br = clampPoint(br); bl = clampPoint(bl);

        const pointsOk = [tl, tr, br, bl].every(p => Number.isFinite(p.x) && Number.isFinite(p.y));
        if (!pointsOk) {
            // fallback: 使用矩形裁切與原圖預覽
            this.canvasCropped.width = cropWidth;
            this.canvasCropped.height = cropHeight;
            const croppedCtx = this.canvasCropped.getContext('2d', { willReadFrequently: true });
            croppedCtx.drawImage(this.originalCanvas, cropX, cropY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);

            this.canvasResult.width = baseW;
            this.canvasResult.height = baseH;
            const resultCtx = this.canvasResult.getContext('2d');
            resultCtx.drawImage(this.originalCanvas, 0, 0);
            resultCtx.strokeStyle = 'rgb(255, 0, 0)';
            resultCtx.lineWidth = 6;
            resultCtx.strokeRect(cropX, cropY, cropWidth, cropHeight);

            this.canvasCroppedOcr.width = cropWidth;
            this.canvasCroppedOcr.height = cropHeight;
            cv.imshow(this.canvasCroppedOcr, croppedMat);

            croppedMat.delete();
            srcColor.delete();
            return;
        }

        // 透視變換
        const srcPts = cv.matFromArray(4, 1, cv.CV_32FC2, [
            tl.x, tl.y, tr.x, tr.y, br.x, br.y, bl.x, bl.y
        ]);
        const dstPts = cv.matFromArray(4, 1, cv.CV_32FC2, [
            0, 0, cropWidth, 0, cropWidth, cropHeight, 0, cropHeight
        ]);
        const M = cv.getPerspectiveTransform(srcPts, dstPts);

        const warpedBinary = new cv.Mat();
        const warpedColor = new cv.Mat();
        cv.warpPerspective(srcBinary, warpedBinary, M, new cv.Size(cropWidth, cropHeight));
        cv.warpPerspective(srcColor, warpedColor, M, new cv.Size(cropWidth, cropHeight));

        // OCR 用裁切（黑白）
        this.canvasCroppedOcr.width = cropWidth;
        this.canvasCroppedOcr.height = cropHeight;
        cv.imshow(this.canvasCroppedOcr, warpedBinary);

        // 預覽用裁切：顯示 OCR Friendly（黑白）結果
        this.canvasCropped.width = cropWidth;
        this.canvasCropped.height = cropHeight;
        cv.imshow(this.canvasCropped, warpedBinary);

        // 預覽結果使用原始影像，疊加紅色方框
        this.canvasResult.width = srcColor.cols;
        this.canvasResult.height = srcColor.rows;
        const overlay = srcColor.clone();
        const red = [255, 0, 0, 255];
        cv.line(overlay, new cv.Point(tl.x, tl.y), new cv.Point(tr.x, tr.y), red, 6);
        cv.line(overlay, new cv.Point(tr.x, tr.y), new cv.Point(br.x, br.y), red, 6);
        cv.line(overlay, new cv.Point(br.x, br.y), new cv.Point(bl.x, bl.y), red, 6);
        cv.line(overlay, new cv.Point(bl.x, bl.y), new cv.Point(tl.x, tl.y), red, 6);
        cv.imshow(this.canvasResult, overlay);

        croppedMat.delete();
        srcColor.delete();
        srcPts.delete();
        dstPts.delete();
        M.delete();
        warpedBinary.delete();
        warpedColor.delete();
        overlay.delete();

        if (window.cameraController) {
            const metrics = this.calculateMetrics(this.canvasCropped.getContext('2d').getImageData(0, 0, cropWidth, cropHeight));
            window.cameraController.imageDimensions.textContent = `${cropWidth} × ${cropHeight}`;
            window.cameraController.imageBrightness.textContent = `${metrics.brightness}/255`;
            window.cameraController.imageSharpness.textContent = metrics.sharpness > 50 ? '良好' : '一般';
        }
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

    getCroppedOcrCanvas() {
        return this.canvasCroppedOcr;
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
