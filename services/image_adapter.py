# services/image_adapter.py
from PIL import Image, ImageOps
import numpy as np
import base64
import io
from typing import Union


class ImageAdapterError(Exception):
    """影像適配器錯誤"""
    pass


class ImageAdapter:
    """統一影像格式處理"""
    
    @staticmethod
    def from_source(source: Union[Image.Image, np.ndarray, bytes, str]) -> Image.Image:
        """
        將各種來源轉為 PIL.Image
        
        Args:
            source: PIL.Image | numpy.ndarray | bytes | base64 string
            
        Returns:
            PIL.Image.Image (RGB mode)
        """
        if source is None:
            raise ImageAdapterError("影像來源為空")
        
        # Case 1: 已經是 PIL.Image
        if isinstance(source, Image.Image):
            image = source
        
        # Case 2: numpy array (OpenCV)
        elif isinstance(source, np.ndarray):
            if source.size == 0:
                raise ImageAdapterError("空的 numpy array")
            # BGR → RGB
            if len(source.shape) == 3 and source.shape[2] == 3:
                image = Image.fromarray(source[:, :, ::-1])
            else:
                image = Image.fromarray(source)
        
        # Case 3: bytes
        elif isinstance(source, bytes):
            try:
                image = Image.open(io.BytesIO(source))
            except Exception as e:
                raise ImageAdapterError(f"無效的影像 bytes: {e}")
        
        # Case 4: base64 string
        elif isinstance(source, str):
            try:
                # 移除 data URI prefix
                if ',' in source:
                    source = source.split(',', 1)[1]
                decoded = base64.b64decode(source)
                image = Image.open(io.BytesIO(decoded))
            except Exception as e:
                raise ImageAdapterError(f"無效的 base64 字串: {e}")
        
        else:
            raise ImageAdapterError(f"不支援的影像類型: {type(source)}")
        
        return ImageAdapter._normalize(image)
    
    @staticmethod
    def _normalize(image: Image.Image) -> Image.Image:
        """標準化影像"""
        # 修正 EXIF 方向
        try:
            image = ImageOps.exif_transpose(image)
        except Exception:
            pass
        
        # 轉為 RGB
        if image.mode != 'RGB':
            image = image.convert('RGB')
        
        # 驗證尺寸
        if image.width <= 0 or image.height <= 0:
            raise ImageAdapterError("無效的影像尺寸")
        
        return image
    
    @staticmethod
    def to_bytes(image: Image.Image, format='JPEG', quality=95) -> bytes:
        """轉為 bytes"""
        buffer = io.BytesIO()
        image.save(buffer, format=format, quality=quality)
        return buffer.getvalue()


