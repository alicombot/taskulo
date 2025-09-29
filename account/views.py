import datetime
import random

from django.contrib.auth import authenticate, login, logout

from django.contrib.auth.decorators import login_required

from django.http import JsonResponse
from django.shortcuts import render, redirect
from django.template.loader import render_to_string
from django.views.decorators.http import require_POST

from account.forms import LoginForm, SignUpForm
from account.models import User
from django.core.mail import EmailMultiAlternatives


# Create your views here.



def user_login(request):
    if request.method == 'POST':
        form = LoginForm(request.POST)
        if form.is_valid():
            cd = form.cleaned_data
            email = cd['email']
            password = cd['password']
            user = authenticate(request, email=email, password=password)
            if user is not None:
                login(request, user)
                return redirect('task:index')
            else:
                form.add_error(None, 'Email or password incorrect')

    else:
        form = LoginForm()

    context = {
        'form': form,
    }

    return render(request, 'registration/login.html', context)


def sign_up(request):
    if request.method == 'POST':
        form = SignUpForm(request.POST)
        if form.is_valid():
            cd = form.cleaned_data
            user = User.objects.create(
                email=cd['email'],
                first_name=cd['name'],
                last_name=cd['last_name'],
                is_active=False
            )
            user.set_password(cd['password'])
            user.save()
            request.session['verification_email'] = user.email
            return redirect('account:verify_email')
    else:
        form = SignUpForm()

    context = {
        'form': form,
    }

    return render(request, 'registration/signup.html', context)


def verify_email(request):
    if request.method == 'POST':
        email = request.POST.get('email')
        action = request.POST.get('action')
        

        if action == 'resend':
            if 'verification_email' not in request.session:
                return JsonResponse({
                    "success": False,
                    "message": "No verification session found. Please register again."
                })

            current_time = datetime.datetime.now().timestamp()
            expiry_time = request.session.get('verification_expiry')


            if expiry_time and current_time < expiry_time:
                remaining_seconds = int(expiry_time - current_time)
                return JsonResponse({
                    "success": False,
                    "message": "Please wait before requesting a new code.",
                    "remaining_seconds": remaining_seconds
                })
            
            email = request.session['verification_email']
            verification_code = random.randint(1000, 9999)
            request.session['verification_code'] = verification_code
            request.session['verification_expiry'] = (datetime.datetime.now() + datetime.timedelta(minutes=2)).timestamp()

            context = { 'verification_code': verification_code }
            plain_message = render_to_string('registration/verify_email_code.txt', context)
            html_message = render_to_string('registration/verify_email_code.html', context)

            s_email = EmailMultiAlternatives(
                subject='Your Taskulo verification code',
                body=plain_message,
                from_email='alicombotpc@gmail.com',
                to=[email]
            )
            s_email.attach_alternative(html_message, 'text/html')
            s_email.send(fail_silently=False)

            return JsonResponse({
                "success": True,
                "message": "New verification code sent to your email!",
                "remaining_seconds": 120
            })
        

        v_code = request.POST.get('verification_code')

        current_time = datetime.datetime.now().timestamp()
        expiry_time = request.session.get('verification_expiry')
        if current_time > expiry_time:
            return JsonResponse({
                "success": False,
                "message": "Verification code expired"
            })


        if 'verification_code' not in request.session:
            return JsonResponse({
                "success": False,
                "message": "No verification code found. Please request a new one."
            })

        saved_code = request.session['verification_code']

        if v_code == str(saved_code):

            if 'verification_email' in request.session:
                search_email = request.session['verification_email']
            else:
                search_email = email
            
            
            user = User.objects.filter(email__iexact=search_email).first()
            
            if user is None:
                return JsonResponse({
                    "success": False,
                    "message": "User not found. Please check your email address."
                })
            
            user.is_active = True
            user.save()


            if 'verification_code' in request.session:
                del request.session['verification_code']
            if 'verification_email' in request.session:
                del request.session['verification_email']

            return JsonResponse({
                "success": True,
                "redirect_url": "/account/login/"
            })
        else:
            return JsonResponse({
                "success": False,
                "message": "Invalid verification code"
            })
    

    if 'verification_email' not in request.session:
        return redirect('account:sign_up')



    email = request.session['verification_email']
    expiry_time = request.session.get('verification_expiry')
    if not expiry_time or datetime.datetime.now().timestamp() >= expiry_time:
        verification_code = random.randint(1000, 9999)
        request.session['verification_code'] = verification_code
        request.session['verification_expiry'] = (datetime.datetime.now() + datetime.timedelta(minutes=2)).timestamp()

        context = { 'verification_code': verification_code }
        plain_message = render_to_string('registration/verify_email_code.txt', context)
        html_message = render_to_string('registration/verify_email_code.html', context)

        s_email = EmailMultiAlternatives(
            subject='Your Taskulo verification code',
            body=plain_message,
            from_email='alicombotpc@gmail.com',
            to=[email]
        )
        s_email.attach_alternative(html_message, 'text/html')
        s_email.send(fail_silently=False)

    current_time = datetime.datetime.now().timestamp()
    remaining_seconds = max(0, int(request.session.get('verification_expiry') - current_time)) if request.session.get('verification_expiry') else 0

    return render(request, 'registration/verify-email.html', {
        'email': email,
        'remaining_seconds': remaining_seconds
    })


@require_POST
def account(request):
    user = User.objects.get(email=request.user)
    data = {
        'name': user.first_name,
        'lastname': user.last_name,
        'username': user.username,
        'email': user.email,
        'photo': user.photo.url if user.photo else None,
    }
    return JsonResponse(data)


@login_required
def update_avatar(request):
    if request.FILES.get('photo'):
        user = request.user
        user.photo = request.FILES.get('photo')
        user.save()
        return JsonResponse({'photo': user.photo.url if user.photo else None})
    return JsonResponse({'error': 'No file uploaded'}, status=400)


@login_required
def update_user(request):
    user = request.user
    name = request.POST.get('name')
    user.last_name = request.POST.get('lastname')
    username = request.POST.get('username')
    email = request.POST.get('gmail')

    if name:
        user.first_name = name
    else:
        return JsonResponse({'field': 'name', 'message': 'required field.'}, status=400)

    if email:
        if email != user.email:
            if User.objects.filter(email=email).exclude(pk=user.pk).exists():
                return JsonResponse({'field': 'email', 'message': 'Email already exists'}, status=400)
            user.email = email
    else:
        return JsonResponse({'field': 'email', 'message': 'required field.'}, status=400)

    if username and username != user.username:
        if User.objects.filter(username=username).exclude(id=user.id).exists():
            return JsonResponse({'field': 'username', 'message': 'Username already exists'}, status=400)
        user.username = username
    else:
        user.username = username

    user.save()
    return JsonResponse({'status': 'success', 'message': 'Changes saved successfully'})


@login_required
def log_out(request):
    logout(request)
    return redirect('landing:landing')
