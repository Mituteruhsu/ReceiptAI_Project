# ReceiptAI 專案現況分析報告

## 1. 專案概觀
本專案是一個基於 Django 框架開發的發票辨識與管理系統，目標是透過 OCR (光學字元辨識) 與 QR Code 掃描技術，自動化解析台灣發票資訊並進行分類，最後同步至 Google Sheets。

目前專案正處於架構重構期（從傳統 Django 結構轉向領域驅動設計的模組化結構），因此程式碼中存在多處功能重疊與測試片段。

---

## 2. 個別功能模組分析

### A. API 層 (`api/`)
*   **功能：** 提供對外的發票處理介面 (`/api/process/`)。
*   **現況：**
    *   目前實作於 `api/views.py` 中，負責影像接收、QR 掃描、OCR 調用、解析與分類的流程控管。
    *   **斷點：** 與 `services/invoice_flow.py` 的職責重疊，API 層過於肥大，包含了過多業務邏輯。

### B. 服務層 (`services/`)
這是專案中最核心也最零散的部分：
1.  **影像適配 (`image_adapter.py`)：**
    *   **功能：** 統一處理 Base64、Bytes、Numpy 等各種影像格式轉為 PIL 物件。
    *   **優點：** 實作完整，具備影像標準化（EXIF 修正、RGB 轉換）功能。
2.  **QR 掃描 (`qr_service.py`)：**
    *   **功能：** 使用 `pyzbar` 辨識發票上的 QR Code。
    *   **現況：** 僅負責原始字串提取，未整合編碼判斷（Big5/UTF-8）。
3.  **OCR 系統 (`services/ocr/`)：**
    *   **Dual OCR 策略：** 包含 `ChiEngOCR` (中文品項) 與 `EngDigitsOCR` (數字金額)。
    *   **優點：** 策略設計正確，區分不同語系的辨識器可提高準確度。
    *   **缺點：** `ocr_service.py` 尚未完全與 `DualOCRService` 整合，目前仍有部分舊代碼使用 `easyocr`。
4.  **發票解析 (`invoice_parser.py`)：**
    *   **功能：** 將 QR 原始碼或 OCR 文本轉換為結構化資料。
    *   **現況：** 對於 QR 77 碼的解析邏輯較完整，但 OCR 解析僅使用簡單正則表達式，且無法處理雙 OCR 產出的合併資料。
5.  **分類系統 (`classify_service.py`)：**
    *   **功能：** 根據品名進行主分類與細分類。
    *   **現況：** 使用關鍵字規則比對，屬於基礎實作。

### C. 領域層 (`domain/`)
*   **現況：** 存在「雙軌制」。
    *   `models.py`: Django ORM 模型，用於資料庫持久化。
    *   `invoice.py` / `item.py`: 新定義的 Dataclasses，用於純業務邏輯運算。
*   **建議：** 應加速轉換，讓 Service 層統一操作 Dataclasses，僅在進入 Infrastructure 時才轉換為 ORM 模型。

### D. 基礎設施層 (`infrastructure/`)
*   **功能：** `google_sheets.py` 負責將資料寫入雲端試算表。
*   **現況：** 具備模擬模式 (Mock) 與實際憑證模式，有利於開發與測試。

---

## 3. 目前優點
1.  **模組化意圖清晰：** 專案目錄結構 (Domain, Services, Infrastructure) 符合現代軟體架構趨勢。
2.  **辨識策略專業：** 針對台灣發票採用 Dual OCR (中文 vs 數字) 是正確的優化方向。
3.  **影像預處理紮實：** `ImageAdapter` 與 `stream_prefilter` (前端概念) 顯示出對拍照品質的重視。

---

## 4. 改進建議與「斷點」修復
1.  **統一流程控管 (Invoice Flow)：**
    *   應將 `api/views.py` 內的邏輯全數移入 `services/invoice_flow.py`。
    *   API 層應僅負責「解析 Request」與「回傳 Response」。
2.  **整合雙 OCR 與 Parser：**
    *   重構 `InvoiceParser`，使其能接收 `DualOCRService` 產出的結構化 dict (ocr_a, ocr_b)。
    *   在 `InvoiceParser` 內實作字串清洗 (如 O 轉 0) 邏輯。
3.  **清理測試片段：**
    *   刪除 `services/` 下的 `test_*.py`（應移至 `tests/` 資料夾）。
    *   移除 `ocr_service.py` 中被註解掉的 `easyocr` 代碼。
4.  **數據流統一：**
    *   確保 `invoice_flow.py` 回傳的是 `domain.invoice.Invoice` 物件，而非 `dict`。
5.  **QR Code 編碼修復：**
    *   整合 `20260203_發票字軌.txt` 中的 `recode` 邏輯，處理 Big5 編碼的品項名稱。

---

## 5. 總結
本專案目前具備良好的骨幹，但由於開發過程中穿插了許多功能驗證 (Proof of Concept) 的腳本與測試檔案，導致核心流程 (Flow) 被切斷。下一步應專注於**「打通中樞神經」**：將影像從 API 進入，流經 Flow，透過雙 OCR 解析，轉為 Domain Object 分類，最後才由 Infrastructure 存檔。
