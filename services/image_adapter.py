# services/image_adapter.py

from typing import Union
from PIL import Image, ImageOps
import numpy as np
import base64
import io


class ImageAdapterError(Exception):
    """Image Adapter 層級錯誤"""
    pass


def adapt_to_image(
    source: Union[
        Image.Image,
        np.ndarray,
        bytes,
        str,          # base64 string
    ]
) -> Image.Image:
    """
    將各種來源的影像資料，統一轉為 PIL.Image.Image

    支援：
    - PIL.Image.Image
    - numpy.ndarray (OpenCV / Camera frame)
    - raw bytes
    - base64 string (不含 data URI prefix)

    不支援：
    - path（檔案路徑應在更外層處理）
    """

    if source is None:
        raise ImageAdapterError("Image source is None")

    # =========================
    # Case 1: Already PIL.Image
    # =========================
    if isinstance(source, Image.Image):
        image = source

    # =========================
    # Case 2: numpy.ndarray
    # =========================
    elif isinstance(source, np.ndarray):
        if source.size == 0:
            raise ImageAdapterError("Empty numpy frame")

        # 預設假設來自 OpenCV: BGR → RGB
        if len(source.shape) == 3 and source.shape[2] == 3:
            image = Image.fromarray(source[:, :, ::-1])
        else:
            image = Image.fromarray(source)

    # =========================
    # Case 3: raw bytes
    # =========================
    elif isinstance(source, bytes):
        try:
            image = Image.open(io.BytesIO(source))
        except Exception as e:
            raise ImageAdapterError("Invalid image bytes") from e

    # =========================
    # Case 4: base64 string
    # =========================
    elif isinstance(source, str):
        try:
            decoded = base64.b64decode(source)
            image = Image.open(io.BytesIO(decoded))
        except Exception as e:
            raise ImageAdapterError("Invalid base64 image string") from e

    else:
        raise ImageAdapterError(f"Unsupported image source type: {type(source)}")

    # =========================
    # Normalize Image
    # =========================
    image = _normalize_image(image)

    return image


def _normalize_image(image: Image.Image) -> Image.Image:
    """
    影像標準化：
    - 套用 EXIF orientation
    - 轉為 RGB
    - 驗證尺寸
    """

    # 修正手機拍照方向
    try:
        image = ImageOps.exif_transpose(image)
    except Exception:
        pass

    # 統一為 RGB
    if image.mode != "RGB":
        image = image.convert("RGB")

    # 基本 sanity check
    width, height = image.size
    if width <= 0 or height <= 0:
        raise ImageAdapterError("Invalid image size")

    return image
