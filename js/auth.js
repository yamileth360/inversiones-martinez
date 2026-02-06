const loginForm = document.getElementById('loginForm');

if (loginForm) {
    loginForm.addEventListener('submit', (e) => {
        e.preventDefault();

        const usuario = document.getElementById('usuario').value.trim();
        const password = document.getElementById('password').value.trim();

        if (usuario === "" || password === "") {
            alert("⚠️ Por favor, ingresa tu cédula y contraseña.");
            return;
        }

        // Credenciales de Inversiones Martínez
        if (usuario === "admin" && password === "1234") {
            const sesionUsuario = {
                cedula: usuario,
                rol: "admin",
                nombre: " ",
                loginTime: new Date().getTime()
            };
            
            // Usamos sessionStorage para que la sesión se cierre al cerrar la pestaña
            sessionStorage.setItem('adminLogueado', 'true');
            localStorage.setItem('sesion', JSON.stringify(sesionUsuario));

            window.location.href = "dashboard.html";
        } else {
            alert("❌ Credenciales incorrectas. Intenta de nuevo.");
        }
    });
}