# services/ocr_service.py
import easyocr

# 建立 reader，只初始化一次
reader = easyocr.Reader(['ch_tra'], gpu=False)  # gpu=True 可加速，但需 GPU

def extract_text(image_path: str) -> str:
    """
    輸入: 發票圖片
    輸出: OCR 完整文字
    """
    result = reader.readtext(image_path, detail=0)
    return "\n".join(result)

def test_ocr_service():
    text = extract_text("recive20220708.jpg")
    assert len(text) > 0
    print(text)

if __name__ == "__main__":
    test_ocr_service()