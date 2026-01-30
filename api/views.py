# api/views.py
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.core.files.uploadedfile import InMemoryUploadedFile
import json
import logging

from services.image_adapter import ImageAdapter, ImageAdapterError
from services.qr_service import QRService
from services.ocr_service import OCRService
from services.invoice_parser import InvoiceParser
from services.classify_service import InvoiceClassifier

logger = logging.getLogger(__name__)


@csrf_exempt
@require_http_methods(["POST"])
def process_invoice(request):
    print('api/views.py process_invoice')
    """
    處理發票辨識流程
    
    接受:
        - multipart/form-data: image (檔案上傳)
        - application/json: image_base64 (base64 字串)
    
    回傳:
        {
            'success': true,
            'data': {
                'number': 'DF62269413',
                'date': '2022-07-08',
                'total': 103,
                'items': [...],
                'category': 'food',
                'invoice_type': 'qr'
            }
        }
    """
    try:
        # 取得影像
        image = None
        
        # Case 1: 檔案上傳
        if request.FILES.get('image'):
            print('api/views.py process_invoice - file upload detected')
            file = request.FILES['image']
            image = ImageAdapter.from_source(file.read())
            print('api/views.py process_invoice - image loaded from file')
            print(f'api/views.py process_invoice - image name: {image.name}, image size: {image.size}')
        
        # Case 2: Base64
        elif request.content_type == 'application/json':
            print('api/views.py process_invoice - JSON base64 detected')
            data = json.loads(request.body)
            image_base64 = data.get('image_base64')
            print('api/views.py process_invoice - base64 image loaded')
            print(f'api/views.py process_invoice - image_base64 length: {len(image_base64) if image_base64 else 0}')
            if image_base64:
                print('api/views.py process_invoice - converting base64 to image')
                image = ImageAdapter.from_source(image_base64)
        
        if image is None:
            return JsonResponse({
                'success': False,
                'error': '缺少影像資料'
            }, status=400)
        
        # 步驟 1: 嘗試 QR Code
        qr_result = QRService.decode(image)
        raw_qrs = qr_result.get('raw_qrs', [])
        
        parsed_data = None
        
        if raw_qrs:
            # 有 QR → 解析 QR
            logger.info(f"檢測到 {len(raw_qrs)} 個 QR Code")
            parsed_data = InvoiceParser.parse_qr(raw_qrs)
        else:
            # 無 QR → 使用 OCR
            logger.info("未檢測到 QR Code，使用 OCR")
            ocr_service = OCRService()
            ocr_result = ocr_service.extract_text(image)
            raw_text = ocr_result.get('raw_text', '')
            
            if not raw_text:
                return JsonResponse({
                    'success': False,
                    'error': '無法辨識發票內容'
                }, status=400)
            
            parsed_data = InvoiceParser.parse_ocr(raw_text)
        
        # 步驟 2: 分類
        classified_result = InvoiceClassifier.classify(parsed_data)
        
        # 合併結果
        result = {
            **parsed_data,
            'category': classified_result['main_category'],
            'items': classified_result['items']
        }
        
        return JsonResponse({
            'success': True,
            'data': result
        })
        
    except ImageAdapterError as e:
        logger.error(f"影像處理錯誤: {e}")
        return JsonResponse({
            'success': False,
            'error': f'影像處理失敗: {str(e)}'
        }, status=400)
        
    except ValueError as e:
        logger.error(f"解析錯誤: {e}")
        return JsonResponse({
            'success': False,
            'error': f'發票解析失敗: {str(e)}'
        }, status=400)
        
    except Exception as e:
        logger.exception("處理發票時發生未預期的錯誤")
        return JsonResponse({
            'success': False,
            'error': '系統錯誤，請稍後再試'
        }, status=500)
