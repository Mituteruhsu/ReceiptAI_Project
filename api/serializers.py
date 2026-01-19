from rest_framework import serializers

class DeviceInfoSerializer(serializers.Serializer):
    platform = serializers.CharField(required=False)
    has_qr = serializers.BooleanField(required=False)
    has_ocr = serializers.BooleanField(required=False)


class InvoiceUploadSerializer(serializers.Serializer):
    image = serializers.CharField(required=False)      # base64
    raw_qrs = serializers.ListField(
        child=serializers.CharField(),
        required=False
    )
    raw_text = serializers.CharField(required=False)
    device = DeviceInfoSerializer(required=False)

    def validate(self, data):
        if not any(k in data for k in ("image", "raw_qrs", "raw_text")):
            raise serializers.ValidationError(
                "至少需要 image / raw_qrs / raw_text 其中一種"
            )
        return data
