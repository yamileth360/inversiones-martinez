/**
 * js/dashboard.js - Inversiones Martínez
 * Sincronización 100% en vivo (Sin LocalStorage)
 * Lógica Contable: Amortización Proporcional de Capital e Intereses
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

// --- 3. MOTOR DE CÁLCULOS PRINCIPAL (CORREGIDO) ---
window.actualizarDashboard = async function () {
    const contenedorLista = document.getElementById('lista-cobros-hoy');
    if (contenedorLista) contenedorLista.innerHTML = "<p style='text-align:center;'>Actualizando indicadores...</p>";

    try {
        // PETICIÓN DIRECTA A LA NUBE
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
        let capitalOriginalTotal = 0;

        // A. PROCESAR PRÉSTAMOS ACTIVOS
        prestamos.forEach(p => {
            if (p.state === 'activo' || p.estado === 'activo') {
                activosCount++;
                
                const montoOriginal = parseFloat(p.montoOriginal || p.monto) || 0;
                const saldoActual = parseFloat(p.saldoPendiente) || 0;
                const tasa = parseFloat(p.tasa) || 0;
                
                capitalOriginalTotal += montoOriginal;

                /**
                 * LÓGICA DE INTERESES POR COBRAR:
                 * En Réditos, el interés pendiente es lo que el saldo exceda al capital original.
                 * En Cuotas, usamos la proporción técnica.
                 */
                if (p.modalidad === 'interes_fijo') {
                    interesesPorCobrar += Math.max(0, saldoActual - montoOriginal);
                } else {
                    const totalConInteresInicial = montoOriginal * (1 + (tasa / 100));
                    const porcentajeInteres = (tasa / 100) / (1 + (tasa / 100));
                    interesesPorCobrar += (saldoActual * porcentajeInteres);
                }

                // DETECCIÓN DE COBROS PARA HOY
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

        // B. LÓGICA DE GANANCIA REAL (Intereses ya cobrados desde la pestaña Cobros)
        interesesYaCobrados = cobrosRealizados.reduce((total, c) => total + (parseFloat(c.interesGanado) || 0), 0);
        
        // C. CÁLCULO DE CAPITAL EN CALLE (Resta Directa: Prestado - Recuperado)
        const totalDineroEntrado = cobrosRealizados.reduce((total, c) => total + (parseFloat(c.montoTotal || c.monto) || 0), 0);
        const capitalRecuperadoReal = totalDineroEntrado - interesesYaCobrados;
        
        // EL CAPITAL EN CALLE ES EL CAPITAL ENTREGADO MENOS EL CAPITAL QUE YA VOLVIÓ
        capitalEnCalle = capitalOriginalTotal - capitalRecuperadoReal;

        // 4. RENDERIZADO EN PANTALLA
        animarNumero('total-clientes', clientes.length);
        animarNumero('prestamos-activos', activosCount);
        animarNumero('pagos-hoy', cobrosHoyCount);

        // Cuadros principales redondeados para evitar decimales molestos
        if(document.getElementById('total-prestado')) 
            document.getElementById('total-prestado').innerText = `RD$ ${Math.max(0, Math.round(capitalEnCalle)).toLocaleString('es-DO')}`;
        
        if(document.getElementById('total-intereses')) 
            document.getElementById('total-intereses').innerText = `RD$ ${Math.round(interesesYaCobrados).toLocaleString('es-DO')}`;
        
        if(document.getElementById('total-atrasados')) 
            document.getElementById('total-atrasados').innerText = `RD$ ${Math.round(interesesPorCobrar).toLocaleString('es-DO')}`;

        // GRÁFICO CIRCULAR DE PROGRESO (Basado en recuperación de capital real)
        const circulo = document.getElementById('circulo-progreso');
        const textoCirculo = document.getElementById('texto-circular');
        if (circulo && textoCirculo) {
            let porcentaje = capitalOriginalTotal > 0 ? (capitalRecuperadoReal / capitalOriginalTotal) * 100 : 0;
            porcentaje = Math.min(Math.max(porcentaje, 0), 100); 
            circulo.style.strokeDashoffset = 283 - (porcentaje * 283 / 100);
            textoCirculo.textContent = Math.round(porcentaje) + "%";
        }

        // LISTA VISUAL DE COBROS PARA HOY
        if (contenedorLista) {
            if (cobrosHoyLista.length > 0) {
                contenedorLista.innerHTML = cobrosHoyLista.map(p => {
                    const montoMostrar = p.modalidad === 'interes_fijo' ? 
                        (parseFloat(p.montoOriginal) * (parseFloat(p.tasa)/100)) : 
                        (p.saldoPendiente / (p.cuotasTotales || 1));
                    
                    return `
                        <div style="display:flex; justify-content:space-between; padding:12px; border-bottom:1px solid #eee; align-items:center;">
                            <div>
                                <strong style="display:block;">${p.nombre}</strong>
                                <small style="color:#64748b;">Saldo: RD$ ${Math.round(p.saldoPendiente).toLocaleString()}</small>
                            </div>
                            <span style="color:#2563eb; font-weight:800; font-size:1.1rem;">
                                RD$ ${Math.round(montoMostrar).toLocaleString()}
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
    // Refrescar datos si vuelve al dashboard
    if (id === 'dashboard') window.actualizarDashboard();
};

// Inicialización automática
document.addEventListener('DOMContentLoaded', () => { 
    window.actualizarDashboard(); 
});