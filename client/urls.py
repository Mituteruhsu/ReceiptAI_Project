# client/urls.py (新增 API 路由)
from django.urls import path
from . import views

app_name = 'client'

urlpatterns = [
    path('', views.UploadView.as_view(), name='upload'),
    path('confirm/', views.ConfirmView.as_view(), name='confirm'),
    path('success/', views.SuccessView.as_view(), name='success'),
]