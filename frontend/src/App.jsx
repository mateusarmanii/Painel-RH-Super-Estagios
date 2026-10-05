import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import Layout from "./components/Layout.jsx";
import KanbanPage from "./pages/Kanban.jsx";
import DashboardPage from "./pages/Dashboard.jsx";
import {
  BancoDeTalentosPage,
  ContratacoesPage,
  EmpresasPage,
  EmpresasSemVagaPage,
  VagasPage,
} from "./pages/Pages.jsx";

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/vagas" element={<VagasPage />} />
          <Route path="/kanban" element={<KanbanPage />} />
          <Route path="/empresas" element={<EmpresasPage />} />
          <Route path="/empresas-sem-vaga" element={<EmpresasSemVagaPage />} />
          <Route path="/banco-de-talentos" element={<BancoDeTalentosPage />} />
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