import Link from "next/link";

import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Icon,
  IconBadge,
  IconButton,
  Input,
  PageHeader,
  type IconName,
  type Tint,
} from "@/components/ui";
import {
  MATERIAL_FILTER_TYPES,
  materialActionLabel,
  materialMetadataLabel,
  materialTypeLabel,
  type MaterialFilterType,
  type MaterialListItem,
  type MaterialType,
  type MaterialsFilters,
} from "@/modules/materials";
import { SubscriptionSuspendedNotice } from "@/modules/billing/ui/suspension-notice";
import { loadCurrentSubscriptionAccess } from "@/server/billing/subscription-access";
import { loadMaterialsPage } from "@/server/materials/materials";

import { setMaterialFavoriteAction } from "./actions";

interface MaterialsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const typeVisual: Record<MaterialType, { icon: IconName; tint: Tint; tag: string }> = {
  PDF: { icon: "file", tint: "red", tag: "error" },
  SUMMARY: { icon: "file", tint: "lilac", tag: "neutral" },
  VOCABULARY: { icon: "book", tint: "blue", tag: "info" },
  GRAMMAR: { icon: "grad", tint: "lilac", tag: "neutral" },
  AUDIO: { icon: "headphones", tint: "yellow", tag: "warning" },
  WORKSHEET: { icon: "pen", tint: "green", tag: "success" },
  ANSWER_KEY: { icon: "check-c", tint: "pink", tag: "pink" },
};

const filterIcon: Record<MaterialFilterType, IconName> = {
  ALL: "grid",
  ...Object.fromEntries(Object.entries(typeVisual).map(([type, visual]) => [type, visual.icon])),
} as Record<MaterialFilterType, IconName>;

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

function searchResultLabel(count: number): string {
  return `${count} ${count === 1 ? "resultado" : "resultados"} na busca atual.`;
}

function FavoriteButton({ material }: { material: MaterialListItem }) {
  return (
    <form action={setMaterialFavoriteAction}>
      <input type="hidden" name="materialId" value={material.id} />
      <input type="hidden" name="favorited" value={material.favorite ? "false" : "true"} />
      <IconButton
        type="submit"
        className="yas-materials-favorite"
        label={material.favorite ? `Desfavoritar ${material.title}` : `Favoritar ${material.title}`}
        aria-pressed={material.favorite}
      >
        <Icon name="star" size={20} />
      </IconButton>
    </form>
  );
}

function MaterialRow({ material }: { material: MaterialListItem }) {
  const visual = typeVisual[material.materialType];
  return (
    <li className="yas-materials-row">
      <IconBadge icon={visual.icon} tone={visual.tint} shape="square" />
      <span className="yas-materials-row-copy">
        <strong>{material.title}</strong>
        <small>
          {material.lesson
            ? `Aula ${material.lesson.position} · ${material.lesson.title}`
            : material.module
              ? `Módulo ${material.module.position}`
              : "Material geral"}
        </small>
      </span>
      <span className="yas-materials-row-meta">
        <Badge tone={visual.tag as "neutral"}>{materialMetadataLabel(material)}</Badge>
      </span>
      <a
        className="yas-button yas-button--soft yas-button--sm"
        href={`/materiais/${material.id}/abrir`}
        target="_blank"
        rel="noopener noreferrer"
      >
        {materialActionLabel(material.materialType)} →
      </a>
      <FavoriteButton material={material} />
    </li>
  );
}

function FavoriteRow({ material }: { material: MaterialListItem }) {
  const visual = typeVisual[material.materialType];
  return (
    <li>
      <IconBadge icon={visual.icon} tone={visual.tint} shape="square" />
      <a
        className="yas-list-text yas-materials-favorite-link"
        href={`/materiais/${material.id}/abrir`}
        target="_blank"
        rel="noopener noreferrer"
      >
        <strong>{material.title}</strong>
        <small>{materialMetadataLabel(material)}</small>
      </a>
      <FavoriteButton material={material} />
    </li>
  );
}

export default async function MaterialsPage({ searchParams }: MaterialsPageProps) {
  const params = await searchParams;
  const access = await loadCurrentSubscriptionAccess();
  if (access.kind === "suspended") {
    return (
      <div className="yas-materials-page">
        <PageHeader
          title="Materiais"
          description="Encontre, revise e abra os recursos do seu curso."
        />
        <SubscriptionSuspendedNotice access={access} context="materials" />
      </div>
    );
  }
  const state = await loadMaterialsPage({
    query: firstValue(params.q),
    type: firstValue(params.type),
  });

  if (state.status === "unauthorized") {
    return (
      <div className="yas-materials-page">
        <PageHeader
          title="Materiais"
          description="Encontre, revise e abra os recursos do seu curso."
        />
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
        <PageHeader
          title="Materiais"
          description="Encontre, revise e abra os recursos do seu curso."
          tagline
        />
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
        actions={<Badge icon="file">{totalAuthorized} disponíveis</Badge>}
      />

      <div className="yas-materials-toolbar">
        <form className="yas-materials-search-row" role="search" method="get">
          <div className="yas-materials-search">
            <Icon name="search" size={18} />
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
            <Link className="yas-button yas-button--ghost" href="/materiais">
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
                className="yas-tab"
                aria-current={selected ? "page" : undefined}
              >
                <Icon name={filterIcon[type]} size={18} />
                {type === "ALL" ? "Todos" : materialTypeLabel(type)}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="yas-materials-layout">
        <section className="yas-materials-library" aria-labelledby="materiais-curso-title">
          <div className="yas-materials-section-heading">
            <h2 id="materiais-curso-title">Materiais do curso</h2>
            <p>
              {filtering
                ? searchResultLabel(materials.length)
                : "Organizados pelo módulo e pela aula da sua trilha."}
            </p>
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
                  open={index === 0 || filtering || group.items.some((item) => item.favorite)}
                >
                  <summary>
                    <Icon name="right" size={18} className="yas-materials-chevron" />
                    <span className="yas-materials-group-number" aria-hidden="true">
                      {index + 1}
                    </span>
                    <span className="yas-materials-group-title">{group.title}</span>
                    <small>
                      {group.items.length} {group.items.length === 1 ? "material" : "materiais"}
                    </small>
                  </summary>
                  <ul className="yas-materials-group-list">
                    {group.items.map((material) => (
                      <MaterialRow key={material.id} material={material} />
                    ))}
                  </ul>
                </details>
              ))}
            </div>
          )}
        </section>

        <aside className="yas-materials-side" aria-labelledby="materiais-favoritos-title">
          <Card>
            <div className="yas-card-header">
              <h2 className="yas-card-title" id="materiais-favoritos-title">
                <Icon name="star" size={18} />
                Favoritos
              </h2>
            </div>
            {favorites.length === 0 ? (
              <p className="yas-materials-side-empty">
                Toque na estrela de um material para guardá-lo aqui e revisar depois.
              </p>
            ) : (
              <ul className="yas-list yas-materials-favorites-list">
                {favorites.map((material) => (
                  <FavoriteRow key={material.id} material={material} />
                ))}
              </ul>
            )}
          </Card>
        </aside>
      </div>
    </div>
  );
}
