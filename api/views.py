# api/views.py
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.core.files.uploadedfile import InMemoryUploadedFile
from django.conf import settings
import hashlib
import json
import logging
import os
import re
import uuid

from services.image_adapter import ImageAdapter, ImageAdapterError
from services.qr_service import QRService
from services.ocr_service import OCRService
from services.invoice_parser import InvoiceParser
from services.classify_service import InvoiceClassifier

logger = logging.getLogger(__name__)


@csrf_exempt
@require_http_methods(["POST"])
def save_image(request):
    """
    將前端上傳的影像儲存到 static/imgs，回傳可存取的靜態 URL
    """
    if not request.FILES.get('image'):
        return JsonResponse({
            'success': False,
            'error': '沒有收到影像檔案'
        }, status=400)

    file = request.FILES['image']
    overwrite = str(request.POST.get('overwrite', '')).lower() in ('1', 'true', 'yes')
    requested_name = (request.POST.get('filename') or '').strip()
    _, ext = os.path.splitext(file.name)
    if not ext:
        content_type = (getattr(file, 'content_type', '') or '').lower()
        if content_type == 'image/png':
            ext = '.png'
        elif content_type == 'image/webp':
            ext = '.webp'
        else:
            ext = '.jpg'

    save_dir = settings.BASE_DIR / 'static' / 'imgs'
    os.makedirs(save_dir, exist_ok=True)

    # 以內容雜湊作為檔名，避免重複儲存同樣的圖
    file_bytes = file.read()
    if overwrite:
        base = os.path.splitext(os.path.basename(requested_name or 'capture_original'))[0]
        base = re.sub(r'[^A-Za-z0-9_-]+', '', base) or 'capture_original'
        filename = f"{base}{ext}"
    else:
        file_hash = hashlib.sha256(file_bytes).hexdigest()
        filename = f"capture_{file_hash}{ext}"
    save_path = save_dir / filename

    # 同名時直接覆寫，確保用最新更新
    with open(save_path, 'wb') as f:
        f.write(file_bytes)

    static_base = settings.STATIC_URL
    if not static_base.startswith('/'):
        static_base = '/' + static_base
    url = f"{static_base}imgs/{filename}"

    return JsonResponse({
        'success': True,
        'url': url,
        'filename': filename
    })


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
            print('api/views.py process_invoice() - file upload detected')
            file = request.FILES['image']
            image = ImageAdapter.from_source(file.read())
            print('api/views.py process_invoice() - image loaded from file')
            print(f'api/views.py process_invoice() - image name: {image}, image size: {image.size}')
        
        # Case 2: Base64
        elif request.content_type == 'application/json':
            print('api/views.py process_invoice() - JSON base64 detected')
            data = json.loads(request.body)
            image_base64 = data.get('image_base64')
            print('api/views.py process_invoice() - base64 image loaded')
            print(f'api/views.py process_invoice() - image_base64 length: {len(image_base64) if image_base64 else 0}')
            if image_base64:
                print('api/views.py process_invoice() - converting base64 to image')
                image = ImageAdapter.from_source(image_base64)
        
        if image is None:
            return JsonResponse({
                'success': False,
                'error': '缺少影像資料'
            }, status=400)
        
        # 步驟 1: 嘗試 QR Code
        qr_result = QRService.decode(image)
        print("api/views.py QRService.decode() - result:")
        # print(f'QR Code result: {qr_result}')
        raw_qrs = qr_result.get('raw_qrs', [])
        print(f'api/views.py process_invoice() - Raw QR codes: {raw_qrs}')
        
        parsed_data = None
        
        if raw_qrs:
            # 有 QR → 解析 QR
            logger.info(f"檢測到 {len(raw_qrs)} 個 QR Code")
            print(f"api/views.py process_invoice() - 檢測到 {len(raw_qrs)} 個 QR Code")
            parsed_data = InvoiceParser.parse_qr(raw_qrs)
            print(f"api/views.py process_invoice() - \n\tParsed data from QR: {parsed_data}")
            request.session['raw_qr_data'] = raw_qrs
        else:
            # 無 QR → 使用 OCR
            logger.info("未檢測到 QR Code，使用 OCR")
            print("api/views.py process_invoice() - 未檢測到 QR Code，使用 OCR")
            ocr_service = OCRService()
            ocr_result = ocr_service.extract_text(image)
            raw_text = ocr_result.get('raw_text', '')
            
            if not raw_text:
                return JsonResponse({
                    'success': False,
                    'error': '無法辨識發票內容'
                }, status=400)
            
            request.session['raw_ocr_data'] = raw_text
            parsed_data = InvoiceParser.parse_ocr(raw_text)
        
        # 步驟 2: 分類
        classified_result = InvoiceClassifier.classify(parsed_data)
        print(f'api/views.py process_invoice() - \n\tClassified result: \n\t{classified_result}')
        # 合併結果
        result = {
            **parsed_data,
            'category': classified_result['main_category'],
            'subcategory': classified_result['main_subcategory'],
            'items': classified_result['items']
        }
        print(f"api/views.py process_invoice() - \n\tFinal result: {result}")

        request.session['invoice_data'] = result
        request.session.modified = True
        
        print("api/views.py process_invoice() - returning JsonResponse")
        print(f"api/views.py process_invoice() - end")
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
