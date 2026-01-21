from django.urls import path
from .views import InvoiceUploadPage
from .views import upload_invoice, ios, iostest, uploadtest

urlpatterns = [
    path("upload/", InvoiceUploadPage.as_view(), name="invoice-upload-page"),
    path("upload/", upload_invoice, name="client-upload"),
    path("ios/", ios, name="ios"),
    path("iostest/", iostest, name="iostest"),
    path("uploadtest/", uploadtest, name="uploadtest"),
]