# services/invoice_parser.py
from domain.invoice import Invoice, Item
from domain.enums import InvoiceType
from datetime import datetime

def parse_qr_set(raw_qrs: list[str]) -> Invoice:
    """
    將「一組 QRCode 原始字串」解析成一張 Invoice
    台灣電子發票：
    - QR1:Header(發票號碼、日期、金額…）
    - QR2:Items(品項）
    """

    header_qr = None
    item_qr = None

    # 1. 判斷哪一個是 Header / Item
    for qr in raw_qrs:
        if qr.count(":") >= 10:
            item_qr = qr
        else:
            header_qr = qr

    if not header_qr:
        raise ValueError("找不到發票 Header QR")

    # 2️. 解析 Header QR
    # 範例：DF622694131110708397000000003000000030000000008547587XKsayZY706hvyFpe6k3TQ==
    invoice_number = header_qr[:10]
    roc_date = header_qr[10:17]  # 民國年月日
    total_amount = int(header_qr[29:37])

    date = _roc_to_ad_date(roc_date)

    items: list[Item] = []

    # 3️. 解析 Item QR（如果存在）
    if item_qr:
        items = _parse_item_qr(item_qr)

    return Invoice(
        number=invoice_number,
        date=date,
        total=total_amount,
        items=items,
        invoice_type=InvoiceType.QR
    )

def _parse_item_qr(item_qr: str) -> list[Item]:
    """
    QR2 Item 格式：
    :序號:數量:金額:品名:數量:金額:品名...
    """
    parts = item_qr.split(":")[5:]
    items = []

    for i in range(0, len(parts), 3):
        try:
            name = parts[i]
            qty = int(parts[i + 1])
            price = int(parts[i + 2])
            items.append(Item(name=name, qty=qty, price=price))
        except (IndexError, ValueError):
            continue

    return items

def _roc_to_ad_date(roc: str) -> str:
    """
    民國日期轉西元
    1110708 -> 2022-07-08
    """
    year = int(roc[:3]) + 1911
    month = int(roc[3:5])
    day = int(roc[5:7])
    return f"{year:04d}-{month:02d}-{day:02d}"

# =========================
# 舊介面保留（單 QR 測試）
# =========================
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

# =========================
# 可直接執行測試（非語法糖）
# =========================

def test_parse_qr_set():
    raw_qrs = [
        "DF622694131110708397000000003000000030000000008547587XKsayZY706hvyFpe6k3TQ==",
        "**********:2:2:1:野川蛋黃派10粒:1:65:可口可樂1250CC:1:38"
    ]

    invoice = parse_qr_set(raw_qrs)

    print("=== Invoice Parsed ===")
    print("Number:", invoice.number)
    print("Date:", invoice.date)
    print("Total:", invoice.total)
    print("Items:")
    for item in invoice.items:
        print("-", item.name, item.qty, item.price)

if __name__ == "__main__":
    test_parse_qr_set()