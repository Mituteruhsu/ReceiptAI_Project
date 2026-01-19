// client/templates/client/js/camera_assist.js
/*
 * 相機輔助系統 - 提供實時拍照品質反饋
 * 
 * 架構說明：
 * 1. 即時分析每一幀影像
 * 2. 品質指標（清晰度、亮度、對比度）
 * 3. 發票穩定偵測（StreamPreFilter）
 * 4. 發票區域框線與提示訊息
 * 5. 自動或手動拍照
 * 
 * 重要：這些只是「輔助」，不保證後端可用性
 */

class CameraAssist {
    constructor() {
        this.video = document.getElementById('video');
        this.canvas = document.getElementById('canvas');
        this.overlay = document.getElementById('invoice-overlay');
        this.assistPanel = document.getElementById('assist-panel');
        
        this.ctx = this.canvas.getContext('2d');

        this.isAnalyzing = false;
        this.messageHistory = [];
        this.MAX_MESSAGES = 5;

        // StreamPreFilter
        this.prefilter = new StreamPreFilter(5, 30);

        // 拍照完成 callback
        this.onCapture = null;
    }

    // ====================
    // 啟動實時分析
    // startRealTimeAnalysis()
    // - requestAnimationFrame(analyze)
    // ====================
    startRealTimeAnalysis(stream) {
        if (!stream) {
            console.error('[CameraAssist] stream is required');
            return;
        }

        console.log('✓ 初始化相機輔助系統');

        this._bindStream(stream);
        this._prepareVideo();
    }

    _bindStream(stream) {
        this.video.srcObject = stream;
        this.assistPanel.style.display = 'block';
    }

    _prepareVideo() {
        this.video.onloadedmetadata = () => {
            this._onVideoReady();
        };
    }

    async _onVideoReady() {
        try {
            await this.video.play();

            this.isAnalyzing = true;
            console.log('✓ 相機已啟動，開始分析');

            this._startAnalyzeLoop();
        } catch (err) {
            console.error('❌ video.play() 失敗', err);
            this.isAnalyzing = false;
        }
    }

    _startAnalyzeLoop() {
        const tick = () => {
            if (!this.isAnalyzing) return;

            if (this.video.videoWidth === 0) {
                requestAnimationFrame(tick);
                return;
            }

            this.analyzeFrame();
            requestAnimationFrame(tick);
        };

        requestAnimationFrame(tick);
    }

    // ====================
    // 停止實時分析
    // stopRealTimeAnalysis()
    // ====================
    stopRealTimeAnalysis() {
        this.isAnalyzing = false;
        this.assistPanel.style.display = 'none';
        console.log('✓ 相機輔助已停止');
    }

    // ====================
    // 分析單一幀
    // analyzeFrame()
    // ====================
    analyzeFrame() {
        if (!this.video.videoWidth) return;

        try {
            // 畫幀到 canvas
            this.canvas.width = this.video.videoWidth;
            this.canvas.height = this.video.videoHeight;
            this.ctx.drawImage(this.video, 0, 0);

            // --- 品質檢測報告 ---
            // 獲取品質指標
            const report = imageProcessor.getQualityReport();
            // 更新 UI
            this.updateQualityIndicators(report);
            this.updateMessages(report);
            this.drawInvoiceOverlay(report.invoiceRect);

            // ★ StreamPreFilter 判斷幀是否穩定可拍照
            const readyToCapture = this.prefilter.feed(this.ctx, this.canvas);
            // 自動拍照
            if (readyToCapture) {
                console.log("[CameraAssist] 幀穩定，自動拍照");
                this.captureAuto();
            }

        } catch (error) {
            console.error('分析幀失敗:', error);
        }
    }

    // ====================
    // 自動拍照
    // captureAuto()
    // ====================
    captureAuto() {
        if (!this.isAnalyzing) return;
        this.isAnalyzing = false;

        const dataUrl = this.canvas.toDataURL('image/jpeg', 0.95);
        if (this.onCapture) this.onCapture(dataUrl);

        console.log("📸 自動拍照完成");
        this.stopRealTimeAnalysis();
    }
    
    // ====================
    // 手動拍照
    // capturePhoto()
    // ====================
    capturePhoto() {
        if (!this.video.videoWidth) return null;
        const dataUrl = this.canvas.toDataURL('image/jpeg', 0.95);
        if (this.onCapture) this.onCapture(dataUrl);
        return dataUrl;
    }

