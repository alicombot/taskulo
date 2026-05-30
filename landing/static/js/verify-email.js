// Email Verification JavaScript for Django Integration
document.addEventListener('DOMContentLoaded', function() {
    const codeInputs = document.querySelectorAll('.verify-code-input');
    const verifyBtn = document.getElementById('verifyBtn');
    const resendBtn = document.getElementById('resendBtn');
    const errorMessage = document.getElementById('errorMessage');
    const successMessage = document.getElementById('successMessage');
    const emailDisplay = document.getElementById('emailDisplay');
    const countdown = document.getElementById('countdown');
    const countdownTimer = document.getElementById('countdownTimer');

    let currentInputIndex = 0;
    let resendCooldown = 60; // default 60s, will be overridden by server
    let cooldownInterval;

    // Get email from URL parameters or localStorage
    function getEmailFromStorage() {
        const urlParams = new URLSearchParams(window.location.search);
        let email = urlParams.get('email') || localStorage.getItem('email') || emailDisplay.textContent;
        
        // Clean the email - remove whitespace and trim
        if (email) {
            email = email.trim();
            // Remove any invisible characters
            email = email.replace(/[\u200B-\u200D\uFEFF]/g, '');
        }
        
        emailDisplay.textContent = email;
        return email;
    }

    // Initialize email display
    getEmailFromStorage();

    // Initialize cooldown from server-provided remaining seconds
    const initialRemaining = parseInt(resendBtn.getAttribute('data-remaining') || '0', 10);
    if (!isNaN(initialRemaining) && initialRemaining > 0) {
        startResendCooldown(initialRemaining);
    }

    // Handle code input navigation
    codeInputs.forEach((input, index) => {
        input.addEventListener('input', function(e) {
            const value = e.target.value;
            
            // Only allow numbers
            if (!/^\d$/.test(value)) {
                e.target.value = '';
                return;
            }

            // Add filled class for styling
            if (value) {
                e.target.classList.add('filled');
            } else {
                e.target.classList.remove('filled');
            }

            // Move to next input
            if (value && index < codeInputs.length - 1) {
                codeInputs[index + 1].focus();
            }

            // Check if all inputs are filled
            checkAllInputsFilled();
        });

        input.addEventListener('keydown', function(e) {
            // Handle backspace
            if (e.key === 'Backspace' && !e.target.value && index > 0) {
                codeInputs[index - 1].focus();
            }
            
            // Handle arrow keys
            if (e.key === 'ArrowLeft' && index > 0) {
                codeInputs[index - 1].focus();
            }
            if (e.key === 'ArrowRight' && index < codeInputs.length - 1) {
                codeInputs[index + 1].focus();
            }
        });

        input.addEventListener('paste', function(e) {
            e.preventDefault();
            const pastedData = e.clipboardData.getData('text').replace(/\D/g, '');
            
            if (pastedData.length === 4) {
                for (let i = 0; i < 4; i++) {
                    codeInputs[i].value = pastedData[i] || '';
                    codeInputs[i].classList.add('filled');
                }
                checkAllInputsFilled();
                codeInputs[3].focus();
            }
        });
    });

    // Check if all inputs are filled
    function checkAllInputsFilled() {
        const allFilled = Array.from(codeInputs).every(input => input.value);
        verifyBtn.disabled = !allFilled;
    }

    // Get verification code
    function getVerificationCode() {
        return Array.from(codeInputs).map(input => input.value).join('');
    }

    // Show error message
    function showError(message) {
        errorMessage.textContent = message;
        errorMessage.style.display = 'block';
        successMessage.style.display = 'none';
        
        // Clear inputs
        codeInputs.forEach(input => {
            input.value = '';
            input.classList.remove('filled');
        });
        codeInputs[0].focus();
        verifyBtn.disabled = true;
    }

    // Show success message
    function showSuccess(message) {
        successMessage.textContent = message;
        successMessage.style.display = 'block';
        errorMessage.style.display = 'none';
        verifyBtn.disabled = true;
    }

    // Hide messages
    function hideMessages() {
        errorMessage.style.display = 'none';
        successMessage.style.display = 'none';
    }

    // Verify email with Django
    verifyBtn.addEventListener('click', function() {
        const code = getVerificationCode();
        const email = getEmailFromStorage();
        
        if (code.length !== 4) {
            showError('Please enter a complete 4-digit code');
            return;
        }

        // Disable button during verification
        verifyBtn.disabled = true;
        verifyBtn.textContent = 'Verifying...';
        hideMessages();

        // Create form data for Django
        const formData = new FormData();
        formData.append('email', email);
        formData.append('verification_code', code);
        formData.append('csrfmiddlewaretoken', getCookie('csrftoken'));

        // Send to Django view
        fetch('/account/verify-email/', {
            method: 'POST',
            body: formData,
            headers: {
                'X-CSRFToken': getCookie('csrftoken')
            }
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                showSuccess('Email verified successfully! Redirecting...');
                
                // Store verification status
                localStorage.setItem('emailVerified', 'true');
                
                // Redirect after 2 seconds
                setTimeout(() => {
                    window.location.href = data.redirect_url || '/account/login/';
                }, 2000);
            } else {
                showError(data.message || 'Invalid verification code. Please try again.');
            }
        })
        .catch(error => {
            console.error('Error:', error);
            showError('An error occurred. Please try again.');
        })
        .finally(() => {
            verifyBtn.disabled = false;
            verifyBtn.textContent = 'Verify Email';
        });
    });

    // Resend verification code
    resendBtn.addEventListener('click', function() {
        const email = getEmailFromStorage();
        
        resendBtn.disabled = true;
        resendBtn.textContent = 'Sending...';
        hideMessages();

        // Create form data for Django
        const formData = new FormData();
        formData.append('email', email);
        formData.append('action', 'resend');
        formData.append('csrfmiddlewaretoken', getCookie('csrftoken'));

        // Send to Django view
        fetch('/account/verify-email/', {
            method: 'POST',
            body: formData,
            headers: {
                'X-CSRFToken': getCookie('csrftoken')
            }
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                showSuccess('New verification code sent to your email!');
                startResendCooldown(typeof data.remaining_seconds === 'number' ? data.remaining_seconds : 120);
            } else {
                // If backend returns remaining_seconds, use it to continue cooldown
                if (typeof data.remaining_seconds === 'number' && data.remaining_seconds > 0) {
                    startResendCooldown(data.remaining_seconds);
                }
                showError(data.message || 'Failed to send verification code. Please try again.');
            }
        })
        .catch(error => {
            console.error('Error:', error);
            showError('An error occurred. Please try again.');
        })
        .finally(() => {
            // Button state handled by cooldown
            if (resendCooldown <= 0) {
                resendBtn.disabled = false;
                resendBtn.textContent = 'Resend Code';
            }
        });
    });

    // Start resend cooldown
    function formatTime(totalSeconds) {
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        const mm = String(minutes).padStart(2, '0');
        const ss = String(seconds).padStart(2, '0');
        return `${mm}:${ss}`;
    }

    function startResendCooldown(seconds) {
        if (cooldownInterval) {
            clearInterval(cooldownInterval);
        }
        resendCooldown = typeof seconds === 'number' ? seconds : 60;
        resendBtn.disabled = true;
        resendBtn.classList.add('is-disabled');
        resendBtn.textContent = 'Wait';
        countdown.style.display = 'block';
        countdownTimer.textContent = formatTime(resendCooldown);

        cooldownInterval = setInterval(() => {
            resendCooldown--;
            countdownTimer.textContent = formatTime(resendCooldown);
            
            if (resendCooldown <= 0) {
                clearInterval(cooldownInterval);
                resendBtn.disabled = false;
                resendBtn.classList.remove('is-disabled');
                resendBtn.textContent = 'Resend Code';
                countdown.style.display = 'none';
            }
        }, 1000);
    }

    // Get CSRF token from cookies
    function getCookie(name) {
        let cookieValue = null;
        if (document.cookie && document.cookie !== '') {
            const cookies = document.cookie.split(';');
            for (let i = 0; i < cookies.length; i++) {
                const cookie = cookies[i].trim();
                if (cookie.substring(0, name.length + 1) === (name + '=')) {
                    cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                    break;
                }
            }
        }
        return cookieValue;
    }

    // Focus first input on load
    codeInputs[0].focus();
});
