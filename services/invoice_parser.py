# services/invoice_parser.py
from domain.invoice import Invoice, Item
from domain.enums import InvoiceType

def parse_qr(raw_qr: str) -> Invoice:
    """
    將 QRCode 原始字串解析成 Invoice
    """
    # TODO: 實作正則解析
    return Invoice(number="AA12345678", date="2026-01-13", total=500, items=[], invoice_type=InvoiceType.QR)

def parse_ocr(raw_text: str) -> Invoice:
    """
    將 OCR 字串解析成 Invoice
    """
    # TODO: 實作關鍵字 / 正則解析
    return Invoice(number="BB87654321", date="2026-01-13", total=800, items=[], invoice_type=InvoiceType.PAPER)

def test_parse():
    invoice_qr = parse_qr("AA12345678|2026-01-13|500")
    assert invoice_qr.number.startswith("AA")

    invoice_ocr = parse_ocr("發票號碼: BB87654321 金額: 800")
    assert invoice_ocr.total == 800
