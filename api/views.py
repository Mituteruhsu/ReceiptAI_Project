from rest_framework.decorators import api_view
from rest_framework.response import Response
from services.invoice_flow import process_invoice

@api_view(['POST'])
def scan_invoice(request):
    data = request.data
    """
    接收前端傳來的 Raw JSON 或圖片
    目前先回傳測試訊息
    """
    invoice = process_invoice(data)
    return Response({
        "status": "success",
        "invoice_number": invoice.number,
        "total": invoice.total,
        "category": invoice.category.name
    })