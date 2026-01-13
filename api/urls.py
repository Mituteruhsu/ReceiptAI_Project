from django.urls import path
from . import views

urlpatterns = [
    path('invoice/scan/', views.scan_invoice, name='scan_invoice')
]