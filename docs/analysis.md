# Análisis del APK de referencia (Tuckii 1.5.0)

Este documento resume el análisis estático de la app que sirvió de inspiración funcional. SaveMe **no contiene código, textos, fuentes, imágenes ni animaciones** de esa app: todo fue escrito desde cero. Solo se estudió qué hace y cómo se ve para diseñar una alternativa libre.

## Archivo analizado

| Campo | Valor |
| --- | --- |
| Origen | `https://files.catbox.moe/ey6yue.xapk` (descarga de terceros) |
| SHA-256 del .xapk | `de222ec14e3bcd355df7e61c47f560de51dc46f8fa1a7be9250224544de2bad4` |
| Paquete | `com.myCku.tuckii`, versión 1.5.0 (code 17), minSdk 24, targetSdk 36 |
| Contenido | APK base + splits `arm64_v8a`, `xxhdpi` y 18 idiomas |
| Firma | APK Signature Scheme v2/v3, certificado `CN=Android, O=Google Inc.` (clave de Play App Signing) — SHA-256 `49A12C85…731A8014` |

## Revisión de seguridad (¿tiene virus?)

**Conclusión: no se encontraron indicios de malware.** Es un análisis estático manual, no un antivirus; para mayor garantía sube el hash a VirusTotal.

Qué se revisó:

1. **Firma**: el certificado es el que Google genera para *Play App Signing*, consistente con un APK extraído de Google Play sin re-firmar. Un APK modificado/"crackeado" normalmente lleva otra firma.
2. **Manifest**: componentes estándar de Expo/React Native, Firebase Messaging, Google Play Billing, RevenueCat, Amazon IAP y `com.pairip.licensecheck` (verificación de licencia de Google Play). No hay servicios de accesibilidad, administradores de dispositivo, receptores de SMS ni lanzadores ocultos.
3. **Permisos**: Internet, almacenamiento, notificaciones, vibración, arranque (para reprogramar recordatorios), facturación y contadores de insignia de launchers. `SYSTEM_ALERT_WINDOW` es el único llamativo; suele venir de la plantilla de React Native (overlay de desarrollo) y es común en apps Expo. SaveMe lo bloquea explícitamente.
4. **DEX** (2 archivos, ~14 MB): todos los paquetes pertenecen a librerías conocidas (expo, com.facebook, com.google, com.amazon, com.swmansion, com.horcrux/svg, com.pairip, revenuecat) más 2 clases propias (`MainActivity`, `MainApplication`). Sin `DexClassLoader` dinámico, sin `su`, sin APIs de SMS/contactos/llamadas usadas por la app.
5. **Librerías nativas**: solo las de React Native, Hermes, Reanimated, Expo, Fresco y codecs de imagen (AVIF/WebP/GIF).
6. **Payloads ocultos**: no hay DEX, ELF ni ZIP embebidos en `assets/` o `res/`.
7. **Red** (dominios en el bundle JS): `tuckii.app`, un CloudFront propio, `save-links-api.vercel.app` (su API para previsualizar enlaces), RevenueCat, Stripe/Paddle (SDK de pagos web de RevenueCat) y `u.expo.dev` (actualizaciones OTA). Nada sospechoso.

Riesgo residual: el archivo viene de un mirror de terceros; la firma de Google lo hace muy probablemente auténtico, pero instalar la app desde Google Play sigue siendo lo más seguro.

## Herramientas

- `morluto/rea` se clonó para consulta; su flujo Android depende de un JAR de JADX que el entorno no permitió descargar, así que se usó el mismo enfoque con herramientas equivalentes:
- `androguard` (manifest, firma, inventario DEX).
- `P1sec/hermes-dec` para descompilar el bundle Hermes (bytecode v98).

## Lo que se aprendió de la app

- **Stack**: Expo SDK 57, React Native, Expo Router, expo-sqlite, Reanimated, RevenueCat.
- **Pantallas**: inicio (biblioteca + colecciones + recientes), colección, detalle de enlace, Focus Mode, búsqueda, ajustes, copia de seguridad, sincronización iCloud (solo iOS), guía, onboarding y paywall.
- **Modelo de datos**: colecciones anidadas, enlaces/imágenes con notas, pin y estado visto, etiquetas.
- **Límites de la versión gratuita**: 3 colecciones raíz, límite diario de enlaces, límite de imágenes e importaciones; etiquetas, subcarpetas, compartir colecciones y exportar eran solo Pro.
- **Diseño**: estilo neo-brutalista — bordes negros de ~2.5 px, sombras sólidas desplazadas 4 px, colores planos saturados, tipografía geométrica.

## Qué hace distinto SaveMe

| | Tuckii | SaveMe |
| --- | --- | --- |
| Precio | Freemium con suscripción | Todo gratis, MIT |
| Límites | 3 colecciones, cupo diario | Ninguno |
| Previews | Servidor propio | Directo desde el dispositivo + oEmbed |
| Exportar | Solo backup propio (Pro) | Backup JSON, HTML de navegador y CSV |
| Importar | CSV/HTML/JSON (limitado) | CSV/HTML/JSON sin límite, carpetas → colecciones |
| Focus Mode | Sí | Sí, con modo aleatorio |
| Recordatorios | Fijos | Hora configurable |
| Cuentas / analítica | RevenueCat, Firebase | Ninguna |
| Marca | Tuckii, mascota propia | SaveMe, logo propio (marcador sonriente), paleta propia |

## Comparación con Tuckii 1.4.0

Se revisó también `Tuckii-1.4.0-split-apks.zip` (SHA-256 `b9db463a…2c2008`). Es la misma app: mismo paquete y mismo certificado de Play App Signing que la 1.5.0, sin indicios de modificaciones. La 1.4.0 todavía no tiene las pantallas de copia de seguridad ni de sincronización con iCloud, y sus tokens de diseño (colores, bordes, sombras, tipografía) son idénticos a los de la 1.5.0.

La diferencia de diseño con la primera versión de SaveMe estaba en la maquetación, no en la versión de Tuckii. Tomando como referencia las capturas públicas de Google Play, SaveMe adoptó: tarjetas de colección con forma de carpeta, titular grande con barra de guardado rápido, aviso de guardados pendientes, orden de colecciones, Focus Mode oscuro con barra de progreso por segmentos, detalle con imagen a sangre y barra de acciones, etiquetas con forma de etiqueta y ajustes en tarjetas. Toda la implementación es propia; no se usan imágenes, textos ni archivos de Tuckii (Sora es una fuente libre de Google Fonts).
