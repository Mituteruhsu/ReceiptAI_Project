/**
 * OCR-Friendly 影像處理器
 * 優化影像以提高辨識率
 */
class ImageProcessor {
    constructor() {
        this.originalCanvas = document.getElementById('originalCanvas');
        this.processedCanvas = document.getElementById('processedCanvas');
        this.originalCtx = this.originalCanvas.getContext('2d');
    }

    async loadImage(imageSource) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            const url = URL.createObjectURL(imageSource);
            img.onload = () => {
                URL.revokeObjectURL(url);
                this.originalCanvas.width = img.width;
                this.originalCanvas.height = img.height;
                this.originalCtx.drawImage(img, 0, 0);
                const initialRect = this.detectInvoiceBoundary(img);
                resolve({ img, initialRect });
            };
            img.onerror = () => {
                URL.revokeObjectURL(url);
                reject(new Error('影像載入失敗'));
            };
            img.src = url;
        });
    }

    detectInvoiceBoundary(img) {
        if (typeof cv === 'undefined' || !cv.Mat) {
            console.warn('OpenCV not loaded, returning default boundary');
            return { x: img.width * 0.1, y: img.height * 0.1, width: img.width * 0.8, height: img.height * 0.8 };
        }

        let src = cv.imread(img);
        let gray = new cv.Mat();
        let blur = new cv.Mat();
        let binary = new cv.Mat();
        let edges = new cv.Mat();

        cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
        cv.GaussianBlur(gray, blur, new cv.Size(5, 5), 0);
        cv.adaptiveThreshold(blur, binary, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY_INV, 15, 10);
        cv.Canny(binary, edges, 40, 120);
        let kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(25, 25));
        cv.dilate(edges, edges, kernel);

        let contours = new cv.MatVector();
        let hierarchy = new cv.Mat();
        cv.findContours(edges, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

        let rects = [];
        for (let i = 0; i < contours.size(); i++) {
            let rect = cv.boundingRect(contours.get(i));
            if (rect.width * rect.height > 800) rects.push(rect);
        }

        let finalRect;
        if (rects.length > 0) {
            let maxRect = rects.reduce((p, c) => (c.width * c.height > p.width * p.height ? c : p));
            let verticalOverlapRects = rects.filter(r => !(r.x + r.width < maxRect.x || r.x > maxRect.x + maxRect.width));
            let minX = Math.min(...verticalOverlapRects.map(r => r.x));
            let maxX = Math.max(...verticalOverlapRects.map(r => r.x + r.width));
            let minY = Math.min(...verticalOverlapRects.map(r => r.y));
            let maxY = Math.max(...verticalOverlapRects.map(r => r.y + r.height));
            finalRect = { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
        } else {
            finalRect = { x: Math.round(src.cols * 0.1), y: Math.round(src.rows * 0.1), width: Math.round(src.cols * 0.8), height: Math.round(src.rows * 0.8) };
        }

        src.delete(); gray.delete(); blur.delete(); binary.delete(); edges.delete(); kernel.delete(); contours.delete(); hierarchy.delete();
        return finalRect;
    }

    applyFinalProcessing(img, box) {
        if (typeof cv === 'undefined' || !cv.Mat) {
            this.processedCanvas.width = box.width;
            this.processedCanvas.height = box.height;
            const ctx = this.processedCanvas.getContext('2d');
            ctx.drawImage(img, box.x, box.y, box.width, box.height, 0, 0, box.width, box.height);
            return { width: box.width, height: box.height, metrics: { brightness: 128, sharpness: 50 }, canvas: this.processedCanvas };
        }

        let src = cv.imread(img);
        let rect = new cv.Rect(Math.max(0, box.x), Math.max(0, box.y), Math.min(src.cols - box.x, box.width), Math.min(src.rows - box.y, box.height));
        let cropped = src.roi(rect);
        let gray = new cv.Mat();
        cv.cvtColor(cropped, gray, cv.COLOR_RGBA2GRAY);
        let final = new cv.Mat();
        cv.adaptiveThreshold(gray, final, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY, 21, 10);

        this.processedCanvas.width = final.cols;
        this.processedCanvas.height = final.rows;
        cv.imshow(this.processedCanvas, final);

        let mean = cv.mean(final)[0];
        src.delete(); cropped.delete(); gray.delete(); final.delete();

        return { width: this.processedCanvas.width, height: this.processedCanvas.height, metrics: { brightness: Math.round(mean), sharpness: 100 }, canvas: this.processedCanvas };
    }

    async canvasToBlob(canvas, quality = 0.9) {
        return new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', quality));
    }
}

document.addEventListener('DOMContentLoaded', () => { window.imageProcessor = new ImageProcessor(); });
