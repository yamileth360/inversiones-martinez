/**
 * js/dashboard.js - Inversiones Martínez
 * Sincronización 100% en vivo - Lógica Contable Corregida
 */

// 1. SEGURIDAD INMEDIATA
(function() {
    if (!sessionStorage.getItem('adminLogueado')) {
        window.location.href = 'index.html';
    }
})();

// 2. CERRAR SESIÓN
window.cerrarSesion = function() {
    if (confirm("¿Seguro que desea salir del sistema, Julio César?")) {
        sessionStorage.clear();
        localStorage.clear(); 
        window.location.href = 'index.html';
    }
};

// --- 3. MOTOR DE CÁLCULOS PRINCIPAL (VERSIÓN FINAL EXACTA) ---
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

        // VARIABLES CONTABLES
        let capitalEnCalle = 0;       
        let interesesYaCobrados = 0;  
        let interesesPorCobrar = 0;   
        let activosCount = 0;
        let cobrosHoyCount = 0;
        let cobrosHoyLista = []; 

        // A. PROCESAR PRÉSTAMOS ACTIVOS
        prestamos.forEach(p => {
            const estado = (p.state || p.estado || "").toLowerCase();
            
            if (estado === 'activo') {
                activosCount++;
                
                const montoOriginal = parseFloat(p.montoOriginal || p.monto) || 0;
                const saldoActual = parseFloat(p.saldoPendiente) || 0;
                const tasa = parseFloat(p.tasa) || 0;
                const modalidad = p.modalidad || "";

                // CAPITAL EN CALLE: Suma directa del saldo que falta por cobrar
                capitalEnCalle += saldoActual;

                // LÓGICA DE INTERESES POR COBRAR (Atrasos/Pendientes)
                if (modalidad === 'interes_fijo') {
                    // En Réditos, el interés pendiente es solo si el saldo supera al capital original
                    const interesPendiente = Math.max(0, saldoActual - montoOriginal);
                    interesesPorCobrar += interesPendiente;
                } else {
                    // En Cuotas, el interés pendiente es la proporción de la tasa sobre el saldo
                    const totalConInteres = montoOriginal * (1 + (tasa / 100));
                    const factorInteres = (tasa / 100) / (1 + (tasa / 100));
                    interesesPorCobrar += (saldoActual * factorInteres);
                }

                // DETECCIÓN DE COBROS PARA HOY
                let fechaVenceRaw = p.proximoPago || "";
                let fechaComparar = "";
                if (fechaVenceRaw.includes('T')) {
                    fechaComparar = fechaVenceRaw.split('T')[0].split('-').reverse().join('/'); 
                } else {
                    fechaComparar = fechaVenceRaw.trim();
                }

                if (fechaComparar === hoyFormateado) {
                    cobrosHoyCount++;
                    cobrosHoyLista.push(p); 
                }
            }
        });

        // B. GANANCIA REAL (Suma directa de lo que ya entró a tu bolsillo)
        interesesYaCobrados = cobrosRealizados.reduce((total, c) => total + (parseFloat(c.interesGanado) || 0), 0);
        
        // 4. RENDERIZADO EN PANTALLA
        animarNumero('total-clientes', clientes.length);
        animarNumero('prestamos-activos', activosCount);
        animarNumero('pagos-hoy', cobrosHoyCount);

        // Actualización de los cuadros de texto
        if(document.getElementById('total-prestado')) 
            document.getElementById('total-prestado').innerText = `RD$ ${Math.round(capitalEnCalle).toLocaleString('es-DO')}`;
        
        if(document.getElementById('total-intereses')) 
            document.getElementById('total-intereses').innerText = `RD$ ${Math.round(interesesYaCobrados).toLocaleString('es-DO')}`;
        
        if(document.getElementById('total-atrasados')) 
            document.getElementById('total-atrasados').innerText = `RD$ ${Math.round(interesesPorCobrar).toLocaleString('es-DO')}`;

        // LISTA DE COBROS CON ACCESO DIRECTO
        if (contenedorLista) {
            if (cobrosHoyLista.length > 0) {
                contenedorLista.innerHTML = cobrosHoyLista.map(p => {
                    const cuotaHoy = p.modalidad === 'interes_fijo' ? 
                        (parseFloat(p.montoOriginal || p.monto) * (parseFloat(p.tasa)/100)) : 
                        (parseFloat(p.saldoPendiente) / (parseInt(p.cuotasRestantes) || 1));
                    
                    return `
                        <div onclick="irACobrarDirecto('${p.cedula}')" 
                             style="display:flex; justify-content:space-between; padding:15px; border-bottom:1px solid #eee; align-items:center; cursor:pointer; background:#fff;"
                             onmouseover="this.style.background='#f8fafc'" 
                             onmouseout="this.style.background='#fff'">
                            <div>
                                <strong style="display:block; color:#1e293b;">${p.nombre}</strong>
                                <small style="color:#64748b;">Saldo: RD$ ${Math.round(p.saldoPendiente).toLocaleString()}</small>
                                <br><small style="color:#22c55e; font-weight:bold;">Toca para cobrar →</small>
                            </div>
                            <span style="color:#2563eb; font-weight:800; font-size:1.1rem;">
                                RD$ ${Math.round(cuotaHoy).toLocaleString()}
                            </span>
                        </div>
                    `;
                }).join('');
            } else {
                contenedorLista.innerHTML = `<p style="text-align:center; color:#94a3b8; margin-top:20px;">No hay cobros programados para hoy</p>`;
            }
        }

    } catch (e) {
        console.error("Error cargando Dashboard:", e);
        if (contenedorLista) contenedorLista.innerHTML = "<p style='color:red; text-align:center;'>Error de conexión con Google Sheets</p>";
    }
};

// FUNCIÓN PARA SALTO DIRECTO A COBRANZA
window.irACobrarDirecto = function(cedula) {
    if (typeof window.mostrarSeccion === 'function') {
        window.mostrarSeccion('cobranza');
    }
    
    setTimeout(() => {
        const inputCedula = document.getElementById('cedula-cobro');
        if (inputCedula) {
            inputCedula.value = cedula;
            if (typeof window.buscarPrestamoPorCedula === 'function') {
                window.buscarPrestamoPorCedula();
            }
        }
    }, 400);
};

// 4. FUNCIONES DE APOYO
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
        } else { elemento.innerText = valorFinal; }
    };
    f();
}

window.mostrarSeccion = function(id) {
    document.querySelectorAll('.content-section').forEach(s => { s.style.display = 'none'; });
    document.querySelectorAll('.sidebar-menu a').forEach(a => { a.classList.remove('active'); });
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