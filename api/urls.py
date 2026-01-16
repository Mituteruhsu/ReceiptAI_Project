from django.urls import path
from . import views
from api.views import InvoiceUploadView

urlpatterns = [
    path("invoice/upload/", InvoiceUploadView.as_view()),
]