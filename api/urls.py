from django.urls import path
from . import views

app_name = 'api'
urlpatterns = [
    path('save-image/', views.save_image, name='save_image'),
    path('process/', views.process_invoice, name='process'),
]
