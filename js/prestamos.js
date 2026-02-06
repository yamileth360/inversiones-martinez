/**
 * js/prestamos.js - Inversiones Martínez
 * Sincronización 100% en vivo con Google Sheets
 * Mantiene diseño original de impresiones
 */

if (typeof window.getE === 'undefined') {
    window.getE = (id) => document.getElementById(id);
}

// FUNCIÓN AUXILIAR: Limpieza de fechas ISO a formato legible DD/MM/YYYY
function limpiarFechaISO(fechaRaw) {
    if (!fechaRaw) return "";
    let f = fechaRaw.toString().trim();
    if (f.includes('T')) {
        let soloFecha = f.split('T')[0]; 
        let [y, m, d] = soloFecha.split('-');
        return `${d}/${m}/${y}`;
    }
    return f;
}

// --- 1. GESTIÓN DE MODAL Y BÚSQUEDA ---
window.abrirModalPrestamo = function() {
    const modal = getE('modal-prestamo');
    if (modal) modal.style.display = 'flex';
};

window.cerrarModalPrestamo = function() {
    const modal = getE('modal-prestamo');
    if (modal) {
        modal.style.display = 'none';
        getE('loan-form')?.reset();
        if (getE('calculo-cuota')) getE('calculo-cuota').innerHTML = "Esperando datos...";
    }
};

window.buscarClientePorCedulaAuto = function(cedula) {
    // Para búsqueda rápida usamos el último cache de clientes
    const clientes = JSON.parse(localStorage.getItem('mis_clientes')) || [];
    const c = clientes.find(item => item.cedula.trim() === cedula.trim());
    const inputNombre = getE('cliente-nombre');
    if (inputNombre) inputNombre.value = c ? c.nombre : "";
};

// --- 2. MOTOR DE CÁLCULO (CAMBIO: Bloqueo de cuotas y cálculo de Réditos) ---
// --- 1. Aseguramos que la función sea global ---
window.calcularPrestamo = function() {
    const monto = parseFloat(document.getElementById('monto')?.value) || 0;
    const tasa = parseFloat(document.getElementById('tasa')?.value) || 0;
    const cuotasInput = document.getElementById('cuotas');
    const modalidad = document.getElementById('modalidad')?.value;
    const calculoTexto = document.getElementById('calculo-cuota');

    if (!calculoTexto) return;

    const montoInteres = Math.round(monto * (tasa / 100));

    if (modalidad === "interes_fijo") {
        if (cuotasInput) { 
            cuotasInput.value = "0"; 
            cuotasInput.disabled = true; 
            cuotasInput.style.backgroundColor = "#f1f5f9";
        }
        calculoTexto.innerHTML = `
            <div style="background:#f1f5f9; padding:10px; border-radius:8px; border:1px solid #cbd5e1;">
                <p style="margin:0; color:#475569;">Modalidad: <b>Réditos</b></p>
                <p style="margin:5px 0;">Interés fijo: <b style="color:#2563eb;">RD$ ${montoInteres.toLocaleString()}</b></p>
                <hr style="border:0; border-top:1px solid #cbd5e1; margin:8px 0;">
                <span style="color:#1e293b; font-weight:bold;">DEUDA INICIAL: RD$ ${(monto + montoInteres).toLocaleString()}</span>
            </div>`;
    } else {
        if (cuotasInput) {
            cuotasInput.disabled = false;
            cuotasInput.style.backgroundColor = "#ffffff";
        }
        const numCuotas = parseInt(cuotasInput?.value) || 1;
        const totalConInteres = Math.round(monto + montoInteres);
        const montoCuota = Math.round(totalConInteres / numCuotas);

        calculoTexto.innerHTML = `
            <div style="background:#f0fdf4; padding:10px; border-radius:8px; border:1px solid #bbf7d0;">
                <p style="margin:0; color:#166534;">Modalidad: <b>Cuotas Fijas</b></p>
                <p style="margin:5px 0;">Pago por cuota: <b style="color:#15803d;">RD$ ${montoCuota.toLocaleString()}</b></p>
                <hr style="border:0; border-top:1px solid #bbf7d0; margin:8px 0;">
                <span style="color:#166534; font-weight:bold;">TOTAL A PAGAR: RD$ ${totalConInteres.toLocaleString()}</span>
            </div>`;
    }
};

