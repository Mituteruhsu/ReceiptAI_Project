from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status

from api.serializers import InvoiceUploadSerializer
from services.invoice_flow import process_invoice
from services.image_adapter import adapt_to_image, ImageAdapterError


class InvoiceUploadView(APIView):
    """
    Client 統一入口：
    - Web
    - iOS
    - Android
    """

    def post(self, request):
        serializer = InvoiceUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        try:
            input_data = self._build_input(data)
            result = process_invoice(input_data)
        except ImageAdapterError as e:
            return Response(
                {"error": str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
        except Exception as e:
            return Response(
                {"error": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

        return Response(result, status=status.HTTP_200_OK)

    def _build_input(self, data):
        """
        將 Client payload 轉為 invoice_flow 可接受的 input
        """
        # Case 1: Client already decoded QR
        if "raw_qrs" in data:
            return {
                "raw_qrs": data["raw_qrs"]
            }

        # Case 2: Client already OCR
        if "raw_text" in data:
            return {
                "raw_text": data["raw_text"]
            }

        # Case 3: Image base64 → PIL.Image
        if "image" in data:
            return adapt_to_image(data["image"])

        raise ValueError("無法建立有效的 invoice input")
