import json
import base64
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.shortcuts import render
from django.views import View

from api.views import process_invoice_internal

class InvoiceUploadPage(View):
    def get(self, request):
        return render(request, "client/upload.html")

@csrf_exempt
def upload_invoice(request):
    if request.method != "POST":
        return JsonResponse({"error": "POST only"}, status=405)

    body = json.loads(request.body)

    image_base64 = body.get("image_base64")
    meta = body.get("meta", {})

    if not image_base64:
        return JsonResponse({"error": "image missing"}, status=400)

    # 只負責轉交，不做 OCR / QR
    result = process_invoice_internal(
        image_base64=image_base64,
        meta=meta
    )

    return JsonResponse(result)

def ios(request):
    return render(request, "client/ios.html")

def iostest(request):
    return render(request, "client/iostest.html")

def uploadtest(request):
    return render(request, "client/uploadtest.html")