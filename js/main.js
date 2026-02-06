/**
 * js/main.js - Inversiones Martínez
 * Versión: Cache Inteligente y Sincronización en Segundo Plano
 */

// 1. URL GLOBAL DE CONEXIÓN (Asegúrate de que sea la de /exec)
window.G_URL = "https://script.google.com/macros/s/AKfycbwjJ1bq7Tmn4uWpRBkPHQPTMgvxwvq11gSgXeHXVWuMCd8YPiRNtlN5TabChAncrnXOUw/exec";

// 2. FUNCIÓN DE NAVEGACIÓN Y SINCRONIZACIÓN
async function mostrarSeccion(seccion) {
    // A. CAMBIO VISUAL INMEDIATO
    document.querySelectorAll('.content-section').forEach(sec => sec.style.display = 'none');
    document.querySelectorAll('.sidebar-menu a').forEach(link => link.classList.remove('active'));

    const targetSec = document.getElementById(`sec-${seccion}`);
    if (targetSec) targetSec.style.display = 'block';

    const activeLink = document.querySelector(`[onclick="mostrarSeccion('${seccion}')"]`);
    if (activeLink) activeLink.classList.add('active');

    // B. CARGA INSTANTÁNEA DESDE CACHE (LocalStorage)
    // Esto hace que la tabla aparezca de una vez aunque el internet esté lento
    ejecutarRenderizado(seccion);

    // C. ACTUALIZACIÓN EN SEGUNDO PLANO DESDE LA NUBE
    try {
        const response = await fetch(window.G_URL);
        const db = await response.json();

        // Guardamos los datos frescos
        if (db.clientes) localStorage.setItem('mis_clientes', JSON.stringify(db.clientes));
        if (db.prestamos) localStorage.setItem('mis_prestamos', JSON.stringify(db.prestamos));
        if (db.cobros) localStorage.setItem('mis_cobros', JSON.stringify(db.cobros));
        if (db.gastos) localStorage.setItem('mis_gastos', JSON.stringify(db.gastos));

        // Volvemos a renderizar solo si hubo cambios y estamos en la sección
        ejecutarRenderizado(seccion);
        console.log(`✅ Datos de ${seccion} actualizados desde la nube.`);

    } catch (error) {
        console.warn("⚠️ Modo Offline: Usando datos guardados en el navegador.");
    }
}

// Función auxiliar para no repetir código de dibujado
function ejecutarRenderizado(seccion) {
    if (seccion === 'clientes' && typeof renderizarTablaClientes === 'function') renderizarTablaClientes();
    if (seccion === 'prestamos' && typeof renderizarTablaPrestamos === 'function') renderizarTablaPrestamos();
    if (seccion === 'cobranza' && typeof renderizarListaMaestra === 'function') renderizarListaMaestra();
    if (seccion === 'reportes' && typeof calcularUtilidades === 'function') calcularUtilidades();
    if (seccion === 'dashboard' && typeof actualizarDashboard === 'function') actualizarDashboard();
    if (seccion === 'gastos' && typeof renderizarGastos === 'function') renderizarGastos();
}