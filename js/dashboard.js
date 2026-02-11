// js/dashboard.js - Inversiones Martínez
// Sincronización 100% en vivo 

// 1. SEGURIDAD INMEDIATA
(function () {
    if (!sessionStorage.getItem('adminLogueado')) {
        window.location.href = 'index.html';
    }
})();

// 2. CERRAR SESIÓN
window.cerrarSesion = function () {
    if (confirm("¿Seguro que desea salir del sistema, Julio César?")) {
        sessionStorage.clear();
        localStorage.clear();
        window.location.href = 'index.html';
    }
};

// --- 3. MOTOR DE CÁLCULOS PRINCIPAL ---
window.actualizarDashboard = async function () {
    const contenedorLista = document.getElementById('lista-cobros-hoy');
    if (contenedorLista) contenedorLista.innerHTML = "<p style='text-align:center;'>Actualizando indicadores...</p>";

    try {
        const response = await fetch(window.G_URL);
        const db = await response.json();

        const clientes = db.clientes || [];
        const prestamos = db.prestamos || [];
        const cobrosRealizados = db.cobros || [];

        const hoy = new Date();
        const hoyFormateado = `${String(hoy.getDate()).padStart(2, '0')}/${String(hoy.getMonth() + 1).padStart(2, '0')}/${hoy.getFullYear()}`;

        let capitalEnCalle = 0;
        let interesesYaCobrados = 0;
        let interesesPorCobrar = 0;
        let activosCount = 0;
        let cobrosHoyCount = 0;
        let cobrosHoyLista = [];
        let capitalOriginalTotal = 0;

        // A. PROCESAR PRÉSTAMOS ACTIVOS
        prestamos.forEach(p => {
            if (p.state === 'activo' || p.estado === 'activo') {
                activosCount++;
                const montoOriginal = parseFloat(p.montoOriginal || p.monto) || 0;
                const saldoActual = parseFloat(p.saldoPendiente) || 0;
                const tasa = parseFloat(p.tasa) || 0;
                capitalOriginalTotal += montoOriginal;

                if (p.modalidad === 'interes_fijo') {
                    interesesPorCobrar += Math.max(0, saldoActual - montoOriginal);
                } else {
                    const porcentajeInteres = (tasa / 100) / (1 + (tasa / 100));
                    interesesPorCobrar += (saldoActual * porcentajeInteres);
                }

                // Detección de fecha
                let fechaVenceRaw = p.proximoPago || "";
                let fechaComparar = "";
                if (fechaVenceRaw.includes('T')) {
                    const soloFecha = fechaVenceRaw.split('T')[0];
                    const partes = soloFecha.split('-');
                    fechaComparar = `${partes[2]}/${partes[1]}/${partes[0]}`;
                } else {
                    fechaComparar = fechaVenceRaw.trim();
                }

                if (fechaComparar === hoyFormateado) {
                    cobrosHoyCount++;
                    cobrosHoyLista.push(p);
                }
            }
        });

        // B. LÓGICA DE GANANCIA Y CAPITAL
        interesesYaCobrados = cobrosRealizados.reduce((total, c) => total + (parseFloat(c.interesGanado) || 0), 0);
        const totalDineroEntrado = cobrosRealizados.reduce((total, c) => total + (parseFloat(c.montoTotal || c.monto) || 0), 0);
        const capitalRecuperadoReal = totalDineroEntrado - interesesYaCobrados;
        capitalEnCalle = capitalOriginalTotal - capitalRecuperadoReal;

        // 4. RENDERIZADO DE INDICADORES
        animarNumero('total-clientes', clientes.length);
        animarNumero('prestamos-activos', activosCount);
        animarNumero('pagos-hoy', cobrosHoyCount);

        if (document.getElementById('total-prestado'))
            document.getElementById('total-prestado').innerText = `RD$ ${Math.max(0, Math.round(capitalEnCalle)).toLocaleString('es-DO')}`;

        if (document.getElementById('total-intereses'))
            document.getElementById('total-intereses').innerText = `RD$ ${Math.round(interesesYaCobrados).toLocaleString('es-DO')}`;

        if (document.getElementById('total-atrasados'))
            document.getElementById('total-atrasados').innerText = `RD$ ${Math.round(interesesPorCobrar).toLocaleString('es-DO')}`;

        // GRÁFICO DE PROGRESO
        const circulo = document.getElementById('circulo-progreso');
        const textoCirculo = document.getElementById('texto-circular');
        if (circulo && textoCirculo) {
            let porcentaje = capitalOriginalTotal > 0 ? (capitalRecuperadoReal / capitalOriginalTotal) * 100 : 0;
            porcentaje = Math.min(Math.max(porcentaje, 0), 100);
            circulo.style.strokeDashoffset = 283 - (porcentaje * 283 / 100);
            textoCirculo.textContent = Math.round(porcentaje) + "%";
        }

        // --- LISTA DE COBROS CON ACCESO DIRECTO ---
        if (contenedorLista) {
            if (cobrosHoyLista.length > 0) {
                contenedorLista.innerHTML = cobrosHoyLista.map(p => {
                    const montoMostrar = p.modalidad === 'interes_fijo' ?
                        (parseFloat(p.montoOriginal) * (parseFloat(p.tasa) / 100)) :
                        (p.saldoPendiente / (p.cuotasTotales || 1));

                    return `
                        <div onclick="irACobrarCliente('${p.nombre}')" 
                             style="display:flex; justify-content:space-between; padding:12px; border-bottom:1px solid #eee; align-items:center; cursor:pointer; transition: 0.2s;"
                             onmouseover="this.style.backgroundColor='#f1f5f9'" 
                             onmouseout="this.style.backgroundColor='transparent'">
                            <div>
                                <strong style="display:block; color:#1e293b;">${p.nombre}</strong>
                                <small style="color:#64748b;">Saldo: RD$ ${Math.round(p.saldoPendiente).toLocaleString()}</small>
                            </div>
                            <span style="color:#2563eb; font-weight:800; font-size:1.1rem;">
                                RD$ ${Math.round(montoMostrar).toLocaleString()}
                            </span>
                        </div>
                    `;
                }).join('');
            } else {
                contenedorLista.innerHTML = `<p style="text-align:center; color:#94a3b8; margin-top:20px;">No hay cobros para hoy</p>`;
            }
        }

    } catch (e) {
        console.error("Error en Dashboard:", e);
        if (contenedorLista) contenedorLista.innerHTML = "<p style='color:red; text-align:center;'>Error de conexión</p>";
    }
};

