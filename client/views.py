from django.shortcuts import render
from django.views import View


class InvoiceUploadPage(View):
    def get(self, request):
        return render(request, "client/upload.html")
