import { ArrowLeft, ExternalLink, Lock, Mail, ShieldCheck } from 'lucide-react';
import { BOOTSTRAPPED_ADMIN_EMAIL } from '../domain/rbacEngine';
import type { NavSection } from './Navbar';

interface PrivacyPolicyViewProps {
  onNavigate: (section: NavSection) => void;
}

export function PrivacyPolicyView({ onNavigate }: PrivacyPolicyViewProps) {
  return (
    <div className="bg-white min-h-[75vh]">
      {/* Carbon Editorial Header */}
      <div className="bg-[#0d0d0d] text-white border-b border-white/10">
        <div className="max-w-[960px] mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <button
            type="button"
            onClick={() => onNavigate('inicio')}
            className="inline-flex items-center gap-2 text-xs uppercase tracking-widest text-neutral-400 hover:text-white transition-colors mb-6 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Volver al inicio</span>
          </button>

          <p className="text-xs uppercase tracking-widest text-[#707ef9] font-medium">
            Documento Público Oficial · Campeonato Intercarreras UFRO
          </p>
          <h1 className="font-display text-4xl sm:text-5xl font-bold uppercase tracking-tight mt-2">
            Política de Privacidad
          </h1>
          <p className="text-sm text-neutral-400 mt-3 max-w-2xl leading-relaxed">
            Transparencia sobre la recopilación, protección, uso limitado de servicios de Google y
            derechos de los participantes de la plataforma oficial del Campeonato Intercarreras de la
            Universidad de La Frontera (Temuco, Chile).
          </p>
          <p className="text-xs text-neutral-500 mt-4 tabular-nums">
            Última actualización: 2026 · Vigente para todos los usuarios y roles del campeonato
          </p>
        </div>
      </div>

      {/* Main Legal Content */}
      <div className="max-w-[960px] mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-10 text-[#0d0d0d]">
        {/* Key Summary Strip */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border border-neutral-200 bg-[#f5f6f8] p-5">
          <div className="bg-white border border-neutral-200 p-4 space-y-1.5">
            <div className="flex items-center gap-2 text-[#707ef9]">
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <h2 className="font-display text-sm font-bold uppercase tracking-wider text-[#0d0d0d]">
                Login mínimo por defecto
              </h2>
            </div>
            <p className="text-xs text-neutral-600 leading-relaxed">
              Al iniciar sesión con Google solo solicitamos tu nombre, correo electrónico y foto de
              perfil. No accedemos a tu Drive ni a tus archivos personales.
            </p>
          </div>
          <div className="bg-white border border-neutral-200 p-4 space-y-1.5">
            <div className="flex items-center gap-2 text-[#707ef9]">
              <Lock className="w-4 h-4 shrink-0" />
              <h2 className="font-display text-sm font-bold uppercase tracking-wider text-[#0d0d0d]">
                Datos estudiantiles aislados
              </h2>
            </div>
            <p className="text-xs text-neutral-600 leading-relaxed">
              RUT, matrícula, correo institucional y fecha de nacimiento se resguardan en una
              colección privada restringida exclusivamente por rol (RBAC).
            </p>
          </div>
          <div className="bg-white border border-neutral-200 p-4 space-y-1.5">
            <div className="flex items-center gap-2 text-[#707ef9]">
              <Mail className="w-4 h-4 shrink-0" />
              <h2 className="font-display text-sm font-bold uppercase tracking-wider text-[#0d0d0d]">
                Sin fines comerciales
              </h2>
            </div>
            <p className="text-xs text-neutral-600 leading-relaxed">
              Esta plataforma tiene carácter exclusivamente deportivo y universitario. Nunca vendemos
              ni compartimos datos con terceros ni para publicidad.
            </p>
          </div>
        </div>

        {/* Section 1 */}
        <section className="space-y-3 border-b border-neutral-200 pb-8">
          <h2 className="font-display text-2xl font-bold uppercase tracking-wide text-[#0d0d0d]">
            1. Responsable de la Plataforma y Alcance
          </h2>
          <p className="text-sm text-neutral-700 leading-relaxed">
            La aplicación web <strong>Campeonato Intercarreras UFRO</strong> es administrada por la
            organización deportiva universitaria del Campeonato Intercarreras en la Universidad de La
            Frontera (Temuco, Región de La Araucanía, Chile). Esta Política de Privacidad describe
            cómo recopilamos, almacenamos, utilizamos y protegemos la información personal de
            estudiantes, jugadores, delegados de equipo, árbitros, fotógrafos oficiales,
            administradores y visitantes públicos.
          </p>
          <p className="text-sm text-neutral-700 leading-relaxed">
            Para consultas sobre privacidad, rectificación o eliminación de datos, el canal oficial de
            contacto es:{' '}
            <a
              href={`mailto:${BOOTSTRAPPED_ADMIN_EMAIL}`}
              className="font-semibold text-[#707ef9] underline"
            >
              {BOOTSTRAPPED_ADMIN_EMAIL}
            </a>
            .
          </p>
        </section>

        {/* Section 2 */}
        <section className="space-y-4 border-b border-neutral-200 pb-8">
          <h2 className="font-display text-2xl font-bold uppercase tracking-wide text-[#0d0d0d]">
            2. Información que Recopilamos
          </h2>
          <div className="space-y-3 text-sm text-neutral-700 leading-relaxed">
            <div>
              <h3 className="font-bold text-[#0d0d0d]">
                2.1. Datos de autenticación con Google (todos los usuarios registrados)
              </h3>
              <p className="mt-1">
                Cuando inicias sesión mediante <strong>Google Sign-In / Firebase Authentication</strong>,
                recibimos únicamente tu información básica de identidad: identificador único de
                usuario (UID), nombre visible, dirección de correo electrónico y URL de fotografía de
                perfil. Esta información se utiliza para crear tu perfil de usuario, gestionar tus
                equipos favoritos, registrar tu voto MVP y aplicar los permisos de tu rol.
              </p>
            </div>

            <div>
              <h3 className="font-bold text-[#0d0d0d]">
                2.2. Datos deportivos y de inscripción de jugadores
              </h3>
              <p className="mt-1">
                Cuando un delegado de equipo o un administrador inscribe un plantel en el campeonato,
                se registran:
              </p>
              <ul className="list-disc pl-5 mt-2 space-y-1">
                <li>
                  <strong>Información deportiva pública:</strong> nombre y apellidos, dorsal,
                  posición, carrera, facultad, nivel académico (pregrado/postgrado), condición de
                  Seleccionado UFRO, fotografía deportiva y estadísticas del campeonato (partidos
                  jugados, goles, asistencias, puntos, tarjetas, aces y bloqueos).
                </li>
                <li>
                  <strong>Información académica y personal aislada (acceso restringido):</strong>{' '}
                  RUT, número de matrícula, correo institucional UFRO y fecha de nacimiento. Estos
                  cuatro campos se almacenan separados del perfil público y solo son visibles para
                  administradores acreditados, el delegado del propio equipo o el propio estudiante
                  vinculado.
                </li>
              </ul>
            </div>

            <div>
              <h3 className="font-bold text-[#0d0d0d]">
                2.3. Actividad comunitaria y material fotográfico
              </h3>
              <p className="mt-1">
                Registramos tu lista de equipos favoritos, preferencia de notificaciones, votos MVP
                (un voto por usuario por partido) y, en el caso de fotógrafos acreditados, los
                metadatos y enlaces de las fotografías oficiales del campeonato.
              </p>
            </div>
          </div>
        </section>

        {/* Section 3 */}
        <section className="space-y-3 border-b border-neutral-200 pb-8">
          <h2 className="font-display text-2xl font-bold uppercase tracking-wide text-[#0d0d0d]">
            3. Finalidad del Tratamiento de Datos
          </h2>
          <ul className="list-disc pl-5 space-y-1.5 text-sm text-neutral-700 leading-relaxed">
            <li>
              Autenticar usuarios y asignar permisos diferenciados (Usuario Tradicional, Jugador,
              Delegado, Árbitro Oficial, Fotógrafo Oficial y Administrador).
            </li>
            <li>
              Verificar la elegibilidad de estudiantes regulares de la Universidad de La Frontera,
              cupos por disciplina y reglas del mercado de transferencias.
            </li>
            <li>
              Publicar tablas de posiciones, llaves de playoffs, estadísticas deportivas, resultados
              validados y votaciones MVP.
            </li>
            <li>
              Mantener el respaldo administrativo en planillas oficiales de Google Sheets y el
              archivo fotográfico oficial en Google Drive exclusivamente mediante acciones
              autorizadas por administradores y fotógrafos.
            </li>
          </ul>
        </section>

        {/* Section 4: Google API Services User Data Policy (CRITICAL FOR OAUTH PUBLISHING) */}
        <section className="space-y-4 border-b border-neutral-200 pb-8">
          <h2 className="font-display text-2xl font-bold uppercase tracking-wide text-[#0d0d0d]">
            4. Uso de APIs de Google Workspace y Cumplimiento de Uso Limitado
          </h2>
          <p className="text-sm text-neutral-700 leading-relaxed">
            El acceso a <strong>Google Sheets</strong> y <strong>Google Drive</strong> es{' '}
            <strong>estrictamente opcional</strong> y <strong>nunca se solicita</strong> durante el
            inicio de sesión estándar de estudiantes, jugadores, delegados ni espectadores. Solo se
            solicita autorización incremental a cuentas con rol de <strong>Administrador</strong> o{' '}
            <strong>Fotógrafo Oficial</strong> cuando deciden explícitamente conectar dichas
            herramientas:
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-sm text-neutral-700 leading-relaxed">
            <li>
              <strong>Google Sheets (solo Administradores):</strong> se utiliza únicamente para leer
              y sincronizar de forma bidireccional las pestañas gestionadas (
              <code className="font-mono text-xs bg-neutral-100 px-1 py-0.5">Web_*</code>) de las
              planillas Master del campeonato expresamente vinculadas por el administrador, previa
              confirmación explícita en pantalla.
            </li>
            <li>
              <strong>Google Drive (solo Administradores y Fotógrafos):</strong> se utiliza
              únicamente para listar las fotografías de la galería oficial del campeonato y subir
              nuevas fotografías a la carpeta de temporada seleccionada por el propio fotógrafo o
              administrador.
            </li>
          </ul>

          <div className="bg-[#f8f9ff] border border-[#707ef9] p-5 space-y-2">
            <p className="font-display text-sm font-bold uppercase tracking-wider text-[#0d0d0d]">
              Declaración de Uso Limitado (Google API Services User Data Policy)
            </p>
            <p className="text-xs text-neutral-800 leading-relaxed">
              El uso y la transferencia a cualquier otra aplicación de la información recibida desde
              las APIs de Google por parte de <strong>Campeonato Intercarreras UFRO</strong>{' '}
              cumplirá en todo momento con la{' '}
              <a
                href="https://developers.google.com/terms/api-services-user-data-policy"
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-[#707ef9] underline inline-flex items-center gap-1"
              >
                <span>Google API Services User Data Policy</span>
                <ExternalLink className="w-3 h-3" />
              </a>
              , incluidos los requisitos de <strong>Uso Limitado (Limited Use)</strong>. Los datos
              obtenidos desde Google Workspace jamás se venden, no se utilizan para publicidad
              dirigida, no se transfieren a terceros externos y no se utilizan para entrenar modelos
              de inteligencia artificial o aprendizaje automático generalizados.
            </p>
          </div>
        </section>

        {/* Section 5 */}
        <section className="space-y-3 border-b border-neutral-200 pb-8">
          <h2 className="font-display text-2xl font-bold uppercase tracking-wide text-[#0d0d0d]">
            5. Almacenamiento, Seguridad y Protección de Datos
          </h2>
          <ul className="list-disc pl-5 space-y-1.5 text-sm text-neutral-700 leading-relaxed">
            <li>
              Todos los datos de la aplicación se almacenan en infraestructura segura de{' '}
              <strong>Google Cloud / Firebase (Cloud Firestore y Firebase Authentication)</strong>{' '}
              con cifrado en tránsito (HTTPS/TLS) y cifrado en reposo.
            </li>
            <li>
              Aplicamos reglas de seguridad estrictas en servidor y base de datos que impiden el
              acceso público a documentos personales sensibles (RUT, matrícula, correo institucional
              y fecha de nacimiento).
            </li>
            <li>
              Los tokens temporales de acceso de Google Workspace (para Administradores y Fotógrafos)
              se mantienen únicamente en memoria durante la sesión activa del navegador y nunca se
              almacenan en <code className="font-mono text-xs bg-neutral-100 px-1 py-0.5">localStorage</code>{' '}
              ni en nuestra base de datos.
            </li>
          </ul>
        </section>

        {/* Section 6 */}
        <section className="space-y-3 border-b border-neutral-200 pb-8">
          <h2 className="font-display text-2xl font-bold uppercase tracking-wide text-[#0d0d0d]">
            6. Retención y Derechos de los Usuarios
          </h2>
          <p className="text-sm text-neutral-700 leading-relaxed">
            Conservamos los datos deportivos e históricos del campeonato mientras dure la temporada y
            para mantener el registro histórico universitario. De conformidad con la normativa chilena
            vigente sobre protección de datos personales (Ley N° 19.628 y sus modificaciones), todo
            usuario tiene derecho a:
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-sm text-neutral-700 leading-relaxed">
            <li>
              <strong>Acceso y rectificación:</strong> consultar sus datos registrados o solicitar la
              corrección de cualquier dato inexacto.
            </li>
            <li>
              <strong>Eliminación:</strong> solicitar la eliminación de su cuenta de usuario o de su
              ficha estudiantil escribiendo a{' '}
              <a
                href={`mailto:${BOOTSTRAPPED_ADMIN_EMAIL}`}
                className="font-semibold text-[#707ef9] underline"
              >
                {BOOTSTRAPPED_ADMIN_EMAIL}
              </a>
              . Las solicitudes se atienden en un plazo máximo de 10 días hábiles.
            </li>
            <li>
              <strong>Revocación de permisos de Google:</strong> puedes revocar en cualquier momento
              el acceso de esta aplicación desde la configuración de seguridad de tu cuenta Google en{' '}
              <a
                href="https://myaccount.google.com/permissions"
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-[#707ef9] underline inline-flex items-center gap-1"
              >
                <span>myaccount.google.com/permissions</span>
                <ExternalLink className="w-3 h-3" />
              </a>
              .
            </li>
          </ul>
        </section>

        {/* Section 7 */}
        <section className="space-y-3">
          <h2 className="font-display text-2xl font-bold uppercase tracking-wide text-[#0d0d0d]">
            7. Modificaciones y Contacto
          </h2>
          <p className="text-sm text-neutral-700 leading-relaxed">
            Podremos actualizar esta Política de Privacidad para reflejar mejoras técnicas o cambios
            normativos del campeonato. Cualquier actualización se publicará en esta misma dirección
            pública indicando la fecha de vigencia. Si tienes dudas o solicitudes relacionadas con
            tus datos personales, escríbenos a{' '}
            <a
              href={`mailto:${BOOTSTRAPPED_ADMIN_EMAIL}`}
              className="font-semibold text-[#707ef9] underline"
            >
              {BOOTSTRAPPED_ADMIN_EMAIL}
            </a>
            .
          </p>
        </section>
      </div>
    </div>
  );
}