    // ====================
    // UI / 品質顯示(更新品質指標條)
    // updateQualityIndicators(report)
    // ====================
    updateQualityIndicators(report) {
        // 清晰度
        this.updateIndicator('sharpness', report.sharpness, 70, 90);

        // 亮度（理想範圍 80-200）
        let brightnessScore = 0;
        if (report.brightness < 50) {
            brightnessScore = (report.brightness / 50) * 50;
        } else if (report.brightness > 220) {
            brightnessScore = ((255 - report.brightness) / 35) * 50 + 50;
        } else {
            brightnessScore = 100;
        }
        this.updateIndicator('brightness', Math.round(brightnessScore), 70, 90);

        // 對比度（理想 > 40）
        this.updateIndicator('contrast', report.contrast, 40, 60);
    }

    // ====================
    // 更新單個指標
    // updateIndicator(name, value, warningThreshold, errorThreshold)
    // ====================
    updateIndicator(name, value, warningThreshold, errorThreshold) {
        const bar = document.getElementById(`${name}-bar`);
        const valueSpan = document.getElementById(`${name}-value`);
        const fill = bar.querySelector('.fill');

        valueSpan.textContent = value;

        // 計算百分比（限制 0-100）
        const percent = Math.min(100, value);
        fill.style.width = percent + '%';

        // 根據閾值改變顏色
        fill.className = 'fill';
        if (value < errorThreshold) {
            fill.classList.add('error');
        } else if (value < warningThreshold) {
            fill.classList.add('warning');
        }
    }

    // ====================
    // 更新使用者訊息
    // updateMessages(report)
    // ====================
    updateMessages(report) {
        const messages = [];

        // 清晰度提示
        if (report.sharpness < 50) {
            messages.push('❌ 影像模糊 - 請穩定相機');
        } else if (report.sharpness < 70) {
            messages.push('⚠️ 請靠近或保持穩定');
        } else {
            messages.push('✓ 清晰度良好');
        }

        // 亮度提示
        if (report.brightness < 50) {
            messages.push('❌ 環境光線太暗 - 請移到亮處');
        } else if (report.brightness < 80) {
            messages.push('⚠️ 光線不足 - 建議在更亮的地方拍攝');
        } else if (report.brightness > 220) {
            messages.push('⚠️ 過度曝光 - 請避免強烈背光');
        } else {
            messages.push('✓ 亮度適中');
        }

        // 對比度提示
        if (report.contrast < 30) {
            messages.push('⚠️ 對比度低 - 請嘗試調整角度');
        } else {
            messages.push('✓ 對比度良好');
        }

        // 發票檢測提示
        if (report.invoiceRect) {
            messages.push('✓ 已檢測到發票');
        } else {
            messages.push('📋 請將發票對準鏡頭');
        }

        this.displayMessages(messages);
    }

    // ====================
    // 顯示訊息
    // displayMessages(messages)
    // ====================
    displayMessages(messages) {
        const messageList = document.getElementById('message-list');
        
        // 最多顯示 5 條訊息
        const displayMessages = messages.slice(0, this.MAX_MESSAGES);
        
        messageList.innerHTML = displayMessages
            .map((msg, index) => {
                let type = 'info';
                if (msg.includes('✓')) type = 'success';
                if (msg.includes('⚠️')) type = 'warning';
                if (msg.includes('❌')) type = 'error';
                
                return `<div class="message ${type}">${msg}</div>`;
            })
            .join('');
    }

    // ====================
    // 繪製發票框線
    // drawInvoiceOverlay(rect)
    // ====================
    drawInvoiceOverlay(rect) {
        if (!rect) {
            this.overlay.style.display = 'none';
            return;
        }

        this.overlay.style.display = 'block';
        this.overlay.style.width = rect.width + 'px';
        this.overlay.style.height = rect.height + 'px';
        this.overlay.style.left = rect.x + 'px';
        this.overlay.style.top = rect.y + 'px';
    }

    // ====================
    // 獲取當前幀的 Base64
    // getCurrentFrameBase64(quality)
    // ====================
    getCurrentFrameBase64(quality = 0.9) {
        if (!this.video.videoWidth) {
            console.error('影像尚未準備好');
            return null;
        }

        this.canvas.width = this.video.videoWidth;
        this.canvas.height = this.video.videoHeight;
        const ctx = this.canvas.getContext('2d');
        ctx.drawImage(this.video, 0, 0);

        try {
            const dataUrl = this.canvas.toDataURL('image/jpeg', quality);
            return dataUrl.split(',')[1];
        } catch (error) {
            console.error('無法轉換為 Base64:', error);
            return null;
        }
    }

    // ====================
    // 處理拍照（含前置處理）
    // processCapture()
    // ====================
    async processCapture() {
        const base64 = this.getCurrentFrameBase64();
        if (!base64) {
            showStatus('❌ 無法擷取影像', 'error');
            return null;
        }

        // 注：實際的影像標準化（EXIF、Resize 等）在後端進行
        // 前端只進行輕度增強（可選）
        
        return {
            base64: base64,
            quality: imageProcessor.getQualityReport(),
            timestamp: new Date().toISOString()
        };
    }
}

