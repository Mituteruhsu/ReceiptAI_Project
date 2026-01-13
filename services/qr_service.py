# services/qr_service.py
from pyzbar.pyzbar import decode
from PIL import Image

def decode_qr(image_path: str) -> dict:
    """
    輸入: QRCode 圖片路徑
    輸出: dict {number, date, total, items=[]}
    """
    image = Image.open(image_path)
    decoded_objs = decode(image)
    if not decoded_objs:
        return {}

    # 假設只取第一個 QRCode
    data_str = decoded_objs[0].data.decode('utf-8')
    # 這裡暫時只回傳原始字串，後續 Parser 會解析
    return {"raw_qr": data_str}

def test_qr_service():
    result = decode_qr("recive20220708.jpg")
    assert "raw_qr" in result
    print(result)

if __name__ == "__main__":
    test_qr_service()