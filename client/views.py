from django.shortcuts import render

def upload(request):
    return render(request, 'client/upload.html')

def confirm(request):
    return render(request, 'client/confirm.html')
