from django.urls import path
from . import views

app_name = 'api'

urlpatterns = [
    path('process/', views.process_invoice, name='process'),
]