// ====================
// StreamPreFilter Class 整合
// ====================
class StreamPreFilter {
    constructor(stableFrames = 5, cooldownFrames = 30) {
        this.stableFrames = stableFrames;
        this.cooldownFrames = cooldownFrames;
        this._hitCount = 0;
        this._cooldown = 0;
    }

    feed(ctx, canvas) {
        if (this._cooldown > 0) { this._cooldown--; return false; }
        if (!this._basicCheck(ctx, canvas)) { this._reset(); return false; }
        if (this._looksLikeInvoice(ctx, canvas)) this._hitCount++;
        else this._hitCount = 0;
        if (this._hitCount >= this.stableFrames) { this._trigger(); return true; }
        return false;
    }

    _basicCheck(ctx, canvas) {
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const brightness = this._calcBrightness(imageData);
        const sharpness = this._calcSharpness(imageData);
        if (brightness < 70 || brightness > 210) return false;
        if (sharpness < 60) return false;
        return true;
    }

    _calcBrightness(imageData) {
        let sum = 0; const data = imageData.data;
        for (let i=0;i<data.length;i+=4) sum += data[i];
        return sum/(data.length/4);
    }

    _calcSharpness(imageData) {
        if (typeof cv==='undefined') return 999;
        let src=cv.matFromImageData(imageData), gray=new cv.Mat(), lap=new cv.Mat();
        cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
        cv.Laplacian(gray, lap, cv.CV_64F);
        let mean=new cv.Mat(), std=new cv.Mat();
        cv.meanStdDev(lap, mean, std);
        const variance = std.doubleAt(0,0)**2;
        src.delete(); gray.delete(); lap.delete(); mean.delete(); std.delete();
        return variance;
    }

    _looksLikeInvoice(ctx, canvas) {
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const whiteRatio = this._calcWhiteRatio(imageData);
        return whiteRatio >= 0.45;
    }

    _calcWhiteRatio(imageData) {
        const data = imageData.data; let whitePixels = 0;
        for (let i=0;i<data.length;i+=4) {
            const r=data[i], g=data[i+1], b=data[i+2];
            if(r>200 && g>200 && b>200) whitePixels++;
        }
        return whitePixels / (data.length/4);
    }

    _trigger() { this._hitCount=0; this._cooldown=this.cooldownFrames; }
    _reset() { this._hitCount=0; }
}

// =================================================
// 以下 static/client/js/camera_assist.js
// class CameraAssist {
//     constructor() {
//         this.video = document.getElementById('video');
//         this.canvas = document.getElementById('canvas');
//         this.overlay = document.getElementById('invoice-overlay');
//         this.assistPanel = document.getElementById('assist-panel');
        
//         this.isAnalyzing = false;
//         this.messageHistory = [];
//         this.MAX_MESSAGES = 5;
//     }

//     /**
//      * 啟動實時分析
//      */
//     startRealTimeAnalysis() {
//         if (this.isAnalyzing) return;
//         this.isAnalyzing = true;

//         console.log('✓ 相機輔助已啟動');
//         this.assistPanel.style.display = 'block';

//         const analyze = () => {
//             if (!this.isAnalyzing) return;

//             this.analyzeFrame();
//             requestAnimationFrame(analyze);
//         };

//         requestAnimationFrame(analyze);
//     }

//     /**
//      * 停止實時分析
//      */
//     stopRealTimeAnalysis() {
//         this.isAnalyzing = false;
//         this.assistPanel.style.display = 'none';
//         console.log('✓ 相機輔助已停止');
//     }

//     /**
//      * 分析單一幀
//      */
//     analyzeFrame() {
//         if (!this.video.videoWidth) return;

//         try {
//             // 複製幀到 canvas
//             this.canvas.width = this.video.videoWidth;
//             this.canvas.height = this.video.videoHeight;
//             const ctx = this.canvas.getContext('2d');
//             ctx.drawImage(this.video, 0, 0);

//             // 獲取品質指標
//             const report = imageProcessor.getQualityReport();

//             // 更新 UI
//             this.updateQualityIndicators(report);
//             this.updateMessages(report);
//             this.drawInvoiceOverlay(report.invoiceRect);

//         } catch (error) {
//             console.error('分析幀失敗:', error);
//         }
//     }

//     /**
//      * 更新品質指標條
//      */
//     updateQualityIndicators(report) {
//         // 清晰度
//         this.updateIndicator('sharpness', report.sharpness, 70, 90);