// --- 2. EL MOTOR QUE ACTIVA TODO (ESTO ES LO QUE TE FALTA) ---
document.addEventListener('DOMContentLoaded', () => {
    // Buscamos los inputs por su ID
    const idsParaEscuchar = ['monto', 'tasa', 'cuotas', 'modalidad'];
    
    idsParaEscuchar.forEach(id => {
        const elemento = document.getElementById(id);
        if (elemento) {
            // Escucha cada vez que escribes (input) o cambias (change)
            elemento.addEventListener('input', window.calcularPrestamo);
            elemento.addEventListener('change', window.calcularPrestamo);
        }
    });

    // Ejecutar una vez al cargar por si hay datos viejos
    window.calcularPrestamo();
});

// --- 3. ENVÍO AL EXCEL (CAMBIO: Guardado de saldo inicial y cuotas en 0 para Réditos) ---
const loanForm = getE('loan-form');

if (loanForm) {
    loanForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        const btn = this.querySelector('button[type="submit"]');
        if (btn) { btn.disabled = true; btn.innerText = "Sincronizando..."; }

        const monto = parseFloat(getE('monto').value);
        const tasa = parseFloat(getE('tasa').value);
        const modalidad = getE('modalidad').value;
        
        // En Réditos el saldo inicial es Capital + el primer interés ganado
        const saldoInicial = Math.round(monto + (monto * (tasa / 100)));

        const nuevoPrestamo = {
            id: Date.now(),
            cedula: getE('cliente-cedula').value.trim(),
            nombre: getE('cliente-nombre').value.trim(),
            montoOriginal: monto,
            tasa: tasa,
            modalidad: modalidad,
            frecuencia: getE('frecuencia').value,
            // CAMBIO: Si es rédito, las cuotas totales son 0 en el Excel
            cuotasTotales: modalidad === "interes_fijo" ? 0 : parseInt(getE('cuotas').value),
            saldoPendiente: saldoInicial,
            fechaCreacion: new Date().toLocaleDateString('es-DO'),
            proximoPago: getE('fecha-primer-pago').value.split('-').reverse().join('/'),
            cuotasPagadas: 0,
            estado: 'activo'
        };

        try {
            await fetch(window.G_URL, {
                method: 'POST',
                mode: 'no-cors',
                body: JSON.stringify({ action: "prestamos", payload: nuevoPrestamo })
            });

            alert("✅ ¡Éxito! Préstamo registrado.");
            window.cerrarModalPrestamo();
            if (typeof window.actualizarDashboard === 'function') window.actualizarDashboard();
            window.renderizarTablaPrestamos();
        } catch (error) {
            alert("⚠️ Error de conexión.");
        } finally {
            if (btn) { btn.disabled = false; btn.innerText = "Aprobar"; }
        }
    });
}

// --- 4. RENDERIZADO DE TABLA (EN VIVO DESDE LA NUBE) ---
window.renderizarTablaPrestamos = async function() {
    const tabla = getE('lista-gestion-prestamos-body');
    if (!tabla) return;
    tabla.innerHTML = "<tr><td colspan='6' style='text-align:center;'>Actualizando datos desde Excel...</td></tr>";

    try {
        const response = await fetch(window.G_URL);
        const db = await response.json();
        const prestamos = db.prestamos || [];
        
        tabla.innerHTML = "";
        [...prestamos].reverse().forEach(p => {
            if(p.estado !== 'finalizado') {
                tabla.innerHTML += `<tr>
                    <td><small>${limpiarFechaISO(p.fechaCreacion)}</small></td>
                    <td><strong>${p.nombre}</strong><br><small>${p.cedula}</small></td>
                    <td>RD$ ${parseFloat(p.montoOriginal).toLocaleString()}</td>
                    <td style="color:#dc2626;font-weight:bold;">RD$ ${Math.round(p.saldoPendiente).toLocaleString()}</td>
                    <td><span class="badge">${p.modalidad === 'interes_fijo' ? 'Réditos' : 'Cuota'}</span></td>
                    <td style="display:flex; gap:5px; justify-content:center;">
                        <button onclick="window.generarContrato(${p.id})" style="background:#2563eb;color:white;border:none;width:35px;height:35px;border-radius:6px;cursor:pointer;"><i class="fas fa-file-contract"></i></button>
                        <button onclick="window.imprimirAmortizacion(${p.id})" style="background:#059669;color:white;border:none;width:35px;height:35px;border-radius:6px;cursor:pointer;"><i class="fas fa-table"></i></button>
                    </td>
                </tr>`;
            }
        });
    } catch (e) {
        tabla.innerHTML = "<tr><td colspan='6' style='color:red;'>No se pudo conectar con la nube.</td></tr>";
    }
};

