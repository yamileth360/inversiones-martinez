/**
 * js/cobros.js - Inversiones Martínez
 * REPARACIÓN: Carga de préstamos en Tabla Maestra y Buscador
 */

if (typeof window.getE === 'undefined') {
    window.getE = (id) => document.getElementById(id);
}

// FUNCIÓN AUXILIAR: Limpieza de fechas
function formatearFechaLimpia(fechaRaw) {
    if (!fechaRaw) return "";
    let f = fechaRaw.toString().trim();
    if (f.includes('T')) {
        let soloFecha = f.split('T')[0];
        let [y, m, d] = soloFecha.split('-');
        return `${d}/${m}/${y}`;
    }
    return f;
}

window.cerrarModalCobro = function () {
    const modal = document.getElementById('modal-cobro');
    if (modal) modal.style.display = 'none';
    const form = document.getElementById('form-pago');
    if (form) form.reset();
};

// 1. BUSCADOR POR CÉDULA (EN VIVO)
window.buscarPrestamoPorCedula = async function () {
    const input = document.getElementById('cedula-cobro');
    const contenedor = document.getElementById('resultado-busqueda-cobro');
    if (!input || !contenedor) return;

    const cedula = input.value.trim();
    if (cedula.length < 4) {
        contenedor.innerHTML = "";
        return;
    }

    contenedor.innerHTML = "<small>Buscando...</small>";

    try {
        const response = await fetch(window.G_URL);
        const db = await response.json();
        const prestamos = db.prestamos || [];
        
        // Filtro flexible para el estado
        const resultados = prestamos.filter(p => 
            p.cedula.toString().includes(cedula) && 
            (p.estado || p.state || "").toString().toLowerCase().trim() === 'activo'
        );

        if (resultados.length > 0) {
            contenedor.innerHTML = resultados.map(p => `
                <div style="background: white; border: 1px solid #e2e8f0; padding: 12px; border-radius: 8px; margin-bottom: 10px; border-left: 5px solid #1e293b;">
                    <strong style="font-size: 0.9rem; display: block;">${p.nombre}</strong>
                    <span style="color: #dc2626; font-weight: 800; font-size: 1.1rem;">RD$ ${Math.round(p.saldoPendiente).toLocaleString()}</span>
                    <button onclick="window.abrirModalCobro(${p.id})" 
                            style="width: 100%; margin-top: 8px; background: #1e293b; color: white; border: none; padding: 8px; border-radius: 5px; cursor: pointer; font-weight: bold;">
                        💵 COBRAR AHORA
                    </button>
                </div>
            `).join('');
        } else {
            contenedor.innerHTML = `<div style="color: #dc2626; text-align: center; padding: 10px;">❌ No activo o no encontrado.</div>`;
        }
    } catch (e) {
        contenedor.innerHTML = "❌ Error de conexión";
    }
};

// 2. ABRIR MODAL DE COBRO (Trae datos frescos)
window.abrirModalCobro = async function (id) {
    const response = await fetch(window.G_URL);
    const db = await response.json();
    const p = db.prestamos.find(item => item.id == id);

    if (p) {
        document.getElementById('id-prestamo-pago').value = id;
        const cap = parseFloat(p.montoOriginal || p.monto || 0);
        const cuota = (cap + (cap * (parseFloat(p.tasa || 0) / 100))) / (parseInt(p.cuotasTotales) || 1);

        const inputMonto = document.getElementById('monto-pago');
        inputMonto.value = Math.round(p.modalidad === 'interes_fijo' ? (cap * (parseFloat(p.tasa || 0) / 100)) : cuota);

        document.getElementById('info-cliente-cobro').innerHTML = `
            <h4 style="margin:0;">${p.nombre}</h4>
            <div style="background:#fff5f5; padding:10px; margin-top:10px; border-radius:8px; color:#c53030;">
                <small>Saldo Pendiente</small><br>
                <strong style="font-size:1.5rem;">RD$ ${Math.round(p.saldoPendiente).toLocaleString()}</strong>
            </div>
        `;
        document.getElementById('modal-cobro').style.display = 'flex';
        setTimeout(() => inputMonto.select(), 100);
    }
};

