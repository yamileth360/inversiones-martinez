/**
 * js/cobros.js - Inversiones Martínez
 * REPARACIÓN: Finalización de préstamos y Lógica de Cobro
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

// 1. BUSCADOR POR CÉDULA (Solo busca préstamos con saldo > 0)
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
        
        // Filtro: Debe coincidir la cédula, estar activo Y tener saldo pendiente
        const resultados = prestamos.filter(p => 
            p.cedula.toString().includes(cedula) && 
            (p.estado || p.state || "").toString().toLowerCase().trim() === 'activo' &&
            parseFloat(p.saldoPendiente) > 0
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
            contenedor.innerHTML = `<div style="color: #dc2626; text-align: center; padding: 10px;">❌ Sin deudas pendientes o no encontrado.</div>`;
        }
    } catch (e) {
        contenedor.innerHTML = "❌ Error de conexión";
    }
};

// 2. ABRIR MODAL DE COBRO
window.abrirModalCobro = async function (id) {
    const response = await fetch(window.G_URL);
    const db = await response.json();
    const p = db.prestamos.find(item => item.id == id);

    if (p) {
        document.getElementById('id-prestamo-pago').value = id;
        const cap = parseFloat(p.montoOriginal || p.monto || 0);
        
        // Sugerencia de cobro
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

// 3. PROCESAR PAGO (CON LÓGICA DE CIERRE)
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
            let nuevoEstado = "activo"; // Por defecto sigue activo

            if (p.modalidad === 'interes_fijo') {
                const reditoFijo = Math.round(parseFloat(p.montoOriginal) * (parseFloat(p.tasa) / 100));
                if (montoPagado >= reditoFijo) {
                    interesGanado = reditoFijo;
                    abonoCapital = montoPagado - reditoFijo;
                } else {
                    interesGanado = montoPagado;
                    abonoCapital = 0;
                }
                nuevoSaldo = Math.max(0, p.saldoPendiente - abonoCapital);
            } else {
                interesGanado = Math.round((parseFloat(p.montoOriginal) * (parseFloat(p.tasa) / 100)) / (parseInt(p.cuotasTotales) || 1));
                nuevoSaldo = Math.max(0, p.saldoPendiente - montoPagado);
                abonoCapital = montoPagado;
            }

            // --- REGLA DE CIERRE: Si saldo es 0, el préstamo se termina ---
            if (nuevoSaldo <= 0) {
                nuevoSaldo = 0;
                nuevoEstado = "finalizado"; 
            }

            const nuevasCuotas = (parseInt(p.cuotasPagadas) || 0) + 1;
            let proxima = p.proximoPago;
            
            // Solo calcular próxima fecha si el préstamo sigue activo
            if (nuevoEstado === "activo") {
                let fLimpia = formatearFechaLimpia(p.proximoPago);
                if (fLimpia.includes('/')) {
                    const parts = fLimpia.split('/');
                    let d = new Date(parts[2], parts[1] - 1, parts[0]);
                    d.setDate(d.getDate() + (parseInt(p.frecuencia) || 7));
                    proxima = d.toLocaleDateString('es-DO');
                }
            } else {
                proxima = "PAGADO"; // Marca visual en Excel
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
                    proximoPago: proxima,
                    nuevoEstado: nuevoEstado // IMPORTANTE: Enviamos el cambio de estado
                }
            };

            try {
                await fetch(window.G_URL, { method: 'POST', mode: 'no-cors', body: JSON.stringify(payload) });
                
                const datosRecibo = { 
                    ...p, 
                    saldoPendiente: nuevoSaldo, 
                    cuotasPagadas: nuevasCuotas, 
                    proximoPago: proxima 
                };

                const conceptoWs = p.modalidad === 'interes_fijo' ? "Pago de Réditos / Abono" : "Pago de Cuota";
                window.enviarWhatsApp(datosRecibo, montoPagado, conceptoWs);

                if (nuevoEstado === "finalizado") {
                    alert("✅ ¡ÉXITO! El préstamo ha sido SALDADO COMPLETAMENTE y se ha cerrado.");
                } else {
                    alert("✅ ¡Éxito! El pago ha sido procesado.");
                }
                
                window.cerrarModalCobro();
                window.actualizarDashboard();
                window.renderizarListaMaestra();
            } catch (err) {
                alert("❌ Error de conexión.");
            } finally {
                btn.disabled = false;
                btn.innerText = "Procesar";
            }
        }
    });
}

// 4. RENDERIZAR TABLA MAESTRA (Solo Activos con Deuda)
window.renderizarListaMaestra = async function () {
    const tabla = document.getElementById('lista-maestra-body');
    if (!tabla) return;
    
    tabla.innerHTML = "<tr><td colspan='4' style='text-align:center;'>Cargando lista...</td></tr>";

    try {
        const response = await fetch(window.G_URL);
        const db = await response.json();
        const prestamos = db.prestamos || [];

        tabla.innerHTML = "";
        const activos = prestamos.filter(p => 
            (p.estado || p.state || "").toString().toLowerCase().trim() === 'activo' &&
            parseFloat(p.saldoPendiente) > 0
        );

        if (activos.length > 0) {
            activos.forEach(p => {
                tabla.innerHTML += `
                    <tr>
                        <td><strong>${p.nombre}</strong><br><small>${p.cedula}</small></td>
                        <td style="color: #dc2626; font-weight: bold;">RD$ ${Math.round(p.saldoPendiente).toLocaleString()}</td>
                        <td>${formatearFechaLimpia(p.proximoPago)}</td>
                        <td>
                            <button class="btn-cobrar" onclick="window.abrirModalCobro(${p.id})">Cobrar</button>
                        </td>
                    </tr>`;
            });
        } else {
            tabla.innerHTML = "<tr><td colspan='4' style='text-align:center; padding:20px;'>No hay deudas activas</td></tr>";
        }
    } catch (e) {
        tabla.innerHTML = "<tr><td colspan='4' style='color:red;'>Error de conexión</td></tr>";
    }
};

// 5. ENVIAR WHATSAPP (Ajustado para pagos finales)
window.enviarWhatsApp = function (p, monto, detalleBase) {
    const ahora = new Date();
    const fechaRecibo = ahora.toLocaleString('es-DO', { day: 'numeric', month: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });

    const proximoPagoLimpio = p.saldoPendiente <= 0 ? "¡PRÉSTAMO FINALIZADO!" : formatearFechaLimpia(p.proximoPago);
    const saldoFormateado = Math.round(p.saldoPendiente).toLocaleString('es-DO');
    const montoFormateado = Math.round(monto).toLocaleString('es-DO');

    let lineaDetalle = (p.modalidad !== "interes_fijo") ? `Cuota de ${p.cuotasTotales}` : `Pago de Réditos`;

    const mensajeTexto =
        `*INVERSIONES MARTÍNEZ* 🏦\n` +
        `*RECIBO DE PAGO DIGITAL*\n\n` +
        `*Fecha:* ${fechaRecibo}\n` +
        `*Cliente:* ${p.nombre.toUpperCase()}\n` +
        `*Monto Pagado:* RD$ ${montoFormateado}\n` +
        `--------------------------\n` +
        `*SALDO RESTANTE:* RD$ ${saldoFormateado}\n\n` +
        `*Estado:* ${p.saldoPendiente <= 0 ? 'SALDADO ✅' : 'Próximo Pago: ' + proximoPagoLimpio}\n\n` +
        `_¡Gracias por su cumplimiento!_`;

    const mensajeFinal = encodeURIComponent(mensajeTexto);
    // Nota: Aquí asumo que tienes el teléfono en los datos p o en caché
    window.location.href = `https://wa.me/?text=${mensajeFinal}`;
};