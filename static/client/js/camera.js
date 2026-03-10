document.addEventListener("DOMContentLoaded", () => {

    const startBtn = document.getElementById("startCamera");
    const captureBtn = document.getElementById("capture");
    const stopBtn = document.getElementById("stopCamera");

    const video = document.getElementById("video");
    const canvas = document.getElementById("originalCanvas");
    const placeholder = document.getElementById("cameraPlaceholder");

    let stream = null;

    // 開啟相機
    startBtn.addEventListener("click", async () => {
        try {

            stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: "environment",
                    // 設定一個超出一般規格的理想值，瀏覽器會回傳該裝置支援的最高規格
                    width: { ideal: 4096 }, 
                    height: { ideal: 2160 }
                },
                audio: false
            });

            video.srcObject = stream;

            video.classList.remove("d-none");
            placeholder.classList.add("d-none");

            startBtn.classList.add("d-none");
            captureBtn.classList.remove("d-none");
            stopBtn.classList.remove("d-none");

        } catch (err) {
            alert("無法開啟相機: " + err.message);
        }
    });


    // 拍照
    captureBtn.addEventListener("click", () => {

        const width = video.videoWidth;
        const height = video.videoHeight;

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        ctx.drawImage(video, 0, 0, width, height);

        // 轉成圖片
        canvas.toBlob((blob) => {

            const url = URL.createObjectURL(blob);

            const a = document.createElement("a");
            a.href = url;
            a.download = "invoice_photo.png";
            a.click();

            URL.revokeObjectURL(url);

        }, "image/png");

    });


    // 關閉相機
    stopBtn.addEventListener("click", () => {

        if (stream) {
            stream.getTracks().forEach(track => track.stop());
        }

        video.srcObject = null;

        video.classList.add("d-none");
        placeholder.classList.remove("d-none");

        startBtn.classList.remove("d-none");
        captureBtn.classList.add("d-none");
        stopBtn.classList.add("d-none");

    });

});