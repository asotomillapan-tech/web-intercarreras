import { ArrowLeft, ExternalLink, Lock, Mail, ShieldCheck } from 'lucide-react';
import { BOOTSTRAPPED_ADMIN_EMAIL } from '../domain/rbacEngine';
import { RevealSection, SectionKicker } from './MotionPrimitives';
import type { NavSection } from './Navbar';

interface PrivacyPolicyViewProps {
  onNavigate: (section: NavSection) => void;
}

export function PrivacyPolicyView({ onNavigate }: PrivacyPolicyViewProps) {
  return (
    <div className="bg-[#050507] text-zinc-100 min-h-[80vh]">
      {/* Obsidian Editorial Header */}
      <div className="border-b border-white/[0.08]">
        <div className="max-w-[920px] mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-5">
          <button
            type="button"
            onClick={() => onNavigate('inicio')}
            className="inline-flex items-center gap-2 text-xs text-zinc-400 hover:text-white transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Volver al inicio</span>
          </button>

          <SectionKicker index="01" label="Documento Oficial · UFRO" />
          <h1 className="text-4xl sm:text-5xl font-medium tracking-[-0.035em] text-white">
            Política de <span className="font-editorial text-[#c8ceff]">privacidad</span>
          </h1>
          <p className="text-sm text-zinc-400 max-w-2xl leading-relaxed">
            Transparencia sobre la recopilación, resguardo y uso limitado de servicios de Google en
            el Campeonato Intercarreras de la Universidad de La Frontera.
          </p>
          <p className="text-xs text-zinc-500 tabular-nums">
            Última actualización: 2026 · Vigente para todos los usuarios y roles
          </p>
        </div>
      </div>

      {/* Main Legal Content */}
      <RevealSection className="max-w-[920px] mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-10">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            {
              icon: ShieldCheck,
              title: 'Acceso mínimo',
              body: 'Al iniciar sesión con Google solo solicitamos nombre, correo y foto de perfil.',
            },
            {
              icon: Lock,
              title: 'Datos aislados',
              body: 'RUT, matrícula, correo institucional y nacimiento se protegen en una colección privada con control por rol.',
            },
            {
              icon: Mail,
              title: 'Sin fines comerciales',
              body: 'Plataforma universitaria sin publicidad ni venta o cesión de datos a terceros.',
            },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.title}
                className="rounded-2xl bg-[#0c0c10] border border-white/[0.08] p-5 space-y-2"
              >
                <div className="flex items-center gap-2 text-[#9aa5ff]">
                  <Icon className="w-4 h-4 shrink-0" />
                  <h2 className="text-sm font-medium text-white">{item.title}</h2>
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed">{item.body}</p>
              </div>
            );
          })}
        </div>

        {/* Section 1 */}
        <section className="space-y-3 border-b border-white/[0.08] pb-8">
          <h2 className="text-xl font-medium tracking-[-0.02em] text-white">
            1. Responsable y alcance
          </h2>
          <p className="text-sm text-zinc-400 leading-relaxed">
            La plataforma <strong className="text-zinc-200 font-medium">Campeonato Intercarreras UFRO</strong> es
            administrada por la organización deportiva universitaria de la Universidad de La
            Frontera (Temuco, Chile). Esta política detalla cómo protegemos los datos de estudiantes,
            jugadores, delegados, árbitros, fotógrafos, administradores y visitantes.
          </p>
          <p className="text-sm text-zinc-400 leading-relaxed">
            Contacto oficial:{' '}
            <a
              href={`mailto:${BOOTSTRAPPED_ADMIN_EMAIL}`}
              className="text-[#a5b0ff] hover:text-white underline underline-offset-4 transition-colors"
            >
              {BOOTSTRAPPED_ADMIN_EMAIL}
            </a>
            .
          </p>
        </section>

        {/* Section 2 */}
        <section className="space-y-4 border-b border-white/[0.08] pb-8">
          <h2 className="text-xl font-medium tracking-[-0.02em] text-white">
            2. Información que recopilamos
          </h2>
          <div className="space-y-4 text-sm text-zinc-400 leading-relaxed">
            <div>
              <h3 className="font-medium text-zinc-200">2.1. Autenticación con Google</h3>
              <p className="mt-1">
                Al iniciar sesión mediante Google Sign-In / Firebase Authentication recibimos tu
                identificador único (UID), nombre visible, correo electrónico y foto de perfil para
                gestionar tus favoritos, votos y permisos de rol.
              </p>
            </div>
            <div>
              <h3 className="font-medium text-zinc-200">2.2. Datos deportivos y de inscripción</h3>
              <ul className="list-disc pl-5 mt-2 space-y-1.5 marker:text-[#9aa5ff]">
                <li>
                  <strong className="text-zinc-200 font-medium">Perfil deportivo público:</strong> nombre,
                  dorsal, posición, carrera, facultad, condición de Seleccionado UFRO, fotografía y
                  estadísticas del torneo.
                </li>
                <li>
                  <strong className="text-zinc-200 font-medium">Información privada aislada:</strong> RUT,
                  matrícula, correo institucional y fecha de nacimiento, accesibles solo para
                  administración, delegado de equipo o el propio estudiante vinculado.
                </li>
              </ul>
            </div>
            <div>
              <h3 className="font-medium text-zinc-200">2.3. Actividad comunitaria y fotografía</h3>
              <p className="mt-1">
                Equipos favoritos, preferencias de notificación, votos oficiales y, para fotógrafos
                acreditados, metadatos de cobertura fotográfica.
              </p>
            </div>
          </div>
        </section>

        {/* Section 3 */}
        <section className="space-y-3 border-b border-white/[0.08] pb-8">
          <h2 className="text-xl font-medium tracking-[-0.02em] text-white">
            3. Finalidad del tratamiento
          </h2>
          <ul className="list-disc pl-5 space-y-1.5 text-sm text-zinc-400 leading-relaxed marker:text-[#9aa5ff]">
            <li>Autenticar usuarios y aplicar permisos por rol (RBAC).</li>
            <li>Verificar elegibilidad estudiantil, cupos y transferencias oficiales.</li>
            <li>Publicar posiciones, llaves de playoffs, estadísticas, resultados y votaciones.</li>
            <li>Respaldar planillas en Google Sheets y archivo fotográfico en Google Drive bajo autorización explícita.</li>
          </ul>
        </section>

        {/* Section 4 */}
        <section className="space-y-4 border-b border-white/[0.08] pb-8">
          <h2 className="text-xl font-medium tracking-[-0.02em] text-white">
            4. APIs de Google Workspace y Uso Limitado
          </h2>
          <p className="text-sm text-zinc-400 leading-relaxed">
            El acceso a Google Sheets y Google Drive es opcional y nunca se solicita durante el
            inicio de sesión estándar. Solo se solicita autorización incremental a Administradores o
            Fotógrafos Oficiales al conectar dichas herramientas:
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-sm text-zinc-400 leading-relaxed marker:text-[#9aa5ff]">
            <li>
              <strong className="text-zinc-200 font-medium">Google Sheets (Administradores):</strong> sincronización
              de pestañas gestionadas (<code className="font-mono text-xs bg-white/[0.06] px-1.5 py-0.5 rounded text-zinc-200">Web_*</code>)
              en planillas vinculadas previa confirmación.
            </li>
            <li>
              <strong className="text-zinc-200 font-medium">Google Drive (Administradores y Fotógrafos):</strong> listado
              y carga de fotografías oficiales en la carpeta de temporada seleccionada.
            </li>
          </ul>

          <div className="rounded-2xl bg-[#101018] border border-[#707ef9]/30 p-5 space-y-2">
            <p className="text-xs font-medium text-[#c8ceff]">
              Declaración de Uso Limitado (Google API Services User Data Policy)
            </p>
            <p className="text-xs text-zinc-300 leading-relaxed">
              El uso y transferencia de información recibida desde las APIs de Google por{' '}
              <strong className="text-white">Campeonato Intercarreras UFRO</strong> cumple íntegramente
              con la{' '}
              <a
                href="https://developers.google.com/terms/api-services-user-data-policy"
                target="_blank"
                rel="noreferrer"
                className="text-[#a5b0ff] hover:text-white underline underline-offset-4 inline-flex items-center gap-1"
              >
                <span>Google API Services User Data Policy</span>
                <ExternalLink className="w-3 h-3" />
              </a>
              , incluidos los requisitos de Limited Use. Nunca vendemos datos, no realizamos
              publicidad dirigida ni entrenamos modelos de IA generalizados con datos de Workspace.
            </p>
          </div>
        </section>

        {/* Section 5 */}
        <section className="space-y-3 border-b border-white/[0.08] pb-8">
          <h2 className="text-xl font-medium tracking-[-0.02em] text-white">
            5. Seguridad y almacenamiento
          </h2>
          <ul className="list-disc pl-5 space-y-1.5 text-sm text-zinc-400 leading-relaxed marker:text-[#9aa5ff]">
            <li>Almacenamiento en Google Cloud / Firebase con cifrado en tránsito (HTTPS/TLS) y en reposo.</li>
            <li>Reglas de seguridad en servidor que aíslan campos sensibles estudiantiles.</li>
            <li>
              Los tokens temporales de Google Workspace permanecen únicamente en memoria durante la
              sesión activa y nunca se guardan en <code className="font-mono text-xs bg-white/[0.06] px-1.5 py-0.5 rounded text-zinc-200">localStorage</code> ni en base de datos.
            </li>
          </ul>
        </section>

        {/* Section 6 */}
        <section className="space-y-3 border-b border-white/[0.08] pb-8">
          <h2 className="text-xl font-medium tracking-[-0.02em] text-white">
            6. Derechos de los usuarios
          </h2>
          <p className="text-sm text-zinc-400 leading-relaxed">
            De conformidad con la Ley N° 19.628, puedes solicitar acceso, rectificación o
            eliminación de tus datos escribiendo a{' '}
            <a
              href={`mailto:${BOOTSTRAPPED_ADMIN_EMAIL}`}
              className="text-[#a5b0ff] hover:text-white underline underline-offset-4"
            >
              {BOOTSTRAPPED_ADMIN_EMAIL}
            </a>{' '}
            (respuesta en un máximo de 10 días hábiles), o revocar permisos en cualquier momento en{' '}
            <a
              href="https://myaccount.google.com/permissions"
              target="_blank"
              rel="noreferrer"
              className="text-[#a5b0ff] hover:text-white underline underline-offset-4 inline-flex items-center gap-1"
            >
              <span>myaccount.google.com/permissions</span>
              <ExternalLink className="w-3 h-3" />
            </a>
            .
          </p>
        </section>

        {/* Section 7 */}
        <section className="space-y-3">
          <h2 className="text-xl font-medium tracking-[-0.02em] text-white">
            7. Actualizaciones
          </h2>
          <p className="text-sm text-zinc-400 leading-relaxed">
            Cualquier modificación a esta política se publicará en esta misma dirección pública
            indicando su fecha de vigencia.
          </p>
        </section>
      </RevealSection>
    </div>
  );
}
