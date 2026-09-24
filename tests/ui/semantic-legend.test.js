import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createBoardScenario, playDomino } from "../fixtures/board-scenarios.js";
import { projectGraphView, projectPortView } from "../../src/js/game/index.js";
import { createGraphScene } from "../../src/js/ui/GraphScene.js";
import { createPortScene } from "../../src/js/ui/PortScene.js";
import { renderPortSvgMarkup } from "../../src/js/ui/PortRenderer.js";
import { renderGraphSvgMarkup } from "../../src/js/ui/GraphRenderer.js";

const read = (file) => readFile(new URL(`../../${file}`, import.meta.url), "utf8");
const [html, main, css, ports, graph] = await Promise.all([
  read("index.html"), read("src/js/main.js"), read("src/css/components.css"),
  read("src/js/ui/PortRenderer.js"), read("src/js/ui/GraphRenderer.js"),
]);

test("Estrategia es el nombre público; ports sigue siendo el identificador interno", () => {
  assert.doesNotMatch(html, /Puertos/);
  assert.match(html, /data-view-mode="ports"[^>]*>Estrategia</);
  assert.match(html, /value="ports"[\s\S]*?<span>Estrategia<\/span>/);
  assert.match(ports, /<title id="port-title">Vista Estrategia<\/title>/);
});

test("Estrategia y Grafo comparten una única leyenda fuera de los renderers", () => {
  assert.equal((html.match(/id="board-semantic-legend"/g) ?? []).length, 1);
  const legend = html.match(/<aside id="board-semantic-legend"[\s\S]*?<\/aside>/)?.[0];
  assert.match(legend, /class="is-playable"><b[^>]*>↗<\/b> conexiones/);
  assert.match(legend, /class="is-scoring"><b[^>]*>×<\/b> suma/);
  assert.match(legend, /class="is-history"><b[^>]*>▣<\/b> salieron/);
  assert.match(main, /semanticLegend\.hidden = mode === BOARD_VIEW_MODES\.TRADITIONAL/);
  assert.doesNotMatch(ports + graph, /semantic-legend/);
  const rules = css.match(/\.board-semantic-legend \{[^}]+\}/)?.[0];
  assert.match(rules, /flex-wrap: wrap/);
  assert.match(rules, /font-size: 0\.75rem/);
  assert.doesNotMatch(rules, /position: absolute|transform:|opacity:/);
  assert.match(css, /\.board-semantic-legend\[hidden\] \{ display: none; \}/);
});

test("la leyenda ocupa una fila dentro de la altura existente, sin provocar scroll por cambio de vista", async () => {
  const boardCss = await read("src/css/board.css");
  assert.match(html, /class="board-frame"[\s\S]*?id="board-root"[\s\S]*?id="board-semantic-legend"/);
  assert.match(boardCss, /\.board-frame \{[^}]*grid-template-rows: minmax\(0, 1fr\) auto;[^}]*height: clamp/);
  assert.match(boardCss, /\.graph-root \{[^}]*height: 100%;[^}]*min-height: 0;/);
});

test("R2 conserva ↗ 2 y ×0 explícitos en Estrategia y Grafo, sin inferir aporte de conexiones", () => {
  let state = playDomino(createBoardScenario({ firstDominoId: "5-5" }), "5-5");
  state = playDomino(state, "1-5", target => target.placementId === "placement-1");
  state = playDomino(state, "2-5", target => target.placementId === "placement-1");
  const portScene = createPortScene(projectPortView(state));
  const graphScene = createGraphScene(projectGraphView(state));
  const five = portScene.nodes.find(node => node.value === 5);
  assert.equal(five.openTargetCount, 2);
  assert.equal(five.scoringMultiplicity, 0);
  for (const markup of [renderPortSvgMarkup(portScene), renderGraphSvgMarkup(graphScene)]) {
    assert.match(markup, /data-(?:node|vertex)-value="5"[^>]*data-open-target-count="2"[^>]*data-scoring-multiplicity="0"/);
    assert.match(markup, />↗ 2<\/text>/);
    assert.match(markup, />×0<\/text>/);
  }
});
