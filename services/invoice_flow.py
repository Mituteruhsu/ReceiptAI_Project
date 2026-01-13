from services.qr_service import decode_qr
from services.ocr_service import extract_text
from services.invoice_parser import parse_invoice
from services.classify_service import classify_invoice
from infrastructure.google_sheets import save_invoice

def process_invoice(input_data):
    """
    input_data: dict (Raw JSON) 或 str (圖片路徑)
    """
    # Step1: 判斷輸入
    if isinstance(input_data, dict):
        invoice = parse_invoice(input_data)
    else:
        # 嘗試 QR
        try:
            qr_data = decode_qr(input_data)
            invoice = parse_invoice(qr_data)
        except:
            # QR 失敗 -> OCR
            text = extract_text(input_data)
            invoice = parse_invoice(text)

    # Step2: AI 分類
    invoice = classify_invoice(invoice)

    # Step3: 輸出到 Google Sheet
    save_invoice(invoice)

    return invoice
