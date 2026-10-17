document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const errorMessage = document.getElementById('errorMessage');
    const btnSubmit = document.getElementById('btnSubmit');

    if (!loginForm) return;

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const emailInput = document.getElementById('email');
        const passwordInput = document.getElementById('password');

        if (!emailInput || !passwordInput) return;

        const email = emailInput.value.trim();
        const password = passwordInput.value;

        if (errorMessage) errorMessage.style.display = 'none';
        btnSubmit.disabled = true;
        btnSubmit.innerText = 'Memeriksa...';

        try {
            if (typeof supabaseClient === 'undefined') {
                throw new Error('Supabase client belum terkonfigurasi di config.js');
            }

            const { data, error } = await supabaseClient.auth.signInWithPassword({
                email: email,
                password: password
            });

            if (error || !data.session) {
                if (errorMessage) {
                    errorMessage.innerText = 'Email atau kata sandi salah!';
                    errorMessage.style.display = 'block';
                } else {
                    alert('Email atau kata sandi salah!');
                }
                btnSubmit.disabled = false;
                btnSubmit.innerText = 'Masuk';
                return;
            }

            // Redirect ke dashboard pegawai
            window.location.href = 'penjual-page/dashboard.html';

        } catch (err) {
            console.error('Login Error:', err);
            if (errorMessage) {
                errorMessage.innerText = err.message || 'Terjadi kesalahan sistem.';
                errorMessage.style.display = 'block';
            }
            btnSubmit.disabled = false;
            btnSubmit.innerText = 'Masuk';
        }
    });
});