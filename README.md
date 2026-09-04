# RepoLens · GitHub en perspectiva

Tercer proyecto del portafolio de **Saul Ramos Sanchez**. Dashboard para explorar repositorios públicos, lenguajes, estrellas y eventos recientes de una cuenta de GitHub.

## Qué puedes hacer

- Buscar usuarios u organizaciones por su nombre de GitHub.
- Filtrar repositorios por nombre, descripción y lenguaje; incluir o excluir forks y archivados.
- Ordenar por estrellas, forks, nombre o fecha del último push.
- Consultar distribución por lenguaje principal, top 5 por estrellas y eventos de los últimos 14 días UTC.
- Abrir los repositorios originales en GitHub.

## Stack y arquitectura

React 19, TypeScript, Tailwind CSS 4, Recharts y componentes Shadcn sobre Vinext. El navegador consulta directamente la API REST pública de GitHub, sin token. El sitio se entrega como una aplicación compatible con Sites/Cloudflare Workers; no utiliza Java ni base de datos.

`lib/github.ts` contiene el cliente HTTP, validación, normalización, caché temporal y funciones de análisis. `app/page.tsx` coordina las consultas cancelables y la interfaz. La información recibida se representa como texto y los enlaces se construyen sobre el dominio fijo `github.com`.

## Ejecutar en Windows

Requisitos: Node.js 24 y npm.

```powershell
cd repolens
npm ci
npm run dev -- --port 3006
```

Abrir http://localhost:3006. También puedes ejecutar `scripts/Iniciar-RepoLens.ps1` desde PowerShell. No requiere Docker, claves de API ni contraseñas.

## Validación

```powershell
npm run typecheck
npm test
npm run build
```

Las 15 pruebas automatizadas cubren normalización, filtros, agregaciones, caché, paginación, respuestas parciales, errores y cancelación. Se comprobó además una consulta real de `octocat` a la API pública. Las pruebas unitarias utilizan respuestas controladas y no consumen la cuota de GitHub. CI ejecuta instalación reproducible, tipos, pruebas y compilación.

## Alcance de los datos

Se cargan hasta 500 repositorios propios públicos ordenados por último push (cinco páginas de 100). Una consulta completa realiza entre 3 y 7 peticiones: perfil, repositorios y una página de eventos. Las métricas de repositorios respetan los filtros y corresponden exclusivamente a los registros cargados.

La distribución cuenta repositorios por lenguaje principal, no bytes ni líneas de código. La actividad usa como máximo 100 eventos públicos recientes y los agrupa en 14 días UTC; no es una medición de productividad ni un historial completo de commits. Las estrellas tampoco miden calidad del código.

GitHub limita las consultas sin autenticación por IP. El dashboard muestra los encabezados de cuota cuando están disponibles y comunica cuándo esperar. La caché conserva hasta ocho consultas durante cinco minutos **en memoria de la pestaña**. Recargar la página elimina esa caché; no hay almacenamiento persistente ni exportación de datos.

Los repositorios privados de tu cuenta (incluidos proyectos del portafolio guardados como privados) no aparecerán. Para probar inmediatamente, usa el botón de ejemplo `octocat`.

## Documentación

- [Manual y decisiones técnicas](docs/guia.md)
- [Casos de prueba](tests/github.test.mjs)
- [Guía HTML](public/guia.html)

Incluye una integración opcional WebMCP para consultar una cuenta desde agentes compatibles. La búsqueda visible funciona sin esa API experimental. Se verificaron el registro de la herramienta, el rechazo de una entrada inválida y la búsqueda de octocat con actualización del dashboard mediante un navegador compatible.

## Fuentes oficiales

- [Repositorios públicos de un usuario](https://docs.github.com/en/rest/repos/repos#list-repositories-for-a-user)
- [Límites de la API REST](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api)
- [Eventos públicos](https://docs.github.com/en/rest/activity/events#list-public-events-for-a-user)

Proyecto independiente de portafolio; no es un producto oficial de GitHub.

## Organización del código

Consulta [la arquitectura y sus decisiones](docs/ARQUITECTURA.md).