// --- 4. FUNCIÓN PARA LLEVAR A COBRANZA ---
window.irACobrarCliente = function(nombre) {
    // Cambia a la sección de cobros
    window.mostrarSeccion('cobros');
    
    // Espera un momento a que la sección sea visible y busca el input
    setTimeout(() => {
        const buscador = document.querySelector('#sec-cobros input') || document.getElementById('buscar-cliente');
        if (buscador) {
            buscador.value = nombre;
            // Dispara eventos para que el sistema filtre automáticamente
            buscador.dispatchEvent(new Event('input', { bubbles: true }));
            buscador.dispatchEvent(new Event('change', { bubbles: true }));
            
            // Si tienes una función de búsqueda manual, ejecútala
            if (typeof window.filtrarCobros === 'function') window.filtrarCobros();
        }
    }, 100);
};

// --- 5. FUNCIONES DE APOYO Y NAVEGACIÓN ---
function animarNumero(id, valorFinal) {
    const elemento = document.getElementById(id);
    if (!elemento) return;
    let inicio = 0;
    const incremento = valorFinal / 30;
    const f = () => {
        inicio += incremento;
        if (inicio < valorFinal) {
            elemento.innerText = Math.ceil(inicio);
            requestAnimationFrame(f);
        } else {
            elemento.innerText = valorFinal;
        }
    };
    f();
}

window.mostrarSeccion = function (id) {
    document.querySelectorAll('.content-section').forEach(s => s.style.display = 'none');
    document.querySelectorAll('.sidebar-menu a').forEach(a => a.classList.remove('active'));
    
    const seccion = document.getElementById('sec-' + id);
    if (seccion) {
        seccion.style.display = 'block';
        const link = document.querySelector(`[onclick="mostrarSeccion('${id}')"]`);
        if (link) link.classList.add('active');
    }

    if (id === 'dashboard') window.actualizarDashboard();
};

document.addEventListener('DOMContentLoaded', () => {
    window.actualizarDashboard();
});