// --- 3. FUNCIONES DE IMPRESIÓN (DISEÑOS SOLICITADOS) ---

window.generarContrato = async function (id) {
    // Obtenemos datos frescos de la nube para el contrato
    const response = await fetch(window.G_URL);
    const db = await response.json();
    const p = db.prestamos.find(item => item.id == id);
    if (!p) return alert("No se encontraron datos del préstamo.");

    const hoy = new Date();
    const diaNum = hoy.getDate();
    const meses = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
    const mesTexto = meses[hoy.getMonth()];
    const anio = hoy.getFullYear();

    const capital = parseFloat(p.montoOriginal || p.monto);
    const totalDeuda = parseFloat(p.saldoPendiente);
    const numCuotas = parseInt(p.cuotasTotales) || 1;
    const montoCuota = Math.round(totalDeuda / numCuotas);
    const frecuenciaTexto = p.frecuencia === "7" ? "semanales" : p.frecuencia === "15" ? "quincenales" : "mensuales";

    const ventana = window.open('', '', 'height=900,width=850');
    if (!ventana) return alert("Por favor, permita las ventanas emergentes.");

    ventana.document.write(`
    <html>
    <head>
        <style>
            body { font-family: 'Times New Roman', serif; padding: 30px 50px; line-height: 1.3; text-align: justify; font-size: 11pt; color: #000; }
            .center { text-align: center; font-weight: bold; text-decoration: underline; margin-bottom: 5px; font-size: 12pt; }
            .bold { font-weight: bold; }
            .tabla-firmas { width: 100%; margin-top: 20px; font-size: 10pt; }
            .firma-box { border-top: 1px solid #000; width: 45%; text-align: center; padding-top: 3px; vertical-align: top; }
            .notario-seccion { margin-top: 15px; border-top: 1px double #000; padding-top: 10px; font-size: 10.5pt; }
            p { margin: 5px 0; }
            @media print { body { padding: 10px 30px; } .no-print { display: none; } }
        </style>
    </head>
    <body>
        <div class="center">PAGARÉ NOTARIAL CON FUERZA EJECUTORIA</div>
        <div class="bold" style="text-align: right;">ACTO No. __________</div>

        <p>En la Provincia de Santo Domingo, Municipio Santo Domingo Este, RD, a los <span class="bold">${diaNum}</span> de <span class="bold">${mesTexto}</span> del <span class="bold">${anio}</span>, ante mí, <span class="bold">LICDO. CELSO ANTONIO PAVÓN MONI</span>, Notario Público del D.N., mat. 1112; COMPARECIERON: de una parte, <span class="bold">SR. ANTHONY MANUEL MARTÍNEZ</span>, cédula 223-0025163-8, domiciliado en Mendoza, SDE (<span class="bold">EL ACREEDOR</span>); y de otra parte, <span class="bold">SR(A). ${p.nombre.toUpperCase()}</span>, cédula <span class="bold">${p.cedula}</span> (<span class="bold">LA DEUDORA</span>), quienes declaran:</p>

        <p><span class="bold">PRIMERO:</span> LA DEUDORA se reconoce deudora formal de EL ACREEDOR por <span class="bold">RD$ ${capital.toLocaleString()}</span> recibidos en calidad de préstamo. <span class="bold">SEGUNDO:</span> Se acuerda la devolución mediante <span class="bold">${numCuotas}</span> cuotas <span class="bold">${frecuenciaTexto}</span> de <span class="bold">RD$ ${montoCuota.toLocaleString()}</span>, hasta saldar <span class="bold">RD$ ${totalDeuda.toLocaleString()}</span>. <span class="bold">TERCERO:</span> Los pagos serán cada ${p.frecuencia} días. El retraso generará una mora del <span class="bold">2% diario</span>.</p>

        <p><span class="bold">CUARTO:</span> El incumplimiento de dos (2) cuotas hará la totalidad de la deuda exigible de pleno derecho. <span class="bold">QUINTO:</span> LA DEUDORA afecta todos sus bienes presentes y futuros. <span class="bold">SEXTO:</span> Las partes otorgan al presente acto <span class="bold">FUERZA EJECUTORIA</span> según Art. 545 del Cód. Proc. Civil, facultando al ACREEDOR a perseguir el cobro por todas las vías de derecho.</p>

        <p><span class="bold">SÉPTIMO:</span> Gastos de redacción y ejecución correrán por cuenta de LA DEUDORA. Presente como testigo la <span class="bold">SRA. YANIRIS ALT. LANFRANCO MARTÍNEZ</span>, cédula 001-0641951-8, a quien doy fe conocer. HECHO Y PASADO en mi estudio, leído a los comparecientes, de lo cual <span class="bold">CERTIFICO Y DOY FE.</span></p>

        <table class="tabla-firmas">
            <tr>
                <td class="firma-box">SR. ANTHONY MANUEL MARTÍNEZ<br><span class="bold">ACREEDOR</span></td>
                <td style="width: 10%;"></td>
                <td class="firma-box">SR(A). ${p.nombre.toUpperCase()}<br><span class="bold">DEUDOR/A</span></td>
            </tr>
        </table>

        <div style="margin-top: 25px; text-align: center;">
            <div style="display: inline-block; border-top: 1px solid #000; width: 250px; padding-top: 3px; font-size: 10pt;">
                YANIRIS ALT. LANFRANCO MARTÍNEZ<br><span class="bold">TESTIGO</span>
            </div>
        </div>

        <div class="notario-seccion">
            <p>Yo, <span class="bold">LICDO. CELSO ANTONIO PAVÓN MONI</span>, Notario Público mat. 1112. <span class="bold">CERTIFICO Y DOY FE:</span> que las firmas fueron puestas en mi presencia, libre y voluntariamente por ANTHONY MANUEL MARTÍNEZ, ${p.nombre.toUpperCase()} y YANIRIS LANFRANCO, quienes declaran que esas son las firmas que acostumbran a usar. En Santo Domingo, a los ${diaNum} días del mes de ${mesTexto} del año ${anio}.</p>
            <div style="text-align: center; margin-top: 20px;">
                <div style="display: inline-block; border-top: 1px solid #000; width: 300px; padding-top: 3px;">
                    <span class="bold">LICDO. CELSO ANTONIO PAVÓN MONI</span><br>Notario Público
                </div>
            </div>
        </div>

        <script>
            window.onload = function() { window.print(); window.close(); }
        </script>
    </body>
    </html>
    `);
    ventana.document.close();
};