//         // 亮度（理想範圍 80-200）
//         let brightnessScore = 0;
//         if (report.brightness < 50) {
//             brightnessScore = (report.brightness / 50) * 50;
//         } else if (report.brightness > 220) {
//             brightnessScore = ((255 - report.brightness) / 35) * 50 + 50;
//         } else {
//             brightnessScore = 100;
//         }
//         this.updateIndicator('brightness', Math.round(brightnessScore), 70, 90);

//         // 對比度（理想 > 40）
//         this.updateIndicator('contrast', report.contrast, 40, 60);
//     }

//     /**
//      * 更新單個指標
//      */
//     updateIndicator(name, value, warningThreshold, errorThreshold) {
//         const bar = document.getElementById(`${name}-bar`);
//         const valueSpan = document.getElementById(`${name}-value`);
//         const fill = bar.querySelector('.fill');

//         valueSpan.textContent = value;

//         // 計算百分比（限制 0-100）
//         const percent = Math.min(100, value);
//         fill.style.width = percent + '%';

//         // 根據閾值改變顏色
//         fill.className = 'fill';
//         if (value < errorThreshold) {
//             fill.classList.add('error');
//         } else if (value < warningThreshold) {
//             fill.classList.add('warning');
//         }
//     }

//     /**
//      * 更新使用者訊息
//      */
//     updateMessages(report) {
//         const messages = [];

//         // 清晰度提示
//         if (report.sharpness < 50) {
//             messages.push('❌ 影像模糊 - 請穩定相機');
//         } else if (report.sharpness < 70) {
//             messages.push('⚠️ 請靠近或保持穩定');
//         } else {
//             messages.push('✓ 清晰度良好');
//         }

//         // 亮度提示
//         if (report.brightness < 50) {
//             messages.push('❌ 環境光線太暗 - 請移到亮處');
//         } else if (report.brightness < 80) {
//             messages.push('⚠️ 光線不足 - 建議在更亮的地方拍攝');
//         } else if (report.brightness > 220) {
//             messages.push('⚠️ 過度曝光 - 請避免強烈背光');
//         } else {
//             messages.push('✓ 亮度適中');
//         }

//         // 對比度提示
//         if (report.contrast < 30) {
//             messages.push('⚠️ 對比度低 - 請嘗試調整角度');
//         } else {
//             messages.push('✓ 對比度良好');
//         }

//         // 發票檢測提示
//         if (report.invoiceRect) {
//             messages.push('✓ 已檢測到發票');
//         } else {
//             messages.push('📋 請將發票對準鏡頭');
//         }

//         this.displayMessages(messages);
//     }

//     /**
//      * 顯示訊息
//      */
//     displayMessages(messages) {
//         const messageList = document.getElementById('message-list');
        
//         // 最多顯示 5 條訊息
//         const displayMessages = messages.slice(0, this.MAX_MESSAGES);
        
//         messageList.innerHTML = displayMessages
//             .map((msg, index) => {
//                 let type = 'info';
//                 if (msg.includes('✓')) type = 'success';
//                 if (msg.includes('⚠️')) type = 'warning';
//                 if (msg.includes('❌')) type = 'error';
                
//                 return `<div class="message ${type}">${msg}</div>`;
//             })
//             .join('');
//     }

//     /**
//      * 繪製發票框線
//      */
//     drawInvoiceOverlay(rect) {
//         if (!rect) {
//             this.overlay.style.display = 'none';
//             return;
//         }

//         this.overlay.style.display = 'block';
//         this.overlay.style.width = rect.width + 'px';
//         this.overlay.style.height = rect.height + 'px';
//         this.overlay.style.left = rect.x + 'px';
//         this.overlay.style.top = rect.y + 'px';
//     }

//     /**
//      * 獲取當前幀的 Base64
//      */
//     getCurrentFrameBase64(quality = 0.9) {
//         if (!this.video.videoWidth) {
//             console.error('影像尚未準備好');
//             return null;
//         }

//         this.canvas.width = this.video.videoWidth;
//         this.canvas.height = this.video.videoHeight;
//         const ctx = this.canvas.getContext('2d');
//         ctx.drawImage(this.video, 0, 0);

//         try {
//             const dataUrl = this.canvas.toDataURL('image/jpeg', quality);
//             return dataUrl.split(',')[1];
//         } catch (error) {
//             console.error('無法轉換為 Base64:', error);
//             return null;
//         }
//     }

//     /**
//      * 處理拍照（含前置處理）
//      */
//     async processCapture() {
//         const base64 = this.getCurrentFrameBase64();
//         if (!base64) {
//             showStatus('❌ 無法擷取影像', 'error');
//             return null;
//         }

//         // 注：實際的影像標準化（EXIF、Resize 等）在後端進行
//         // 前端只進行輕度增強（可選）
        
//         return {
//             base64: base64,
//             quality: imageProcessor.getQualityReport(),
//             timestamp: new Date().toISOString()
//         };
//     }
// }