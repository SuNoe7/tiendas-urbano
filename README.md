# TIENDAS URBANO — Plataforma E-Commerce & Gestión Operativa (Neo-Seoul Noir)

Aplicación web Full-Stack desarrollada en **Next.js 14 (App Router) + TypeScript + Tailwind CSS + Supabase (PostgreSQL, Auth RBAC, Storage) + Transbank Webpay Plus SDK**.

## 1. Cómo publicar tu enlace público en 3 minutos (Gratis en Vercel + Supabase)

### Paso A: Base de datos, Roles RBAC y Catálogo (Supabase)
1. Crea un proyecto gratuito en [https://supabase.com](https://supabase.com).
2. Ve a **SQL Editor**, pega el contenido completo del archivo `supabase/schema.sql` y presiona **Run**. Esto crea las tablas, las políticas de seguridad por rol (RLS), el bucket de imágenes `product-images` y los **24 productos de demostración**.
3. Copia tus 3 credenciales desde **Project Settings > API**:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`

### Paso B: Publicar en Vercel (URL pública para el Profesor)
1. Sube esta carpeta a un repositorio de GitHub (o arrástrala en Vercel CLI).
2. Importa el proyecto en [https://vercel.com](https://vercel.com), agrega las 3 variables de entorno de Supabase en **Environment Variables** y presiona **Deploy**.
3. Una vez desplegado, haz una petición `POST` a `https://tu-enlace.vercel.app/api/seed-demo-users` para registrar automáticamente las 5 cuentas de demostración en Supabase Auth.

---

## 2. Credenciales de Prueba para los 5 Roles (RBAC)

| Rol Operativo | Correo de Acceso | Contraseña | Permisos Verificables |
| :--- | :--- | :--- | :--- |
| **Clienta** | `clienta@urbano.cl` | `Password123` | Catálogo, filtros, carrito, checkout Webpay Plus, descarga de comprobante PDF y seguimiento propio. |
| **Administrador / Dueño** | `admin@urbano.cl` | `Password123` | CRUD completo de productos, subida de fotografías online, control de precios/ofertas y supervisión total. |
| **Encargado de Bodega** | `bodega@urbano.cl` | `Password123` | Preparación (picking) de pedidos pagados y paso a despacho. Sin acceso a precios ni finanzas. |
| **Despachador** | `despacho@urbano.cl` | `Password123` | Hoja de ruta diaria imprimible con direcciones, actualización a *En despacho* y *Entregado*. |
| **Soporte** | `soporte@urbano.cl` | `Password123` | Consulta de pedidos y postventa sin permisos de modificación de catálogo ni pagos. |

---

## 3. Archivo Editable para Figma
En la carpeta `figma/tiendas-urbano-design-tokens.json` se incluyen los Design Tokens oficiales **Neo-Seoul Noir** listos para importar directamente en **Figma** utilizando el plugin gratuito **Tokens Studio for Figma**.
