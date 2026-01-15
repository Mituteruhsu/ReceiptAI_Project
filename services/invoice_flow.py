# services/invoice_flow.py

from services.qr_service import decode_qr
from services.ocr_service import extract_text
from services.invoice_parser import parse_qr_set, parse_ocr
from services.classify_service import classify_invoice
from infrastructure.google_sheets import save_invoice


def process_invoice(input_data):
    """
    支援輸入：
    1. image path (str)               → Web / 手機拍照
    2. dict { raw_qrs: [...] }        → iPhone / Android 已掃 QR
    3. dict { raw_text: "..." }       → 手機已 OCR
    """

    invoice = None

    # =========================
    # Case 1: 手機 / 前端已掃 QR
    # =========================
    if isinstance(input_data, dict) and "raw_qrs" in input_data:
        raw_qrs = input_data["raw_qrs"]
        if raw_qrs:
            invoice = parse_qr_set(raw_qrs)
        else:
            raise ValueError("raw_qrs 為空，無法解析發票")

    # =========================
    # Case 2: 手機已 OCR
    # =========================
    elif isinstance(input_data, dict) and "raw_text" in input_data:
        invoice = parse_qr_set(input_data["raw_text"])

    # =========================
    # Case 3: 圖片路徑（後端全處理）
    # =========================
    elif isinstance(input_data, str):
        # 先嘗試 QR
        qr_result = decode_qr(input_data)
        raw_qrs = qr_result.get("raw_qrs", [])

        if raw_qrs:
            invoice = parse_qr_set(raw_qrs)
        else:
            # QR 失敗 → OCR
            raw_text = extract_text(input_data)
            invoice = parse_ocr(raw_text)

    else:
        raise TypeError("不支援的 input_data 型態")

    # =========================
    # 分類
    # =========================
    classify_result = classify_invoice(invoice)

    # =========================
    # 儲存（Google Sheets）
    # =========================
    save_invoice(invoice, classify_result)

    return {
        "invoice": invoice,
        "classification": classify_result
    }
