import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import Layout from "./components/Layout.jsx";
import KanbanPage from "./pages/Kanban.jsx";
import DashboardPage from "./pages/Dashboard.jsx";
import AgendaPage from "./pages/Agenda.jsx";
import ContratacoesPage from "./pages/Contratacoes.jsx";
import BancoTalentosPage from "./pages/BancoTalentos.jsx";
import VagasPage from "./pages/Vagas.jsx";
import { EmpresasPage, EmpresasSemVagaPage } from "./pages/Empresas.jsx";
import EstudantesPage from "./pages/Estudantes.jsx";
import EstudantePerfilPage from "./pages/EstudantePerfil.jsx";

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/vagas" element={<VagasPage />} />
          <Route path="/kanban" element={<KanbanPage />} />
          <Route path="/kanban/:vagaId" element={<KanbanPage />} />
          <Route path="/agenda" element={<AgendaPage />} />
          <Route path="/empresas" element={<EmpresasPage />} />
          <Route path="/empresas-sem-vaga" element={<EmpresasSemVagaPage />} />
          <Route path="/estudantes" element={<EstudantesPage />} />
          <Route path="/estudantes/:id" element={<EstudantePerfilPage />} />
          <Route path="/banco-de-talentos" element={<BancoTalentosPage />} />
          <Route path="/contratacoes" element={<ContratacoesPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
      <Toaster
        position="top-right"
        containerStyle={{ top: 76 }}
        toastOptions={{ className: "text-sm", duration: 4000, error: { duration: 6000 } }}
      />
    </BrowserRouter>
  );
}