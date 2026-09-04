# Guía de RepoLens

## Primer uso

1. Escribe el nombre de una cuenta, por ejemplo `octocat`, y pulsa Explorar.
2. Revisa el perfil y la fecha de la consulta para confirmar qué cuenta estás viendo.
3. Filtra por lenguaje, texto, forks o archivos. Las tarjetas y las gráficas de repositorios se recalculan sobre esa selección.
4. Ordena la lista y pulsa Mostrar 20 más para revelar más registros ya descargados.
5. Revisa la actividad pública. Esta sección pertenece a la cuenta completa y no cambia con los filtros de repositorios.

Puedes buscar otra cuenta durante una consulta: la solicitud anterior se cancela y sus resultados no reemplazan los nuevos. El botón Cancelar consulta vuelve al estado inicial. Los filtros no hacen nuevas peticiones a GitHub.

## Interpretar las gráficas

**Lenguajes:** una unidad equivale a un repositorio. Los registros sin lenguaje detectable se etiquetan como Sin lenguaje. Cuando hay más de seis categorías, se muestran las cinco principales y se agrupa el resto; la tabla conserva los lenguajes individuales.

**Estrellas:** top 5 de los repositorios filtrados. El conteo representa estrellas recibidas por esos repositorios, no estrellas que el usuario ha dado a otros proyectos.

**Actividad:** número de eventos públicos por día UTC en una ventana de 14 días, tomada de una página de hasta 100 eventos. Los eventos pueden representar pushes, incidencias, estrellas, pull requests u otras acciones. Un evento no equivale a un commit y una ausencia de eventos no prueba inactividad.

**Último push:** fecha pública reportada para el repositorio; no equivale necesariamente a actividad personal del dueño.

## Errores y datos parciales

- Nombre inválido: se rechaza localmente antes de consultar GitHub.
- 404: la cuenta pública no se encontró.
- 403 o 429: GitHub restringió las consultas; se muestra el momento de recuperación cuando lo indica la API.
- Tiempo de espera o desconexión: se informa del fallo y se permite reintentar manualmente. Cada petición tiene un límite de 12 segundos.
- Error a partir de la segunda página: se conservan los repositorios ya cargados con un aviso de muestra incompleta.
- Error de eventos: se conservan perfil y repositorios y se marca la actividad como no disponible, sin convertirla en cero ficticio.

No hay reintentos automáticos ni solicitudes en segundo plano. La cuenta y los filtros se mantienen únicamente mientras la página está abierta.

## Decisiones técnicas

El acceso directo desde el navegador evita almacenar tokens y aprovecha el soporte CORS de GitHub. Las peticiones usan `credentials: omit`; no leen repositorios privados ni la sesión de GitHub abierta en otras pestañas. El backend del hosting entrega la aplicación, pero no actúa como proxy de la API.

La paginación está acotada a cinco páginas para controlar latencia y consumo. No se sigue ciegamente una URL recibida en un encabezado: las rutas se construyen con un usuario validado y un número de página local. Los repositorios se deduplican por ID.

`AbortController` cancela solicitudes previas y un identificador de secuencia protege contra respuestas fuera de orden. La caché en memoria reduce consultas repetidas sin presentar datos almacenados como información en tiempo real.

La interfaz permite teclado, utiliza etiquetas en los controles y ofrece una tabla textual de repositorios. Las gráficas tienen soporte de accesibilidad de Recharts, leyendas con cantidades y descripciones de alcance.

## Cómo presentarlo en una entrevista

“Desarrollé un dashboard en React y TypeScript conectado a una API externa. Separé la obtención y normalización de datos de los componentes visuales, incorporé paginación limitada, caché temporal y cancelación de solicitudes. Las pruebas cubren respuestas parciales y errores de cuota, además de filtros y agregaciones.”

Muestra una búsqueda, un filtro combinado y una gráfica; explica por qué los eventos públicos no equivalen a productividad. No presentes como implementados un backend Java, autenticación o una base de datos: están fuera del alcance de esta versión.