window.imprimirAmortizacion = async function (id) {
    const response = await fetch(window.G_URL);
    const db = await response.json();
    const p = db.prestamos.find(item => item.id == id);
    const cobrosRealizados = db.cobros ? db.cobros.filter(c => c.idPrestamo == id) : [];
    
    if (!p) return alert("No se encontraron datos.");

    const capitalOriginal = parseFloat(p.montoOriginal || p.monto);
    const tasa = parseFloat(p.tasa);
    let filas = "";
    
    if (p.modalidad === 'interes_fijo') {
        // --- LÓGICA PARA RÉDITOS (HISTORIAL REAL CON BALANCE DINÁMICO) ---
        let balanceAcumulado = capitalOriginal;

        cobrosRealizados.forEach((cobro, index) => {
            const montoPagado = parseFloat(cobro.montoTotal) || 0;
            const interesFijo = Math.round(capitalOriginal * (tasa / 100));
            
            // Si pagó más que el interés, el resto va al capital
            const abonoCap = Math.max(0, montoPagado - interesFijo);
            balanceAcumulado -= abonoCap;

            filas += `<tr>
                <td>${index + 1}</td>
                <td>${cobro.fecha}</td>
                <td>RD$ ${montoPagado.toLocaleString()}</td>
                <td>RD$ ${abonoCap.toLocaleString()}</td>
                <td>RD$ ${interesFijo.toLocaleString()}</td>
                <td>RD$ ${Math.round(balanceAcumulado).toLocaleString()}</td>
                <td><b style="color:#059669;">PAGADO</b></td>
            </tr>`;
        });

        // Fila del PRÓXIMO pago pendiente
        const proximoInteres = Math.round(capitalOriginal * (tasa / 100));
        filas += `<tr style="background-color: #fff7ed;">
            <td>${cobrosRealizados.length + 1}</td>
            <td>${formatearFechaLimpia(p.proximoPago)}</td>
            <td>RD$ ${proximoInteres.toLocaleString()}</td>
            <td>RD$ 0</td>
            <td>RD$ ${proximoInteres.toLocaleString()}</td>
            <td>RD$ ${Math.round(p.saldoPendiente).toLocaleString()}</td>
            <td><b style="color:#f97316;">PRÓXIMO</b></td>
        </tr>`;

    } else {
        // --- LÓGICA PARA CUOTAS FIJAS ---
        const totalInteres = capitalOriginal * (tasa / 100);
        const totalConInteres = capitalOriginal + totalInteres;
        const numCuotas = parseInt(p.cuotasTotales) || 1;
        const montoCuota = Math.round(totalConInteres / numCuotas);
        const interesPorCuota = Math.round(totalInteres / numCuotas);
        const capitalPorCuota = montoCuota - interesPorCuota;
        let balanceRestante = totalConInteres;
        const cuotasPagadas = parseInt(p.cuotasPagadas) || 0;

        let [d, m, y] = limpiarFechaISO(p.proximoPago).split('/');
        let fechaPago = new Date(y, m - 1, d);

        for (let i = 1; i <= numCuotas; i++) {
            balanceRestante -= montoCuota;
            let estado = (i <= cuotasPagadas) ? '<b style="color:#059669;">PAGADO</b>' : '<b style="color:#dc2626;">PENDIENTE</b>';
            filas += `<tr>
                <td>${i}</td>
                <td>${fechaPago.toLocaleDateString('es-DO')}</td>
                <td>RD$ ${montoCuota.toLocaleString()}</td>
                <td>RD$ ${capitalPorCuota.toLocaleString()}</td>
                <td>RD$ ${interesPorCuota.toLocaleString()}</td>
                <td>RD$ ${Math.max(0, Math.round(balanceRestante)).toLocaleString()}</td>
                <td>${estado}</td>
            </tr>`;
            fechaPago.setDate(fechaPago.getDate() + (parseInt(p.frecuencia) || 7));
        }
    }

    // --- EL RESTO DEL DISEÑO SE MANTIENE IGUAL ---
    const ventana = window.open('', '', 'height=900,width=1000');
    ventana.document.write(`
    <html>
    <head>
        <title>Estado de Cuenta - ${p.nombre}</title>
        <style>
            body { font-family: 'Segoe UI', sans-serif; padding: 30px; color: #1e293b; background-color: #f8fafc; }
            .header-container { background: white; padding: 20px; border-radius: 12px; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); margin-bottom: 20px; border-top: 5px solid #1e293b; }
            .header-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-top: 15px; }
            .info-item { font-size: 0.9rem; color: #64748b; }
            .info-item b { color: #1e293b; font-size: 1rem; }
            table { width: 100%; border-collapse: collapse; background: white; border-radius: 12px; overflow: hidden; }
            th { background: #1e293b; color: white; padding: 15px; font-size: 0.85rem; text-transform: uppercase; }
            td { padding: 12px; border-bottom: 1px solid #e2e8f0; text-align: center; font-size: 0.9rem; }
            tr:nth-child(even) { background-color: #f1f5f9; }
        </style>
    </head>
    <body>
        <div class="header-container">
            <h2 style="margin:0;">INVERSIONES MARTÍNEZ</h2>
            <p>Estado de Cuenta - Modalidad: <b>${p.modalidad === 'interes_fijo' ? 'Réditos' : 'Cuotas'}</b></p>
            <div class="header-grid">
                <div class="info-item">Cliente: <br><b>${p.nombre.toUpperCase()}</b></div>
                <div class="info-item">Capital Inicial: <br><b>RD$ ${capitalOriginal.toLocaleString()}</b></div>
                <div class="info-item">Balance Pendiente: <br><b style="color:#dc2626;">RD$ ${Math.round(p.saldoPendiente).toLocaleString()}</b></div>
                <div class="info-item">Tasa: <br><b>${tasa}%</b></div>
            </div>
        </div>
        <table>
            <thead>
                <tr>
                    <th>#</th>
                    <th>Fecha</th>
                    <th>Monto Pagado</th>
                    <th>Abono Cap.</th>
                    <th>Interés</th>
                    <th>Balance</th>
                    <th>Estado</th>
                </tr>
            </thead>
            <tbody>${filas}</tbody>
        </table>
    </body>
    </html>
    `);
    ventana.document.close();
};