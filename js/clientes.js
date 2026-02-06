/**
 * js/clientes.js - Inversiones Martínez
 * Versión: Gestión de Clientes 100% en Vivo (Sin LocalStorage)
 */

if (typeof window.getE === 'undefined') {
    window.getE = (id) => document.getElementById(id);
}

// 1. MODAL
window.abrirModalCliente = function() {
    const modal = getE('modal-cliente');
    if (modal) modal.style.display = 'flex';
};

window.cerrarModalCliente = function() {
    const modal = getE('modal-cliente');
    if (modal) {
        modal.style.display = 'none';
        getE('client-form')?.reset();
        getE('client-form')?.removeAttribute('data-edit-id');
        
        const inputCedula = getE('cedula-cliente');
        if (inputCedula) {
            inputCedula.readOnly = false;
            inputCedula.style.backgroundColor = "white";
        }

        const submitBtn = document.querySelector('#client-form .btn-guardar');
        if (submitBtn) submitBtn.innerText = "Guardar";
    }
};

// 2. GUARDAR / EDITAR DIRECTO EN LA NUBE
const clientForm = getE('client-form');
if (clientForm) {
    clientForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const btnGuardar = this.querySelector('.btn-guardar');
        const editId = this.getAttribute('data-edit-id');
        const nombre = getE('nombre-cliente')?.value.trim();
        const cedula = getE('cedula-cliente')?.value.trim();
        const telefono = getE('tel-cliente')?.value.trim();

        if(!nombre || !cedula) return alert("Nombre y Cédula obligatorios");

        if (btnGuardar) {
            btnGuardar.disabled = true;
            btnGuardar.innerText = "Sincronizando Excel...";
        }

        const datosParaNube = { 
            id: editId ? editId : Date.now(), 
            nombre, 
            cedula, 
            telefono, 
            fechaRegistro: new Date().toLocaleDateString('es-DO') 
        };

        try {
            // ENVIAR A GOOGLE SHEETS
            await fetch(window.G_URL, {
                method: 'POST',
                mode: 'no-cors',
                body: JSON.stringify({ action: "clientes", payload: datosParaNube })
            });

            alert("✅ Cliente guardado en la base de datos.");
            window.cerrarModalCliente();
            
            // Forzamos la recarga de la tabla consultando la nube de nuevo
            window.renderizarTablaClientes();

        } catch (error) {
            console.error("Error sincronización:", error);
            alert("❌ Error de conexión. Revisa tu internet.");
        } finally {
            if (btnGuardar) {
                btnGuardar.disabled = false;
                btnGuardar.innerText = editId ? "Actualizar" : "Guardar";
            }
        }
    });
}

// 3. TABLA DE CLIENTES (LECTURA EN VIVO)
window.renderizarTablaClientes = async function() {
    const tabla = getE('lista-clientes-body');
    if (!tabla) return;
    
    tabla.innerHTML = "<tr><td colspan='4' style='text-align:center;'>Consultando Excel...</td></tr>";

    try {
        const response = await fetch(window.G_URL);
        const db = await response.json();
        const clientes = db.clientes || [];

        // Opcional: Actualizar memoria local solo para autocompletado rápido
        localStorage.setItem('mis_clientes', JSON.stringify(clientes));

        tabla.innerHTML = "";
        [...clientes].reverse().forEach(c => {
            tabla.innerHTML += `
                <tr>
                    <td>${c.nombre}</td>
                    <td>${c.cedula}</td>
                    <td>${c.telefono || 'N/A'}</td>
                    <td style="display: flex; gap: 8px; justify-content: center;">
                        <button onclick="window.irAPrestamo('${c.cedula}')" style="background:#2563eb; color:white; border:none; width:35px; height:35px; border-radius:6px; cursor:pointer;" title="Nuevo Préstamo">
                            <i class="fas fa-hand-holding-usd"></i>
                        </button>
                        <button onclick="window.prepararEdicion(${c.id})" style="background:#f59e0b; color:white; border:none; width:35px; height:35px; border-radius:6px; cursor:pointer;" title="Editar">
                            <i class="fas fa-edit"></i>
                        </button>
                    </td>
                </tr>`;
        });
    } catch (e) {
        tabla.innerHTML = "<tr><td colspan='4' style='color:red;'>Error al conectar con la base de datos</td></tr>";
    }
};

// 4. PREPARAR EDICIÓN
window.prepararEdicion = function(id) {
    const clientes = JSON.parse(localStorage.getItem('mis_clientes')) || [];
    const c = clientes.find(item => item.id == id);
    if (c) {
        window.abrirModalCliente();
        setTimeout(() => {
            if(getE('nombre-cliente')) getE('nombre-cliente').value = c.nombre;
            if(getE('tel-cliente')) getE('tel-cliente').value = c.telefono || "";
            const inputCedula = getE('cedula-cliente');
            if(inputCedula) {
                inputCedula.value = c.cedula;
                inputCedula.readOnly = true;
                inputCedula.style.backgroundColor = "#e2e8f0";
            }
            getE('client-form')?.setAttribute('data-edit-id', id);
            const btn = document.querySelector('#client-form .btn-guardar');
            if(btn) btn.innerText = "Actualizar";
        }, 100);
    }
};


window.irAPrestamo = function(cedula) {
    if (typeof window.mostrarSeccion === 'function') {
        window.mostrarSeccion('prestamos');
        setTimeout(() => {
            if(typeof window.abrirModalPrestamo === 'function') window.abrirModalPrestamo();
            const inp = getE('cliente-cedula');
            if (inp) {
                inp.value = cedula;
                if(typeof window.buscarClientePorCedulaAuto === 'function') {
                    window.buscarClientePorCedulaAuto(cedula);
                }
            }
        }, 250);
    }
};

document.addEventListener('DOMContentLoaded', window.renderizarTablaClientes);