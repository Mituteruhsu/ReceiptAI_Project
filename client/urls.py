from django.urls import path
from .views import InvoiceUploadPage
from .views import upload_invoice, iostest, uploadtest

urlpatterns = [
    path("upload/", InvoiceUploadPage.as_view(), name="invoice-upload-page"),
    path("upload/", upload_invoice, name="client-upload"),
    path("iostest/", iostest, name="iostest"),
    path("uploadtest/", uploadtest, name="uploadtest"),
]