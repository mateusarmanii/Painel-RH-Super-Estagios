import { lazy, Suspense, useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes, useParams } from "react-router-dom";
import toast, { Toaster } from "react-hot-toast";
import Layout from "./components/Layout.jsx";
import LoginPage from "./pages/Login.jsx";
import { clearSession, getUser, SESSION_EXPIRED_EVENT } from "./session.js";
// Cada tela é carregada só quando é aberta (o primeiro carregamento fica menor).
const DashboardPage = lazy(() => import("./pages/Dashboard.jsx"));
const KanbanPage = lazy(() => import("./pages/Kanban.jsx"));
const AgendaPage = lazy(() => import("./pages/Agenda.jsx"));
const ContratacoesPage = lazy(() => import("./pages/Contratacoes.jsx"));
const BancoTalentosPage = lazy(() => import("./pages/BancoTalentos.jsx"));
const VagasPage = lazy(() => import("./pages/Vagas.jsx"));
const EmpresasPage = lazy(() => import("./pages/Empresas.jsx").then((module) => ({ default: module.EmpresasPage })));
const EmpresasSemVagaPage = lazy(() => import("./pages/Empresas.jsx").then((module) => ({ default: module.EmpresasSemVagaPage })));
const EstudantesPage = lazy(() => import("./pages/Estudantes.jsx"));
const EstudantePerfilPage = lazy(() => import("./pages/EstudantePerfil.jsx"));
const ConfiguracoesPage = lazy(() => import("./pages/Configuracoes.jsx"));
const RelatorioEmpresaPage = lazy(() => import("./pages/RelatorioEmpresa.jsx"));
const TutorialIaPage = lazy(() => import("./pages/TutorialIa.jsx"));
const TreinamentoPage = lazy(() => import("./pages/Treinamento.jsx"));
// O painel é só da equipe. Única página sem login: nova senha, aberta pelo link enviado ao e-mail do próprio usuário.
const RedefinirSenhaPage = lazy(() => import("./pages/publico/RedefinirSenha.jsx"));

const pageFallback = (
  <div className="px-4 py-8 sm:px-6 lg:px-8" aria-busy="true" aria-label="Carregando">
    <div className="mx-auto h-64 max-w-7xl animate-pulse superficie rounded-lg border border-slate-200 bg-white" />
  </div>
);

export default function App() {
  const [user, setUser] = useState(getUser);

  // A API respondeu 401 (token vencido, inválido ou usuário desativado): volta para o login.
  useEffect(() => {
    const expire = () => {
      setUser(null);
      toast.error("Sua sessão expirou. Entre novamente.", { id: "sessao-expirada" });
    };
    window.addEventListener(SESSION_EXPIRED_EVENT, expire);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, expire);
  }, []);

  function logout() {
    clearSession();
    setUser(null);
  }

  return (
    <BrowserRouter>
      <Suspense fallback={pageFallback}>
        <Routes>
          <Route path="/redefinir-senha/:token" element={<RedefinirSenhaPage />} />
          <Route path="*" element={user ? <AppRoutes user={user} onLogout={logout} /> : <LoginPage onLogin={setUser} />} />
        </Routes>
      </Suspense>
      <Toaster
        position="top-right"
        containerStyle={{ top: 76 }}
        toastOptions={{ className: "text-sm", duration: 4000, error: { duration: 6000 } }}
      />
    </BrowserRouter>
  );
}

// Perfil novo a cada estudante: ir de um perfil para outro (ex.: "Ver perfil" do aviso de telefone repetido)
// não deixa modais abertos com os dados do anterior.
function EstudantePerfilRoute() {
  const { id } = useParams();
  return <EstudantePerfilPage key={id} />;
}

// Telas do painel (só com login). Sem login, qualquer endereço mostra a tela de login e, ao entrar, abre o endereço pedido.
function AppRoutes({ user, onLogout }) {
  return (
    <Layout user={user} onLogout={onLogout}>
      <Suspense fallback={pageFallback}>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/vagas" element={<VagasPage />} />
          <Route path="/kanban" element={<KanbanPage />} />
          <Route path="/kanban/:vagaId" element={<KanbanPage />} />
          <Route path="/calendario" element={<AgendaPage />} />
          {/* Endereço antigo (antes "Agenda de Entrevistas"), para links salvos. */}
          <Route path="/agenda" element={<Navigate to="/calendario" replace />} />
          <Route path="/empresas" element={<EmpresasPage />} />
          <Route path="/empresas-sem-vaga" element={<EmpresasSemVagaPage />} />
          <Route path="/estudantes" element={<EstudantesPage />} />
          <Route path="/estudantes/:id" element={<EstudantePerfilRoute />} />
          <Route path="/banco-de-talentos" element={<BancoTalentosPage />} />
          <Route path="/contratacoes" element={<ContratacoesPage />} />
          <Route path="/configuracoes" element={<ConfiguracoesPage user={user} />} />
          <Route path="/relatorios/empresa/:id" element={<RelatorioEmpresaPage />} />
          <Route path="/tutorial-ia" element={<TutorialIaPage />} />
          <Route path="/treinamento" element={<TreinamentoPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </Layout>
  );
}