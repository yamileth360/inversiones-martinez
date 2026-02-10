/**
 * js/dashboard.js - Inversiones Martínez
 * Lógica Contable: Capital Puro (Sin Intereses)
 */

// ... (Mantener secciones 1 y 2 de Seguridad y Cerrar Sesión igual)

window.actualizarDashboard = async function () {
    const contenedorLista = document.getElementById('lista-cobros-hoy');
    if (contenedorLista) contenedorLista.innerHTML = "<p style='text-align:center;'>Actualizando indicadores...</p>";

    try {
        const response = await fetch(window.G_URL);
        const db = await response.json();

        const prestamos = db.prestamos || [];
        const cobrosRealizados = db.cobros || [];
        const clientes = db.clientes || [];

        const hoy = new Date();
        const hoyFormateado = `${String(hoy.getDate()).padStart(2, '0')}/${String(hoy.getMonth() + 1).padStart(2, '0')}/${hoy.getFullYear()}`;

        let capitalPuroEnCalle = 0;       
        let interesesPorCobrar = 0;   
        let activosCount = 0;
        let cobrosHoyCount = 0;
        let cobrosHoyLista = []; 

        prestamos.forEach(p => {
            const estado = (p.state || p.estado || "").toLowerCase();
            
            if (estado === 'activo') {
                activosCount++;
                
                const montoOriginal = parseFloat(p.montoOriginal || p.monto) || 0;
                const saldoActual = parseFloat(p.saldoPendiente) || 0;
                const tasa = parseFloat(p.tasa) || 0;
                const modalidad = p.modalidad || "";

                if (modalidad === 'interes_fijo') {
                    /**
                     * LÓGICA RÉDITOS:
                     * El capital puro es el Monto Original (mientras el saldo sea mayor o igual al capital).
                     * Si el saldo es menor al capital (porque abonó a capital), el capital puro es el saldo.
                     */
                    const capitalEnEstePrestamo = Math.min(montoOriginal, saldoActual);
                    const interesEnEstePrestamo = Math.max(0, saldoActual - montoOriginal);
                    
                    capitalPuroEnCalle += capitalEnEstePrestamo;
                    interesesPorCobrar += interesEnEstePrestamo;
                } else {
                    /**
                     * LÓGICA CUOTAS:
                     * Desglosamos el saldo actual quitándole la proporción de interés.
                     */
                    const factorCapital = 1 / (1 + (tasa / 100));
                    const capitalNeto = saldoActual * factorCapital;
                    const interesNeto = saldoActual - capitalNeto;

                    capitalPuroEnCalle += capitalNeto;
                    interesesPorCobrar += interesNeto;
                }

                // Detección de cobros para hoy (se mantiene igual)
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

        // Intereses ya cobrados (Ganancia real)
        const interesesYaCobrados = cobrosRealizados.reduce((total, c) => total + (parseFloat(c.interesGanado) || 0), 0);
        
        // RENDERIZADO
        animarNumero('total-clientes', clientes.length);
        animarNumero('prestamos-activos', activosCount);
        animarNumero('pagos-hoy', cobrosHoyCount);

        // Mostramos el Capital Puro (Dinero real en la calle)
        if(document.getElementById('total-prestado')) 
            document.getElementById('total-prestado').innerText = `RD$ ${Math.round(capitalPuroEnCalle).toLocaleString('es-DO')}`;
        
        if(document.getElementById('total-intereses')) 
            document.getElementById('total-intereses').innerText = `RD$ ${Math.round(interesesYaCobrados).toLocaleString('es-DO')}`;
        
        if(document.getElementById('total-atrasados')) 
            document.getElementById('total-atrasados').innerText = `RD$ ${Math.round(interesesPorCobrar).toLocaleString('es-DO')}`;

        // (Mantener aquí la función irACobrarDirecto y la lista de cobros igual que antes)
        renderizarListaHoy(cobrosHoyLista, contenedorLista);

    } catch (e) {
        console.error("Error:", e);
    }
};

function renderizarListaHoy(lista, contenedor) {
    if (!contenedor) return;
    if (lista.length > 0) {
        contenedor.innerHTML = lista.map(p => {
            const cuota = p.modalidad === 'interes_fijo' ? 
                (parseFloat(p.montoOriginal) * (parseFloat(p.tasa)/100)) : 
                (parseFloat(p.saldoPendiente) / (parseInt(p.cuotasRestantes) || 1));
            return `
                <div onclick="irACobrarDirecto('${p.cedula}')" style="display:flex; justify-content:space-between; padding:15px; border-bottom:1px solid #eee; cursor:pointer; background:#fff;">
                    <div>
                        <strong>${p.nombre}</strong><br>
                        <small style="color:#22c55e;">Registrar Pago ></small>
                    </div>
                    <span style="color:#2563eb; font-weight:800;">RD$ ${Math.round(cuota).toLocaleString()}</span>
                </div>`;
        }).join('');
    } else {
        contenedor.innerHTML = `<p style="text-align:center; color:#94a3b8; margin-top:20px;">No hay cobros hoy</p>`;
    }
}