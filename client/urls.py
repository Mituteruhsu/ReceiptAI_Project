from django.urls import path
from .views import InvoiceUploadPage

urlpatterns = [
    path("upload/", InvoiceUploadPage.as_view(), name="invoice-upload-page"),
]