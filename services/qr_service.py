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
        print("↓ QRService.decode() ↓")
        decoded_objs = decode(image)
        raw_qrs = []
        
        for obj in decoded_objs:
            try:
                data = obj.data.decode('utf-8').strip()
                # 過濾太短的資料
                if len(data) >= 8:
                    raw_qrs.append(data)
            except Exception:
                continue

        print(f"QRService.decode() raw_qrs: {raw_qrs}")
        print("↑ QRService.decode() ↑")
        return {'raw_qrs': raw_qrs}