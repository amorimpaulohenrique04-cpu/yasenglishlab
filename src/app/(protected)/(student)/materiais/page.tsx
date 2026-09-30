import Link from "next/link";

import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  IconButton,
  Input,
  PageHeader,
} from "@/components/ui";
import {
  MATERIAL_FILTER_TYPES,
  materialActionLabel,
  materialMetadataLabel,
  materialTypeLabel,
  type MaterialFilterType,
  type MaterialListItem,
  type MaterialsFilters,
} from "@/modules/materials";
import { loadMaterialsPage } from "@/server/materials/materials";

import { setMaterialFavoriteAction } from "./actions";

interface MaterialsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function filterHref(filters: MaterialsFilters, type: MaterialFilterType): string {
  const params = new URLSearchParams();
  if (filters.query) params.set("q", filters.query);
  if (type !== "ALL") params.set("type", type);

  const query = params.toString();
  return query ? `/materiais?${query}` : "/materiais";
}

function MaterialTypeIcon({ material }: { material: MaterialListItem }) {
  const short = {
    PDF: "PDF",
    SUMMARY: "R",
    VOCABULARY: "V",
    GRAMMAR: "G",
    AUDIO: "♪",
    WORKSHEET: "✎",
    ANSWER_KEY: "✓",
  }[material.materialType];

  return (
    <span className="yas-materials-type-icon" data-type={material.materialType} aria-hidden="true">
      {short}
    </span>
  );
}

function MaterialRow({
  material,
  compact = false,
}: {
  material: MaterialListItem;
  compact?: boolean;
}) {
  return (
    <div className={compact ? "yas-materials-row yas-materials-row--compact" : "yas-materials-row"}>
      <MaterialTypeIcon material={material} />
      <div className="yas-materials-row-copy">
        <strong>{material.title}</strong>
        <span>{materialMetadataLabel(material)}</span>
        {!compact && (
          <small>
            {material.module?.title ?? "Material geral"}
            {material.lesson ? ` • Aula ${material.lesson.position}` : ""}
          </small>
        )}
      </div>
      <div className="yas-materials-row-actions">
        {!compact && (
          <a
            className="yas-materials-open-link yas-focusable"
            href={`/materiais/${material.id}/abrir`}
            target="_blank"
            rel="noopener noreferrer"
          >
            {materialActionLabel(material.materialType)} →
          </a>
        )}
        <form action={setMaterialFavoriteAction}>
          <input type="hidden" name="materialId" value={material.id} />
          <input type="hidden" name="favorited" value={material.favorite ? "false" : "true"} />
          <IconButton
            type="submit"
            className="yas-materials-favorite"
            label={
              material.favorite
                ? `Desfavoritar ${material.title}`
                : `Favoritar ${material.title}`
            }
            aria-pressed={material.favorite}
          >
            {material.favorite ? "★" : "☆"}
          </IconButton>
        </form>
      </div>
    </div>
  );
}

export default async function MaterialsPage({ searchParams }: MaterialsPageProps) {
  const params = await searchParams;
  const state = await loadMaterialsPage({
    query: firstValue(params.q),
    type: firstValue(params.type),
  });

  if (state.status === "unauthorized") {
    return (
      <div className="yas-materials-page">
        <PageHeader title="Materiais" description="Encontre, revise e abra os recursos do seu curso." />
        <ErrorState
          title="Acesso não autorizado"
          description="Sua conta não possui acesso à biblioteca de materiais."
        />
      </div>
    );
  }

  if (state.status === "empty") {
    return (
      <div className="yas-materials-page">
        <PageHeader title="Materiais" description="Encontre, revise e abra os recursos do seu curso." />
        <EmptyState
          title="Nenhum material disponível"
          description="Os recursos autorizados do seu curso aparecerão aqui quando forem publicados."
        />
      </div>
    );
  }

  const { filters, groups, favorites, materials, totalAuthorized } = state.data;
  const filtering = Boolean(filters.query) || filters.type !== "ALL";

  return (
    <div className="yas-materials-page">
      <PageHeader
        title="Materiais"
        description="Encontre, revise e abra os recursos do seu curso."
        actions={<Badge>{totalAuthorized} disponíveis</Badge>}
      />

      <div className="yas-materials-toolbar">
        <form className="yas-materials-search-row" role="search" method="get">
          <div className="yas-materials-search">
            <Input
              label="Buscar materiais"
              name="q"
              type="search"
              defaultValue={filters.query}
              placeholder="Buscar materiais, aulas ou temas…"
            />
          </div>
          {filters.type !== "ALL" && <input type="hidden" name="type" value={filters.type} />}
          <Button type="submit" variant="secondary">
            Buscar
          </Button>
          {filtering && (
            <Link className="yas-materials-clear yas-focusable" href="/materiais">
              Limpar
            </Link>
          )}
        </form>

        <nav className="yas-materials-filters" aria-label="Categorias de materiais">
          {MATERIAL_FILTER_TYPES.map((type) => {
            const selected = filters.type === type;
            return (
              <Link
                key={type}
                href={filterHref(filters, type)}
                className="yas-tag yas-materials-filter yas-focusable"
                data-selected={selected}
                aria-current={selected ? "page" : undefined}
              >
                {type === "ALL" ? "Todos" : materialTypeLabel(type)}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="yas-materials-layout">
        <section className="yas-materials-library" aria-labelledby="materiais-curso-title">
          <div className="yas-materials-section-heading">
            <div>
              <h2 id="materiais-curso-title">Materiais do curso</h2>
              <p>
                {filtering
                  ? `${materials.length} resultado${materials.length === 1 ? "" : "s"} na busca atual.`
                  : "Organizados pelo contexto pedagógico da sua trilha."}
              </p>
            </div>
          </div>

          {materials.length === 0 ? (
            <Card>
              <EmptyState
                title="Nenhum material encontrado"
                description="Tente outro termo ou volte para a categoria Todos."
              />
            </Card>
          ) : (
            <div className="yas-materials-groups">
              {groups.map((group, index) => (
                <details
                  className="yas-materials-group"
                  key={group.key}
                  open={index === 0 || group.items.some((item) => item.favorite)}
                >
                  <summary>
                    <span>{group.title}</span>
                    <small>
                      {group.items.length} {group.items.length === 1 ? "material" : "materiais"}
                    </small>
                  </summary>
                  <div className="yas-materials-group-list">
                    {group.items.map((material) => (
                      <MaterialRow key={material.id} material={material} />
                    ))}
                  </div>
                </details>
              ))}
            </div>
          )}
        </section>

        <aside className="yas-materials-side" aria-labelledby="materiais-favoritos-title">
          <Card>
            <div className="yas-materials-side-stack">
              <div className="yas-materials-section-heading">
                <div>
                  <h2 id="materiais-favoritos-title">Favoritos</h2>
                  <p>Seus recursos salvos para revisar depois.</p>
                </div>
              </div>

              {favorites.length === 0 ? (
                <p className="yas-materials-side-empty">
                  Favoritados aparecem aqui sem criar uma segunda lista de progresso.
                </p>
              ) : (
                <div className="yas-materials-favorites-list">
                  {favorites.map((material) => (
                    <MaterialRow key={material.id} material={material} compact />
                  ))}
                </div>
              )}
            </div>
          </Card>
        </aside>
      </div>
    </div>
  );
}
