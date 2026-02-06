/**
 * js/gastos.js - Inversiones Martínez
 * Gestión de egresos 100% en Vivo (Sin LocalStorage)
 */

// 1. REGISTRAR GASTO DIRECTO EN LA NUBE
window.registrarGasto = async function(e) {
    if (e) e.preventDefault();

    const concepto = document.getElementById('gasto-concepto').value.trim();
    const monto = parseFloat(document.getElementById('gasto-monto').value);
    const categoria = document.getElementById('gasto-categoria').value;

    if (!concepto || isNaN(monto) || monto <= 0) {
        alert("⚠️ Por favor, ingrese un concepto y un monto válido.");
        return;
    }

    const btnGuardar = document.querySelector('#form-gasto button[type="submit"]');
    if (btnGuardar) {
        btnGuardar.disabled = true;
        btnGuardar.innerText = "Sincronizando Excel...";
    }

    const nuevoGasto = {
        id: Date.now(),
        fecha: new Date().toLocaleDateString('es-DO'),
        concepto: concepto,
        monto: monto,
        categoria: categoria
    };

    try {
        // ENVIAR A GOOGLE SHEETS (Pestaña 'gastos')
        await fetch(window.G_URL, {
            method: 'POST',
            mode: 'no-cors',
            body: JSON.stringify({ action: "gastos", payload: nuevoGasto })
        });

        alert("✅ Gasto registrado en la base de datos.");
        document.getElementById('form-gasto').reset();
        
        // Refrescar vistas consultando la nube de nuevo
        window.renderizarGastos();
        if (typeof window.actualizarDashboard === 'function') window.actualizarDashboard();
        if (typeof window.calcularUtilidades === 'function') window.calcularUtilidades();

    } catch (error) {
        console.error("Error sincronización:", error);
        alert("❌ Error de conexión. El gasto no pudo guardarse en la nube.");
    } finally {
        if (btnGuardar) {
            btnGuardar.disabled = false;
            btnGuardar.innerText = "Registrar Gasto";
        }
    }
};

// 2. RENDERIZAR LISTA DE GASTOS (LECTURA EN VIVO)
window.renderizarGastos = async function() {
    const contenedor = document.getElementById('lista-gastos-body');
    if (!contenedor) return;

    contenedor.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:20px;">Consultando gastos en la nube...</td></tr>`;

    try {
        const response = await fetch(window.G_URL);
        const db = await response.json();
        const gastos = db.gastos || [];

        // Ordenar por fecha (más recientes primero)
        const gastosOrdenados = [...gastos].reverse();

        if (gastosOrdenados.length === 0) {
            contenedor.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:20px; color:#64748b;">No hay gastos registrados en el Excel</td></tr>`;
            return;
        }

        contenedor.innerHTML = gastosOrdenados.map(g => `
            <tr>
                <td>${g.fecha}</td>
                <td style="font-weight: 600;">${g.concepto}</td>
                <td><span style="background:#f1f5f9; padding:4px 8px; border-radius:4px; font-size:0.8rem;">${g.categoria}</span></td>
                <td style="color:#dc2626; font-weight:bold;">RD$ ${parseFloat(g.monto).toLocaleString('es-DO')}</td>
                <td style="text-align:right;">
                    <small style="color:#94a3b8;">Ver en Excel</small>
                </td>
            </tr>
        `).join('');

    } catch (e) {
        contenedor.innerHTML = `<tr><td colspan="5" style="text-align:center; color:red; padding:20px;">Error al conectar con la base de datos</td></tr>`;
    }
};

// Inicializar al cargar
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('lista-gastos-body')) {
        window.renderizarGastos();
    }
});