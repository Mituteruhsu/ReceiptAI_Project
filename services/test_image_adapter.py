# services/test_image_adapter.py
from django.test import TestCase
from PIL import Image
import numpy as np
import base64
import io
from services.image_adapter import ImageAdapter, ImageAdapterError


class ImageAdapterTestCase(TestCase):
    
    def setUp(self):
        """建立測試影像"""
        self.test_image = Image.new('RGB', (100, 100), color='red')
    
    def test_from_pil_image(self):
        """測試 PIL.Image 來源"""
        result = ImageAdapter.from_source(self.test_image)
        self.assertIsInstance(result, Image.Image)
        self.assertEqual(result.mode, 'RGB')
    
    def test_from_bytes(self):
        """測試 bytes 來源"""
        buffer = io.BytesIO()
        self.test_image.save(buffer, format='JPEG')
        image_bytes = buffer.getvalue()
        
        result = ImageAdapter.from_source(image_bytes)
        self.assertIsInstance(result, Image.Image)
    
    def test_from_base64(self):
        """測試 base64 來源"""
        buffer = io.BytesIO()
        self.test_image.save(buffer, format='JPEG')
        image_base64 = base64.b64encode(buffer.getvalue()).decode()
        
        result = ImageAdapter.from_source(image_base64)
        self.assertIsInstance(result, Image.Image)
    
    def test_from_numpy(self):
        """測試 numpy array 來源"""
        img_array = np.array(self.test_image)
        result = ImageAdapter.from_source(img_array)
        self.assertIsInstance(result, Image.Image)
    
    def test_invalid_source(self):
        """測試無效來源"""
        with self.assertRaises(ImageAdapterError):
            ImageAdapter.from_source(None)
        
        with self.assertRaises(ImageAdapterError):
            ImageAdapter.from_source("invalid_string")