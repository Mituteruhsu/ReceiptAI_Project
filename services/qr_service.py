from pyzbar.pyzbar import decode
from PIL import Image


def decode_qr(image_path: str) -> dict:
    """
    掃描圖片中所有 QR / Barcode
    回傳已過濾的 QR 原始字串
    """
    image = Image.open(image_path)
    decoded_objs = decode(image)

    raw_qrs = []

    for obj in decoded_objs:
        try:
            data = obj.data.decode("utf-8").strip()
        except Exception:
            continue

        # 過濾太短或非可用資料
        if len(data) < 8:
            continue

        raw_qrs.append(data)

    return {"raw_qrs": raw_qrs}
