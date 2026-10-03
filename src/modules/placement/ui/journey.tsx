import { Badge, Card } from "@/components/ui";
import { placementLabels, placementStates, type PlacementView } from "../domain/models";
export function Journey({ view }: { view: PlacementView }) {
  const index = placementStates.indexOf(view.case.state);
  return (
    <Card className="yas-stack">
      <Badge tone={view.case.state === "ENROLLED" ? "success" : "info"}>
        {placementLabels[view.case.state]}
      </Badge>
      <ol aria-label="Etapas da sua entrada" className="yas-stack">
        <li>Pagamento confirmado ✓</li>
        <li>
          {index >= 3
            ? "Teste concluído ✓"
            : index === 2
              ? "Teste em andamento"
              : "Teste aguardando início"}
        </li>
        <li>
          {index >= 4
            ? "Avaliação concluída ✓"
            : index === 3
              ? "Avaliação em andamento"
              : "Avaliação aguardando teste"}
        </li>
        <li>
          {index === 6
            ? "Matrícula concluída ✓"
            : index >= 4
              ? "Turma aguardando sua escolha"
              : "Turma aguardando recomendação"}
        </li>
      </ol>
    </Card>
  );
}
