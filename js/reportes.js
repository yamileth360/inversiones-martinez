/**
 * js/reportes.js - Inversiones Martínez
 * Reporte Histórico General con Sincronización Nube
 * Corrección: Mapeo de variables montoTotal e interesGanado
 */

window.calcularUtilidades = async function() {
    const contenedor = document.getElementById('utilidad-neta');
    if (!contenedor) return;

    contenedor.innerHTML = `<div style="text-align:center; padding:50px; color:#64748b;">
        <i class="fas fa-sync fa-spin" style="font-size:2rem;"></i><br><br>
        Obteniendo datos actualizados de la nube...</div>`;

    try {
        const response = await fetch(window.G_URL);
        const db = await response.json();

        // Limpiamos LocalStorage con datos frescos
        if (db.cobros) localStorage.setItem('mis_cobros', JSON.stringify(db.cobros));
        if (db.gastos) localStorage.setItem('mis_gastos', JSON.stringify(db.gastos));

    } catch (error) {
        console.warn("⚠️ Usando datos locales.");
    }

    const historial = JSON.parse(localStorage.getItem('mis_cobros')) || [];
    const gastos = JSON.parse(localStorage.getItem('mis_gastos')) || [];

    let capRecuperado = 0;
    let intGanado = 0;
    let totalGastos = 0;

    // --- PROCESAR COBROS (CORREGIDO) ---
    historial.forEach(p => {
        // Usamos montoTotal que es el nombre real en tu Excel de cobros
        const montoRecibido = parseFloat(p.montoTotal || p.monto) || 0;
        const interes = parseFloat(p.interesGanado) || 0;
        
        intGanado += interes;
        // Capital Recuperado = Lo que pagó el cliente menos el interés
        capRecuperado += (montoRecibido - interes);
    });

    // --- PROCESAR GASTOS ---
    gastos.forEach(g => {
        totalGastos += parseFloat(g.monto) || 0;
    });

    const gananciaReal = intGanado - totalGastos;

    // RENDERIZADO
    contenedor.innerHTML = `
        <div style="text-align:center; margin-bottom: 30px;">
            <h2 style="color: #1e293b; font-size: 1.8rem;">Reporte de Rendimiento Histórico</h2>
            <p style="color: #64748b;">Resumen total acumulado en Inversiones Martínez</p>
        </div>

        <div class="cards-grid" style="display:grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px;">
            <div style="border-left: 6px solid #2563eb; background: white; padding: 25px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
                <p style="color: #64748b; font-size: 0.8rem; text-transform: uppercase; font-weight:bold;">Capital Recuperado (Cobrado)</p>
                <h3 style="font-size: 1.8rem; color: #1e293b; margin: 10px 0;">RD$ ${Math.round(capRecuperado).toLocaleString('es-DO')}</h3>
                <small style="color: #64748b;">Dinero base que regresó a caja</small>
            </div>
            
            <div style="border-left: 6px solid #10b981; background: white; padding: 25px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
                <p style="color: #64748b; font-size: 0.8rem; text-transform: uppercase; font-weight:bold;">Intereses Ganados</p>
                <h3 style="font-size: 1.8rem; color: #10b981; margin: 10px 0;">RD$ ${Math.round(intGanado).toLocaleString('es-DO')}</h3>
                <small style="color: #64748b;">Ganancia bruta por préstamos</small>
            </div>
            
            <div style="border-left: 6px solid #dc2626; background: white; padding: 25px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
                <p style="color: #64748b; font-size: 0.8rem; text-transform: uppercase; font-weight:bold;">Gastos Operativos</p>
                <h3 style="font-size: 1.8rem; color: #dc2626; margin: 10px 0;">RD$ ${Math.round(totalGastos).toLocaleString('es-DO')}</h3>
                <small style="color: #64748b;">Egresos y costos registrados</small>
            </div>
        </div>

        <div style="margin-top: 40px; background: linear-gradient(135deg, #1e293b 0%, #334155 100%); color: white; padding: 50px; border-radius: 20px; text-align: center;">
            <p style="opacity: 0.8; font-size: 1rem; text-transform: uppercase; letter-spacing: 3px;">Utilidad Neta Real</p>
            <h2 style="font-size: 4rem; font-weight: 800; margin: 0;">RD$ ${Math.round(gananciaReal).toLocaleString('es-DO')}</h2>
            <div style="width: 80px; height: 4px; background: #10b981; margin: 25px auto;"></div>
            <button onclick="window.print()" style="background: #dc2626; color: white; border: none; padding: 15px 40px; font-weight: bold; border-radius: 10px; cursor: pointer;">
                <i class="fas fa-file-pdf"></i> GENERAR PDF DE AUDITORÍA
            </button>
        </div>
    `;
};

document.addEventListener('DOMContentLoaded', window.calcularUtilidades);