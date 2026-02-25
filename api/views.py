from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from services.invoice_flow import InvoiceFlow
import json

@csrf_exempt
@require_http_methods(["POST"])
def process_invoice(request):
    try:
        # Simplified image retrieval
        image_data = None
        if request.FILES.get('image'):
            image_data = request.FILES['image'].read()
        elif request.content_type == 'application/json':
            data = json.loads(request.body)
            image_data = data.get('image_base64')

        if not image_data:
            return JsonResponse({'success': False, 'error': 'No image data provided'}, status=400)

        # Execute the Flow
        flow = InvoiceFlow()
        invoice = flow.process(image_data)

        return JsonResponse({
            'success': True,
            'data': invoice.to_dict()
        })

    except Exception as e:
        return JsonResponse({'success': False, 'error': str(e)}, status=500)
