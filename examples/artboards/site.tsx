// Artboards — the website, designed with artboards. The header image opens it,
// then one page per feature.
//   artboards dev examples/artboards/site.tsx
//   artboards build examples/artboards/site.tsx
// Every export below is one artboard, in canvas order.
import { ReadmeHeader } from "./header.tsx";

/** The header image, as the first page. */
export function Hero() {
  return <ReadmeHeader />;
}

export { DesignInCode, Lint, Inspect, Variants, Play, Review, Agents, GetStarted } from "./pages.tsx";
