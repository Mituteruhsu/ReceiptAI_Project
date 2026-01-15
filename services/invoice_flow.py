# services/invoice_flow.py
from PIL import Image
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
        if not raw_qrs:
            raise ValueError("raw_qrs 為空，無法解析發票")

        invoice = parse_qr_set(raw_qrs)

    # =========================
    # Case 2: 手機已 OCR
    # =========================
    elif isinstance(input_data, dict) and "raw_text" in input_data:
        raw_text = input_data["raw_text"]
        invoice = parse_ocr(raw_text)

    # =========================
    # Case 3: 圖片路徑（後端全處理）
    # =========================
    elif isinstance(input_data, Image.Image):
        # QR first
        qr_result = decode_qr(input_data)
        raw_qrs = qr_result.get("raw_qrs", [])

        if raw_qrs:
            invoice = parse_qr_set(raw_qrs)
        else:
            raw_text = extract_text(input_data)
            invoice = parse_ocr(raw_text)

    else:
        raise TypeError(
            "invoice_flow 只接受 dict(raw_qrs/raw_text) 或 PIL.Image.Image"
        )

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
