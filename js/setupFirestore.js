// /js/setupFirestore.js
import { db } from './firebase-config.js';
import {
    collection, addDoc, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js';

async function crearEstructuraDemo() {
    try {
        console.log('🚀 Creando estructura completa de QA...');
        const timestamp = serverTimestamp();

        const dataDemo = [
            {
                nombre: 'Portal FINSUS',
                requerimiento: 'Integración SPEI',
                fechaFin: new Date('2025-12-31'),
                modulos: [
                    {
                        nombre: 'Transferencias SPEI',
                        ambiente: 'Desarrollo',
                        fechaInicio: new Date(),
                        matriz: {
                            nombre: 'Matriz SPEI V1',
                            descripcion: 'Casos funcionales de SPEI',
                            Ambiente: 'Desarrollo',
                            Modulo: 'Transferencias',
                            Submodulo: 'SPEI',
                            casos: [
                                {
                                    NombreDelCaso: 'Validar SPEI exitoso',
                                    Descripcion: 'Validar flujo correcto de transferencia SPEI.',
                                    Precondiciones: 'Usuario activo con saldo suficiente',
                                    Pasos: '1. Ingresar monto válido\n2. Confirmar\n3. Validar mensaje de éxito',
                                    TipoDePrueba: 'Funcional',
                                    Criterio: true,
                                    ResultadoEsperado: 'Transferencia procesada con éxito',
                                    Tipo: 'Positiva',
                                    Estado: 'Positivo',
                                    FechaEjecucion: new Date(),
                                    Comentarios: 'Funciona correctamente',
                                    Tester: 'daniel@finsus.mx',
                                    ReferenciaHU: 'HU-001',
                                    Fecha: timestamp
                                },
                                {
                                    NombreDelCaso: 'Validar límite diario',
                                    Descripcion: 'Bloquear transferencias > $80,000',
                                    Precondiciones: 'Usuario nivel 2',
                                    Pasos: '1. Ingresar monto mayor a 80,000\n2. Intentar enviar',
                                    TipoDePrueba: 'Negativa',
                                    Criterio: false,
                                    ResultadoEsperado: 'Error “Límite excedido”',
                                    Tipo: 'Negativa',
                                    Estado: 'Fallo',
                                    Comentarios: 'No se bloqueó correctamente',
                                    Tester: 'daniel@finsus.mx',
                                    ReferenciaHU: 'HU-002',
                                    Fecha: timestamp
                                }
                            ]
                        }
                    },
                    {
                        nombre: 'Validación de CURP',
                        ambiente: 'Producción',
                        fechaInicio: new Date('2025-01-05'),
                        matriz: {
                            nombre: 'Matriz CURP',
                            descripcion: 'Validación de CURP automática',
                            Ambiente: 'Producción',
                            Modulo: 'Registro',
                            Submodulo: 'CURP',
                            casos: [
                                {
                                    NombreDelCaso: 'Validar CURP correcta',
                                    Descripcion: 'Aceptar CURP con formato válido.',
                                    TipoDePrueba: 'Funcional',
                                    Estado: 'Positivo',
                                    Tester: 'qa@finsus.mx',
                                    ReferenciaHU: 'HU-003',
                                    Fecha: timestamp
                                },
                                {
                                    NombreDelCaso: 'Rechazar CURP inválida',
                                    Descripcion: 'Mostrar mensaje de error en formato incorrecto.',
                                    TipoDePrueba: 'Negativa',
                                    Estado: 'Positivo',
                                    Tester: 'qa@finsus.mx',
                                    ReferenciaHU: 'HU-004',
                                    Fecha: timestamp
                                }
                            ]
                        }
                    }
                ]
            },
            {
                nombre: 'FINSUS App Móvil',
                requerimiento: 'Remediación de Expedientes',
                fechaFin: new Date('2026-03-01'),
                modulos: [
                    {
                        nombre: 'Crédito con Garantía',
                        ambiente: 'Desarrollo',
                        fechaInicio: new Date(),
                        matriz: {
                            nombre: 'Matriz Crédito PF',
                            descripcion: 'Pruebas de solicitud y validación de crédito.',
                            Ambiente: 'Desarrollo',
                            Modulo: 'Créditos',
                            Submodulo: 'PF',
                            casos: [
                                {
                                    NombreDelCaso: 'Validar solicitud exitosa',
                                    TipoDePrueba: 'Funcional',
                                    Estado: 'Pendiente',
                                    Tester: 'daniel@finsus.mx',
                                    ReferenciaHU: 'HU-005',
                                    Fecha: timestamp
                                },
                                {
                                    NombreDelCaso: 'Validar error sin inversión',
                                    TipoDePrueba: 'Negativa',
                                    Estado: 'Fallo',
                                    Tester: 'daniel@finsus.mx',
                                    ReferenciaHU: 'HU-006',
                                    Fecha: timestamp
                                }
                            ]
                        }
                    },
                    {
                        nombre: 'Dashboard de usuarios',
                        ambiente: 'Producción',
                        fechaInicio: new Date('2025-09-10'),
                        matriz: {
                            nombre: 'Matriz Usuarios',
                            descripcion: 'Validación de perfiles y roles.',
                            Ambiente: 'Producción',
                            Modulo: 'Usuarios',
                            Submodulo: 'Roles',
                            casos: [
                                {
                                    NombreDelCaso: 'Validar asignación de rol',
                                    TipoDePrueba: 'Funcional',
                                    Estado: 'Positivo',
                                    Tester: 'qa@finsus.mx',
                                    ReferenciaHU: 'HU-007',
                                    Fecha: timestamp
                                },
                                {
                                    NombreDelCaso: 'Validar restricción Tester',
                                    TipoDePrueba: 'Negativa',
                                    Estado: 'Positivo',
                                    Tester: 'qa@finsus.mx',
                                    ReferenciaHU: 'HU-008',
                                    Fecha: timestamp
                                }
                            ]
                        }
                    }
                ]
            }
        ];

        // 🔹 Recorremos las apps
        for (const app of dataDemo) {
            const appRef = await addDoc(collection(db, 'apps'), {
                nombre: app.nombre,
                requerimiento: app.requerimiento,
                fechaFin: app.fechaFin,
                createdAt: timestamp
            });
            console.log(`✅ App creada: ${app.nombre}`);

            for (const mod of app.modulos) {
                const modRef = await addDoc(collection(db, `apps/${appRef.id}/modulos`), {
                    nombre: mod.nombre,
                    ambiente: mod.ambiente,
                    fechaInicio: mod.fechaInicio,
                    createdAt: timestamp
                });
                console.log(`   ├─ Módulo: ${mod.nombre}`);

                const matriz = mod.matriz;
                const matrizRef = await addDoc(collection(db, `apps/${appRef.id}/modulos/${modRef.id}/matriz`), {
                    nombre: matriz.nombre,
                    descripcion: matriz.descripcion,
                    Ambiente: matriz.Ambiente,
                    Modulo: matriz.Modulo,
                    Submodulo: matriz.Submodulo,
                    createdAt: timestamp
                });
                console.log(`   │   ├─ Matriz: ${matriz.nombre}`);

                for (const caso of matriz.casos) {
                    await addDoc(collection(db, `apps/${appRef.id}/modulos/${modRef.id}/matriz/${matrizRef.id}/casos`), caso);
                    console.log(`   │   │   ├─ Caso: ${caso.NombreDelCaso}`);
                }
            }
        }

        console.log('🔥 Estructura completa creada con éxito');
        alert('✅ Firestore poblado con datos demo');
    } catch (err) {
        console.error('❌ Error al crear estructura:', err);
        alert('Error: ' + err.message);
    }
}

crearEstructuraDemo();
