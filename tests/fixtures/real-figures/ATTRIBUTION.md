# Third-party figures used as test inputs

These three figures were drawn by other people and published on Wikimedia Commons. Soma's
team did not draw them. They are used, unaltered in content, as inputs to a small live check
of whether Soma reads diagrams it was not designed around (`tests/providers/real-figures-live.test.ts`).

| File here | Source | Author | License | Changes |
| --- | --- | --- | --- | --- |
| `commons-directed-shortest-path.png` | [Shortest path with direct weights.svg](https://commons.wikimedia.org/wiki/File:Shortest_path_with_direct_weights.svg) | Artyom Kalinin | [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/) | Wikimedia's 1280 px PNG render, placed on a white background |
| `commons-wikipedia-dijkstra.png` | [Dijkstra Animation.gif](https://commons.wikimedia.org/wiki/File:Dijkstra_Animation.gif) | Ibmua | Public domain | First frame of the animation, on white, enlarged 4× |
| `commons-kirchhoff-symbolic.png` | [Kirchhoff-example-circuit.svg](https://commons.wikimedia.org/wiki/File:Kirchhoff-example-circuit.svg) | MikeRun | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) | Wikimedia's 1280 px PNG render, placed on a white background |

The two CC BY-SA files here are adaptations and are shared under the same licenses as their
sources. The answer keys in `cases.json` were read from the figures by hand. The circuit
figure prints no values, so the intended outcome is that Soma does not solve it.