// 3. PROCESAR PAGO
const formPago = document.getElementById('form-pago');
if (formPago) {
    formPago.addEventListener('submit', async function (e) {
        e.preventDefault();
        const btn = this.querySelector('button[type="submit"]');
        btn.disabled = true; btn.innerText = "Sincronizando...";

        const idPrestamo = document.getElementById('id-prestamo-pago').value;
        const montoPagado = parseFloat(document.getElementById('monto-pago').value);

        const responseData = await fetch(window.G_URL);
        const db = await responseData.json();
        let p = db.prestamos.find(item => item.id == idPrestamo);

        if (p) {
            let nuevoSaldo = p.saldoPendiente;
            let interesGanado = 0;
            let abonoCapital = 0;

            // --- LÓGICA DE CÁLCULO SEGÚN MODALIDAD ---
            if (p.modalidad === 'interes_fijo') {
                // MODALIDAD RÉDITOS: El interés se calcula sobre el capital original
                const reditoFijo = Math.round(parseFloat(p.montoOriginal) * (parseFloat(p.tasa) / 100));
                
                if (montoPagado >= reditoFijo) {
                    interesGanado = reditoFijo;
                    abonoCapital = montoPagado - reditoFijo;
                } else {
                    // Si paga menos del interés, todo es interés y no baja capital
                    interesGanado = montoPagado;
                    abonoCapital = 0;
                }
                // Solo restamos el abono que sobró del interés
                nuevoSaldo = Math.max(0, p.saldoPendiente - abonoCapital);
            } else {
                // MODALIDAD CUOTAS: Se resta el monto total pagado al saldo directamente
                interesGanado = Math.round((parseFloat(p.montoOriginal) * (parseFloat(p.tasa) / 100)) / (parseInt(p.cuotasTotales) || 1));
                nuevoSaldo = Math.max(0, p.saldoPendiente - montoPagado);
                abonoCapital = montoPagado; // En cuotas, todo el pago mueve el saldo
            }

            // Actualizamos el contador de cuotas pagadas
            const nuevasCuotas = (parseInt(p.cuotasPagadas) || 0) + 1;

            // Cálculo de la próxima fecha de pago
            let proxima = p.proximoPago;
            let fLimpia = formatearFechaLimpia(p.proximoPago);
            if (fLimpia.includes('/')) {
                const parts = fLimpia.split('/');
                let d = new Date(parts[2], parts[1] - 1, parts[0]);
                d.setDate(d.getDate() + (parseInt(p.frecuencia) || 7));
                proxima = d.toLocaleDateString('es-DO');
            }

            const payload = {
                action: "cobros",
                payload: {
                    id: Date.now(),
                    fecha: new Date().toLocaleString('es-DO'),
                    cliente: p.nombre,
                    montoTotal: montoPagado,
                    interesGanado: interesGanado,
                    idPrestamo: idPrestamo, 
                    nuevoSaldo: nuevoSaldo,
                    cuotasPagadas: nuevasCuotas,
                    proximoPago: proxima
                }
            };

            try {
                // Sincronización con Google Sheets
                await fetch(window.G_URL, { method: 'POST', mode: 'no-cors', body: JSON.stringify(payload) });
                
                // Preparar datos para el recibo de WhatsApp
                const datosRecibo = { 
                    ...p, 
                    saldoPendiente: nuevoSaldo, 
                    cuotasPagadas: nuevasCuotas, 
                    proximoPago: proxima 
                };

                // Enviamos el mensaje (el detalle cambia según la modalidad)
                const conceptoWs = p.modalidad === 'interes_fijo' ? "Pago de Réditos / Abono" : "Pago de Cuota";
                window.enviarWhatsApp(datosRecibo, montoPagado, conceptoWs);

                alert("✅ ¡Éxito! El pago ha sido procesado correctamente.");
                window.cerrarModalCobro();
                window.actualizarDashboard();
                window.renderizarListaMaestra();
            } catch (err) {
                alert("❌ Error de conexión al guardar el cobro.");
            } finally {
                btn.disabled = false;
                btn.innerText = "Procesar";
            }
        }
    });
}

