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
        this.originalCtx = this.originalCanvas.getContext('2d', { willReadFrequently: true });

        // New canvases for cropping
        this.canvasResult = document.getElementById('canvasResult');
        this.canvasCropped = document.getElementById('canvasCropped');
        // OCR 專用裁切畫布（不顯示在 UI）
        this.canvasCroppedOcr = document.createElement('canvas');

        this.detectedRect = null;
        this.currentSrc = null; // cv.Mat (Processed Cropped Image)
        this.cropPoints = null; // [{x,y} ...] for touch drag
        this.dragActive = false;
        this._lastOcrPreviewTs = 0;
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
        
        // 1. 不做自動裁切，使用置中的預設框（先裁切再預處理）
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
        if (!cv || !this.originalCanvas) return;
        const src = cv.imread(this.originalCanvas);
        const binary = this.preprocessMat(src, { updatePreview: true });
        if (binary) {
            if (this.currentSrc) this.currentSrc.delete();
            this.currentSrc = binary;
        }
        src.delete();
    }

    preprocessMat(src, { updatePreview = true } = {}) {
        if (!cv || !src) return null;

        // 流程：RGBA -> 灰階 -> Adaptive Threshold
        const gray = new cv.Mat();
        const binary = new cv.Mat();

        // 轉灰階
        cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

        // Shadow and Highlight enhancement（抬升暗部、壓低高光）
        const shadowBoost = 0.6;   // 0~1，越大越提亮暗部
        const highlightCut = 0.4;  // 0~1，越大越壓低高光
        const grayFloat = new cv.Mat();
        gray.convertTo(grayFloat, cv.CV_32F, 1.0 / 255.0);

        for (let y = 0; y < grayFloat.rows; y++) {
            for (let x = 0; x < grayFloat.cols; x++) {
                const v = grayFloat.floatAt(y, x);
                const shadow = Math.pow(v, 0.6);               // 提亮暗部
                const highlight = 1.0 - Math.pow(1.0 - v, 0.6); // 壓低高光
                const mixed = (shadowBoost * shadow) + ((1 - shadowBoost) * v);
                const out = (1 - highlightCut) * mixed + highlightCut * highlight;
                grayFloat.floatAt(y, x, out);
            }
        }

        grayFloat.convertTo(gray, cv.CV_8U, 255.0);
        grayFloat.delete();

        // 曝光補償（提升亮度/對比）
        const exposureComp = 1.2; // 1.0 = 不變，>1 變亮
        cv.convertScaleAbs(gray, gray, exposureComp, 0);

        // 曝光後二值化（Otsu）
        cv.threshold(gray, binary, 0, 255, cv.THRESH_BINARY | cv.THRESH_OTSU);
        gray.delete();
        return binary;
    }

    updateOcrFromBinary(binary, outW, outH, { updateCroppedPreview = true } = {}) {
        if (!binary) return;
        if (this.currentSrc) this.currentSrc.delete();
        this.currentSrc = binary;

        this.canvasCroppedOcr.width = outW;
        this.canvasCroppedOcr.height = outH;
        cv.imshow(this.canvasCroppedOcr, binary);

        if (updateCroppedPreview) {
            this.canvasCropped.width = outW;
            this.canvasCropped.height = outH;
            cv.imshow(this.canvasCropped, binary);
        }
    }

    // 預設置中框（約 70%）
    setDefaultRect() {
        if (!this.originalCanvas) return;
        const w = this.originalCanvas.width;
        const h = this.originalCanvas.height;
        const rectW = Math.floor(w * 0.7);
        const rectH = Math.floor(h * 0.7);
        const x = Math.floor((w - rectW) / 2);
        const y = Math.floor((h - rectH) / 2);
        this.detectedRect = { x, y, width: rectW, height: rectH };
    }

    // 取得目前四角點（觸控拖曳用）
    getCropPoints() {
        return this.cropPoints ? this.cropPoints.map(p => ({ x: p.x, y: p.y })) : null;
    }

    // 設定四角點（觸控拖曳用）
    setCropPoints(points) {
        if (!points || points.length !== 4) return;
        this.cropPoints = points.map(p => ({ x: p.x, y: p.y }));
        this.updateCropWithPoints(this.cropPoints);
    }

    setDragActive(active) {
        this.dragActive = !!active;
        if (this.cropPoints) {
            this.updateCropWithPoints(this.cropPoints);
        }
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

        // 初始化觸控拖曳四角點
        this.cropPoints = [
            { x: cropX, y: cropY },
            { x: cropX + cropWidth, y: cropY },
            { x: cropX + cropWidth, y: cropY + cropHeight },
            { x: cropX, y: cropY + cropHeight }
        ];
    }

    updateCrop() {
        if (!cv || !this.detectedRect || !this.originalCanvas) return;

        // 70% 為基準，100% 代表從 70% 放大到 100%，每邊只需 +15%
        // 所以需要除以 200（而不是 100）
        const topPct = 0;
        const bottomPct = 0;
        const leftPct = 0;
        const rightPct = 0;
        const topNarrowPct = 0;
        const bottomNarrowPct = 0;
        const rotateAngle = 0;

        // 以原圖尺寸為基準，並以 detectedRect 為中心進行擴張
        const baseW = this.originalCanvas?.width || (this.currentSrc ? this.currentSrc.cols : 0);
        const baseH = this.originalCanvas?.height || (this.currentSrc ? this.currentSrc.rows : 0);

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

        const srcColor = cv.imread(this.originalCanvas);

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

        // 保存四角點供觸控拖曳
        this.cropPoints = [tl, tr, br, bl].map(p => ({ x: p.x, y: p.y }));

        const pointsOk = [tl, tr, br, bl].every(p => Number.isFinite(p.x) && Number.isFinite(p.y));
        if (!pointsOk) {
            // fallback: 使用矩形裁切與原圖預覽
            const rect = new cv.Rect(cropX, cropY, cropWidth, cropHeight);
            const croppedColor = srcColor.roi(rect);
            const binary = this.preprocessMat(croppedColor, { updatePreview: true });
            this.updateOcrFromBinary(binary, cropWidth, cropHeight, { updateCroppedPreview: true });
            croppedColor.delete();

            this.canvasResult.width = baseW;
            this.canvasResult.height = baseH;
            const resultCtx = this.canvasResult.getContext('2d');
            resultCtx.drawImage(this.originalCanvas, 0, 0);
            resultCtx.strokeStyle = 'rgb(255, 0, 0)';
            resultCtx.lineWidth = 6;
            resultCtx.strokeRect(cropX, cropY, cropWidth, cropHeight);
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

        const warpedColor = new cv.Mat();
        cv.warpPerspective(srcColor, warpedColor, M, new cv.Size(cropWidth, cropHeight));
        const binary = this.preprocessMat(warpedColor, { updatePreview: true });
        this.updateOcrFromBinary(binary, cropWidth, cropHeight, { updateCroppedPreview: true });

        // 預覽結果使用原始影像，疊加紅色方框
        this.canvasResult.width = srcColor.cols;
        this.canvasResult.height = srcColor.rows;
        const overlay = srcColor.clone();
        const red = [255, 0, 0, 255];
        cv.line(overlay, new cv.Point(tl.x, tl.y), new cv.Point(tr.x, tr.y), red, 6);
        cv.line(overlay, new cv.Point(tr.x, tr.y), new cv.Point(br.x, br.y), red, 6);
        cv.line(overlay, new cv.Point(br.x, br.y), new cv.Point(bl.x, bl.y), red, 6);
        cv.line(overlay, new cv.Point(bl.x, bl.y), new cv.Point(tl.x, tl.y), red, 6);
        // 角點提示（拖曳中只顯示紅線）
        if (!this.dragActive) {
            cv.circle(overlay, new cv.Point(tl.x, tl.y), 30, [255, 215, 0, 255], -1);
            cv.circle(overlay, new cv.Point(tr.x, tr.y), 30, [255, 215, 0, 255], -1);
            cv.circle(overlay, new cv.Point(br.x, br.y), 30, [255, 215, 0, 255], -1);
            cv.circle(overlay, new cv.Point(bl.x, bl.y), 30, [255, 215, 0, 255], -1);
        }
        cv.imshow(this.canvasResult, overlay);

        srcColor.delete();
        srcPts.delete();
        dstPts.delete();
        M.delete();
        warpedColor.delete();
        overlay.delete();

        if (window.cameraController) {
            const metrics = this.calculateMetrics(this.canvasCropped.getContext('2d').getImageData(0, 0, cropWidth, cropHeight));
            window.cameraController.imageDimensions.textContent = `${cropWidth} × ${cropHeight}`;
            window.cameraController.imageBrightness.textContent = `${metrics.brightness}/255`;
            window.cameraController.imageSharpness.textContent = metrics.sharpness > 50 ? '良好' : '一般';
        }
    }

    updateCropWithPoints(points) {
        if (!cv || !this.originalCanvas) return;
        const baseW = this.originalCanvas.width;
        const baseH = this.originalCanvas.height;
        const clampPoint = (p) => ({
            x: Math.max(0, Math.min(baseW - 1, p.x)),
            y: Math.max(0, Math.min(baseH - 1, p.y))
        });
        const pts = points.map(clampPoint);
        const [tl, tr, br, bl] = pts;

        // 拖曳中只更新紅框，避免每次都做透視運算（提高靈敏性）
        if (this.dragActive) {
            this.canvasResult.width = baseW;
            this.canvasResult.height = baseH;
            const ctx = this.canvasResult.getContext('2d', { willReadFrequently: true });
            ctx.drawImage(this.originalCanvas, 0, 0);
            ctx.strokeStyle = 'rgb(255, 0, 0)';
            ctx.lineWidth = 6;
            ctx.beginPath();
            ctx.moveTo(tl.x, tl.y);
            ctx.lineTo(tr.x, tr.y);
            ctx.lineTo(br.x, br.y);
            ctx.lineTo(bl.x, bl.y);
            ctx.closePath();
            ctx.stroke();
            return;
        }

        const widthTop = Math.hypot(tr.x - tl.x, tr.y - tl.y);
        const widthBottom = Math.hypot(br.x - bl.x, br.y - bl.y);
        const heightLeft = Math.hypot(bl.x - tl.x, bl.y - tl.y);
        const heightRight = Math.hypot(br.x - tr.x, br.y - tr.y);
        const outW = Math.max(1, Math.round(Math.max(widthTop, widthBottom)));
        const outH = Math.max(1, Math.round(Math.max(heightLeft, heightRight)));

        const srcPts = cv.matFromArray(4, 1, cv.CV_32FC2, [
            tl.x, tl.y, tr.x, tr.y, br.x, br.y, bl.x, bl.y
        ]);
        const dstPts = cv.matFromArray(4, 1, cv.CV_32FC2, [
            0, 0, outW, 0, outW, outH, 0, outH
        ]);
        const M = cv.getPerspectiveTransform(srcPts, dstPts);

        const srcColor = cv.imread(this.originalCanvas);
        const warpedColor = new cv.Mat();
        cv.warpPerspective(srcColor, warpedColor, M, new cv.Size(outW, outH));
        const binary = this.preprocessMat(warpedColor, { updatePreview: true });
        this.updateOcrFromBinary(binary, outW, outH, { updateCroppedPreview: true });

        // 原圖紅框 + 角點
        this.canvasResult.width = baseW;
        this.canvasResult.height = baseH;
        const overlay = srcColor.clone();
        const red = [255, 0, 0, 255];
        cv.line(overlay, new cv.Point(tl.x, tl.y), new cv.Point(tr.x, tr.y), red, 6);
        cv.line(overlay, new cv.Point(tr.x, tr.y), new cv.Point(br.x, br.y), red, 6);
        cv.line(overlay, new cv.Point(br.x, br.y), new cv.Point(bl.x, bl.y), red, 6);
        cv.line(overlay, new cv.Point(bl.x, bl.y), new cv.Point(tl.x, tl.y), red, 6);
        if (!this.dragActive) {
            cv.circle(overlay, new cv.Point(tl.x, tl.y), 30, [255, 215, 0, 255], -1);
            cv.circle(overlay, new cv.Point(tr.x, tr.y), 30, [255, 215, 0, 255], -1);
            cv.circle(overlay, new cv.Point(br.x, br.y), 30, [255, 215, 0, 255], -1);
            cv.circle(overlay, new cv.Point(bl.x, bl.y), 30, [255, 215, 0, 255], -1);
        }
        cv.imshow(this.canvasResult, overlay);

        srcColor.delete();
        srcPts.delete();
        dstPts.delete();
        M.delete();
        warpedColor.delete();
        overlay.delete();
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
            // 只更新 OCR friendly，不動預覽
            this.reprocessOcrOnly();
        };
        img.src = this.originalCanvas.toDataURL();
    }

    // 更新 OCR friendly + 預覽（用於切換對比方式）
    reprocessWithPreview() {
        if (!this.originalCanvas || !this.originalCanvas.width || !this.originalCanvas.height) return;
        if (this.cropPoints && this.cropPoints.length === 4) {
            this.updateCropWithPoints(this.cropPoints);
        } else if (this.detectedRect) {
            this.updateCrop();
        }
    }

    // 只更新 OCR friendly（不更新預覽畫布）
    reprocessOcrOnly() {
        if (this.cropPoints && this.cropPoints.length === 4) {
            this.updateOcrOnlyFromPoints(this.cropPoints);
            return;
        }
        if (this.detectedRect) {
            const { x, y, width, height } = this.detectedRect;
            const pts = [
                { x, y },
                { x: x + width, y },
                { x: x + width, y: y + height },
                { x, y: y + height }
            ];
            this.updateOcrOnlyFromPoints(pts);
        }
    }

    updateOcrOnlyFromPoints(points) {
        if (!cv || !this.originalCanvas || !points || points.length !== 4) return;
        const baseW = this.originalCanvas.width;
        const baseH = this.originalCanvas.height;
        const clampPoint = (p) => ({
            x: Math.max(0, Math.min(baseW - 1, p.x)),
            y: Math.max(0, Math.min(baseH - 1, p.y))
        });
        const pts = points.map(clampPoint);
        const [tl, tr, br, bl] = pts;

        const widthTop = Math.hypot(tr.x - tl.x, tr.y - tl.y);
        const widthBottom = Math.hypot(br.x - bl.x, br.y - bl.y);
        const heightLeft = Math.hypot(bl.x - tl.x, bl.y - tl.y);
        const heightRight = Math.hypot(br.x - tr.x, br.y - tr.y);
        const outW = Math.max(1, Math.round(Math.max(widthTop, widthBottom)));
        const outH = Math.max(1, Math.round(Math.max(heightLeft, heightRight)));

        const srcPts = cv.matFromArray(4, 1, cv.CV_32FC2, [
            tl.x, tl.y, tr.x, tr.y, br.x, br.y, bl.x, bl.y
        ]);
        const dstPts = cv.matFromArray(4, 1, cv.CV_32FC2, [
            0, 0, outW, 0, outW, outH, 0, outH
        ]);
        const M = cv.getPerspectiveTransform(srcPts, dstPts);

        const srcColor = cv.imread(this.originalCanvas);
        const warpedColor = new cv.Mat();
        cv.warpPerspective(srcColor, warpedColor, M, new cv.Size(outW, outH));
        const binary = this.preprocessMat(warpedColor, { updatePreview: false });
        this.updateOcrFromBinary(binary, outW, outH, { updateCroppedPreview: false });

        srcColor.delete();
        srcPts.delete();
        dstPts.delete();
        M.delete();
        warpedColor.delete();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.imageProcessor = new ImageProcessor();
    console.log('↓ 🖼️ [ImageProcessor] 初始化 ↓');
});
