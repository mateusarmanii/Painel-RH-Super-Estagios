import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Pencil, Trash2 } from "lucide-react";
import CreationForm from "./CreationForm.jsx";
import ListToolbar from "./ListToolbar.jsx";
import Modal from "./Modal.jsx";
import PageHeader from "./PageHeader.jsx";
import { downloadCsv, toCsv, todayForFilename } from "../csv.js";
import { normalize } from "../text.js";
import { API_URL as apiUrl } from "../api.js";

// Lista com busca, edição (PUT) e exclusão (DELETE) para empresas, vagas e estudantes.
export default function EntityList({
  title,
  type,
  endpoint,
  entityLabel,
  searchPlaceholder,
  getSearchText,
  getName,
  emptyMessage,
  renderItem,
  renderEditExtra,
  csvExport,
  filterItems,
  subtitle,
}) {
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editingItem, setEditingItem] = useState(null);
  const [deletingItem, setDeletingItem] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadItems = useCallback(async () => {
    try {
      const response = await fetch(`${apiUrl}/${endpoint}`);
      if (!response.ok) throw new Error(`Não foi possível carregar a lista de ${entityLabel.plural}.`);
      setItems(await response.json());
    } catch (loadError) {
      toast.error(loadError.message);
    } finally {
      setIsLoading(false);
    }
  }, [endpoint, entityLabel.plural]);

  useEffect(() => {
    loadItems();
    window.addEventListener("dashboard:refresh", loadItems);
    return () => window.removeEventListener("dashboard:refresh", loadItems);
  }, [loadItems]);

  const filteredItems = useMemo(() => {
    const visibleItems = filterItems ? items.filter(filterItems) : items;
    const term = normalize(search.trim());
    if (!term) return visibleItems;
    return visibleItems.filter((item) => normalize(getSearchText(item)).includes(term));
  }, [items, search, getSearchText, filterItems]);

  // Exporta exatamente o que está na tela (já filtrado pela busca).
  function handleExport() {
    downloadCsv(`${csvExport.filename}-${todayForFilename()}.csv`, toCsv(filteredItems, csvExport.columns));
    toast.success(
      `${filteredItems.length} ${filteredItems.length === 1 ? entityLabel.singular : entityLabel.plural} exportad${entityLabel.article}${filteredItems.length === 1 ? "" : "s"}.`,
    );
  }

  async function handleDelete() {
    setIsDeleting(true);

    try {
      const response = await fetch(`${apiUrl}/${endpoint}/${deletingItem.id}`, { method: "DELETE" });

      if (!response.ok) {
        const result = await response.json().catch(() => ({}));
        throw new Error(result.erro ?? `Não foi possível excluir ${entityLabel.article} ${entityLabel.singular}.`);
      }

      setItems((current) => current.filter((item) => item.id !== deletingItem.id));
      toast.success(`${getName(deletingItem)} foi excluíd${entityLabel.article} com sucesso.`);
      window.dispatchEvent(new Event("dashboard:refresh"));
    } catch (deleteError) {
      // Em caso de 409 (vínculos), a API explica o motivo; o item continua na lista.
      toast.error(deleteError.message);
    } finally {
      setIsDeleting(false);
      setDeletingItem(null);
    }
  }

  return (
    <section className="min-h-[calc(100vh-4rem)] bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-7xl">
        <PageHeader title={title} subtitle={subtitle} />
        <ListToolbar
          id={type}
          search={search}
          onSearchChange={setSearch}
          placeholder={searchPlaceholder}
          onExport={csvExport && handleExport}
          exportDisabled={isLoading || filteredItems.length === 0}
        />

        {isLoading ? (
          <p className="text-sm text-slate-500">A carregar...</p>
        ) : filteredItems.length === 0 ? (
          <p className="text-sm text-slate-500">
            {search.trim() ? `Nenhum resultado para "${search.trim()}".` : emptyMessage}
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filteredItems.map((item) => (
              <article
                key={item.id}
                className="relative flex min-h-56 flex-col rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="absolute right-3 top-3 flex gap-1">
                  <button
                    type="button"
                    aria-label={`Editar ${getName(item)}`}
                    title="Editar"
                    onClick={() => setEditingItem(item)}
                    className="grid size-8 place-items-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-sky-800"
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    type="button"
                    aria-label={`Excluir ${getName(item)}`}
                    title="Excluir"
                    onClick={() => setDeletingItem(item)}
                    className="grid size-8 place-items-center rounded-md text-rose-600 transition-colors hover:bg-rose-50 hover:text-rose-700"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                {renderItem(item)}
              </article>
            ))}
          </div>
        )}
      </div>

      <Modal
        isOpen={Boolean(editingItem)}
        title={`Editar ${entityLabel.singular}`}
        onClose={() => setEditingItem(null)}
      >
        {editingItem && (
          <>
            <CreationForm
              key={editingItem.id}
              type={type}
              initialData={editingItem}
              onSuccess={() => setEditingItem(null)}
            />
            {renderEditExtra?.(editingItem)}
          </>
        )}
      </Modal>

      <Modal
        isOpen={Boolean(deletingItem)}
        title="Tem certeza?"
        onClose={() => !isDeleting && setDeletingItem(null)}
      >
        {deletingItem && (
          <div className="space-y-5">
            <p className="text-sm text-slate-700">
              Deseja excluir {entityLabel.article} {entityLabel.singular}{" "}
              <strong className="font-semibold text-slate-900">{getName(deletingItem)}</strong>?
              Esta ação não pode ser desfeita.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeletingItem(null)}
                disabled={isDeleting}
                className="h-10 rounded-md border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                className="h-10 rounded-md bg-rose-600 px-4 text-sm font-medium text-white transition-colors hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isDeleting ? "A excluir..." : "Excluir"}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </section>
  );
}