// 4. RENDERIZAR TABLA MAESTRA (CORREGIDA)
window.renderizarListaMaestra = async function () {
    const tabla = document.getElementById('lista-maestra-body');
    if (!tabla) return;
    
    tabla.innerHTML = "<tr><td colspan='4' style='text-align:center;'>Cargando lista...</td></tr>";

    try {
        const response = await fetch(window.G_URL);
        const db = await response.json();
        const prestamos = db.prestamos || [];

        tabla.innerHTML = "";
        // Quitamos el filtro estricto por si el Excel tiene espacios
        const activos = prestamos.filter(p => 
            (p.estado || p.state || "").toString().toLowerCase().trim() === 'activo'
        );

        if (activos.length > 0) {
            activos.forEach(p => {
                tabla.innerHTML += `
                    <tr>
                        <td>
                            <strong>${p.nombre}</strong><br>
                            <small style="color: #64748b;">${p.cedula}</small>
                        </td>
                        <td style="color: #dc2626; font-weight: bold;">
                            RD$ ${Math.round(p.saldoPendiente).toLocaleString()}
                        </td>
                        <td>${formatearFechaLimpia(p.proximoPago)}</td>
                        <td>
                            <button class="btn-cobrar" onclick="window.abrirModalCobro(${p.id})">
                                <i class="fas fa-money-bill-wave"></i> Cobrar
                            </button>
                        </td>
                    </tr>`;
            });
        } else {
            tabla.innerHTML = "<tr><td colspan='4' style='text-align:center; padding:20px;'>No hay préstamos activos</td></tr>";
        }
    } catch (e) {
        tabla.innerHTML = "<tr><td colspan='4' style='color:red;'>Error de conexión</td></tr>";
    }
};

// 5. ENVIAR WHATSAPP (Diseño Final Profesional - Inversiones Martínez)
window.enviarWhatsApp = function (p, monto, detalleBase) {
    const ahora = new Date();
    const fechaRecibo = ahora.toLocaleString('es-DO', {
        day: 'numeric',
        month: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    });

    const proximoPagoLimpio = formatearFechaLimpia(p.proximoPago);
    const saldoFormateado = Math.round(p.saldoPendiente).toLocaleString('es-DO');
    const montoFormateado = Math.round(monto).toLocaleString('es-DO');

    // --- CONSTRUCCIÓN DEL DETALLE DE CUOTAS ---
    let lineaDetalle = "";
    if (p.modalidad !== "interes_fijo") {
        const actual = parseInt(p.cuotasPagadas) || 0;
        const totales = parseInt(p.cuotasTotales) || 0;
        
        if (totales > 0) {
            const faltantes = Math.max(0, totales - actual);
            lineaDetalle = `Cuota #${actual} de ${totales} (Faltan ${faltantes})`;
        } else {
            lineaDetalle = `Cuota #${actual}`;
        }
    } else {
        lineaDetalle = `Pago de Réditos (Interés)`;
    }

    // --- CONSTRUCCIÓN DEL MENSAJE (Diseño solicitado) ---
    const mensajeTexto =
        `*INVERSIONES MARTÍNEZ* 🏦\n` +
        `*RECIBO DE PAGO DIGITAL*\n\n` +
        `*Fecha:* ${fechaRecibo}\n` +
        `*Cliente:* ${p.nombre.toUpperCase()}\n` +
        `*Concepto:* ${detalleBase}\n` +
        `*Detalle:* ${lineaDetalle}\n` +
        `*Monto Pagado:* RD$ ${montoFormateado}\n` +
        `--------------------------\n` +
        `*SALDO PENDIENTE:* RD$ ${saldoFormateado}\n\n` +
        `*Próximo Pago:* ${proximoPagoLimpio}\n\n` +
        `_¡Gracias por su cumplimiento!_`;

    // Buscar teléfono en la caché local de clientes
    const clientes = JSON.parse(localStorage.getItem('mis_clientes')) || [];
    const c = clientes.find(item => item.cedula == p.cedula);
    let tel = (c && c.telefono) ? String(c.telefono).replace(/\D/g, '') : "";

    // Codificamos el mensaje para que WhatsApp no lo corte
    const mensajeFinal = encodeURIComponent(mensajeTexto);

    // Abrimos WhatsApp con un ligero retraso para asegurar consistencia
    setTimeout(() => {
        let url = "";
        if (tel.length >= 10) {
            // Asegurar código de país 1 (Rep. Dom / USA)
            const phone = tel.startsWith('1') ? tel : '1' + tel;
            url = `https://wa.me/${phone}?text=${mensajeFinal}`;
        } else {
            url = `https://wa.me/?text=${mensajeFinal}`;
        }
        window.open(url, '_blank');
    }, 600);
};