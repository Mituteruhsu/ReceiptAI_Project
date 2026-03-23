# services/qr_service.py
from pyzbar.pyzbar import decode
from PIL import Image
from typing import List, Dict


class QRService:
    """QR Code 掃描服務"""
    
    @staticmethod
    def decode(image: Image.Image) -> Dict[str, List[str]]:
        """
        掃描影像中的所有 QR Code
        
        Returns:
            {'raw_qrs': ['qr_string_1', 'qr_string_2']}
        """
        print("services/qr_service.py QRService.decode() - called")
        decoded_objs = decode(image)
        raw_qrs = []

        def decode_bytes(data: bytes) -> str:
            # 若 pyzbar 回傳的是已解碼字串，嘗試以 latin1 還原原始 bytes 再解碼
            if isinstance(data, str):
                try:
                    return decode_bytes(data.encode("latin1"))
                except Exception:
                    return data.strip()
            # 嘗試多種常見編碼，避免出現亂碼
            for enc in ("utf-8", "utf-8-sig", "big5hkscs", "big5", "cp950", "gb18030", "shift_jis", "latin1"):
                try:
                    text = data.decode(enc).strip()
                    if text:
                        return text
                except Exception:
                    continue
            return data.decode("utf-8", errors="replace").strip()
        
        for obj in decoded_objs:
            try:
                data = decode_bytes(obj.data)
                # 過濾太短的資料
                if len(data) >= 8:
                    raw_qrs.append(data)
            except Exception:
                continue
        print(f"services/qr_service.py QRService.decode() - decoded {len(raw_qrs)} QR codes")
        return {'raw_qrs': raw_qrs}
